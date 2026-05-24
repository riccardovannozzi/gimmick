-- ─────────────────────────────────────────────────────────────────────────
-- 032 · ON DELETE CASCADE su statuses.user_id → auth.users
--
-- Tabella sfuggita dalla 031 (era sotto la zona visibile della query
-- diagnostica). Stesso pattern: trova dinamicamente la FK e la ri-crea
-- con CASCADE così l'account deletion non resta bloccato dai status
-- canonici (active/paused/blocked/cancelled/done) seedati al signup.
-- ─────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  fk_name text;
BEGIN
  SELECT tc.constraint_name INTO fk_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON kcu.constraint_name = tc.constraint_name
  JOIN information_schema.referential_constraints rc
    ON rc.constraint_name = tc.constraint_name
  WHERE tc.table_schema = 'public'
    AND tc.table_name = 'statuses'
    AND kcu.column_name = 'user_id'
    AND rc.unique_constraint_schema = 'auth'
  LIMIT 1;

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.statuses DROP CONSTRAINT %I', fk_name);
    EXECUTE format(
      'ALTER TABLE public.statuses ADD CONSTRAINT %I FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE',
      fk_name
    );
    RAISE NOTICE 'Converted statuses FK % to ON DELETE CASCADE', fk_name;
  ELSE
    RAISE NOTICE 'No FK found on statuses.user_id → auth.users — skipping';
  END IF;
END $$;

-- Verifica
SELECT tc.table_name, rc.delete_rule
FROM information_schema.referential_constraints rc
JOIN information_schema.table_constraints tc ON tc.constraint_name = rc.constraint_name
JOIN information_schema.key_column_usage kcu  ON kcu.constraint_name = rc.constraint_name
WHERE rc.unique_constraint_schema = 'auth'
  AND tc.table_schema = 'public'
  AND kcu.column_name = 'user_id'
  AND tc.table_name = 'statuses';
