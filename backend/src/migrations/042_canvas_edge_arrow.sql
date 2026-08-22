-- 042_canvas_edge_arrow.sql
-- Verso della freccia di un collegamento del canvas.
--
-- NULL = nessuna freccia, ed è deliberatamente il default: è l'aspetto che gli
-- edge hanno sempre avuto (linea nuda con i pallini agli agganci), quindi
-- nessun collegamento già disegnato cambia faccia dopo questa migrazione. La
-- freccia si aggiunge scegliendola, e si toglie tornando a "nessuna".
--
-- A = source_id, B = target_id — l'ordine in cui l'edge è stato tirato.
ALTER TABLE canvas_edges
  ADD COLUMN IF NOT EXISTS arrow TEXT;  -- NULL | 'forward' (A→B) | 'backward' (B→A) | 'both' (A↔B)

-- Misura della punta, 1..4 come lo spessore della linea. NULL = 2, la misura
-- media: la decide il client, così un edge salvato prima di questa colonna non
-- ha bisogno di essere riscritto.
ALTER TABLE canvas_edges
  ADD COLUMN IF NOT EXISTS arrow_size INTEGER;  -- 1 | 2 | 3 | 4
