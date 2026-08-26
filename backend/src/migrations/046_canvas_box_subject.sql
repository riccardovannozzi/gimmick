-- 046_canvas_box_subject.sql
--
-- Quarto tipo di box del canvas: il SOGGETTO — la persona a cui una parte della
-- lavagna fa capo.
--
-- Come per il marcatore (044) non è una tabella nuova, e per la stessa ragione:
-- un soggetto è già tutto quello che `canvas_boxes` sa fare — ha una posizione,
-- si trascina, si elimina, si copia e fa da capo a un edge (`tb:<id>`). Dargli
-- una tabella sua avrebbe voluto dire riscrivere quelle cose una seconda volta e
-- tenerle allineate per sempre.
--
-- I dati stanno in `content`:
--   { "name": "...", "email": "...", "phone": "...", "notes": "..." }
--
-- ⚠️ NON è la stessa cosa dei `contacts`, la rubrica che alimenta i passi dei
-- flow. Là un contatto è una riga condivisa e referenziata
-- (`tile_subtasks.contact_id`); qui è un segno su UNA lavagna, che vive e muore
-- con lei. Sono due nomi vicini per due cose diverse, e tenerli separati è una
-- scelta: legarli avrebbe voluto dire decidere che ogni persona disegnata su un
-- canvas entra in rubrica, che non è quello che si fa disegnando uno schema.
-- Se un domani servisse il collegamento, `content` è JSONB: ci si aggiunge un
-- `contact_id` senza toccare lo schema.
ALTER TABLE canvas_boxes DROP CONSTRAINT IF EXISTS canvas_boxes_type_check;
ALTER TABLE canvas_boxes
  ADD CONSTRAINT canvas_boxes_type_check CHECK (type IN ('text', 'image', 'marker', 'subject'));
