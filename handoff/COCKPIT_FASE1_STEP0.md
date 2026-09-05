# Cockpit · Fase 0 — Ricognizione

Esito della fase di sola lettura del `PROTOCOLLO_cockpit_fase1.md`.
Nessun file esistente è stato modificato. Creati soltanto i due output previsti:
questo documento e `scripts/cockpit_recon.sql`.

**Data:** 4 settembre 2026 · **Ramo:** `dev`

---

## 0.1 — Verifica delle premesse

Tutte e cinque reggono. Una (la 3) regge con una precisazione che conviene
leggere, perché il protocollo la cita come se fosse scritta dove non è.

### 1. `tile_subtasks` ha le sette colonne — ✅ CONFERMATA

| Colonna | Dove nasce |
|---|---|
| `is_done` | `backend/src/migrations/005_tile_subtasks.sql:10` |
| `sort_order` | `005_tile_subtasks.sql:11` |
| `created_at` | `005_tile_subtasks.sql:12` |
| `updated_at` | `005_tile_subtasks.sql:13` (+ trigger, riga 41) |
| `contact_id` | `037_flow_action_type.sql:43` — `REFERENCES contacts(id) ON DELETE SET NULL` |
| `occurred_at` | `038_subtask_step_fields.sql:62` |
| `state` | `038_subtask_step_fields.sql:65` — `CHECK (state IS NULL OR state IN ('blocked','cancelled'))` |

Riscontro indipendente sul codice: `backend/src/routes/subtasks.ts:23` le
seleziona tutte e sette per nome.

### 2. `contacts.is_self`, al massimo uno per utente — ✅ CONFERMATA

- Colonna: `027_self_contact_replaces_owner.sql:22`.
- Unicità garantita dal **database**, non dall'applicazione: indice unico
  parziale `contacts_one_self_per_user` (`027:26`), che conta solo le righe con
  `is_self = true`.
- Difesa anche al bordo: `backend/src/routes/contacts.ts:74` documenta che
  `is_self` non si accetta mai dalla richiesta, e la INSERT lo forza a `false`
  (`contacts.ts:87`). L'unico che lo mette a `true` è il signup
  (`routes/auth.ts:125`).

### 3. `contact_id IS NULL` significa "default-mine" — ⚠️ CONFERMATA, ma non dove il protocollo dice

La semantica **è** dichiarata nella 027, alla riga 7:

> *«square if contact.is_self (or contact_id IS NULL — default-mine semantics),
> circle otherwise»*

ma quella frase parla di **`flow_nodes.contact_id`**, non di
`tile_subtasks.contact_id`, che nel momento in cui la 027 fu scritta non
esisteva ancora: arriva dieci migration dopo, con la 037.

La 037 non ripete la regola. Dice solo *«Soggetto del passo: chi ha la palla»*
(`037:47`). Il ponte fra le due tabelle è nel commento di
`frontend/lib/tile-visual.ts:161`: *«"Di chi è la palla" oggi non è uno stato:
si deriva da `contacts.is_self` attraverso `contact_id`»*.

**Perché non mi fermo:** la premessa è vera nella sostanza — nessun punto del
codice legge `contact_id` nullo come "di qualcun altro", e la 027 è l'unico
posto dove la regola sia mai stata scritta. È vera nella provenienza: la
dichiarazione riguarda la tabella sorella, e i `tile_subtasks` l'hanno
ereditata per convenzione, mai per iscritto.

**Conseguenza operativa per la Fase 4:** il commento di `subtaskBall()` è il
posto dove questa eredità va finalmente messa nero su bianco per la tabella
giusta. Oggi non lo è da nessuna parte.

### 4. L'ultima migration è la 048 — ✅ CONFERMATA

`backend/src/migrations/` contiene 49 file, da `001` a `048`
(la 002 è doppia: `002_tags.sql` e `002_rename_sparks_and_calendar.sql`).
Ultima in ordine: `048_canvas_box_organization.sql`. La 049 è libera.

### 5. Non esiste già una funzione per "passo corrente" o "stallo" — ✅ CONFERMATA

- **Passo corrente:** nessuna, su dati veri. Le uniche tre occorrenze di
  `find(s => !s.done)` stanno in `frontend/app/obsidian-flow-preview/page.tsx`
  (righe 100, 338, 363), che è una rotta di sola progettazione su un tipo finto
  — vedi il censimento, gruppo D.
- **Stallo:** nessuna. Nessun punto del codice calcola un'anzianità su
  `tile_subtasks` o su `tiles`. `idleDays` nella pagina di anteprima è un
  numero scritto a mano nei dati di prova.
- **Precedente nel database, però:** la vista `flow_node_activity` (creata in
  `027:53-71`) calcola
  `last_activity_at = COALESCE(occurred_at, scheduled_at, updated_at)`.
  Include `updated_at` — esattamente ciò che la Fase 4 vieta. La vista esiste
  ancora sul database e **non è letta da nessuna riga di codice**: nessun
  conflitto pratico, ma è il precedente da non imitare, e il commento chiesto
  dalla Fase 4 ha qui la sua ragione concreta.

---

## 0.2 — Censimento della logica duplicata

Diciannove punti, in sette gruppi. La colonna **Sorte** anticipa cosa dovrà
succedergli in Fase 4; è una proposta, non una decisione presa.

*Erano quindici in sei gruppi. Il ciclo del Notaio (giro 1) ha aggiunto **A5**
(voce CRITICO) e il **gruppo G** (voce ALTA), che il censimento aveva perso.*

### Gruppo A — `state` + `is_done` → stato del passo

| # | Punto | Espressione | Concorda? | Sorte |
|---|---|---|---|---|
| A1 | `frontend/lib/tile-visual.ts:151` `subtaskToStep` | `s.state ?? (s.is_done ? 'done' : 'pending')` | originale web | **resta** |
| A2 | `mobile/lib/tile-visual.ts:154` `subtaskToStep` | tre `if` espliciti | equivalente, forma diversa | resta (copia di piattaforma) |
| A3 | `backend/src/routes/subtasks.ts:117-121` | `blocked o cancelled ⇒ is_done=false`; `is_done=true ⇒ state=null` | concorda | resta (è scrittura, non lettura) |
| A4 | `frontend/components/tileview/SubtaskList.tsx:194,199` | stessa invariante, in ottimistico | concorda con A3 | resta |
| **A5** | `mobile/app/tile/[id]/list.tsx:272-273,279,301-302` | legge **solo** `is_done`; la parola `state` non compare nel file | **DIVERGE** | → *Decisione aperta n. 5* |

Cinque chiamanti di A1 (`CanvasBoard.tsx:2534`, `StagingPanel.tsx:292`,
`chrono-live.tsx:114`, `kanban-live.tsx:199`) e uno di A2
(`mobile/lib/obsidian-adapters.ts:226`).

⚠️ **A5 è una correzione, aggiunta dal ciclo del Notaio (giro 1, voce CRITICO).**
Questo paragrafo diceva che il gruppo A era già stato consolidato una volta e
aveva tenuto. **Non è vero**, e la frase è ritirata.

Esiste un secondo schermo mobile che disegna le stesse righe di `tile_subtasks`
senza passare da `subtaskToStep` e senza leggere `state`. Per una riga
`cancelled` — quindi con `is_done = false`, garantito dall'invariante A3 — i
due schermi mobili mostrano cose diverse: `mobile/components/obsidian/SubtaskList.tsx:140`
la dà spenta e barrata (`spent = is_done || state === 'cancelled'`),
`mobile/app/tile/[id]/list.tsx:301-302` la dà come una voce aperta normale.
Due copie che **divergono già oggi**, non che divergeranno.

E non è codice morto. Lo schermo Obsidian compare solo se
`isObsidianShellEnabled()` (`mobile/lib/feature-flags.ts:10-13`, che legge
`EXPO_PUBLIC_OBSIDIAN_SHELL`); il profilo EAS `development` non imposta quella
variabile (`mobile/eas.json:7-16`) e `mobile/.env.example:9` la lascia vuota,
mentre `preview` e `production` la forzano a `"1"`. Lo sviluppo locale col dev
client — il percorso più battuto — cade quindi di default sullo schermo legacy,
che si raggiunge da `mobile/app/tile/[id].tsx:429,455` (swipe a sinistra e
pulsante «lista»).

Resta vero, e vale la pena tenerlo: A1 esiste perché quattro viste ne avevano
ciascuna una copia, e il segmento rosso non si accendeva in nessuna. Il
consolidamento ha funzionato **dove è arrivato**. A5 dice che non è arrivato
dappertutto — il che è un argomento a favore della Fase 4, non contro.

### Gruppo B — proiezione compatta ordinata per `sort_order`

| # | Punto | Concorda? |
|---|---|---|
| B1 | `backend/src/routes/tiles.ts:163-166` | — |
| B2 | `backend/src/routes/tags.ts:507-510` | identica a B1 |
| B3 | `frontend/components/tileview/SubtaskList.tsx:69-73` | identica a B1 |

Tutte e tre: `.sort((a,b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))` seguito
da `.map(s => ({ is_done: !!s.is_done, state: s.state ?? null }))`.

⚠️ **Il difetto che la Fase 4 nomina è qui, ed è reale.** Quell'ordinamento
**non è totale**: a parità di `sort_order` l'esito dipende dall'ordine in cui il
database ha restituito le righe. Oggi non si vede perché nessuno chiede "il
primo": si disegna una barra, e due segmenti scambiati fra loro sono
invisibili. Nel momento in cui `currentStep()` sceglierà **una** riga, lo stesso
tile potrà mostrare passi diversi a due caricamenti identici. Il criterio
`created_at` poi `id` chiesto dalla Fase 4 chiude esattamente questo.

### Gruppo C — conteggio «X di Y»

| # | Punto | Espressione | Concorda? |
|---|---|---|---|
| C1 | `frontend/components/canvas/CanvasBoard.tsx:2513` | `items.filter(s => s.is_done).length` | — |
| C2 | `frontend/components/canvas/StagingPanel.tsx:297` | idem | uguale a C1 |
| C3 | `frontend/components/views/kanban-live.tsx:82` | idem | uguale a C1 |
| C4 | `mobile/components/obsidian/screens/TileScreen.tsx:467` | idem | uguale a C1 |
| C5 | `mobile/lib/obsidian-adapters.ts:226-228` | `steps.filter(s => s === 'done').length`, **dopo** `subtaskToStep` | **DIVERGE nella forma** |

C5 conta lo stato derivato, gli altri quattro il booleano grezzo. Oggi danno lo
stesso numero **solo grazie all'invariante A3**, che impedisce
`is_done = true` insieme a uno `state`. Su una riga scritta prima di
quell'invariante i due conteggi si separano.

⚠️ **Tutti e cinque contano i `cancelled` nel denominatore.** Un flow con due
passi annullati su cinque dice «3 di 5» quando i passi che restano sono tre. La
Fase 4 stabilisce che *«i `cancelled` non contano mai»*: se quella regola vale,
questi cinque punti la contraddicono. **Non li tocco**: allineare il
denominatore è un cambiamento di comportamento visibile su ogni card di ogni
vista, e la Fase 4 chiede espressamente di elencare le divergenze, non di
sanarle di iniziativa propria. → *Decisione aperta n. 1.*

### Gruppo D — primo aperto, palla, stallo (prototipo)

| # | Punto | Espressione |
|---|---|---|
| D1 | `frontend/app/obsidian-flow-preview/page.tsx:100,363` | `steps.find(s => !s.done)` |
| D2 | `page.tsx:338` | `steps.find(s => !s.done)?.who ? 'waiting' : 'mine'` |
| D3 | `page.tsx:337,365` | `idleDays >= IDLE_THRESHOLD` (14) |

Sono le tre funzioni della Fase 4 già scritte — ma su `Step = { label, done,
who? }`, un tipo **finto**. La rotta `/obsidian-flow-preview` non legge dati,
non chiama il backend e si cancella senza conseguenze (lo dichiara la sua
intestazione, righe 5-7).

**Non sono chiamanti da riportare.** Vanno letti come la specifica di
riferimento del disegno — e vale la pena notare che D2 usa la stessa polarità
scelta per `subtaskBall`: assenza di `who` significa "mio". La soglia di stallo
è già stata scelta una volta: **14 giorni**.

### Gruppo E — `contact_id` → responsabilità

**Nessun punto.** Zero.

Nessun file, in nessuna delle tre piattaforme, legge `tile_subtasks.contact_id`
per decidere di chi sia la palla. La colonna compare solo in firme che la fanno
transitare: `routes/subtasks.ts:23,91`, `frontend/lib/api.ts:338`,
`mobile/lib/api.ts:758`, e il tipo `Partial<Pick<…>>` in `SubtaskList.tsx:96`.
Nessun chiamante gliela passa.

### Gruppo F — anzianità e ritardo

**Nessun punto** nel codice. L'unico precedente è la vista
`flow_node_activity` descritta in 0.1 §5.

### Gruppo G — «questa riga è spenta»

*Aggiunto dal ciclo del Notaio (giro 1, voce ALTA): mancava del tutto.*

| # | Punto | Espressione | Concorda? |
|---|---|---|---|
| G1 | `frontend/components/tileview/SubtaskList.tsx:377` | `subtask.is_done || subtask.state === 'cancelled'` → colore | — |
| G2 | `frontend/components/tileview/SubtaskList.tsx:385` | identica, per `textDecoration` | uguale a G1 |
| G3 | `mobile/components/obsidian/SubtaskList.tsx:140` | `const spent = subtask.is_done || subtask.state === 'cancelled'` | uguale a G1 |

È una regola **distinta** da quella del gruppo A, e il censimento l'aveva persa
perché cercava `subtaskToStep` e le sue varianti: questa non passa di lì.
Dice una cosa che `subtaskToStep` non dice — *un passo annullato si legge come
uno fatto, un passo bloccato no* — e G3 la motiva in un commento
(`SubtaskList.tsx:137-139`): in entrambi i casi non c'è più niente da farci,
mentre un passo fermo resta a piena voce perché è quello che devi ancora
sbloccare.

Le tre copie oggi concordano su ogni input. La più fragile è la coppia
G1/G2: **stesso file, dieci righe di distanza**. Una correzione che tocchi il
colore e dimentichi la sottolineatura non la vede nessuno finché non capita
sotto gli occhi la riga giusta.

---

## Cose che contraddicono il piano, o che il piano non prevede

Cinque. Nessuna rende falsa una premessa, quindi il protocollo prosegue; tutte
e cinque cambiano come vanno letti i numeri della Fase 2 o cosa costerà una
fase successiva.

### N1 — `is_theirs` nascerà senza nessuno che possa scriverlo

`frontend/components/tileview/SubtaskList.tsx:19-32` documenta una scelta
deliberata: i passi di un flow **hanno avuto** tre controlli in più — contatto,
data, stato — e sono stati **tolti**, perché *«una voce di checklist con tre
chip sotto non è più una voce di checklist»*. È rientrato il solo `state`, come
lucchetto nella barra di azioni, e per una ragione precisa: il segmento rosso
della barra di avanzamento non aveva sorgente.

Verificato: **nessuna interfaccia scrive `contact_id` o `occurred_at` su un
subtask.** Le API li accettano su tutte e tre le piattaforme; nessun chiamante
li passa.

Quindi, il giorno dopo la 049: `is_theirs` sarà `FALSE` su tutte le righe,
nessun comando potrà cambiarlo, e `subtaskBall()` restituirà `'mine'` per
tutto. Questo **non è un difetto della Fase 3**, che costruisce fondamenta ed è
in portata; è un fatto da sapere prima di guardare i numeri della Fase 2.

### N2 — la Query 6 misurerà l'assenza di interfaccia, non il modello

Discende da N1. La Fase 2 dice: *«molti passi `blocked` senza contatto significa
che il modello a due zone non basta»*. Ma `contact_id` non è mai stato
scrivibile dall'interfaccia, e `state` lo è solo dal lucchetto — introdotto di
recente e su un comando solo.

Se la Query 6 dicesse "tutti i `blocked` sono senza contatto", la lettura
onesta sarebbe *«nessuno ha mai potuto assegnare un contatto a un passo»*, non
*«il modello a due zone non basta»*. Per aiutare a distinguere i due casi, la
sezione 6 dello script conta **quattro** righe invece di una: i `blocked` con e
senza contatto, e gli aperti non-`blocked` con e senza. Se la colonna
"con un contatto" è zero su entrambe le righe, il numero non dice niente sul
modello.

### N3 — la palla potrebbe essere finita dentro il testo

Sempre `SubtaskList.tsx:23-28`: al momento della migrazione dei beat, ciò che
contatto e data dicevano *«è stato ripiegato nel testo»* —
«Attesa risposta — Alessandro Bisdomini · 03/06/26» — e la ragione data è
solida: è l'unico modo perché due attese sulla stessa cosa ma su persone
diverse restino due righe distinguibili.

Se è andata così, l'informazione su chi ha la palla è in `content`, dove
`subtaskBall()` non la vedrà mai. Lo stesso commento assicura che le colonne
*«conservano il valore originale»*: la ricognizione lo dirà (sezione 6, righe
"con un contatto"). È il primo numero da guardare.

### N4 — `backend/src/lib/` non esiste

Il backend ha `config/`, `middleware/`, `migrations/`, `observability/`,
`routes/`, `scripts/`, `services/`, `types/`, `utils/`. La Fase 4 chiede
`backend/src/lib/cockpitDerive.ts`, che sarebbe una **terza** cartella per
codice condiviso accanto a `utils/` e `services/`.

Segnalo e non decido: se `cockpitDerive` è pura logica senza I/O, `utils/` è la
casa che il progetto ha già. La Fase 4 nomina però un percorso esplicito, e
cambiarlo di iniziativa mia sarebbe allargare la portata al contrario.
→ *Decisione aperta n. 2.*

### N5 — il backend non ha un test runner

`backend/package.json` non ha script `test`, e fra le devDependencies non c'è
né vitest né jest. `find backend/src -name "*.test.ts"` non trova nulla: non
esiste un solo test nel backend.

La Fase 5 chiede `backend/src/lib/__tests__/cockpitDerive.test.ts` e che *«i
test devono passare»*. Come è scritta oggi, quella fase comprende quindi
**anche l'introduzione di un modo di eseguirli**: o una dipendenza nuova
(vitest), o `node:test` eseguito con il `tsx` già presente, che non aggiunge
niente al `package.json` se non uno script.

Non è fuori portata — la Fase 5 chiede test e i test vanno eseguiti — ma è un
lavoro che il protocollo non nomina, e il terzo commit della Fase 6
(`test(lib): copertura di cockpitDerive`) toccherebbe `package.json`.
→ *Decisione aperta n. 3.*

---

## 0.3 — Query di ricognizione

Creato `scripts/cockpit_recon.sql`. **Non eseguito**, come da protocollo.

Tre scelte che vanno dichiarate, perché non erano nel testo della fase.

**Una sola query invece di sei.** L'editor SQL di Supabase mostra il risultato
dell'*ultima* istruzione: sei SELECT in fila darebbero un risultato e cinque
schermate perse. Le sei ricognizioni sono unite in un elenco unico a tre
colonne — sezione · voce · valore — così una Run sola le mostra tutte. Il
prezzo è che ogni valore è testo: è un tabellone da leggere, non un dato su cui
fare altri conti.

**Una settima query, la 3b.** `tags.tag_type` è TEXT libero con default
`'topic'` (`routes/tags.ts:18,71`): non c'è nessun vincolo che garantisca
l'esistenza di `'progetto'`, che è una **convenzione**. Se la sezione 3 dicesse
"nessuno" su tutta la riga, senza la 3b si concluderebbe che l'ancora non
regge, quando la causa potrebbe essere che quel tipo di tag si chiama
diversamente. La 3b elenca i `tag_type` che esistono davvero, con quanti tag
ciascuno.

**Nessun filtro per utente.** Sul database c'è un utente solo, e un id cablato
sarebbe una bugia il giorno in cui non sarà più vero. Ogni CTE porta comunque
`user_id`, a portata di `WHERE`.

⚠️ **Lo script non è stato eseguito e quindi non è provato che compili.** Il
protocollo lo vieta e non ho una connessione al database. Se Postgres si
lamenta, i due punti da guardare per primi sono le due `ROW_NUMBER() OVER
(ORDER BY …)` delle sezioni 2 e 3b — le uniche espressioni non banali — e il
`GROUP BY 2, 4` posizionale della sezione 5.

---

## Riepilogo

| | |
|---|---|
| Premesse verificate | 5 su 5 (la n. 3 con la precisazione di provenienza) |
| Punti censiti | **19, in 7 gruppi** (15 in Fase 0, +4 dal giro 1 del Notaio) |
| Di cui da riportare in Fase 4 | **0 per `subtaskBall`**, 0 per `stalenessFrom`, 3 per `currentStep` — e nessuno dei tre su dati veri |
| Di cui **fuori portata** per questo protocollo | **16** — ogni punto che vive in `frontend/` o `mobile/`: A1, A2, A4, A5, B3, gruppo C (5), gruppo D (3), gruppo G (3). In portata restano i soli **A3, B1, B2**, i tre punti nel backend |
| Contraddizioni segnalate | 5 (N1–N5) |
| Decisioni aperte | 5 |
| File esistenti modificati | 0 |
| File creati | `scripts/cockpit_recon.sql`, questo documento, `handoff/COCKPIT_FASE1_STATO.md` |

**Il numero che sorprende è il terzo.** Il censimento doveva dire *quanti punti
dovranno essere riportati alla funzione unica, prima di scriverla*: la risposta
è quasi nessuno. `subtaskBall` e `stalenessFrom` non hanno un solo chiamante
oggi, e `currentStep` ne ha tre su una pagina di prova che non legge dati.

`cockpitDerive.ts` non sarà un consolidamento di logica sparsa: sarà **logica
nuova**, scritta prima del suo primo lettore. Il che è legittimo — è quello che
"fondamenta" significa — ma cambia cosa può accertare il Notaio in Fase 4: non
potrà verificare che i punti censiti chiamino l'originale, perché i punti
censiti sono altrove. Potrà solo verificare che non ne nascano di nuovi.

Il vero lavoro di consolidamento che il censimento ha trovato è un altro, e sta
nel **gruppo C**: cinque punti che contano i `cancelled` fra i passi di un
flow, in contraddizione con la regola che la Fase 4 sta per scrivere. Il giro 1
del Notaio ne ha aggiunti altri quattro, e uno — **A5** — non è un rischio
futuro ma una divergenza in atto.

⚠️ **E qui c'è il nodo: nessuno di questi nove — i cinque di C, i tre di G, e A5
— è riparabile dentro questo protocollo.** La PORTATA esclude in modo assoluto *«qualsiasi componente, vista
o file in `frontend/` e `mobile/`»*, e i gruppi C, G e il punto A5 vivono tutti
lì. Il censimento può registrarli — ed è il motivo per cui esiste — ma la
riparazione è un progetto a sé, da aprire dopo.

Il che ridefinisce onestamente cosa sono le fasi 3-5: **non toccano una riga di
quel che il censimento ha trovato.** Costruiscono la colonna vertebrale
(`is_theirs`, `cockpitDerive`, i test) accanto a un corpo che continuerà a
sbagliare i conteggi finché non arriverà un secondo intervento. È una scelta
legittima — le fondamenta si gettano prima — purché non la si scambi per una
bonifica.
