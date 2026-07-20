# Piano di migrazione Obsidian — Prompt 8

> Stato: **bozza per revisione** · Generato il 2026-06-27 · Nessun file di produzione modificato.
> Riferimenti: [README.md](README.md) (strategia strangler), [PROMPTS.md](PROMPTS.md) (Prompt 8), `TOKENS.md`.

---

## 0. Sintesi esecutiva

Il design system Obsidian (web **e** mobile) è completo a livello *visivo* ma:

- È consumato **solo da route di anteprima/QA** (`/obsidian-*`), mai dalla produzione.
- I **componenti vista** (`components/views/*`) sono **mockup con dati hardcoded**: nessun `useQuery`, nessuna `useMutation`, nessun handler reale. Le **primitive e lo shell** invece sono già data-driven via props (puliti, nessuna dipendenza da `pixel-theme`).
- Tutta la produzione (11 route dashboard + 5 auth, + intera app mobile) usa ancora l'arcade `pixel-theme`/`components/pixel`.

Il Prompt 8 ("sostituisci gli import una rotta alla volta, poi cancella l'arcade") **non è eseguibile così com'è**: presuppone parità funzionale inesistente. Manca lo step centrale: **collegare i componenti Obsidian ai dati e alle interazioni reali**. Questo piano inserisce quello step.

### Insight architetturale chiave — due classi di vista

| Classe | Viste | Stato componente Obsidian | Strategia |
|--------|-------|---------------------------|-----------|
| **A. Liste/tabelle** | Tiles, Sparks, Flows, Kanban, colonne Notes/Todo | Mockup ma struttura sana, basta estendere props/callback | **Wire**: passare dati reali + callback, estendere con pickers inline |
| **B. Canvas interattivi** | Canvas (D3), Graph/Panopticon (D3), Calendario (FullCalendar) | Mockup **decorativi** (PRNG/SVG statici), zero interattività | **Restyle, non sostituire**: tenere i componenti funzionanti esistenti (`CanvasBoard`, graph SVG, FullCalendar) e riverniciarli con i token `--ob-*` |

Tentare di rimpiazzare la classe B con i mockup Obsidian significherebbe **reimplementare da zero** D3 physics, editing relazioni, drag-drop calendario: settimane di lavoro ad alto rischio. La scelta corretta è restyling token-based.

---

## 1. Principi della migrazione

1. **Strangler, una rotta alla volta** — nuovo accanto al vecchio, swap atomico per route, verifica, poi avanti.
2. **Web prima, mobile dopo** — sono due design system distinti (`components/*` web vs `mobile/components/obsidian/*`); track separati.
3. **Nessuna cancellazione finché esistono consumer** — l'arcade si rimuove solo a migrazione completa (Fase finale).
4. **Coesistenza dei provider** — `PixelThemeProvider` e il tema Obsidian convivono durante la transizione.
5. **Ogni PR è verde** — ogni route migrata builda, passa lint/type-check e supera la checklist trasversale (§7) prima del merge.
6. **Single tag per tile** — rispettare il vincolo già attivo (selezione esclusiva, vedi memory) quando si ricabla il TagDropdown/Inspector.

---

## 2. Architettura target dello shell

Oggi (produzione): `(dashboard)/layout.tsx` → `<Sidebar/>` (arcade) + `<main>{children}</main>` + `<ChatPanel/>`.

Target Obsidian (da `obsidian-shell/page.tsx`):

```
AppShell (mode, activeView, onViewChange)
├── Header        (view tabs, Ask, Bell, Settings, Avatar)
├── Sidebar       (groups = tag/cartelle reali, activeChildId, onSelectChild)
├── ViewContainer (toolbar + meta + children = la vista attiva)
└── Inspector     (dettaglio tile = sostituisce TileSidebar)
```

Decisione di routing: l'`AppShell` usa `activeView` interno + `onViewChange`. Due opzioni:

- **(Raccomandata) Mantenere il routing Next.js per-URL**: ogni `(dashboard)/<route>/page.tsx` resta una pagina, ma rende `<ViewContainer>` con la propria vista; lo shell (Header/Sidebar/Inspector) si monta una volta in `layout.tsx`. `onViewChange` fa `router.push`. Mantiene deep-link, back/forward, `?tile=`/`?flow=` query già usate da Flows/Canvas.
- (Alternativa) SPA a vista singola con stato interno — romperebbe i deep-link esistenti. **Scartata.**

---

## 3. Fase 0 — Fondamenta (sbloccante, nessuna route ancora migrata)

Obiettivo: poter montare lo shell Obsidian con dati reali, senza toccare le viste.

1. **Theme provider Obsidian** — verificare come `lib/theme/obsidian.ts` espone i token (`obsidianCssVars()`, `data-theme`). Creare/confermare un provider che imposta `data-theme` light/dark e inietta le CSS vars a livello root, **accanto** a `PixelThemeProvider` in `app/providers.tsx`.
2. **Settings di tema** — collegare lo switch light/dark a un valore persistito (riusare il pattern `settingsApi` già usato per `onboarding_v1`/pixel settings). Definire la chiave (es. `obsidian_theme_v1`).
3. **Adapter dati per la Sidebar** — `shell/Sidebar` vuole `groups: SidebarGroup[]` (id, name, icon, color, children, pinned, defaultOpen). Scrivere un adapter `tags → SidebarGroup[]` da `useQuery(['tags'])` (gerarchia per tag-type/prefisso come in `obsidian-shell` demo: GDS_/OM_ ecc.). `activeChildId` ↔ `useTagFilterStore`.
4. **Inspector ↔ TileSidebar** — l'`Inspector` Obsidian è presentazionale (InspectorSection/Field/TagPill/Caps). Decidere: (a) avvolgere il `TileSidebar` esistente dentro `Inspector`, oppure (b) ricostruire i campi con le primitive Obsidian collegate alle mutation di `tilesApi`. Raccomandazione: **(a) in Fase 0** (riuso immediato), **(b) come refinement** dopo che le viste sono migrate.
5. **Header** — collegare callback: `onAsk` → apre Ask/ChatPanel, `onBell` → NotificationCenter (`useTileNotificationStore`), `onSettings` → `/settings`, `onAvatar` → menu utente (`useAuthStore`), view tabs → `router.push`. `userInitials` da `useAuthStore`.
6. **Mount in `layout.tsx`** dietro a un flag/feature-toggle, in modo da poter alternare vecchio shell ↔ AppShell durante la transizione.

Deliverable Fase 0: AppShell montato con Sidebar (tag reali), Header (azioni reali), Inspector (TileSidebar avvolto), `children` ancora = vecchie pagine. Da qui ogni route si migra dentro lo shell.

---

## 4. Fasi 1–N — Migrazione route per route

Ordine consigliato: **dal più semplice/isolato al più complesso**, per validare presto il pattern.

Legenda per ogni route: *Componente Obsidian* · *Dati reali (oggi)* · *Gap da colmare* · *Lavoro*.

### Fase 1 — Sparks (`/sparks`) — pilota raccomandato
- **Componente**: `views/sparks.tsx` `SparksView({ sparks, onDelete })`.
- **Dati reali**: `useQuery(['sparks', {page, type}])`, `sparksApi`, `useFilterStore` (filtro AI), `SparkViewer` modal.
- **Gap**: mappare `Spark → SparkItem` (id, name, type, date, dim, ai). Collegare: chip-filtro tipo → param `type` della query; sort → ordinamento query/lista; `onDelete` → `deleteMutation`; click riga → apertura `SparkViewer`; paginazione (50/pagina) → la view oggi non ha paginazione, **aggiungere** (footer/scroll). Banner filtro AI da `useFilterStore`.
- **Lavoro**: basso-medio. È la vista più vicina a drop-in. **Validare qui l'intero pattern** (adapter dati, callback, inspector, light/dark).

### Fase 2 — Flows (`/flows`)
- **Componente**: `views/flows.tsx` `FlowsView({ lanes })`.
- **Dati reali**: `useFlowHub(filter)`, read-only; 4 tab stato (done/wait/undo/stop), sort (days/tag/contact), deep-link `?tile=&flow=`, `TileSidebar`.
- **Gap**: mappare flow nodes → `FlowLane[]`/`Flow[]`; tab stato → filtro `useFlowHub`; sort → ordinamento; click card → `router.push('/canvas?tile=…&flow=…')` + apertura Inspector. Nessuna mutation (più semplice).
- **Lavoro**: basso-medio (read-only).

### Fase 3 — Tiles (`/tiles`)
- **Componente**: `views/tiles.tsx` `TilesView({ rows, count, total, onAddTile })`.
- **Dati reali**: `useInfiniteQuery(['tiles'])`, `tagsApi`, `statuses`, store: typeIcons/statuses/actionColors/tileNotification/flowOpen.
- **Gap (significativo)**: la `TilesView` Obsidian ha **solo** `onAddTile` e righe statiche; mancano gli **editor inline** che la pagina reale ha (action-type picker con data/ora, status picker, type-icon picker, tag dropdown single-tag, SparkChip preview, multi-select + bulk delete/group, search/filter/sort toolbar, infinite scroll). **Estendere** `TilesView` con render-props/callback per: `onRowClick`, `onEditAction`, `onEditStatus`, `onEditType`, `onEditTag`, `onToggleSelect`, `onBulkDelete`, slot toolbar. Mappare `Tile → TileRow` (+ campi extra).
- **Lavoro**: alto. È il banco di prova degli editor inline; molti pattern qui si riusano in Kanban.

### Fase 4 — Kanban (`/kanban`)
- **Componente**: `views/kanban.tsx` `KanbanView({ lanes })`.
- **Dati reali**: `useQuery(['kanban-columns'])` (colonne create dall'utente con filtri/sort/width/bg), `tiles`, `tags`, `statuses`; drag tra colonne applica i filtri colonna come update; CRUD colonne; pickers inline.
- **Gap (significativo)**: la `KanbanView` Obsidian ha lane **statiche per stato** con solo filtro tag locale. La realtà è lane = colonne dinamiche con filtri compositi, drag-drop (`tileMutation`), CRUD colonne. **Estendere**: rendere `lanes` derivate dalle colonne reali, aggiungere drag-drop (riusare la lib già in uso nella pagina), callback CRUD/inline (riuso dagli editor di Fase 3).
- **Lavoro**: alto.

### Fase 5 — Calendar/Chrono (`/calendar`)
- **Componenti**: colonne Notes/Todo → `views/chrono.tsx` `ChronoView({ notes, todos })`; calendario → **NON** la parte statica di ChronoView.
- **Dati reali**: `calendarApi`, `tilesApi`, `tagsApi`; `useQuery(['calendar-events'])`, `['tiles-unscheduled']`, `['tiles-calendar']`; FullCalendar week/month, drag-drop, reschedule, modal create/edit; action-type picker, TimePicker, TileSidebar.
- **Gap (alto)**: ChronoView ha calendario **decorativo** (EVENTS/ALLDAY hardcoded, mascotte fissa, nav non collegata). **Strategia ibrida**: collegare le **colonne Notes/Todo** ai dati reali (`action_type` none/anytime) come liste Obsidian; **tenere FullCalendar** per la griglia e **riverniciarlo** con token `--ob-*` (classe B). Collegare drag tra colonne/calendario alle mutation esistenti (`moveTileMutation`, `scheduleMutation`).
- **Lavoro**: alto.

### Fase 6 — Settings (`/settings`)
- **Componente**: `views/settings.tsx` `SettingsView` (stato locale, nessuna persistenza).
- **Dati reali**: `authApi`, `settingsApi`; modali Actions/Statuses/TypeIcons/CardRoster; DangerZone (delete account).
- **Gap**: collegare i toggle a `settingsApi` (persistenza), montare i modali esistenti (o ricostruirli con primitive Obsidian + `Modal`/`Sheet`), DangerZone → `authApi.deleteAccount`. Sostituire `PixelArcadeModal` con il pannello tema Obsidian (Aspetto). Riusare `views/modals.tsx` IconPicker/ColorPicker dove serve.
- **Lavoro**: medio.

### Fase 7 — Ask / Chat
- **Componente**: `views/ask.tsx` `AskView` (thread hardcoded) + `states/*` per toast.
- **Dati reali**: `chatApi` (text/voice/tts), `ChatPanel` esistente, `useChatStore`.
- **Gap**: collegare composer → `chatApi`, streaming/tool-use loop, suggerimenti → azioni reali, render risultati tile. Decidere se Ask diventa una vista a sé o resta pannello laterale (`onAsk` dell'Header).
- **Lavoro**: medio.

### Fase 8 — Canvas (`/canvas`) — RESTYLE, non sostituire
- **Componente reale**: `CanvasBoard` (D3/SVG, physics, drag, edges, boxes, groups), `CanvasTopbar`, `StagingPanel`, `TileSidebar`/`MultiTileSidebar`.
- **Gap**: `views/canvas.tsx` Obsidian è SVG **statico decorativo** → **non usarlo come sostituto funzionale**. Invece: montare il `CanvasBoard` esistente dentro `ViewContainer`, sostituire `usePixelTheme` con token `--ob-*` in `CanvasBoard`/`CanvasTopbar`/`StagingPanel`, riverniciare toolbar (da `pixelToolbarBtn` a `Button`/`IconButton` Obsidian).
- **Lavoro**: medio (restyle), basso rischio funzionale.

### Fase 9 — Graph/Panopticon (`/graph`) — RESTYLE, non sostituire
- **Componente reale**: pagina graph D3 (force sim, modi navigate/edit, filtri tipo/data, editing relazioni, context menu, console physics).
- **Gap**: `views/panopticon.tsx` è grafo **PRNG decorativo** → non funzionale. Stessa strategia di Fase 8: tenere il D3 reale, restyle token + toolbar Obsidian.
- **Lavoro**: medio (restyle).

### Fase 10 — Auth (5 route) + Welcome
- **Route**: `(auth)/{login,register,forgot-password,reset-password,verify-email}`, `auth/callback`, `(dashboard)/welcome`.
- **Gap**: usano solo `usePixelTheme` per styling. Ricostruire con primitive Obsidian (`Button`, `Field`, `Card`) + token. Welcome wizard: 4 step con `MascotSprite` → usare `Beniamino`/`MascotSuggestion` Obsidian.
- **Lavoro**: basso-medio (poca logica, molto styling).

### Componenti condivisi da migrare lungo il percorso
Man mano che le route li usano, riverniciare/ricostruire con Obsidian (oggi usano `usePixelTheme`): `layout/header.tsx`, `layout/sidebar.tsx`, `chat/chat-panel.tsx`, `spark/spark-viewer.tsx`, `tileview/{TileSidebar,MultiTileSidebar,SubtaskList}.tsx`, `tags/tag-manager-modal.tsx`, `tiles/tile-detail-modal.tsx`, `actions/*`, `statuses/*`, `type-icons/*`, `flow/*`, `markdown/*`, `cards/*`, `ui/time-picker.tsx`, `canvas/*`. (Elenco completo: 34 componenti condivisi + 11 pagine dashboard + 5 auth = **55 consumer frontend**.)

---

## 5. Track mobile (separato, dopo o in parallelo al web)

- **Design system pronto**: `mobile/components/obsidian/*` (AppHeader, Drawer, TopNav, NavPill, StatusBar, Mascot, `screens/*`) + `mobile/lib/obsidian.tsx` + `mobile/constants/obsidian.ts`. Consumato solo dalle 8 route QA `mobile/app/obsidian-*.tsx`.
- **Stessa natura mockup**: gli `screens/*` Obsidian sono ricostruzioni visive; vanno collegati a `lib/api`, store (`bufferStore`, `authStore`, `settingsStore`), hooks (`useVoiceRecorder`).
- **Superficie da migrare**: ~30 file mobile usano `pixel-theme`/`components/pixel` (tabs, capture/*, tile/*, edit/*, componenti capture/chat/ui). Provider in `mobile/app/_layout.tsx`.
- **Ordine**: tabs (index/chrono/flows/history/settings) → capture flows → tile/edit → auth. Poi rimozione `mobile/constants/pixel-theme.ts` + `mobile/components/pixel/`.
- **Lavoro**: alto (volume simile al web). Trattare come progetto a sé dopo il web, salvo richiesta diversa.

---

## 6. Fase finale — Pulizia arcade (vero Prompt 8)

**Precondizione**: 0 import residui di `pixel-*`/`components/pixel` (verificare con grep prima di ogni delete).

Ordine di cancellazione (dependency-safe):

**Frontend**
1. Rimuovere `PixelThemeProvider`/`PixelSettingsServerSync` da `app/providers.tsx`.
2. Rimuovere `import './pixel.css'` da `app/layout.tsx`; ripulire classi arcade (CRT/scanline/`--font-pixel-*`) da `globals.css`.
3. Eliminare `components/pixel/` (3 file: index, PixelArcadeModal, PixelSettingsPanel).
4. Eliminare `lib/pixel-toolbar.ts`, `lib/pixel-theme.ts`, `app/pixel.css`.

**Mobile**
5. Rimuovere `PixelThemeProvider` da `mobile/app/_layout.tsx`.
6. Eliminare `mobile/components/pixel/`, `mobile/constants/pixel-theme.ts`.

**Route QA di anteprima (solo a UI definitiva)**
7. Frontend: `app/obsidian-preview/`, `obsidian-shell/`, `obsidian-screens/`, `obsidian-states/` + i relativi `obsidian-*.css` **non più referenziati** (attenzione: alcuni `obsidian-*.css` potrebbero diventare CSS di produzione — verificare gli import in `layout.tsx`/componenti prima di cancellarli).
8. Mobile: 8 file `mobile/app/obsidian-*.tsx`.

**Archivio**
9. `handoff/` e `design_handoff_obsidian/*.dc.html`: spostare in archivio/docs (riferimento storico), non necessari a runtime.

> ⚠️ Nota CSS: i file `frontend/app/obsidian-*.css` si dividono in **due gruppi** — quelli di *anteprima* (eliminabili) e quelli che diventano **stili di produzione** del design system (da tenere). Distinguere via `import` prima di cancellare; non cancellare in blocco.

---

## 7. Verifiche trasversali (per ogni route, da Prompt 8)

- [ ] **Light + Dark**: ogni componente legge i token dal tema attivo; nessun colore hardcoded fuori da `--ob-*`.
- [ ] **Contrasto AA**: testo/sfondo ≥ 4.5:1 (≥ 3:1 per testo grande/icone). Verificare specie su accent-soft e tinte tile.
- [ ] **Hit target ≥ 44px** su mobile per ogni elemento interattivo.
- [ ] **Transizioni** 120–180ms ease-out; niente scanline/animazioni decorative residue.
- [ ] **Build + type-check + lint** verdi.
- [ ] **Parità funzionale**: tutte le query/mutation/store della route precedente funzionano (checklist per-route dalle §4).
- [ ] **Deep-link** preservati (`?tile=`, `?flow=`, week/month, paginazione).
- [ ] **Single-tag per tile** rispettato dove si tocca il tagging.

---

## 8. Ordine, rischi, stima relativa

| # | Lavoro | Effort | Rischio | Tipo |
|---|--------|--------|---------|------|
| 0 | Fondamenta shell/provider/adapter | M | Medio | Sblocca tutto |
| 1 | Sparks (pilota) | S/M | Basso | Wire |
| 2 | Flows | S/M | Basso | Wire (read-only) |
| 3 | Tiles | L | Medio | Wire + editor inline |
| 4 | Kanban | L | Medio | Wire + drag-drop |
| 5 | Calendar | L | Alto | Wire + restyle FullCalendar |
| 6 | Settings | M | Basso | Wire + modali |
| 7 | Ask/Chat | M | Medio | Wire chat |
| 8 | Canvas | M | Basso | **Restyle** D3 |
| 9 | Graph | M | Basso | **Restyle** D3 |
| 10 | Auth + Welcome | S/M | Basso | Restyle |
| — | Mobile (intero) | L+ | Medio | Track separato |
| F | Pulizia arcade | S | Basso | Delete |

**Rischi principali**
- Sottostima della classe B (Canvas/Graph/Calendar): mitigato dalla scelta *restyle anziché sostituire*.
- Gli editor inline di Tiles/Kanban non esistono nei mockup Obsidian → vanno progettati (estensione props) una volta sola e riusati.
- CSS `obsidian-*.css`: ambiguità anteprima vs produzione → verificare gli import prima di qualsiasi delete.
- Doppio provider durante la transizione: tenere sotto controllo z-index/CSS vars in conflitto.

---

## 9. Prossimo passo proposto

Eseguire **Fase 0 + Fase 1 (Sparks)** come slice verticale end-to-end: dimostra adapter dati, shell montato, una vista reale, light/dark e checklist AA/44px. Da lì il pattern si replica sulle altre route.
