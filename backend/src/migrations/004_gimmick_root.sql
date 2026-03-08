-- Migration 004: Tag GIMMICK (nodo radice) + relation_type
-- Aggiunge is_root per proteggere il tag GIMMICK dalla cancellazione
-- Aggiunge relation_type per relazioni semantiche manuali tra tag

-- 1. Aggiunge colonna is_root a tags
ALTER TABLE tags ADD COLUMN IF NOT EXISTS is_root BOOLEAN DEFAULT FALSE;

-- 2. Aggiunge colonna relation_type a tag_relations
ALTER TABLE tag_relations ADD COLUMN IF NOT EXISTS relation_type TEXT;

-- 3. Aggiunge UNIQUE constraint su (user_id, name) se non esiste gia'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tags_user_id_name_key'
  ) THEN
    ALTER TABLE tags ADD CONSTRAINT tags_user_id_name_key UNIQUE (user_id, name);
  END IF;
END $$;

-- 4. Backfill: marca come root i tag GIMMICK gia' esistenti
UPDATE tags SET is_root = TRUE WHERE name = 'GIMMICK';

-- Crea tag GIMMICK solo per utenti che non ce l'hanno ancora
-- Controlla sia name che slug per evitare conflitti su entrambi gli indici
INSERT INTO tags (user_id, name, is_root, color, slug)
SELECT DISTINCT t.user_id, 'GIMMICK', TRUE, '#528BFF', 'gimmick'
FROM tags t
WHERE t.user_id NOT IN (
  SELECT user_id FROM tags WHERE name = 'GIMMICK' OR slug = 'gimmick'
)
ON CONFLICT DO NOTHING;

-- 5. Crea relazioni root-link tra GIMMICK e tutti i tag esistenti dell'utente
-- Per ogni tag non-root, crea relazione bidirezionale verso GIMMICK
INSERT INTO tag_relations (user_id, tag_from, tag_to, weight, relation_type)
SELECT t.user_id, t.id, g.id, 0, 'root-link'
FROM tags t
JOIN tags g ON g.user_id = t.user_id AND g.is_root = TRUE
WHERE t.is_root = FALSE
ON CONFLICT (user_id, tag_from, tag_to) DO NOTHING;

INSERT INTO tag_relations (user_id, tag_from, tag_to, weight, relation_type)
SELECT t.user_id, g.id, t.id, 0, 'root-link'
FROM tags t
JOIN tags g ON g.user_id = t.user_id AND g.is_root = TRUE
WHERE t.is_root = FALSE
ON CONFLICT (user_id, tag_from, tag_to) DO NOTHING;

-- 6. Auto-tag tile orfane (senza nessun tag) con GIMMICK
INSERT INTO tile_tags (tag_id, tile_id)
SELECT g.id, tl.id
FROM tiles tl
JOIN tags g ON g.user_id = tl.user_id AND g.is_root = TRUE
WHERE tl.id NOT IN (SELECT tile_id FROM tile_tags)
ON CONFLICT (tag_id, tile_id) DO NOTHING;
