-- 044_canvas_box_marker.sql
--
-- Terzo tipo di box del canvas: il MARCATORE (start / stop / goal / milestone).
--
-- Non è una tabella nuova, ed è la scelta che vale la pena spiegare: un
-- marcatore è già tutto quello che `canvas_boxes` sa fare — ha una posizione,
-- si trascina, si elimina, si copia, entra in un gruppo e fa da capo a un edge
-- (`tb:<id>`). Dargli una tabella sua avrebbe voluto dire riscrivere quelle sei
-- cose una seconda volta, e tenerle allineate per sempre.
--
-- La forma la porta `content`: { "kind": "start" | "end" }. La misura sta in
-- w/h come per gli altri box (48×48), così il codice che calcola gli agganci
-- degli edge e i contorni dei gruppi non deve sapere che i marcatori esistono.
ALTER TABLE canvas_boxes DROP CONSTRAINT IF EXISTS canvas_boxes_type_check;
ALTER TABLE canvas_boxes
  ADD CONSTRAINT canvas_boxes_type_check CHECK (type IN ('text', 'image', 'marker'));

-- I marcatori sono passati da 48 a 36 px. La misura di ognuno sta sulla sua
-- riga (w/h), come per ogni box, quindi quelli già posati non si adeguano da
-- soli: questa UPDATE li riallinea. È innocua a riapplicarla — riscrive lo
-- stesso valore — e va rilanciata se la costante `MARKER_SIZE` cambia ancora.
UPDATE canvas_boxes SET w = 36, h = 36 WHERE type = 'marker' AND (w <> 36 OR h <> 36);

-- I marcatori sono passati da due tipi (start/end) a quattro
-- (start/stop/goal/milestone), e i due nomi vecchi hanno ciascuno un erede
-- diretto: 'end' → 'stop', 'node' → 'milestone'. Senza queste righe un
-- marcatore già posato ricadrebbe sul tipo di ripiego e cambierebbe faccia da
-- solo. Sono innocue a riapplicarle: dopo la prima volta non trovano più nulla.
UPDATE canvas_boxes
SET content = jsonb_set(content, '{kind}', '"stop"')
WHERE type = 'marker' AND content->>'kind' = 'end';

UPDATE canvas_boxes
SET content = jsonb_set(content, '{kind}', '"milestone"')
WHERE type = 'marker' AND content->>'kind' = 'node';
