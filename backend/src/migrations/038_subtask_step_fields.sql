-- Migration 038: i passi di un flow diventano voci di checklist.
--
-- La 037 ha dato ai `tile_subtasks` il SOGGETTO (`contact_id`). Restano le due
-- sole informazioni che un beat di `flow_nodes` porta e che una voce di
-- checklist non sa ancora contenere. Misurate sui 72 beat reali:
--
--   label          68/72  → `content`      già c'è
--   sort_order     72/72  → `sort_order`   già c'è
--   contact_id     68/72  → `contact_id`   già c'è (037)
--   occurred_at    43/72  → QUI SOTTO
--   state           3/72  → QUI SOTTO      (2 `undo`, 1 `stop`)
--   scheduled_at    0/72  → vuoto su tutti: niente da migrare
--   notes           0/72  → vuoto su tutti: niente da migrare
--   x / y          40/72  → posizioni sul canvas, muoiono col grafo
--
-- ─── `occurred_at` ───────────────────────────────────────────────────────────
--
-- Quando il passo è avvenuto. È ciò che rende leggibile un processo che si
-- trascina per settimane: "richiesto il 13, sollecitato il 20, risposto il 24".
-- Senza, la lista dice cosa è successo ma non quando.
--
-- NON è una scadenza e non va in calendario: è storia, non programma. Il campo
-- gemello `flow_nodes.scheduled_at` — quello che una scadenza l'avrebbe
-- rappresentata — è vuoto su tutti e 72 i beat e non viene portato avanti.
--
-- ─── `state` ─────────────────────────────────────────────────────────────────
--
-- Una SOVRASTRUTTURA su `is_done`, non un suo rimpiazzo. NULL significa "voce
-- ordinaria": lo stato si legge da `is_done` come sempre. I due valori ammessi
-- coprono ciò che un booleano non sa dire, cioè un passo che non è né fatto né
-- semplicemente in attesa.
--
--   NULL         → fatto o da fare, secondo `is_done`
--   'blocked'    → fermo per un ostacolo         (il beat `stop`)
--   'cancelled'  → non si farà più               (i beat `undo`)
--
-- Questa forma è deliberata. Sostituire `is_done` con una colonna di stato a
-- quattro valori avrebbe toccato OGNI voce di checklist di OGNI tile (87 righe
-- su 27 tile, in larga parte note e to-do) e ogni punto di codice che le legge:
-- la barra di avanzamento, l'API dei subtask, lo stepper del Tile. Così invece
-- le 87 righe esistenti restano valide con `state` a NULL, e nessuna query
-- cambia comportamento.
--
-- È anche ciò che accende il segmento rosso dello stepper, che `lib/tile-visual.ts`
-- prevede e che finora non aveva sorgente:
--   StepState = state ?? (is_done ? 'done' : 'pending')
--
-- ⚠️ Cosa NON serve rappresentare: la distinzione fra i beat `active` (tocca a
--    me) e `wait` (aspetto lui), che sono 4 + 23. Non è uno stato del passo: si
--    deriva dal soggetto, cioè da `contacts.is_self` attraverso `contact_id`.
--    Entrambi restano `pending`, e chi ha la palla lo dice il contatto.
--
-- ─── Portata ─────────────────────────────────────────────────────────────────
--
-- Le colonne stanno su `tile_subtasks`, quindi esistono per ogni tile. La
-- distinzione fra "checklist della spesa" e "passi di un processo" è di RESA,
-- non di schema: la List mostra data e stato quando il tile è di tipo `flow` e
-- resta una checklist nuda altrove. Stessa tabella, stessa API, due letture —
-- lo stesso principio del sistema visivo dei tile.

ALTER TABLE tile_subtasks
  ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMPTZ;

ALTER TABLE tile_subtasks
  ADD COLUMN IF NOT EXISTS state TEXT;

-- Il vincolo è dichiarato a parte e in forma idempotente: `ADD CONSTRAINT` non
-- accetta `IF NOT EXISTS`, e rilanciare la migration non deve fallire.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'tile_subtasks'::regclass
      AND conname = 'tile_subtasks_state_check'
  ) THEN
    ALTER TABLE tile_subtasks
      ADD CONSTRAINT tile_subtasks_state_check
      CHECK (state IS NULL OR state IN ('blocked', 'cancelled'));
  END IF;
END $$;

-- Le voci eccezionali sono una manciata: indice parziale, non totale.
CREATE INDEX IF NOT EXISTS idx_tile_subtasks_state
  ON tile_subtasks (state)
  WHERE state IS NOT NULL;

COMMENT ON COLUMN tile_subtasks.occurred_at IS
  'Quando il passo è avvenuto. Storia, non programma: non compare in calendario.';
COMMENT ON COLUMN tile_subtasks.state IS
  'Sovrastruttura su is_done. NULL = voce ordinaria (lo stato lo dice is_done); ''blocked'' = ferma per un ostacolo; ''cancelled'' = non si farà.';
