-- 033_canvas_group_style.sql
-- Stile per-gruppo del canvas: colore di sfondo, colore/spessore/tipologia del
-- bordo. Tutti opzionali → i gruppi esistenti restano con l'aspetto di default.

ALTER TABLE canvas_groups
  ADD COLUMN IF NOT EXISTS bg_color     TEXT,
  ADD COLUMN IF NOT EXISTS border_color TEXT,
  ADD COLUMN IF NOT EXISTS border_width INTEGER,
  ADD COLUMN IF NOT EXISTS border_style TEXT; -- 'solid' | 'dashed' | 'dotted'
