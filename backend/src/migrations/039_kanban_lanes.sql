-- Migration 039: le corsie orizzontali del Kanban.
--
-- La board diventa una GRIGLIA. Le colonne affettano i tile lungo un campo
-- (status, tipo, azione, tag); le corsie li affettano lungo un secondo campo, e
-- ogni cella e' l'incrocio dei due: i tile che soddisfano SIA i filtri della
-- colonna SIA quelli della corsia.
--
-- Stessa forma di `kanban_columns`, deliberatamente: sono la stessa cosa su due
-- assi diversi, e tenerle simmetriche significa che il codice che le legge, le
-- ordina e le filtra e' lo stesso. Le uniche colonne che non porto avanti sono
-- `width` e `bg_color`: la larghezza di una corsia orizzontale non ha senso, e
-- il colore non ha oggi nessuna resa (il pallino e il bordo che lo mostravano
-- sono stati rimossi dalla testata).
--
-- Senza corsie la board resta a una dimensione, esattamente com'e' adesso: zero
-- righe in questa tabella significa "nessuna corsia", non "board vuota".

CREATE TABLE IF NOT EXISTS kanban_lanes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Nuova corsia',
  sort_order INTEGER NOT NULL DEFAULT 0,
  filters JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS kanban_lanes_user_idx ON kanban_lanes(user_id, sort_order);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
--
-- Il backend passa dalla service role key e non e' impattato: queste policy
-- chiudono l'altro ingresso, cioe' PostgREST con la chiave anon, che e' pubblica
-- per progetto. Stesso pattern della migration 036 — che nacque proprio perche'
-- `kanban_columns` era rimasta scoperta e la anon key ne leggeva titoli e filtri
-- di TUTTI gli utenti. Una tabella nuova non deve ripetere quell'errore.

ALTER TABLE kanban_lanes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'kanban_lanes' AND policyname = 'kanban_lanes_select_own') THEN
    CREATE POLICY kanban_lanes_select_own ON kanban_lanes FOR SELECT USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'kanban_lanes' AND policyname = 'kanban_lanes_insert_own') THEN
    CREATE POLICY kanban_lanes_insert_own ON kanban_lanes FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'kanban_lanes' AND policyname = 'kanban_lanes_update_own') THEN
    CREATE POLICY kanban_lanes_update_own ON kanban_lanes FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'kanban_lanes' AND policyname = 'kanban_lanes_delete_own') THEN
    CREATE POLICY kanban_lanes_delete_own ON kanban_lanes FOR DELETE USING (user_id = auth.uid());
  END IF;
END $$;

COMMENT ON TABLE kanban_lanes IS
  'Corsie orizzontali del Kanban. Stessa semantica dei filtri di kanban_columns: OR dentro lo stesso tipo, AND fra tipi diversi. Una cella della board e'' l''intersezione fra una colonna e una corsia.';
