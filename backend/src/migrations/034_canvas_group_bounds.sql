-- 034_canvas_group_bounds.sql
-- Dimensione manuale opzionale del gruppo (ridimensionamento via maniglie).
-- Quando presente, il gruppo si estende ad ALMENO questo rettangolo (unione con
-- il bounding box dei tile). NULL → auto-fit sui soli tile (comportamento
-- precedente, invariato per i gruppi esistenti).

ALTER TABLE canvas_groups
  ADD COLUMN IF NOT EXISTS bounds JSONB; -- { x, y, w, h } in coordinate canvas
