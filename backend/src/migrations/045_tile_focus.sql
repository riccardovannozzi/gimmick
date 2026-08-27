-- Migration 045: "focus" su un tile.
--
-- Marca l'attività su cui si sta lavorando ADESSO. Non è uno status e non ne
-- prende il posto: uno status dice a che punto è l'attività (attiva, in pausa,
-- bloccata), il focus dice che è quella che hai davanti. Un tile può essere
-- «attivo» senza essere quello di adesso, e uno «bloccato» può benissimo essere
-- il pezzo su cui stai sbattendo la testa. Sono due assi, quindi due colonne.
--
-- NON è esclusivo: più tile possono essere in focus insieme. È il caso reale di
-- chi ha due o tre fronti aperti in una giornata, e imporre l'unicità qui
-- avrebbe voluto dire decidere anche il suo raggio d'azione — per utente? per
-- tag? per canvas? — cioè scriverla nel database prima di sapere quale delle tre
-- serve. Un flag per riga lascia la domanda aperta, e l'unicità si può sempre
-- aggiungere dopo con un indice parziale.
--
-- Idempotente.

ALTER TABLE tiles
  ADD COLUMN IF NOT EXISTS is_focused BOOLEAN NOT NULL DEFAULT FALSE;

-- Indice PARZIALE: le righe in focus sono una manciata su migliaia, e la sola
-- domanda che si fa a questa colonna è «quali sono». Un indice pieno avrebbe
-- indicizzato anche le decine di migliaia di FALSE, che non serve a nessuno.
CREATE INDEX IF NOT EXISTS tiles_user_focused_idx
  ON tiles(user_id)
  WHERE is_focused = TRUE;
