-- Migration 019: Generalize canvas_textboxes → canvas_boxes (polymorphic).
--
-- Boxes get a discriminator `type` and a JSONB `content` field, so the same
-- shared infrastructure (drag, resize, ports, edges, selection) can host
-- text, image, and future content kinds with a single table.
--
-- Schema after this migration:
--   canvas_boxes (
--     id, user_id, tag_id, x, y, w, h, created_at, updated_at,
--     type    TEXT     NOT NULL DEFAULT 'text',
--     content JSONB    NOT NULL DEFAULT '{}'
--   )
--
-- Mapping for legacy text rows: { html: <old content TEXT> }
--
-- Idempotent: every step is wrapped in an existence check.

-- ─── Step 1: rename table canvas_textboxes → canvas_boxes ───
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='canvas_textboxes')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables
                     WHERE table_schema='public' AND table_name='canvas_boxes') THEN
    ALTER TABLE canvas_textboxes RENAME TO canvas_boxes;
    RAISE NOTICE 'Renamed canvas_textboxes → canvas_boxes';
  ELSE
    RAISE NOTICE 'Skipped table rename (already canvas_boxes or canvas_textboxes missing)';
  END IF;
END $$;

-- ─── Step 2: rename index ───
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes
             WHERE schemaname='public' AND indexname='canvas_textboxes_tag_idx')
     AND NOT EXISTS (SELECT 1 FROM pg_indexes
                     WHERE schemaname='public' AND indexname='canvas_boxes_tag_idx') THEN
    ALTER INDEX canvas_textboxes_tag_idx RENAME TO canvas_boxes_tag_idx;
    RAISE NOTICE 'Renamed index canvas_textboxes_tag_idx → canvas_boxes_tag_idx';
  END IF;
END $$;

-- ─── Step 3: rename legacy text column `content` → `content_legacy` so the new
--           JSONB column can use the same name. Skipped if already renamed.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='canvas_boxes'
               AND column_name='content' AND data_type='text') THEN
    ALTER TABLE canvas_boxes RENAME COLUMN content TO content_legacy;
    RAISE NOTICE 'Renamed canvas_boxes.content (TEXT) → content_legacy';
  END IF;
END $$;

-- ─── Step 4: add type discriminator + JSONB content ───
ALTER TABLE canvas_boxes ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'text';
ALTER TABLE canvas_boxes ADD COLUMN IF NOT EXISTS content JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ─── Step 5: backfill content from content_legacy for existing rows ───
-- Only update rows where content is still empty/{} AND content_legacy exists.
-- Stores HTML at content.html for the 'text' type.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='canvas_boxes'
               AND column_name='content_legacy') THEN
    UPDATE canvas_boxes
    SET content = jsonb_build_object('html', COALESCE(content_legacy, ''))
    WHERE content = '{}'::jsonb;
    RAISE NOTICE 'Backfilled canvas_boxes.content from content_legacy';
  END IF;
END $$;

-- ─── Step 6: drop the legacy text column (data migrated) ───
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='canvas_boxes'
               AND column_name='content_legacy') THEN
    ALTER TABLE canvas_boxes DROP COLUMN content_legacy;
    RAISE NOTICE 'Dropped canvas_boxes.content_legacy';
  END IF;
END $$;

-- ─── Step 7: enforce CHECK on type to catch typos in client code ───
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname='canvas_boxes_type_check') THEN
    ALTER TABLE canvas_boxes
      ADD CONSTRAINT canvas_boxes_type_check
      CHECK (type IN ('text', 'image'));
    RAISE NOTICE 'Added CHECK constraint canvas_boxes_type_check';
  END IF;
END $$;
