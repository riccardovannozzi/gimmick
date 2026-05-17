-- Migration: Kanban board with customizable columns
-- Each user can create kanban columns with JSONB filter rules.
-- Tiles appear in a column when they match ALL of the column's filters (AND logic).
-- Filter types: action_type, tag, status (completed/active), pattern.

CREATE TABLE IF NOT EXISTS kanban_columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Nuova colonna',
  sort_order INTEGER NOT NULL DEFAULT 0,
  filters JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS kanban_columns_user_idx ON kanban_columns(user_id, sort_order);
