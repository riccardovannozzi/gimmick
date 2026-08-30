-- 047_contact_organizations.sql
--
-- L'APPARTENENZA: chi fa parte di che cosa.
--
-- ─── Perché NON è una tabella "organizations" ────────────────────────────────
--
-- La richiesta era «un oggetto che rappresenti un insieme di soggetti, una
-- organizzazione», e con essa «due database distinti». Il secondo database però
-- esiste già, ed è lo stesso del primo: `contacts` ha un campo `kind` che vale
-- person / company / professional / institution / other (022_flows.sql). Una
-- persona e un'organizzazione ci stanno dentro entrambe da sempre — la rubrica
-- non è mai stata una rubrica di sole persone.
--
-- Aggiungere `subjects` e `organizations` avrebbe messo lo stesso "Mario Rossi"
-- in tre posti (rubrica, soggetto, e il box del canvas) senza niente che li
-- tenesse allineati, e prima o poi qualcuno avrebbe dovuto decidere quale dei
-- tre è quello vero.
--
-- Quello che davvero non esisteva è il LEGAME. Ed è questa tabella, una sola.
--
-- ─── Cosa dice una riga ──────────────────────────────────────────────────────
--
--   member_id fa parte di org_id
--
-- Molti-a-molti in entrambi i versi: un soggetto sta in più organizzazioni, e
-- un'organizzazione ha più membri. È la relazione chiesta («attribuire ad un
-- soggetto una o più organizzazioni»), letta anche al contrario senza aggiungere
-- niente.
--
-- ─── Cosa NON è vincolato, e perché ─────────────────────────────────────────
--
-- 1. I `kind` dei due capi. Verrebbe spontaneo imporre member=person e
--    org=company, ma sarebbe sbagliato: una società controllata FA PARTE di una
--    capogruppo, e un professionista fa parte di uno studio. Entrambi i capi
--    sono contatti e basta; a scegliere che cosa proporre nei menu è
--    l'interfaccia, che è il posto giusto per una convenzione — non un vincolo
--    di integrità, che è il posto delle cose impossibili.
--
-- 2. I CICLI. A sta in B, B sta in A: vietarlo vuol dire una closure ricorsiva
--    a ogni scrittura, e oggi nessuna schermata percorre la gerarchia in
--    profondità. Se un domani lo farà, dovrà difendersi da sé — sta scritto qui
--    perché chi ci arriva lo sappia prima di scoprirlo con un ciclo infinito.
--
-- L'unica cosa davvero impossibile è che qualcosa faccia parte di sé stesso, e
-- quella sì è un CHECK.
--
-- ─── Cancellazioni ───────────────────────────────────────────────────────────
--
-- CASCADE su entrambi i capi: l'appartenenza non sopravvive a nessuno dei due.
-- Non c'è niente da conservare in «un id cancellato fa parte di un altro id».
--
-- Idempotente: sicura da riapplicare.

CREATE TABLE IF NOT EXISTS contact_organizations (
  -- Ridondante rispetto ai due capi (che sono già dello stesso utente), ma è la
  -- colonna su cui si regge la RLS: senza, ogni policy dovrebbe passare da una
  -- sottoquery su `contacts` a ogni riga letta.
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES contacts(id)   ON DELETE CASCADE,
  org_id    UUID NOT NULL REFERENCES contacts(id)   ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Chiave composta e nessun id surrogato: la riga È la coppia, come in
  -- `tile_tags`. Dà gratis l'unicità (una sola appartenenza per coppia) e
  -- l'indice per la lettura più frequente, «le organizzazioni di questo
  -- soggetto».
  PRIMARY KEY (member_id, org_id),
  CONSTRAINT contact_organizations_no_self CHECK (member_id <> org_id)
);

-- La lettura al contrario, «i membri di questa organizzazione»: la chiave
-- composta parte da member_id e non la serve.
CREATE INDEX IF NOT EXISTS contact_organizations_org_idx  ON contact_organizations(org_id);
CREATE INDEX IF NOT EXISTS contact_organizations_user_idx ON contact_organizations(user_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- RLS — stesso pattern di 036_rls_missing_tables.sql
--
-- Il backend passa dalla service role key e bypassa tutto: queste policy
-- chiudono l'altro ingresso, PostgREST con la chiave anon, che è pubblica.
-- L'UPDATE ha anche WITH CHECK: col solo USING un utente potrebbe riscrivere lo
-- user_id di una propria riga e regalarla a un altro.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE contact_organizations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contact_organizations' AND policyname = 'contact_organizations_select_own') THEN
    CREATE POLICY contact_organizations_select_own ON contact_organizations FOR SELECT USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contact_organizations' AND policyname = 'contact_organizations_insert_own') THEN
    CREATE POLICY contact_organizations_insert_own ON contact_organizations FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contact_organizations' AND policyname = 'contact_organizations_update_own') THEN
    CREATE POLICY contact_organizations_update_own ON contact_organizations FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contact_organizations' AND policyname = 'contact_organizations_delete_own') THEN
    CREATE POLICY contact_organizations_delete_own ON contact_organizations FOR DELETE USING (user_id = auth.uid());
  END IF;
END $$;
