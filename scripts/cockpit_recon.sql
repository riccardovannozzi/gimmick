-- ─────────────────────────────────────────────────────────────────────────────
-- COCKPIT · FASE 0 — Query di ricognizione
--
-- NON modifica niente: sei SELECT in sola lettura. Si esegue nell'editor SQL di
-- Supabase, incollando tutto e premendo Run una volta sola.
--
-- ─── Perche' e' UNA query e non sei ─────────────────────────────────────────
--
-- L'editor SQL di Supabase mostra il risultato dell'ULTIMA istruzione: sei
-- SELECT in fila darebbero un solo risultato e cinque schermate perse. Qui le
-- sei ricognizioni sono unite in un unico elenco a tre colonne
-- (sezione · voce · valore), quindi una Run sola le mostra tutte.
--
-- Il prezzo e' che ogni valore e' TESTO: e' un tabellone da leggere, non un
-- dato su cui fare altri conti. Per la Fase 2 e' esattamente quel che serve.
--
-- ─── Che cosa conta come PASSO APERTO ────────────────────────────────────────
--
-- Questa e' la definizione su cui poggia tutto il resto, ed e' la stessa che la
-- Fase 4 mettera' in `currentStep()`:
--
--     is_done = FALSE  AND  (state IS NULL  OR  state = 'blocked')
--
-- Un passo `cancelled` non e' aperto e non e' fatto: non si fara' piu', quindi
-- esce dal conto invece di restare in eterno fra i pendenti. Un passo `blocked`
-- invece E' aperto — e' fermo, che e' il caso piu' interessante di tutti.
--
-- ─── Ambito ──────────────────────────────────────────────────────────────────
--
-- Le query NON filtrano per utente: sul database attuale c'e' un utente solo, e
-- un filtro cablato su un id sarebbe una bugia il giorno in cui non sara' piu'
-- vero. Se un giorno servisse, ogni CTE ha gia' `user_id` a portata di WHERE.
-- ─────────────────────────────────────────────────────────────────────────────

WITH
-- I passi aperti, una volta sola, riusati da tutte le sezioni.
open_sub AS (
  SELECT
    s.id,
    s.user_id,
    s.tile_id,
    s.state,
    s.contact_id,
    -- La regola di anzianita' della Fase 4 (`stalenessFrom`): quando il passo e'
    -- avvenuto, e in mancanza quando e' nato. MAI `updated_at` — correggere un
    -- refuso in una riga azzererebbe trenta giorni di attesa.
    FLOOR(EXTRACT(EPOCH FROM (NOW() - COALESCE(s.occurred_at, s.created_at))) / 86400)::int AS age_days
  FROM tile_subtasks s
  WHERE s.is_done = FALSE
    AND (s.state IS NULL OR s.state = 'blocked')
),

-- I tile CANDIDATI: quelli che il Cockpit avrebbe qualcosa da dire su di loro,
-- cioe' quelli con almeno un passo aperto.
candidate AS (
  SELECT DISTINCT t.id, t.user_id, t.action_type, t.status_id
  FROM tiles t
  JOIN open_sub s ON s.tile_id = t.id
),

-- Quanti tag di tipo `progetto` porta ciascun tile candidato.
proj_tag AS (
  SELECT tt.tile_id, COUNT(*)::int AS n
  FROM tile_tags tt
  JOIN tags g ON g.id = tt.tag_id
  WHERE g.tag_type = 'progetto'
  GROUP BY tt.tile_id
),

rows_out AS (

  -- ── 1 · Quanti tile hanno almeno un passo aperto ──────────────────────────
  SELECT 1 AS ord, 0 AS sub,
         '1 · TILE CANDIDATI' AS sezione,
         'tile con almeno un passo aperto' AS voce,
         (SELECT COUNT(*) FROM candidate)::text AS valore
  UNION ALL
  SELECT 1, 1, '1 · TILE CANDIDATI', 'tile totali (riferimento)',
         (SELECT COUNT(*) FROM tiles)::text
  UNION ALL
  SELECT 1, 2, '1 · TILE CANDIDATI', 'passi aperti totali (riferimento)',
         (SELECT COUNT(*) FROM open_sub)::text
  UNION ALL
  SELECT 1, 3, '1 · TILE CANDIDATI', 'voci di checklist totali (riferimento)',
         (SELECT COUNT(*) FROM tile_subtasks)::text

  -- ── 2 · Distribuzione dei candidati per action_type e per status ──────────
  --
  -- Lo status vive su `statuses.name` attraverso `tiles.status_id`. Un tile
  -- senza status si legge come `active`: e' lo stato normale e tace.
  UNION ALL
  SELECT 2, ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC, COALESCE(c.action_type, '(nullo)'), COALESCE(st.name, '(nessuno → active)'))::int,
         '2 · CANDIDATI PER TIPO E STATO',
         COALESCE(c.action_type, '(nullo)') || '  ·  ' || COALESCE(st.name, '(nessuno → active)'),
         COUNT(*)::text
  FROM candidate c
  LEFT JOIN statuses st ON st.id = c.status_id
  GROUP BY COALESCE(c.action_type, '(nullo)'), COALESCE(st.name, '(nessuno → active)')

  -- ── 3 · L'ancora: quanti candidati hanno UN tag `progetto` ────────────────
  --
  -- La colonna ancora del Cockpit mostra il progetto di appartenenza. Se molti
  -- candidati non ne hanno nessuno, quella colonna sara' una fila di trattini.
  UNION ALL
  SELECT 3, 0, '3 · TAG PROGETTO SUI CANDIDATI', 'nessun tag progetto',
         (SELECT COUNT(*) FROM candidate c LEFT JOIN proj_tag p ON p.tile_id = c.id
          WHERE COALESCE(p.n, 0) = 0)::text
  UNION ALL
  SELECT 3, 1, '3 · TAG PROGETTO SUI CANDIDATI', 'esattamente un tag progetto',
         (SELECT COUNT(*) FROM candidate c JOIN proj_tag p ON p.tile_id = c.id
          WHERE p.n = 1)::text
  UNION ALL
  SELECT 3, 2, '3 · TAG PROGETTO SUI CANDIDATI', 'piu'' di un tag progetto',
         (SELECT COUNT(*) FROM candidate c JOIN proj_tag p ON p.tile_id = c.id
          WHERE p.n > 1)::text

  -- ── 3b · Quali `tag_type` esistono davvero ────────────────────────────────
  --
  -- Aggiunta alle sei query chieste, e serve a non leggere male la sezione 3.
  -- `tags.tag_type` e' TEXT libero con default 'topic': lo slug 'progetto' e'
  -- una CONVENZIONE, non un valore garantito dallo schema. Se la sezione 3
  -- dicesse "nessuno" su tutta la riga, prima di concludere che l'ancora non
  -- regge conviene guardare qui: potrebbe chiamarsi diversamente.
  UNION ALL
  SELECT 3, 10 + ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC, COALESCE(g.tag_type, '(nullo)'))::int,
         '3b · TAG_TYPE PRESENTI (diagnostica)',
         COALESCE(g.tag_type, '(nullo)'),
         COUNT(*)::text || ' tag'
  FROM tags g
  GROUP BY COALESCE(g.tag_type, '(nullo)')

  -- ── 4 · Lunghezza dei nomi dei tag `progetto` ─────────────────────────────
  --
  -- Decide se l'ancora ci sta in colonna o va troncata.
  UNION ALL
  SELECT 4, 0, '4 · NOMI DEI TAG PROGETTO', 'quanti sono',
         (SELECT COUNT(*) FROM tags WHERE tag_type = 'progetto')::text
  UNION ALL
  SELECT 4, 1, '4 · NOMI DEI TAG PROGETTO', 'lunghezza massima (caratteri)',
         COALESCE((SELECT MAX(LENGTH(name)) FROM tags WHERE tag_type = 'progetto')::text, '—')
  UNION ALL
  SELECT 4, 2, '4 · NOMI DEI TAG PROGETTO', 'lunghezza media (caratteri)',
         COALESCE((SELECT ROUND(AVG(LENGTH(name)), 1) FROM tags WHERE tag_type = 'progetto')::text, '—')
  UNION ALL
  SELECT 4, 3, '4 · NOMI DEI TAG PROGETTO', 'il piu'' lungo',
         COALESCE((SELECT name FROM tags WHERE tag_type = 'progetto'
                   ORDER BY LENGTH(name) DESC, name LIMIT 1), '—')

  -- ── 5 · Anzianita' dei passi aperti ───────────────────────────────────────
  --
  -- E' il numero che dice se le attese sono undici o tre. Se sono tre, un
  -- layout a tre colonne e' sbagliato.
  UNION ALL
  SELECT 5,
         CASE
           WHEN s.age_days < 3  THEN 1
           WHEN s.age_days < 7  THEN 2
           WHEN s.age_days <= 20 THEN 3
           ELSE 4
         END,
         '5 · ANZIANITA'' DEI PASSI APERTI',
         CASE
           WHEN s.age_days < 3  THEN '0–2 giorni'
           WHEN s.age_days < 7  THEN '3–6 giorni'
           WHEN s.age_days <= 20 THEN '7–20 giorni'
           ELSE 'oltre 20 giorni'
         END,
         COUNT(*)::text
  FROM open_sub s
  GROUP BY 2, 4

  -- 6 · PASSI FERMI SENZA UN NOME
  --
  -- Il modello a due zone (tocca a me / aspetto lui) presuppone che di un passo
  -- fermo si sappia chi lo tiene fermo. Molti `blocked` senza contatto
  -- significa che due zone non bastano: ne servirebbe una terza per "fermo e
  -- non so da chi".
  UNION ALL
  SELECT 6, 0, '6 · PASSI FERMI SENZA CONTATTO', 'blocked con contact_id nullo',
         (SELECT COUNT(*) FROM open_sub WHERE state = 'blocked' AND contact_id IS NULL)::text
  UNION ALL
  SELECT 6, 1, '6 · PASSI FERMI SENZA CONTATTO', 'blocked con un contatto',
         (SELECT COUNT(*) FROM open_sub WHERE state = 'blocked' AND contact_id IS NOT NULL)::text
  UNION ALL
  SELECT 6, 2, '6 · PASSI FERMI SENZA CONTATTO', 'aperti NON blocked, con un contatto',
         (SELECT COUNT(*) FROM open_sub WHERE state IS NULL AND contact_id IS NOT NULL)::text
  UNION ALL
  SELECT 6, 3, '6 · PASSI FERMI SENZA CONTATTO', 'aperti NON blocked, senza contatto',
         (SELECT COUNT(*) FROM open_sub WHERE state IS NULL AND contact_id IS NULL)::text
)

SELECT sezione, voce, valore
FROM rows_out
ORDER BY ord, sub, voce;
