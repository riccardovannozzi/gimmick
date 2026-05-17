# Flow System — Specifica architetturale

## Concetto

Un **Flow** è un DAG di micro-azioni (Flow node) dentro una Tile. Serve a tracciare scambi e solleciti con soggetti esterni quando una Tile è di tipo "task con feedback continui" (es. preventivi, sollecitare ditte, attese di risposta).

Filosofia: i Flow node sono **sotto-struttura interna di una Tile**, come gli Spark, ma con funzione complementare:
- **Spark** = cosa ho catturato/registrato (memoria, contenuto)
- **Flow node** = a che punto siamo nello scambio (stato, processo, pianificazione)

I Flow node **non emergono mai** nel Panopticon o nel Find globale. Vivono dentro la Tile e si vedono in tre superfici dedicate (FlowTrack, FlowInspector, FlowHub).

## Modello dati

### `contacts`
Entità a sé. Riusabile in tutto Gimmick ma per ora solo dai Flow node.

| Campo | Tipo | Note |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK auth.users | cascade delete |
| `name` | TEXT NOT NULL | |
| `kind` | TEXT | `person` \| `company` \| `professional` \| `institution` \| `other` |
| `phone, email, notes` | TEXT nullable | |
| `color, avatar_url` | TEXT nullable | |
| `archived_at` | TIMESTAMPTZ nullable | soft delete |
| `created_at, updated_at` | TIMESTAMPTZ | trigger updated_at |

### `flow_nodes`
Nodi del DAG. Un nodo appartiene a una sola Tile.

| Campo | Tipo | Note |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK auth.users | cascade delete |
| `tile_id` | UUID FK tiles | cascade delete |
| `label` | TEXT NOT NULL DEFAULT '' | "Mandato preventivo", "Risollecitato"... |
| `state` | TEXT NOT NULL DEFAULT 'mine' | enum: `mine` \| `theirs` \| `done` \| `blocked` \| `cancelled` |
| `contact_id` | UUID FK contacts | nullable, SET NULL on delete |
| `occurred_at` | TIMESTAMPTZ nullable | quando è accaduto |
| `scheduled_at` | TIMESTAMPTZ nullable | quando deve accadere |
| `notes` | TEXT nullable | testo libero per la sidebar |
| `created_at, updated_at` | TIMESTAMPTZ | trigger updated_at |

**Semantica dei timestamp** (ortogonali, possono coesistere):
- Solo `occurred_at` → evento passato, già accaduto
- Solo `scheduled_at` → evento futuro, ancora da accadere
- Entrambi → l'evento era programmato e poi è accaduto (eventualmente in ritardo)
- Nessuno dei due → bozza di nodo appena creato

### `flow_edges`
Edge del DAG. Cicli vietati (controllo applicativo prima dell'insert).

| Campo | Tipo | Note |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK | |
| `tile_id` | UUID FK | denormalizzato per query veloci |
| `parent_id, child_id` | UUID FK flow_nodes | cascade delete |
| `created_at` | TIMESTAMPTZ | |

Constraints: `parent_id <> child_id` (no self-loop), unique `(parent_id, child_id)`.

### View `flow_node_activity`
Vista derivata centralizzata per le query "last activity" e "is leaf":

```sql
last_activity_at = COALESCE(occurred_at, scheduled_at, updated_at)
is_open          = state IN ('mine', 'theirs')
is_leaf          = NOT EXISTS edge with parent_id = this node
```

## Regole derivate (runtime, non salvate)

### Spessore edge nel FlowTrack
```
Δt_seconds = (
  COALESCE(child.occurred_at, NOW())
  - COALESCE(parent.occurred_at, parent.scheduled_at, parent.created_at)
).total_seconds()

stroke_width = clamp(
  1 + log10(max(Δt_seconds / 3600, 1)) * 2.5,
  min=1, max=12
)
```
- Edge in arrivo a un nodo `done` → calcolato una volta, non cambia più.
- Edge in arrivo a un nodo `mine`/`theirs` aperto → ricalcolato a ogni render, **cresce nel tempo**. È il segnale visivo principale di stallo.

### Beat "fermo" (stalled)
Un Flow node è "fermo" se:
- `is_leaf = TRUE`
- `is_open = TRUE`
- `NOW() - last_activity_at > soglia` (default 7 giorni, configurabile per utente in futuro)

### Tile "ha flow aperti"
Esiste almeno un `flow_node` con `is_leaf=TRUE AND is_open=TRUE` per quel `tile_id`. Diventa un badge sul Tile nel Canvas/Panopticon (futuro).

## Validazione applicativa edge — no cicli

Prima di inserire un edge `(parent_id, child_id)`:
1. Verifica che `parent_id` e `child_id` appartengano alla stessa `tile_id`.
2. BFS/DFS partendo da `child_id` seguendo gli edge esistenti. Se raggiungi `parent_id`, l'edge creerebbe un ciclo → rifiuta con 400.
3. Verifica unicità `(parent_id, child_id)` (DB lo garantisce già).

Implementare come funzione helper backend: `assertEdgeAcyclic(tileId, parentId, childId)`.

## API backend — endpoint

Base: `/api/flows` per i nodi, `/api/contacts` per i contatti.

### Contacts
- `GET    /api/contacts` — lista non archiviati (query `?archived=true` per archiviati)
- `POST   /api/contacts` — body: `{name, kind?, phone?, email?, notes?, color?}`
- `PATCH  /api/contacts/:id` — body parziale
- `DELETE /api/contacts/:id` — hard delete (libera `contact_id` su flow_nodes via SET NULL)
- `POST   /api/contacts/:id/archive` — soft delete (setta `archived_at`)

### Flow nodes
- `GET    /api/tiles/:tileId/flow` — restituisce `{nodes: FlowNode[], edges: FlowEdge[]}` per il FlowTrack
- `POST   /api/tiles/:tileId/flow/nodes` — body: `{label?, state?, contact_id?, occurred_at?, scheduled_at?, notes?, parent_node_id?}` — se `parent_node_id` è presente, crea anche l'edge in transazione
- `PATCH  /api/flow/nodes/:id` — body parziale; campi modificabili: label, state, contact_id, occurred_at, scheduled_at, notes
- `DELETE /api/flow/nodes/:id` — cascade rimuove anche gli edge in/out

### Flow edges
- `POST   /api/flow/edges` — body: `{parent_id, child_id}` — valida `tile_id` coincidente + assertEdgeAcyclic
- `DELETE /api/flow/edges/:id`

### FlowHub (vista globale)
- `GET /api/flows/hub?filter=mine|theirs|due_soon|stalled|blocked&days=7`
  Restituisce lista di Flow node arricchita con `tile {id, title}` e `contact {id, name}` per la pagina FlowHub.

## Tipi TypeScript (condivisi backend/frontend)

```ts
// types/flow.ts

export type FlowNodeState = 'mine' | 'theirs' | 'done' | 'blocked' | 'cancelled';

export type ContactKind = 'person' | 'company' | 'professional' | 'institution' | 'other';

export interface Contact {
  id: string;
  user_id: string;
  name: string;
  kind: ContactKind;
  phone: string | null;
  email: string | null;
  notes: string | null;
  color: string | null;
  avatar_url: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FlowNode {
  id: string;
  user_id: string;
  tile_id: string;
  label: string;
  state: FlowNodeState;
  contact_id: string | null;
  occurred_at: string | null;
  scheduled_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FlowEdge {
  id: string;
  user_id: string;
  tile_id: string;
  parent_id: string;
  child_id: string;
  created_at: string;
}

export interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface FlowHubItem extends FlowNode {
  tile: { id: string; title: string };
  contact: { id: string; name: string; color: string | null } | null;
  last_activity_at: string;
  is_leaf: boolean;
  is_open: boolean;
  days_since_activity: number;
}
```

## Frontend — superfici

### FlowTrack (pannello in basso)
- Drawer ancorato in basso, altezza ~40vh, resizable verticalmente.
- Si apre quando l'utente clicca una Tile nel Canvas o nell'indice.
- Header: titolo della Tile + bottoni (`+ Aggiungi nodo`, `Espandi a full`, `Chiudi`).
- Body: DAG orizzontale (layout left-to-right) renderizzato in SVG.
  - Nodi: cerchi di raggio 22px, colorati per stato.
  - Label sotto il cerchio (timestamp + label + contatto).
  - Edge: linee curve quando ramificano, dritte quando lineari. Spessore calcolato come da regola.
  - Click su un nodo → selezione (highlight) + apertura `FlowInspector`.
- Layout: Dagre o algoritmo simile (left-to-right, separazione 110px orizzontale, 100px verticale tra rami).

### FlowInspector (sidebar destra dentro FlowTrack)
- Pannello che scivola da destra dentro l'area del FlowTrack quando un nodo è selezionato (largo 320px).
- Campi editabili (autosave al blur):
  - `label` (textarea breve)
  - `state` (segmented control: mine/theirs/done/blocked/cancelled)
  - `contact_id` (combobox con ricerca su `contacts`, "+ Nuovo contatto" inline)
  - `occurred_at` (datetime picker, opzionale)
  - `scheduled_at` (datetime picker, opzionale)
  - `notes` (textarea libera)
- Azioni: `Aggiungi figlio`, `Aggiungi predecessore`, `Duplica`, `Elimina`.

### FlowHub (route `/flows`)
Nuova pagina principale, raggiungibile da topbar.

Tab/filtri predefiniti in cima:
- 🔵 **Palla mia** — `state='mine' AND is_leaf=TRUE`
- 🟡 **In attesa di loro** — `state='theirs' AND is_leaf=TRUE`
- ⏰ **In scadenza** — `scheduled_at BETWEEN NOW() AND NOW() + 48h`
- 🐌 **Fermi** — `is_open AND is_leaf AND last_activity_at < NOW() - 7d`
- 🔴 **Bloccati** — `state='blocked'`

Sotto, lista di righe (una per Flow node) con:
- Stato (pallino colorato)
- Label del nodo
- Titolo della Tile padre (clickable → apre la Tile e il FlowTrack focalizzato sul nodo)
- Contatto (chip)
- Tempo dall'ultima attività ("ferma da 14g")

## Colori degli stati

Dalla palette Airtable già adottata:

| Stato | Hex | Famiglia |
|---|---|---|
| `mine` | `#378ADD` | blueBright |
| `theirs` | `#EF9F27` | orangeBright |
| `done` | `#1D9E75` | tealBright |
| `blocked` | `#E24B4A` | redBright |
| `cancelled` | `#888780` | grayDark1 |

I colori devono essere definiti come costanti in `lib/flow-colors.ts` per coerenza tra FlowTrack, FlowHub e Inspector.

## Cosa NON tocchiamo in questa iterazione

- Spark, Tag, Tile, Canvas, Panopticon, Chrono restano invariati.
- I Flow node non emergono nel Find globale.
- I contatti non sono Tag e non sono Tile.
- Niente recurring/ripetizioni dei Flow node (eventualmente futuro).
- Niente template di Flow predefiniti (eventualmente futuro).
- Niente notifiche push su `scheduled_at` (eventualmente futuro).

## Roadmap incrementale (per Claude Code)

**Fase 1 — Foundation**
1. Migration `022_flows.sql`
2. Tipi TS condivisi in `frontend/types/flow.ts` e `backend/src/types/flow.ts`
3. Costanti colori in `frontend/lib/flow-colors.ts`

**Fase 2 — Backend**
4. Route `backend/src/routes/contacts.ts`
5. Route `backend/src/routes/flow.ts` (nodes + edges + hub)
6. Helper `assertEdgeAcyclic` in `backend/src/services/flow-validation.ts`

**Fase 3 — Frontend hooks**
7. Hook `useFlow(tileId)` con react-query (GET/POST/PATCH/DELETE nodi e edge)
8. Hook `useContacts()` con react-query
9. Hook `useFlowHub(filter)` per la vista globale

**Fase 4 — UI FlowTrack**
10. Componente `<FlowTrack tileId>` (drawer in basso, layout SVG, Dagre per posizionamento)
11. Componente `<FlowNode>` (cerchio + label sotto + click handler)
12. Componente `<FlowEdge>` (path SVG con spessore calcolato)
13. Integrazione in Canvas: click su Tile apre il FlowTrack

**Fase 5 — FlowInspector**
14. Componente `<FlowInspector node>` (sidebar destra dentro FlowTrack)
15. Sotto-componente `<ContactCombobox>` con creazione inline

**Fase 6 — FlowHub**
16. Pagina `/flows` con tab di filtri
17. Componente `<FlowHubRow>` per ogni riga
18. Link bidirezionale: dalla riga, deep-link al Tile + nodo selezionato

**Fase 7 — Polish**
19. Empty states ("nessun flow per questa Tile, crea il primo nodo")
20. Animazioni di transizione FlowTrack (slide-up)
21. Aggiornamento CLAUDE.md con sezione "Flow system"
