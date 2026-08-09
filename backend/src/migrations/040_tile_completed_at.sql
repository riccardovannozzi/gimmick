-- Migration 040: quando un tile è stato completato, non solo se.
--
-- `is_completed` è un booleano: risponde a "è fatto?" e a nient'altro. Non
-- permette di chiedere "cosa ho chiuso questa settimana", né di sapere quanto
-- un'attività è rimasta aperta — due domande che su un archivio di attività
-- sono fra le prime che si pongono.
--
-- ─── Dove viene scritta ──────────────────────────────────────────────────────
--
-- NON è un campo che il client imposta. Il completamento ha già una fonte di
-- verità sola — lo `status_id` che punta allo status di sistema `done`, da cui
-- `is_completed` viene derivato in PATCH /api/tiles/:id (migration 015). Il
-- timestamp si aggancia LÌ, subito dopo, così vale per qualunque strada porti
-- al completamento: cambio di status, flag diretto, o quel che verrà.
--
-- Si scrive solo alla TRANSIZIONE verso completato. Ri-salvare un tile già
-- chiuso non deve spostarne in avanti la data: sarebbe la data dell'ultima
-- modifica, che è `updated_at` e ce l'abbiamo già.
--
-- Tornare a non-completato la azzera: un tile riaperto non ha un momento di
-- chiusura, e conservarlo significherebbe che una riga può dirsi aperta e
-- chiusa allo stesso tempo.

ALTER TABLE tiles
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- ─── Backfill ────────────────────────────────────────────────────────────────
--
-- Per i tile già completati il momento esatto è perduto: nessuno lo registrava.
-- `updated_at` è l'approssimazione migliore disponibile — sul tile completato è
-- quasi sempre proprio la modifica che l'ha chiuso.
--
-- Approssimare è meglio che lasciare NULL: con NULL ogni filtro temporale
-- ignorerebbe in silenzio tutto lo storico, e una domanda come "quante ne ho
-- chiuse quest'anno" risponderebbe con un numero falso invece che con uno
-- impreciso. Chi legge questo campo su dati anteriori alla migration sappia che
-- vale "chiuso entro questa data", non "chiuso esattamente allora".
UPDATE tiles
   SET completed_at = updated_at
 WHERE is_completed = true
   AND completed_at IS NULL;

-- Le interrogazioni sono sempre per utente e in ordine di chiusura ("le ultime
-- che ho completato"). Indice parziale: i tile aperti non hanno questo campo, e
-- in un archivio sano sono la maggioranza.
CREATE INDEX IF NOT EXISTS idx_tiles_completed_at
  ON tiles (user_id, completed_at DESC)
  WHERE completed_at IS NOT NULL;

COMMENT ON COLUMN tiles.completed_at IS
  'Quando il tile è stato completato. Scritto alla sola transizione verso completato, azzerato alla riapertura. Sui tile chiusi prima della migration 040 è un''approssimazione ricavata da updated_at.';
