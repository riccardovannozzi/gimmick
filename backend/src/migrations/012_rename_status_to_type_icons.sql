-- Migration: rename "status icon" feature to "type icon".
-- Tables, columns, and kanban-filter JSON key are all renamed in one shot.
-- Non-destructive: only names change; existing rows are preserved.

ALTER TABLE IF EXISTS status_icons RENAME TO type_icons;
ALTER TABLE IF EXISTS tile_status_icons RENAME TO tile_type_icons;
ALTER TABLE tile_type_icons RENAME COLUMN status_icon_id TO type_icon_id;

-- kanban_columns.filters is a JSONB array of { type, value }.
-- Rewrite any entry whose type == 'status_icon' to type == 'type_icon'.
UPDATE kanban_columns
SET filters = (
  SELECT jsonb_agg(
    CASE WHEN f->>'type' = 'status_icon'
         THEN jsonb_set(f, '{type}', '"type_icon"')
         ELSE f
    END
  )
  FROM jsonb_array_elements(filters) f
)
WHERE filters @> '[{"type":"status_icon"}]';
