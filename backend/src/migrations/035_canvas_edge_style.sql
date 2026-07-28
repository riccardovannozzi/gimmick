-- 035_canvas_edge_style.sql
-- Stile per-edge del canvas: colore, tipologia linea, spessore e testo al centro.
-- Tutti opzionali → gli edge esistenti restano con l'aspetto di default
-- (linea tratteggiata sottile, colore bordo neutro, senza etichetta).

ALTER TABLE canvas_edges
  ADD COLUMN IF NOT EXISTS color      TEXT,
  ADD COLUMN IF NOT EXISTS line_style TEXT,    -- 'solid' | 'dashed' | 'dotted'
  ADD COLUMN IF NOT EXISTS line_width INTEGER, -- 1..4 px
  ADD COLUMN IF NOT EXISTS label      TEXT;    -- testo al centro dell'edge
