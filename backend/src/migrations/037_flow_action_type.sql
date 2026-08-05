-- Migration 037: il quinto action_type — `flow` — e il contatto sui passi.
--
-- ─── Cosa cambia davvero ─────────────────────────────────────────────────────
--
-- Quasi niente, ed è il punto. Un flow non è una nuova entità: è un TILE il cui
-- `action_type` vale `flow`, e i cui passi sono i `tile_subtasks` che ogni tile
-- ha già. Questa migration esiste per l'unica cosa che i subtask non sanno
-- ancora dire: A CHI tocca un passo.
--
-- ─── Perché `action_type` non viene toccato ──────────────────────────────────
--
-- Verificato sul database reale (sonda: creato un tile, scritto action_type =
-- 'flow', riletto, eliminato → accettato): la colonna è TEXT senza CHECK e senza
-- tipo ENUM. Il quinto valore non richiede quindi alcuna DDL.
--
-- Deliberatamente NON si aggiunge un CHECK ora. Introdurne uno che non è mai
-- esistito è un cambiamento di natura diversa da quello richiesto: sposterebbe
-- la validazione dal bordo (lo `z.enum(ACTION_TYPES)` in routes/tiles.ts, che
-- copre ogni scrittura applicativa) al centro, e trasformerebbe qualunque riga
-- inattesa in un errore di scrittura invece che in un tile mal classificato.
-- Se in futuro lo si vuole, va fatto come intervento a sé, dopo aver verificato
-- che le 585 righe attuali rispettino tutte l'insieme.
--
-- Distribuzione rilevata su 585 tile, per riferimento:
--   event 393 · none 106 · anytime 54 · deadline 32 · flow 0 · NULL 0
--
-- ─── `tile_subtasks.contact_id` ──────────────────────────────────────────────
--
-- Un flow è un rimpallo di responsabilità: "richiesto io → attesa lui →
-- sollecitato io → risposto lui". Il contatto è ciò che distingue un passo di
-- flow da una voce di checklist. Nei 72 beat dell'attuale `flow_nodes` — la
-- tabella che i subtask sostituiscono — 68 portano un `contact_id`: senza questa
-- colonna la migrazione dei dati perderebbe il 94% dell'informazione.
--
-- Nullable, e resta nullable: sugli altri tipi di tile la checklist non ha
-- soggetto, e anche dentro un flow un passo può non averne.
--
-- ON DELETE SET NULL, come in `flow_nodes` (migration 022): eliminare un
-- contatto non deve cancellare la storia di un processo, deve solo togliere il
-- nome da un passaggio.

ALTER TABLE tile_subtasks
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;

-- Indice parziale: le righe con un contatto sono la minoranza (oggi zero, dopo
-- la migrazione dei beat circa 68 su 155), e l'unica interrogazione che serve è
-- "i passi aperti che aspettano questa persona".
CREATE INDEX IF NOT EXISTS idx_tile_subtasks_contact
  ON tile_subtasks (contact_id)
  WHERE contact_id IS NOT NULL;

COMMENT ON COLUMN tile_subtasks.contact_id IS
  'Soggetto del passo: chi ha la palla. Popolato sui passi dei tile con action_type = ''flow''; nullo sulle checklist ordinarie.';

-- ─── Cosa questa migration NON fa, e perché ──────────────────────────────────
--
-- 1. NON migra i 72 beat da `flow_nodes` a `tile_subtasks`, e non tocca né
--    `flow_nodes` né `flow_edges`. Quei beat vivono su 28 tile, 19 dei quali
--    oggi occupano il calendario: decidere quali siano flow veri è una cernita
--    di merito, non un'operazione meccanica, e finché non è fatta non esiste
--    l'elenco su cui operare. Spostare i beat prima significherebbe riempire di
--    checklist dei tile che flow non sono.
--
-- 2. NON aggiunge uno `state` ai subtask. `tile_subtasks` ha solo `is_done`,
--    quindi due stati su quattro: `blocked` e `cancelled` — il segmento rosso
--    dello stepper — non hanno sorgente. Tre beat su 72 (`undo` ×2, `stop` ×1)
--    portano un'informazione che `is_done` non sa contenere e che la migrazione
--    dovrà appiattire o preservare: è una scelta aperta, e aggiungere qui una
--    colonna di stato cambierebbe il modello della checklist di OGNI tile, non
--    solo dei flow. Va decisa a parte.
