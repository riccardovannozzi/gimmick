-- Migration: Add sort configuration to kanban columns
-- Each column can independently sort its tiles by a date field, asc or desc.
-- sort_by: 'date_start' | 'date_end' | 'date_created' | 'date_updated' | NULL (insertion order)
-- sort_dir: 'asc' | 'desc'

ALTER TABLE kanban_columns ADD COLUMN IF NOT EXISTS sort_by TEXT;
ALTER TABLE kanban_columns ADD COLUMN IF NOT EXISTS sort_dir TEXT NOT NULL DEFAULT 'asc';
