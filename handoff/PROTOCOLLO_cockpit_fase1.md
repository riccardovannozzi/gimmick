# PROTOCOLLO — Cockpit Fase 1

Documento auto-guidato. Non si esegue tutto in una volta: si esegue **una fase
per turno**, e lo stato di avanzamento vive su disco, non in questa
conversazione.

---

## REGOLA DI INGAGGIO — leggi questa prima di ogni altra cosa

Ogni volta che ricevi l'istruzione di lavorare su questo protocollo:

1. Leggi `handoff/COCKPIT_FASE1_STATO.md`. Se non esiste, crealo con il modello
   riportato in fondo a questo documento e la fase corrente impostata a `0`.
2. Individua la **fase corrente** e il suo **esito**.
3. Esegui **soltanto quella fase**. Non leggere in avanti per anticipare, non
   iniziare la fase successiva, non "portarti avanti" perché il passo dopo
   sembra ovvio.
4. Aggiorna lo stato: fase eseguita, esito, file toccati, data.
5. **Fermati e riferisci.** Attendi che l'utente dica esplicitamente di
   proseguire.

Il fatto che tu possa leggere tutte le fasi in questo file non ti autorizza a
eseguirle. Il documento è unico per comodità dell'utente, non per darti il
permesso di correre. Se ti accorgi di aver superato un gate senza conferma,
**dichiaralo subito** invece di continuare.

Se l'utente scrive semplicemente "prosegui", significa: avanza di **una** fase.

---

## PORTATA

Solo dati e logica di derivazione. Nessun endpoint nuovo, nessuna vista, nessun
componente. La UI del Cockpit è un progetto successivo e non si tocca qui.

Fuori portata in modo assoluto, per tutte le fasi:

- `GET /api/cockpit` — richiede prima l'hardening RLS
- qualsiasi componente, vista o file in `frontend/` e `mobile/`
- migrazione di `flow_nodes` verso i subtask
- cambio di semantica di `contact_id`
- aggiunta di `waiting_for` fra gli status del tile

Se una fase sembra richiedere una di queste cose, **fermati e chiedi**: significa
che il piano è sbagliato, non che la portata va allargata.

---

## FASE 0 — Ricognizione in sola lettura

**Non modificare nessun file esistente in questa fase.** Puoi solo creare i due
file di output indicati.

### 0.1 Verifica delle premesse

Conferma o smentisci ciascuna, citando file e riga:

1. `tile_subtasks` ha `is_done`, `sort_order`, `state`, `occurred_at`,
   `contact_id`, `created_at`, `updated_at`.
2. `contacts` ha `is_self`, e c'è al massimo un contatto self per utente.
3. `contact_id IS NULL` su un subtask significa oggi "default-mine"
   (semantica dichiarata nella migration 027).
4. L'ultima migration presente è la 048.
5. Non esiste già una funzione che calcoli "passo corrente" o "stallo".

Se una risulta falsa, **fermati**. Il resto del protocollo le presuppone vere.

### 0.2 Censimento della logica duplicata

Cerca ovunque nel repo — `backend/`, `frontend/`, `mobile/` — i punti in cui si
deriva lo stato di un subtask o di un flow dai campi grezzi:

- espressioni che combinano `is_done` e `state`
- selezioni del "primo aperto" per `sort_order`
- letture di `contact_id` per decidere di chi è la responsabilità
- calcoli di anzianità o ritardo su subtask o tile

Per ognuno: file, riga, espressione, e se concorda o diverge dagli altri.

Questo censimento è il motivo principale della fase. Serve a sapere quanti punti
dovranno essere riportati alla funzione unica, **prima** di scriverla.

### 0.3 Query di ricognizione

Crea `scripts/cockpit_recon.sql`. **Non eseguirlo**: lo lancerà l'utente.

1. Quanti tile hanno almeno un subtask non `done` e non `cancelled`.
2. Distribuzione dei tile candidati per `action_type` e per `status`.
3. Quanti tile candidati hanno esattamente un tag `progetto`, quanti zero,
   quanti più di uno.
4. Lunghezza massima e media del `name` dei tag `progetto`.
5. Anzianità dei subtask aperti in fasce (0–2 giorni, 3–6, 7–20, oltre 20),
   calcolata su `NOW() - COALESCE(occurred_at, created_at)`.
6. Quanti subtask aperti hanno `state = 'blocked'` con `contact_id IS NULL`.

### 0.4 Output

`handoff/COCKPIT_FASE1_STEP0.md` con l'esito di 0.1, la tabella di 0.2, e una
nota su qualunque cosa contraddica il piano.

**GATE 0 → aggiorna lo stato, fermati.**

---

## FASE 1 — Ciclo del Notaio sul censimento

Lancia l'agente `notaio` sul censimento della fase 0.

Correggi **solo** le voci CRITICO e ALTA. MEDIA e BASSA non si toccano: vanno
nel backlog Miglioramento come tile `anytime`. Correggerle ora allarga il diff e
rende i commit non isolati, che è il difetto che l'impianto serve a evitare.

Rilancia il Notaio dopo ogni tornata di correzioni.

**Massimo tre iterazioni.** Se al terzo giro restano CRITICO o ALTA, non fare un
quarto giro: fermati e riferisci. Un ciclo che non converge in tre passate
significa quasi sempre una di queste tre cose, e nessuna si risolve correggendo
ancora:

- l'agente produce falsi positivi su un pattern legittimo → va corretta la
  definizione dell'agente, non il codice
- due punti divergono e la scelta non è deducibile dal codice → decide l'utente
- il disegno è sbagliato → se la regola richiede eccezioni in più punti, forse
  non è una regola sola

**GATE 1 → aggiorna lo stato, fermati.**

---

## FASE 2 — Punto di decisione umano

**Non c'è lavoro da eseguire in questa fase.** Serve a impedire che il protocollo
prosegua prima che l'utente abbia guardato i dati veri.

Riferisci all'utente questo, e fermati:

> Esegui `scripts/cockpit_recon.sql` nell'editor SQL di Supabase. Tre numeri
> decidono se il disegno del Cockpit regge:
>
> - **Query 6** — molti passi `blocked` senza contatto significa che il modello
>   a due zone non basta.
> - **Query 3** — molti tile candidati senza tag `progetto` significa che la
>   colonna àncora sarà piena di trattini.
> - **Query 5** — dice se le attese sono undici o tre. Se sono tre, il layout a
>   tre colonne è sbagliato.

Se uno di questi numeri contraddice il disegno, il protocollo **si sospende**:
la revisione va fatta prima della migration, non dopo.

Riprendi solo su conferma esplicita dell'utente che i numeri reggono.

**GATE 2 → aggiorna lo stato, fermati.**

---

## FASE 3 — Migrazione 049

File: `backend/src/migrations/049_subtask_ball.sql`

```sql
-- Migration 049: la palla del passo
--
-- La 027 ha stabilito che contact_id IS NULL significa "default-mine". Restava
-- scoperto il caso opposto: un passo in mano ad altri senza voler dire a chi.
-- Marcarlo su contact_id ribalterebbe la semantica di tutte le righe esistenti,
-- quindi la marcatura vive su una colonna propria.
--
-- Polarità: FALSE è il valore muto e maggioritario, come `state IS NULL` e come
-- `action_type = 'none'`. Si tocca solo l'eccezione.
--
-- contact_id resta sopra come raffinamento opzionale: se un giorno si vorrà dire
-- CHI, si dirà, e la regola di lettura non cambia.

ALTER TABLE tile_subtasks
  ADD COLUMN IF NOT EXISTS is_theirs BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_tile_subtasks_theirs
  ON tile_subtasks (tile_id)
  WHERE is_theirs = TRUE;

COMMENT ON COLUMN tile_subtasks.is_theirs IS
  'Marcatura di eccezione: il passo attende una mossa altrui. FALSE = tocca a me (default muto). Un contact_id non-self implica comunque "altri": la regola di lettura sta in subtaskBall().';
```

Aggiorna la documentazione dello schema dove elenca le colonne di
`tile_subtasks`. Non toccare altro.

Poi lancia l'agente `doganiere` sul diff: verifica che la 049 non tocchi le RLS
di `tile_subtasks` e che nessuna query nuova sia priva del filtro `user_id`.
Stesso ciclo della Fase 1, stesso tetto di tre iterazioni.

La migration **non va eseguita** dall'esecutore: la lancia l'utente su Supabase.

**GATE 3 → aggiorna lo stato, fermati.**

---

## FASE 4 — La derivazione, in un posto solo

Crea `backend/src/lib/cockpitDerive.ts`. Tre funzioni pure, nessun accesso al
database.

**`currentStep(subtasks)`** — il primo subtask per `sort_order` crescente con
`is_done = false` e `state IS NULL OR state = 'blocked'`. I `cancelled` non
contano mai. `null` se non ce n'è nessuno.

A parità di `sort_order`, ordina per `created_at` e poi per `id`: l'ordinamento
deve essere totale e deterministico, altrimenti il Cockpit cambia contenuto fra
due caricamenti identici.

**`subtaskBall(subtask, selfContactId)`**

```
'theirs'  se  is_theirs === true
'theirs'  se  contact_id != null && contact_id !== selfContactId
'mine'    altrimenti
```

L'ordine dei rami è vincolante e va commentato: `is_theirs` è la marcatura
esplicita dell'utente e vince sul contatto, non il contrario.

**`stalenessFrom(subtask)`** — restituisce `occurred_at ?? created_at`.

Non usare mai `tiles.updated_at` né `tile_subtasks.updated_at`. Correggere un
refuso in un titolo azzererebbe trenta giorni di attesa. Scrivi questa frase come
commento sopra la funzione: è il tipo di errore che si nota solo dopo mesi.

**Riporta i chiamanti.** Per ogni punto censito in 0.2, sostituisci la logica
inline con una chiamata. Se un punto **diverge** nel comportamento, non
allinearlo di tua iniziativa: elencalo e chiedi.

Poi lancia il `notaio` sul diff. È il controllo per cui è stato scritto: i punti
censiti chiamano l'originale, e non ne sono nati di nuovi. Tetto di tre giri.

**GATE 4 → aggiorna lo stato, fermati.**

---

## FASE 5 — Test

`backend/src/lib/__tests__/cockpitDerive.test.ts`. Casi obbligatori:

- checklist vuota → `currentStep` è `null`
- tutti done → `null`
- primo aperto è `cancelled` → salta al successivo
- primo aperto è `blocked` → è quello, non lo salta
- due subtask con lo stesso `sort_order` → esito stabile su input rimescolato
- `is_theirs = true` con `contact_id` self → `'theirs'` (la marcatura vince)
- `contact_id` non-self, `is_theirs = false` → `'theirs'`
- entrambi nulli/falsi → `'mine'`
- `occurred_at` nullo → `stalenessFrom` cade su `created_at`

I test devono passare. Se uno fallisce, non modificare il test per farlo passare:
riferisci quale comportamento diverge dalla specifica.

**GATE 5 → aggiorna lo stato, fermati.**

---

## FASE 6 — Passata finale e commit

Lancia `notaio` e `doganiere` sul diff completo delle fasi 3–5.

**Precisino non gira in questo protocollo.** Non c'è UI: produrrebbe solo rumore
su file non toccati, e abitua a ignorare i suoi rapporti.

Poi prepara tre commit isolati su `dev`, in quest'ordine:

1. `feat(db): migration 049 — is_theirs sui subtask`
2. `refactor(lib): derivazione unica per passo corrente, palla e stallo`
3. `test(lib): copertura di cockpitDerive`

**Non fare push.** Railway auto-deploya da `dev`: il push lo decide l'utente.

Infine copia in `handoff/` questo protocollo e il file di stato, come traccia di
cosa è stato chiesto e cosa è risultato.

**GATE 6 → protocollo concluso.**

---

## Cosa questo protocollo NON verifica

Nessuno degli agenti legge il database. Possono accertare che la derivazione sia
scritta in un posto solo e sia coerente, **non che produca il risultato giusto
sui dati veri**. Quella verifica è la Fase 2 e i test della Fase 5.

Un ciclo verde su tutti i gate non significa che il Cockpit sia il disegno
giusto. Significa solo che le fondamenta sono coerenti con sé stesse.

---

## Modello del file di stato

Da creare come `handoff/COCKPIT_FASE1_STATO.md` se non esiste.

```markdown
# Stato — Cockpit Fase 1

**Fase corrente:** 0
**Esito ultima fase:** non iniziata
**Ultimo aggiornamento:** —

## Registro

| Fase | Esito | Iterazioni agente | File toccati | Data |
|------|-------|-------------------|--------------|------|
|      |       |                   |              |      |

## Decisioni aperte

(voci in cui due punti divergono e la scelta spetta all'utente)

## Rinviate al backlog

(segnalazioni MEDIA e BASSA, da trasformare in tile `anytime`)
```
