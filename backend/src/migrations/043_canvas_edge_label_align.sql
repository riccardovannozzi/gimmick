-- 043_canvas_edge_label_align.sql
-- Come si dispone l'etichetta di un collegamento rispetto alla linea.
--
--   'center'      ruotata lungo l'edge, centrata SULLA linea  (default)
--   'above'       ruotata lungo l'edge, appoggiata sopra la linea
--   'horizontal'  orizzontale al centro dell'edge
--
-- ⚠️ NULL vale 'center', non 'horizontal': è una scelta deliberata e cambia
-- l'aspetto delle etichette già scritte, che finora erano tutte orizzontali.
-- Chi vuole tenere quelle com'erano deve scegliere 'horizontal' a mano — o
-- lanciare la riga qui sotto PRIMA di distribuire il client nuovo.
--
--   UPDATE canvas_edges SET label_align = 'horizontal' WHERE label IS NOT NULL;
ALTER TABLE canvas_edges
  ADD COLUMN IF NOT EXISTS label_align TEXT;  -- NULL/'center' | 'above' | 'horizontal'
