-- Migration 017: Migrazione palette Gimmick → Airtable Blocks SDK
--
-- Sostituisce la vecchia GIMMICK_PALETTE (25 colori con id italiani — Lavanda, Fumo, ...)
-- con la nuova palette di 40 colori basata sull'Airtable Blocks SDK
-- (10 famiglie × 4 stop: Light2, Light1, Bright, Dark1).
--
-- Mappatura hex legacy → hex nuovo "best-effort" per vicinanza cromatica.
-- Applicata a ogni colonna colore-hex che esiste nel DB:
--   • tag_types.color        (sorgente reale del colore dei tile via tag→tag_type)
--   • tags.color             (legacy, potrebbe essere stato rimosso)
--   • kanban_columns.bg_color
--   • statuses.color
--   • type_icons.color
--   • user_settings.value    (chiave 'action_colors' — JSONB)
--
-- Difensivo: ogni UPDATE è wrappato in un IF EXISTS sulla colonna
-- information_schema.columns, quindi la migration non fallisce se una
-- colonna/tabella non esiste (es. features mai applicate sul DB corrente).
--
-- Idempotente: ri-eseguibile senza side-effect (gli hex nuovi non matchano
-- la CASE, quindi restano invariati al secondo giro).

-- Helper function: mappa hex legacy → hex nuovo. Hex sconosciuti restano invariati.
CREATE OR REPLACE FUNCTION migrate_legacy_palette_color(old_hex text) RETURNS text AS $$
BEGIN
  IF old_hex IS NULL THEN RETURN NULL; END IF;
  RETURN CASE lower(old_hex)
    -- Viola/Blu (riga 1 legacy)
    WHEN '#8b5cf6' THEN '#CDB0FF'  -- Lavanda    → purpleLight1
    WHEN '#6c6cf5' THEN '#8B46FF'  -- Pervinca   → purpleBright
    WHEN '#3b82f6' THEN '#2D7FF9'  -- Zaffiro    → blueBright
    WHEN '#1da8d8' THEN '#18BFFF'  -- Oceano     → cyanBright
    WHEN '#06b6d4' THEN '#18BFFF'  -- Acqua      → cyanBright
    -- Verdi (riga 2 legacy)
    WHEN '#0bc4a0' THEN '#20D9D2'  -- Menta      → tealBright
    WHEN '#10b981' THEN '#20C933'  -- Smeraldo   → greenBright
    WHEN '#4ab84a' THEN '#20C933'  -- Erba       → greenBright
    WHEN '#84cc16' THEN '#93E088'  -- Lime       → greenLight1
    WHEN '#c8c014' THEN '#B87503'  -- Cedro      → yellowDark1
    -- Gialli/Arancio (riga 3 legacy)
    WHEN '#facc15' THEN '#FCB400'  -- Sole       → yellowBright
    WHEN '#f59e0b' THEN '#FCB400'  -- Miele      → yellowBright
    WHEN '#f97316' THEN '#FF6F2C'  -- Mandarino  → orangeBright
    WHEN '#c45c2a' THEN '#D74D26'  -- Terracotta → orangeDark1
    WHEN '#92400e' THEN '#D74D26'  -- Terra      → orangeDark1
    -- Rossi/Rosa (riga 4 legacy)
    WHEN '#ef4444' THEN '#F82B60'  -- Corallo    → redBright
    WHEN '#f43f72' THEN '#F82B60'  -- Fiamma     → redBright
    WHEN '#ec4899' THEN '#FF08C2'  -- Ciclamino  → pinkBright
    WHEN '#e879c8' THEN '#F99DE2'  -- Peonia     → pinkLight1
    WHEN '#f9a8d4' THEN '#FFDAF6'  -- Quarzo     → pinkLight2
    -- Grigi Slate (riga 5 legacy)
    WHEN '#f8fafc' THEN '#EEEEEE'  -- Neve       → grayLight2
    WHEN '#cbd5e1' THEN '#CCCCCC'  -- Nebbia     → grayLight1
    WHEN '#94a3b8' THEN '#666666'  -- Fumo       → grayBright
    WHEN '#64748b' THEN '#444444'  -- Pietra     → grayDark1
    WHEN '#1e293b' THEN '#444444'  -- Ardesia    → grayDark1
    ELSE old_hex  -- hex non riconosciuto (incluso #528BFF del root GIMMICK): invariato
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 1a. tag_types.color — sorgente reale del colore visibile sui tile.
DO $$
DECLARE n_updated int;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tag_types' AND column_name = 'color'
  ) THEN
    EXECUTE '
      UPDATE tag_types
      SET color = migrate_legacy_palette_color(color)
      WHERE color IS NOT NULL
        AND color <> migrate_legacy_palette_color(color)
    ';
    GET DIAGNOSTICS n_updated = ROW_COUNT;
    RAISE NOTICE 'tag_types.color: % row(s) aggiornate', n_updated;
  ELSE
    RAISE NOTICE 'tag_types.color: colonna non presente, skip';
  END IF;
END $$;

-- 1b. tags.color (legacy — potrebbe non esistere più)
DO $$
DECLARE n_updated int;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tags' AND column_name = 'color'
  ) THEN
    EXECUTE '
      UPDATE tags
      SET color = migrate_legacy_palette_color(color)
      WHERE color IS NOT NULL
        AND color <> migrate_legacy_palette_color(color)
    ';
    GET DIAGNOSTICS n_updated = ROW_COUNT;
    RAISE NOTICE 'tags.color: % row(s) aggiornate', n_updated;
  ELSE
    RAISE NOTICE 'tags.color: colonna non presente, skip';
  END IF;
END $$;

-- 2. kanban_columns.bg_color
DO $$
DECLARE n_updated int;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'kanban_columns' AND column_name = 'bg_color'
  ) THEN
    EXECUTE '
      UPDATE kanban_columns
      SET bg_color = migrate_legacy_palette_color(bg_color)
      WHERE bg_color IS NOT NULL
        AND bg_color <> migrate_legacy_palette_color(bg_color)
    ';
    GET DIAGNOSTICS n_updated = ROW_COUNT;
    RAISE NOTICE 'kanban_columns.bg_color: % row(s) aggiornate', n_updated;
  ELSE
    RAISE NOTICE 'kanban_columns.bg_color: colonna non presente, skip';
  END IF;
END $$;

-- 3. statuses.color
DO $$
DECLARE n_updated int;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'statuses' AND column_name = 'color'
  ) THEN
    EXECUTE '
      UPDATE statuses
      SET color = migrate_legacy_palette_color(color)
      WHERE color IS NOT NULL
        AND color <> migrate_legacy_palette_color(color)
    ';
    GET DIAGNOSTICS n_updated = ROW_COUNT;
    RAISE NOTICE 'statuses.color: % row(s) aggiornate', n_updated;
  ELSE
    RAISE NOTICE 'statuses.color: colonna non presente, skip';
  END IF;
END $$;

-- 4. type_icons.color
DO $$
DECLARE n_updated int;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'type_icons' AND column_name = 'color'
  ) THEN
    EXECUTE '
      UPDATE type_icons
      SET color = migrate_legacy_palette_color(color)
      WHERE color IS NOT NULL
        AND color <> migrate_legacy_palette_color(color)
    ';
    GET DIAGNOSTICS n_updated = ROW_COUNT;
    RAISE NOTICE 'type_icons.color: % row(s) aggiornate', n_updated;
  ELSE
    RAISE NOTICE 'type_icons.color: colonna non presente, skip';
  END IF;
END $$;

-- 5. user_settings.value per chiave 'action_colors' (JSONB: { none, anytime, deadline, event, allday })
DO $$
DECLARE n_updated int;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_settings' AND column_name = 'value'
  ) THEN
    EXECUTE $sql$
      UPDATE user_settings
      SET value = jsonb_build_object(
        'none',     COALESCE(migrate_legacy_palette_color(value->>'none'),     value->>'none'),
        'anytime',  COALESCE(migrate_legacy_palette_color(value->>'anytime'),  value->>'anytime'),
        'deadline', COALESCE(migrate_legacy_palette_color(value->>'deadline'), value->>'deadline'),
        'event',    COALESCE(migrate_legacy_palette_color(value->>'event'),    value->>'event'),
        'allday',   COALESCE(migrate_legacy_palette_color(value->>'allday'),   value->>'allday')
      )
      WHERE key = 'action_colors'
        AND value IS NOT NULL
    $sql$;
    GET DIAGNOSTICS n_updated = ROW_COUNT;
    RAISE NOTICE 'user_settings.action_colors: % row(s) aggiornate', n_updated;
  ELSE
    RAISE NOTICE 'user_settings.value: colonna non presente, skip';
  END IF;
END $$;

-- Cleanup: rimuovi la funzione helper (non più necessaria dopo la migrazione).
-- Commenta questa riga se vuoi tenerla per debug / re-run manuale.
DROP FUNCTION IF EXISTS migrate_legacy_palette_color(text);
