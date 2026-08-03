-- Migration 036: Row Level Security sulle tabelle rimaste scoperte.
--
-- ─── Perché questa migration esiste ──────────────────────────────────────────
--
-- Il backend usa la SERVICE ROLE KEY per ogni query (config/supabase.ts), e la
-- service role key BYPASSA la RLS. Queste policy non hanno quindi alcun effetto
-- sul backend: nessuna query esistente cambia comportamento. Servono a chiudere
-- l'altro ingresso al database — l'accesso diretto a PostgREST con la CHIAVE
-- ANON, che è pubblica per progetto ed è committata in `mobile/eas.json`.
--
-- ─── Stato rilevato sul database reale (sonda: confronto fra righe viste dalla
--     service key e righe viste dalla anon key non autenticata) ──────────────
--
--   canvas_layouts   221 righe · anon 0  → RLS già attiva
--   canvas_edges      50 righe · anon 0  → RLS già attiva
--   canvas_groups     34 righe · anon 0  → RLS già attiva
--   canvas_boxes       6 righe · anon 0  → RLS già attiva
--   kanban_columns     6 righe · anon 6  → RLS ASSENTE  ← il buco reale
--
--   tiles            564 righe · anon 0  → RLS già attiva  (esclusa: già protetta)
--   sparks           357 righe · anon 0  → RLS già attiva  (esclusa: già protetta)
--
-- Solo `kanban_columns` era davvero esposta: la anon key ne leggeva titoli,
-- filtri e ordinamento di TUTTI gli utenti.
--
-- Le quattro tabelle canvas sono già protette, ma la loro protezione è stata
-- applicata a mano dalla dashboard e non risulta in NESSUNA migration: un
-- ambiente ricreato da zero da questi file nascerebbe scoperto. Sono incluse
-- qui in forma idempotente per rendere lo stato riproducibile — sul database
-- attuale l'ENABLE è un no-op e le policy, se equivalenti a quelle esistenti,
-- sono semanticamente inerti.
--
-- ⚠️ Un caso a cui prestare attenzione al riapplicare: se una di quelle tabelle
--    avesse oggi RLS attiva e ZERO policy (stato "chiuso a tutti", che dal di
--    fuori è indistinguibile perché il backend passa dalla service key), queste
--    policy ALLARGANO l'accesso da nessuno al proprietario. È la semantica
--    corretta e uguale a ogni altra tabella dell'app, ma è un cambiamento di
--    comportamento, non un no-op.
--
-- ─── Pattern ─────────────────────────────────────────────────────────────────
--
-- Lo stesso di 022_flows.sql (contacts/flow_nodes), con due scostamenti voluti:
--
--   1. Il guard su pg_policies filtra anche per `tablename` e `schemaname`, non
--      solo per `policyname`. In 022 il nome bastava perché era prefissato per
--      tabella, ma il guard restava globale: due tabelle con una policy dello
--      stesso nome si sarebbero silenziosamente saltate a vicenda.
--
--   2. Le policy di UPDATE hanno anche WITH CHECK, non solo USING. Con il solo
--      USING un utente può aggiornare una PROPRIA riga riscrivendone lo user_id
--      con quello di un altro, regalandogliela (o sottraendola a sé). Il WITH
--      CHECK impone che anche la riga risultante gli appartenga.
--
-- Tutte le tabelle qui trattate hanno user_id UUID NOT NULL REFERENCES
-- auth.users(id) ON DELETE CASCADE (migration 007 e 008) e un indice che parte
-- da user_id, quindi le policy non introducono scansioni sequenziali.
--
-- Idempotente: ogni passo è protetto da un test di esistenza. Sicura da riapplicare.


-- ─────────────────────────────────────────────────────────────────────────────
-- 1) KANBAN_COLUMNS — l'unica tabella effettivamente esposta
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE kanban_columns ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'kanban_columns' AND policyname = 'kanban_columns_select_own') THEN
    CREATE POLICY kanban_columns_select_own ON kanban_columns FOR SELECT USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'kanban_columns' AND policyname = 'kanban_columns_insert_own') THEN
    CREATE POLICY kanban_columns_insert_own ON kanban_columns FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'kanban_columns' AND policyname = 'kanban_columns_update_own') THEN
    CREATE POLICY kanban_columns_update_own ON kanban_columns FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'kanban_columns' AND policyname = 'kanban_columns_delete_own') THEN
    CREATE POLICY kanban_columns_delete_own ON kanban_columns FOR DELETE USING (user_id = auth.uid());
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2) CANVAS_LAYOUTS — posizione dei tile sul canvas di un tag
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE canvas_layouts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'canvas_layouts' AND policyname = 'canvas_layouts_select_own') THEN
    CREATE POLICY canvas_layouts_select_own ON canvas_layouts FOR SELECT USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'canvas_layouts' AND policyname = 'canvas_layouts_insert_own') THEN
    CREATE POLICY canvas_layouts_insert_own ON canvas_layouts FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'canvas_layouts' AND policyname = 'canvas_layouts_update_own') THEN
    CREATE POLICY canvas_layouts_update_own ON canvas_layouts FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'canvas_layouts' AND policyname = 'canvas_layouts_delete_own') THEN
    CREATE POLICY canvas_layouts_delete_own ON canvas_layouts FOR DELETE USING (user_id = auth.uid());
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3) CANVAS_EDGES — collegamenti fra nodi del canvas
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE canvas_edges ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'canvas_edges' AND policyname = 'canvas_edges_select_own') THEN
    CREATE POLICY canvas_edges_select_own ON canvas_edges FOR SELECT USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'canvas_edges' AND policyname = 'canvas_edges_insert_own') THEN
    CREATE POLICY canvas_edges_insert_own ON canvas_edges FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'canvas_edges' AND policyname = 'canvas_edges_update_own') THEN
    CREATE POLICY canvas_edges_update_own ON canvas_edges FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'canvas_edges' AND policyname = 'canvas_edges_delete_own') THEN
    CREATE POLICY canvas_edges_delete_own ON canvas_edges FOR DELETE USING (user_id = auth.uid());
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4) CANVAS_GROUPS — raggruppamenti di nodi sul canvas
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE canvas_groups ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'canvas_groups' AND policyname = 'canvas_groups_select_own') THEN
    CREATE POLICY canvas_groups_select_own ON canvas_groups FOR SELECT USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'canvas_groups' AND policyname = 'canvas_groups_insert_own') THEN
    CREATE POLICY canvas_groups_insert_own ON canvas_groups FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'canvas_groups' AND policyname = 'canvas_groups_update_own') THEN
    CREATE POLICY canvas_groups_update_own ON canvas_groups FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'canvas_groups' AND policyname = 'canvas_groups_delete_own') THEN
    CREATE POLICY canvas_groups_delete_own ON canvas_groups FOR DELETE USING (user_id = auth.uid());
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5) CANVAS_BOXES — box di testo/immagine sul canvas (ex canvas_textboxes, 019)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE canvas_boxes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'canvas_boxes' AND policyname = 'canvas_boxes_select_own') THEN
    CREATE POLICY canvas_boxes_select_own ON canvas_boxes FOR SELECT USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'canvas_boxes' AND policyname = 'canvas_boxes_insert_own') THEN
    CREATE POLICY canvas_boxes_insert_own ON canvas_boxes FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'canvas_boxes' AND policyname = 'canvas_boxes_update_own') THEN
    CREATE POLICY canvas_boxes_update_own ON canvas_boxes FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'canvas_boxes' AND policyname = 'canvas_boxes_delete_own') THEN
    CREATE POLICY canvas_boxes_delete_own ON canvas_boxes FOR DELETE USING (user_id = auth.uid());
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFICA POST-APPLICAZIONE
-- ─────────────────────────────────────────────────────────────────────────────
-- Da eseguire a mano dopo la migration. Attese: relrowsecurity = true su tutte
-- e cinque, e 4 policy per tabella.
--
--   SELECT c.relname, c.relrowsecurity, count(p.policyname) AS policies
--   FROM pg_class c
--   LEFT JOIN pg_policies p ON p.tablename = c.relname AND p.schemaname = 'public'
--   WHERE c.relname IN ('kanban_columns','canvas_layouts','canvas_edges','canvas_groups','canvas_boxes')
--   GROUP BY c.relname, c.relrowsecurity
--   ORDER BY c.relname;
--
-- Controprova dall'esterno: una GET su /rest/v1/kanban_columns con la sola
-- chiave anon deve restituire [] — prima di questa migration restituiva le
-- righe di tutti gli utenti.
