-- ─────────────────────────────────────────────────────────────────────────
-- 031 · ON DELETE CASCADE su tutte le FK utente verso auth.users
--
-- Necessario per il nuovo endpoint DELETE /api/auth/account: senza CASCADE
-- su queste 7 tabelle, supabase.auth.admin.deleteUser fallisce perché
-- Postgres rifiuta di cancellare la riga in auth.users finché esistono
-- righe figlie. Risultato: utente non eliminabile, dati orfani.
--
-- Approccio: per ogni tabella tipo trovo dinamicamente il nome della FK
-- esistente, la droppo e la ri-creo con ON DELETE CASCADE. Idempotente:
-- se la FK è già CASCADE non viene toccata; se la FK non esiste viene
-- creata da zero.
-- ─────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  -- Tabelle da convertire da NO ACTION → CASCADE.
  tbl text;
  tables_to_fix text[] := ARRAY[
    'tags',
    'canvas_layouts',
    'canvas_edges',
    'canvas_groups',
    'canvas_boxes',
    'tile_type_icons',
    'type_icons'
  ];
  fk_name text;
BEGIN
  FOREACH tbl IN ARRAY tables_to_fix LOOP
    -- Trova la FK esistente su user_id che punta a auth.users.
    SELECT tc.constraint_name INTO fk_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = tc.constraint_name
    JOIN information_schema.referential_constraints rc
      ON rc.constraint_name = tc.constraint_name
    WHERE tc.table_schema = 'public'
      AND tc.table_name = tbl
      AND kcu.column_name = 'user_id'
      AND rc.unique_constraint_schema = 'auth'
    LIMIT 1;

    IF fk_name IS NOT NULL THEN
      -- Drop & re-add con CASCADE.
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', tbl, fk_name);
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE',
        tbl, fk_name
      );
      RAISE NOTICE 'Converted % FK % to ON DELETE CASCADE', tbl, fk_name;
    ELSE
      RAISE NOTICE 'No FK found on %.user_id → auth.users — skipping', tbl;
    END IF;
  END LOOP;
END $$;

-- Verifica post-migration: ritorna le 7 tabelle con il nuovo delete_rule.
-- Esegui per conferma dopo l'apply.
SELECT
  tc.table_name,
  rc.delete_rule
FROM information_schema.referential_constraints rc
JOIN information_schema.table_constraints tc ON tc.constraint_name = rc.constraint_name
JOIN information_schema.key_column_usage kcu  ON kcu.constraint_name = rc.constraint_name
WHERE rc.unique_constraint_schema = 'auth'
  AND tc.table_schema = 'public'
  AND kcu.column_name = 'user_id'
  AND tc.table_name IN ('tags','canvas_layouts','canvas_edges','canvas_groups','canvas_boxes','tile_type_icons','type_icons')
ORDER BY tc.table_name;
