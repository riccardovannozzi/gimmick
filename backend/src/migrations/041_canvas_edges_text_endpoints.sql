-- 041_canvas_edges_text_endpoints.sql
--
-- Gli endpoint di un edge del canvas NON sono solo tile: possono essere box
-- (`tb:<uuid>` per immagini e note) e gruppi. La 007 dichiarava già
-- `source_id TEXT` / `target_id TEXT`, ma la tabella nel database ESISTEVA GIÀ
-- con quelle colonne di tipo UUID e con una FOREIGN KEY verso `tiles` — e
-- `CREATE TABLE IF NOT EXISTS` non tocca una tabella esistente. Risultato: il
-- tipo dichiarato nel repository e quello reale hanno divergito in silenzio.
--
-- Sintomo: collegare un'immagine a un tile "non era persistente". L'edge
-- compariva (scrittura ottimistica lato client) e poi spariva, perché la INSERT
-- veniva rifiutata da Postgres:
--
--   22P02  invalid input syntax for type uuid: "tb:1aac9596-c8ca-47af-…"
--
-- Gli edge fra tile funzionavano — sono UUID validi — quindi il buco riguardava
-- SOLO gli endpoint non-tile: immagini, note, gruppi.
--
-- ⚠️ La FK è il vincolo VERO: anche col tipo giusto, «ogni endpoint è un tile»
-- resterebbe una regola che il canvas ha smesso di rispettare il giorno in cui
-- ha accettato box e gruppi come nodi. Va tolta — ma non gratis: era lei a
-- cancellare gli edge di un tile cancellato (le rotte non lo fanno). Il
-- paragrafo 3 qui sotto rimette quella pulizia come trigger, che per di più
-- copre anche i box, che la FK non ha mai coperto.
--
-- La conversione di tipo è sicura: ogni valore presente è un UUID e la sua
-- forma testuale è esattamente ciò che il codice rilegge. Gli indici dipendenti
-- (canvas_edges_unique_idx) vengono ricostruiti da Postgres nell'ALTER.


-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Via le FK sugli endpoint (qualunque nome abbiano)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  fk RECORD;
BEGIN
  FOR fk IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    WHERE ns.nspname = 'public'
      AND rel.relname = 'canvas_edges'
      AND con.contype = 'f'
      AND con.conkey && ARRAY[
        (SELECT attnum FROM pg_attribute WHERE attrelid = rel.oid AND attname = 'source_id'),
        (SELECT attnum FROM pg_attribute WHERE attrelid = rel.oid AND attname = 'target_id')
      ]
  LOOP
    EXECUTE format('ALTER TABLE canvas_edges DROP CONSTRAINT %I', fk.conname);
    RAISE NOTICE 'rimossa FK %', fk.conname;
  END LOOP;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2) UUID → TEXT
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'canvas_edges'
      AND column_name = 'source_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE canvas_edges ALTER COLUMN source_id TYPE TEXT USING source_id::text;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'canvas_edges'
      AND column_name = 'target_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE canvas_edges ALTER COLUMN target_id TYPE TEXT USING target_id::text;
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3) La pulizia che faceva la FK, ora per TUTTI i tipi di nodo
--
-- Un nodo cancellato non deve lasciare in giro i suoi archi. La FK lo garantiva
-- solo per i tile; qui vale anche per i box (id nudo per i tile, `tb:<id>` per i
-- box — le due forme con cui il canvas scrive gli endpoint).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION canvas_edges_drop_for_node() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM canvas_edges
   WHERE source_id IN (OLD.id::text, 'tb:' || OLD.id::text)
      OR target_id IN (OLD.id::text, 'tb:' || OLD.id::text);
  RETURN OLD;
END $$;

-- Il trigger cerca per endpoint, e l'indice unico (user_id, tag_id, source_id,
-- target_id) non serve a una ricerca sul solo endpoint: due indici dedicati.
CREATE INDEX IF NOT EXISTS canvas_edges_source_idx ON canvas_edges(source_id);
CREATE INDEX IF NOT EXISTS canvas_edges_target_idx ON canvas_edges(target_id);

DROP TRIGGER IF EXISTS tiles_drop_canvas_edges ON tiles;
CREATE TRIGGER tiles_drop_canvas_edges
  AFTER DELETE ON tiles
  FOR EACH ROW EXECUTE FUNCTION canvas_edges_drop_for_node();

DROP TRIGGER IF EXISTS canvas_boxes_drop_canvas_edges ON canvas_boxes;
CREATE TRIGGER canvas_boxes_drop_canvas_edges
  AFTER DELETE ON canvas_boxes
  FOR EACH ROW EXECUTE FUNCTION canvas_edges_drop_for_node();

-- Archi già orfani (endpoint che non esiste più): il canvas non li disegna, ma
-- restano righe che nessuno leggerà mai. Si tolgono una volta sola, qui.
DELETE FROM canvas_edges e
 WHERE NOT EXISTS (SELECT 1 FROM tiles t WHERE t.id::text = e.source_id)
   AND NOT EXISTS (SELECT 1 FROM canvas_boxes b WHERE 'tb:' || b.id::text = e.source_id);
DELETE FROM canvas_edges e
 WHERE NOT EXISTS (SELECT 1 FROM tiles t WHERE t.id::text = e.target_id)
   AND NOT EXISTS (SELECT 1 FROM canvas_boxes b WHERE 'tb:' || b.id::text = e.target_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 4) Stessa famiglia di derive, trovata mentre si diagnosticava questa: la
-- `canvas_groups.id` reale non ha il DEFAULT dichiarato nella 007. Oggi non si
-- vede — il client genera l'id con crypto.randomUUID() e lo manda sempre — ma è
-- una mina per qualunque INSERT che si fidi dello schema e ometta l'id.
-- (`node_ids` invece è davvero TEXT[]: i membri `tb:<id>` dei gruppi si salvano.)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE canvas_groups ALTER COLUMN id SET DEFAULT gen_random_uuid();


-- ─── Verifica (da eseguire a mano dopo la migration) ─────────────────────────
--
--   SELECT column_name, data_type, column_default
--   FROM information_schema.columns
--   WHERE table_schema = 'public'
--     AND (table_name, column_name) IN (
--       ('canvas_edges','source_id'), ('canvas_edges','target_id'),
--       ('canvas_groups','id'), ('canvas_groups','node_ids')
--     )
--   ORDER BY table_name, column_name;
--
-- Atteso: canvas_edges.source_id/target_id = text · canvas_groups.id con
-- default gen_random_uuid() · canvas_groups.node_ids = ARRAY (text[]).
--
--   SELECT conname FROM pg_constraint con
--   JOIN pg_class rel ON rel.oid = con.conrelid
--   WHERE rel.relname = 'canvas_edges' AND con.contype = 'f';
--
-- Atteso: nessuna FK sugli endpoint (resta solo quella su user_id/tag_id).
