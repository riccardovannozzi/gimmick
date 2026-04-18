-- Migration: Optional background color override per kanban column
-- Stores a hex string (e.g. "#1C1C1E") picked from GIMMICK_PALETTE. NULL = default.

ALTER TABLE kanban_columns ADD COLUMN IF NOT EXISTS bg_color TEXT;
