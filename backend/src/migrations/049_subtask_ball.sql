-- Migration 049: la palla del passo
--
-- La 027 ha stabilito che contact_id IS NULL significa "default-mine". Restava
-- scoperto il caso opposto: un passo in mano ad altri senza voler dire a chi.
-- Marcarlo su contact_id ribalterebbe la semantica di tutte le righe esistenti,
-- quindi la marcatura vive su una colonna propria.
--
-- Polarità: FALSE è il valore muto e maggioritario, come `state IS NULL` e come
-- `action_type = 'none'`. Si tocca solo l'eccezione.
--
-- contact_id resta sopra come raffinamento opzionale: se un giorno si vorrà dire
-- CHI, si dirà, e la regola di lettura non cambia.
--
-- ─── Perché la colonna arriva SOLO ORA, e insieme al suo comando ─────────────
--
-- Questa migration era già scritta e non fu eseguita. La ricognizione sui dati
-- veri (05/09/2026) ha mostrato il perché: sui 123 passi aperti, 98 non hanno un
-- contatto, e i 25 che ce l'hanno sono un lascito della migrazione dei vecchi
-- `flow_nodes`. Nessuna schermata scrive `contact_id`: ogni passo nuovo nasce
-- senza, quindi la lista «Tocca a te» sarebbe partita quasi vuota e si sarebbe
-- svuotata da sola.
--
-- Una colonna che nessuna interfaccia può valorizzare non è una fondamenta, è
-- debito. Da qui la scelta di far arrivare la colonna e il pulsante che la
-- scrive nello stesso lavoro.

ALTER TABLE tile_subtasks
  ADD COLUMN IF NOT EXISTS is_theirs BOOLEAN NOT NULL DEFAULT FALSE;

-- Indice parziale: le righe marcate sono e resteranno la minoranza, e l'unica
-- interrogazione che serve è "i passi di questo tile che aspettano altri".
CREATE INDEX IF NOT EXISTS idx_tile_subtasks_theirs
  ON tile_subtasks (tile_id)
  WHERE is_theirs = TRUE;

COMMENT ON COLUMN tile_subtasks.is_theirs IS
  'Marcatura di eccezione: il passo attende una mossa altrui. FALSE = tocca a me (default muto). Un contact_id non-self implica comunque "altri": la regola di lettura sta in subtaskBall().';

-- ─── Travaso ─────────────────────────────────────────────────────────────────
--
-- 27 passi aperti su 28 marcati `blocked` non hanno un contatto. È il profilo
-- esatto di «l'ho fermato perché aspetto qualcuno, senza stare a dire chi» —
-- cioè il caso per cui questa colonna esiste. Accenderli fa nascere la lista
-- «Tocca a te» già popolata, che è l'unico modo di vedere subito se il disegno
-- funziona invece di aspettare settimane di uso.
--
-- ⚠️ RISTRETTO AI FLOW, per decisione esplicita. Fuori da un flusso di attività
-- fra più soggetti la palla non ha significato, e il pulsante che la marca non
-- compare nemmeno: accendere `is_theirs` su una lista della spesa scriverebbe
-- un'informazione che nessuna schermata mostra e nessuno potrebbe correggere.
--
-- ⚠️ NON tocca il lucchetto. `blocked` continua a significare "fermo per un
-- ostacolo" e resta indipendente dalla palla: un passo può essere fermo e
-- toccare a te, o fermo e toccare a me. Qui `blocked` è solo l'indizio con cui
-- si indovina il valore iniziale, una volta sola.
--
-- Idempotente (`AND s.is_theirs = FALSE`), e reversibile con una riga:
--   UPDATE tile_subtasks SET is_theirs = FALSE;

UPDATE tile_subtasks s
SET is_theirs = TRUE
FROM tiles t
WHERE t.id = s.tile_id
  AND t.action_type = 'flow'
  AND s.is_done = FALSE
  AND s.state = 'blocked'
  AND s.contact_id IS NULL
  AND s.is_theirs = FALSE;
