-- Migration: Column width multiplier for kanban columns
-- `width` is an integer ≥ 1. 1 = single tile-width column (default);
-- 2 = tiles wrap in a 2-up grid; 3 = 3-up grid; etc.
-- Lets users redistribute dense columns across more horizontal space.

ALTER TABLE kanban_columns ADD COLUMN IF NOT EXISTS width INTEGER NOT NULL DEFAULT 1;
