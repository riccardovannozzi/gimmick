-- Migration 022: Flow system — micro-action DAGs inside a Tile.
--
-- Introduces three concepts:
--   1. `contacts`      — standalone entity for people/companies/professionals
--                        that can have the ball in a Flow node (idraulico, ditta…).
--   2. `flow_nodes`    — nodes of a per-tile DAG. Each node has a state
--                        (mine/theirs/done/blocked/cancelled), an optional
--                        contact, an optional `occurred_at` (when it happened),
--                        and an optional `scheduled_at` (when it must happen).
--   3. `flow_edges`    — DAG edges between flow_nodes inside the same tile.
--                        Cycles are forbidden (enforced at application level
--                        before insert).
--
-- Idempotent: all steps wrapped in IF NOT EXISTS / DO blocks. Safe to re-run.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) CONTACTS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS contacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'person',
  phone       TEXT,
  email       TEXT,
  notes       TEXT,
  color       TEXT,
  avatar_url  TEXT,
  archived_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contacts_kind_check') THEN
    ALTER TABLE contacts
      ADD CONSTRAINT contacts_kind_check
      CHECK (kind IN ('person', 'company', 'professional', 'institution', 'other'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS contacts_user_id_idx ON contacts(user_id);
CREATE INDEX IF NOT EXISTS contacts_user_name_idx ON contacts(user_id, name);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'contacts_select_own') THEN
    CREATE POLICY contacts_select_own ON contacts FOR SELECT USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'contacts_insert_own') THEN
    CREATE POLICY contacts_insert_own ON contacts FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'contacts_update_own') THEN
    CREATE POLICY contacts_update_own ON contacts FOR UPDATE USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'contacts_delete_own') THEN
    CREATE POLICY contacts_delete_own ON contacts FOR DELETE USING (user_id = auth.uid());
  END IF;
END $$;

CREATE OR REPLACE FUNCTION update_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS contacts_updated_at_trigger ON contacts;
CREATE TRIGGER contacts_updated_at_trigger
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_contacts_updated_at();


-- ─────────────────────────────────────────────────────────────────────────────
-- 2) FLOW_NODES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS flow_nodes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tile_id       UUID NOT NULL REFERENCES tiles(id) ON DELETE CASCADE,
  label         TEXT NOT NULL DEFAULT '',
  state         TEXT NOT NULL DEFAULT 'mine',
  contact_id    UUID REFERENCES contacts(id) ON DELETE SET NULL,
  occurred_at   TIMESTAMPTZ,
  scheduled_at  TIMESTAMPTZ,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'flow_nodes_state_check') THEN
    ALTER TABLE flow_nodes
      ADD CONSTRAINT flow_nodes_state_check
      CHECK (state IN ('mine', 'theirs', 'done', 'blocked', 'cancelled'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS flow_nodes_tile_id_idx       ON flow_nodes(tile_id);
CREATE INDEX IF NOT EXISTS flow_nodes_user_id_idx       ON flow_nodes(user_id);
CREATE INDEX IF NOT EXISTS flow_nodes_user_state_idx    ON flow_nodes(user_id, state);
CREATE INDEX IF NOT EXISTS flow_nodes_contact_id_idx    ON flow_nodes(contact_id);
CREATE INDEX IF NOT EXISTS flow_nodes_scheduled_at_idx  ON flow_nodes(user_id, scheduled_at)
  WHERE scheduled_at IS NOT NULL;

ALTER TABLE flow_nodes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'flow_nodes_select_own') THEN
    CREATE POLICY flow_nodes_select_own ON flow_nodes FOR SELECT USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'flow_nodes_insert_own') THEN
    CREATE POLICY flow_nodes_insert_own ON flow_nodes FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'flow_nodes_update_own') THEN
    CREATE POLICY flow_nodes_update_own ON flow_nodes FOR UPDATE USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'flow_nodes_delete_own') THEN
    CREATE POLICY flow_nodes_delete_own ON flow_nodes FOR DELETE USING (user_id = auth.uid());
  END IF;
END $$;

CREATE OR REPLACE FUNCTION update_flow_nodes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS flow_nodes_updated_at_trigger ON flow_nodes;
CREATE TRIGGER flow_nodes_updated_at_trigger
  BEFORE UPDATE ON flow_nodes
  FOR EACH ROW EXECUTE FUNCTION update_flow_nodes_updated_at();


-- ─────────────────────────────────────────────────────────────────────────────
-- 3) FLOW_EDGES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS flow_edges (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tile_id    UUID NOT NULL REFERENCES tiles(id) ON DELETE CASCADE,
  parent_id  UUID NOT NULL REFERENCES flow_nodes(id) ON DELETE CASCADE,
  child_id   UUID NOT NULL REFERENCES flow_nodes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT flow_edges_no_self_loop CHECK (parent_id <> child_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS flow_edges_unique_idx
  ON flow_edges(parent_id, child_id);

CREATE INDEX IF NOT EXISTS flow_edges_tile_id_idx  ON flow_edges(tile_id);
CREATE INDEX IF NOT EXISTS flow_edges_parent_idx   ON flow_edges(parent_id);
CREATE INDEX IF NOT EXISTS flow_edges_child_idx    ON flow_edges(child_id);

ALTER TABLE flow_edges ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'flow_edges_select_own') THEN
    CREATE POLICY flow_edges_select_own ON flow_edges FOR SELECT USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'flow_edges_insert_own') THEN
    CREATE POLICY flow_edges_insert_own ON flow_edges FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'flow_edges_delete_own') THEN
    CREATE POLICY flow_edges_delete_own ON flow_edges FOR DELETE USING (user_id = auth.uid());
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4) DERIVED VIEW — flow_node_activity
-- ─────────────────────────────────────────────────────────────────────────────
-- Single source of truth for "last activity" of a node. Used by FlowHub filters
-- ("stalled for > 7 days") and by the BeatTrack stroke-width calculation
-- without round-tripping through application code.
--
-- last_activity_at = COALESCE(occurred_at, scheduled_at, updated_at)
-- is_leaf          = TRUE if no edge has parent_id = this node
-- is_open          = state IN ('mine', 'theirs')

CREATE OR REPLACE VIEW flow_node_activity AS
SELECT
  n.id,
  n.user_id,
  n.tile_id,
  n.state,
  n.contact_id,
  n.occurred_at,
  n.scheduled_at,
  n.updated_at,
  COALESCE(n.occurred_at, n.scheduled_at, n.updated_at) AS last_activity_at,
  (n.state IN ('mine', 'theirs'))                       AS is_open,
  NOT EXISTS (
    SELECT 1 FROM flow_edges e WHERE e.parent_id = n.id
  )                                                      AS is_leaf
FROM flow_nodes n;
