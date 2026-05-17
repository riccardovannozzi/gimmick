-- Migration: introduce a per-user "self" contact and remove flow_nodes.owner.
--
-- Rationale: the ownership concept (mine/theirs) is redundant once we have a
-- contacts table. By seeding each user with one contact flagged `is_self=true`
-- and letting flow_nodes.contact_id drive the rendering, we collapse two
-- fields into one. Node shape derivation moves to: square if contact.is_self
-- (or contact_id IS NULL — default-mine semantics), circle otherwise.
--
-- Migration policy for existing rows (per the user's explicit decision):
--   owner='mine'                 → link contact_id to the user's self contact
--                                  IF contact_id is currently NULL. Existing
--                                  contact assignments are kept as-is.
--   owner='theirs' + null contact → leave contact_id NULL. The "theirs without
--                                   specific contact" case loses its ball-info
--                                   (accepted information loss).
--   owner='theirs' + contact     → leave the contact, drop owner.
--
-- Idempotent: every step uses IF NOT EXISTS / WHERE filters, can be re-run.

-- ── Step A: add is_self column to contacts ───────────────────────────────────
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS is_self BOOLEAN NOT NULL DEFAULT false;

-- At most one self contact per user. Partial unique index — null/false rows
-- are uncounted, so users can still have N regular contacts.
CREATE UNIQUE INDEX IF NOT EXISTS contacts_one_self_per_user
  ON contacts(user_id) WHERE is_self = true;

-- ── Step B: seed the self contact for every existing user that lacks one ────
INSERT INTO contacts (user_id, name, kind, is_self)
SELECT u.id, 'Io', 'person', true
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM contacts c WHERE c.user_id = u.id AND c.is_self = true
);

-- ── Step C: backfill flow_nodes.contact_id for owner='mine' rows that have
-- no contact yet. They land on the user's self contact so the new
-- contact-derived ownership matches their previous owner='mine'.
UPDATE flow_nodes n
SET contact_id = c.id
FROM contacts c
WHERE c.user_id = n.user_id
  AND c.is_self = true
  AND n.owner = 'mine'
  AND n.contact_id IS NULL;

-- ── Step D: drop+recreate the flow_node_activity view without `owner`,
-- but with `is_self_contact` derived from a LEFT JOIN on contacts. The hub
-- endpoint will use this column to filter "mine" vs "theirs" — same UX,
-- different source of truth.
DROP VIEW IF EXISTS flow_node_activity;
CREATE OR REPLACE VIEW flow_node_activity AS
SELECT
  n.id,
  n.user_id,
  n.tile_id,
  n.state,
  n.contact_id,
  COALESCE(c.is_self, false)                            AS is_self_contact,
  n.occurred_at,
  n.scheduled_at,
  n.updated_at,
  COALESCE(n.occurred_at, n.scheduled_at, n.updated_at) AS last_activity_at,
  (n.state IN ('active', 'wait'))                       AS is_open,
  NOT EXISTS (
    SELECT 1 FROM flow_edges e WHERE e.parent_id = n.id
  )                                                      AS is_leaf
FROM flow_nodes n
LEFT JOIN contacts c ON c.id = n.contact_id;

-- ── Step E: drop the owner index, check constraint, and column ──────────────
DROP INDEX IF EXISTS flow_nodes_user_owner_idx;
ALTER TABLE flow_nodes DROP CONSTRAINT IF EXISTS flow_nodes_owner_check;
ALTER TABLE flow_nodes DROP COLUMN IF EXISTS owner;
