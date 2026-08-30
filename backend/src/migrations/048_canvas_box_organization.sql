-- 048_canvas_box_organization.sql
--
-- Quinto tipo di box del canvas: l'ORGANIZZAZIONE. E, insieme, il cambio di
-- natura del SOGGETTO: da scheda a puntatore.
--
-- ─── Cosa cambia per il soggetto ─────────────────────────────────────────────
--
-- La 046 aveva scritto, in fondo al suo commento:
--
--     «Se un domani servisse il collegamento, `content` è JSONB: ci si aggiunge
--      un `contact_id` senza toccare lo schema.»
--
-- Il domani è arrivato, e la previsione era giusta a metà. Il collegamento
-- serve, ma non come campo dentro un JSONB: come COLONNA con una foreign key.
-- La differenza non è di stile — è che il database può garantire che il
-- contatto puntato esista davvero, e può portarsi via il box quando il contatto
-- non c'è più. Dentro il JSONB sarebbe stato un id che nessuno controlla.
--
-- Da qui in poi un box soggetto/organizzazione NON contiene più i dati della
-- persona: li PUNTA. Nome, mail, telefono e note sono righe di `contacts`, dove
-- stanno anche i contatti dei passi dei tile — una persona sola, un posto solo.
-- `content` resta per le proprietà di DISEGNO (nulla, oggi).
--
-- ─── Perché un solo tipo non bastava ─────────────────────────────────────────
--
-- Soggetto e organizzazione puntano alla stessa tabella e si distinguono per il
-- `kind` del contatto. Si poteva quindi tenere un tipo solo e disegnarne la
-- faccia in base al kind. Non l'ho fatto: il tipo del box dice che cosa hai
-- POSATO sulla lavagna, e resta quello anche se un domani quel contatto cambia
-- kind in rubrica. Un'icona che cambia forma da sola perché qualcuno ha
-- riclassificato un contatto in un'altra schermata è esattamente il genere di
-- sorpresa che non si spiega.
--
-- ─── La conversione dei soggetti già posati ──────────────────────────────────
--
-- Ogni box `subject` esistente diventa un contatto vero, e il box lo punta.
--
-- NESSUNA fusione con contatti omonimi già in rubrica, e nessuna fusione fra
-- box omonimi: due box con lo stesso nome diventano due contatti. È la scelta
-- REVERSIBILE — unire due schede a mano è un minuto, separare due persone che
-- il database ha deciso essere la stessa non si può più. Se ne escono dei
-- doppioni, si uniscono dalla rubrica.
--
-- Il vecchio `content` non viene conservato: da qui in poi c'è una sola fonte,
-- e tenerne una seconda in ombra era il problema da cui siamo partiti.
--
-- Idempotente: il ciclo lavora solo sui box con `contact_id IS NULL`, quindi una
-- seconda esecuzione non crea niente.

-- ── 1. Il tipo nuovo ────────────────────────────────────────────────────────
ALTER TABLE canvas_boxes DROP CONSTRAINT IF EXISTS canvas_boxes_type_check;
ALTER TABLE canvas_boxes
  ADD CONSTRAINT canvas_boxes_type_check
  CHECK (type IN ('text', 'image', 'marker', 'subject', 'organization'));

-- ── 2. Il puntatore ─────────────────────────────────────────────────────────
--
-- CASCADE, non SET NULL. È la differenza con `tile_subtasks.contact_id`, che
-- usa SET NULL, e la ragione è che le due cose non sono la stessa: un passo di
-- un tile è un LAVORO, e resta un lavoro anche se perde la persona a cui era
-- assegnato. Un box soggetto invece È la presenza di quella persona su quella
-- lavagna: tolto il contatto, resterebbe una figurina che non rappresenta più
-- nessuno.
ALTER TABLE canvas_boxes
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE;

-- Parziale: la stragrande maggioranza dei box (testi, immagini, marcatori) ha
-- questa colonna a NULL e non ha motivo di stare nell'indice.
CREATE INDEX IF NOT EXISTS canvas_boxes_contact_id_idx
  ON canvas_boxes(contact_id) WHERE contact_id IS NOT NULL;

-- ── 3. I soggetti già posati diventano contatti ─────────────────────────────
DO $$
DECLARE
  b RECORD;
  new_contact_id UUID;
BEGIN
  FOR b IN
    SELECT id, user_id, content
    FROM canvas_boxes
    WHERE type = 'subject' AND contact_id IS NULL
  LOOP
    INSERT INTO contacts (user_id, name, kind, email, phone, notes)
    VALUES (
      b.user_id,
      -- Un box senza nome è legittimo (lo si posa e lo si nomina dopo), ma
      -- `contacts.name` è NOT NULL: gli si dà lo stesso nome che la lavagna già
      -- mostrava al suo posto, così la riga in rubrica si riconosce.
      COALESCE(NULLIF(btrim(b.content->>'name'), ''), 'Soggetto senza nome'),
      'person',
      NULLIF(btrim(b.content->>'email'), ''),
      NULLIF(btrim(b.content->>'phone'), ''),
      NULLIF(btrim(b.content->>'notes'), '')
    )
    RETURNING id INTO new_contact_id;

    UPDATE canvas_boxes
    SET contact_id = new_contact_id,
        content = '{}'::jsonb
    WHERE id = b.id;
  END LOOP;
END $$;
