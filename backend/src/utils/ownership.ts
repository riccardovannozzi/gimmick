/**
 * Verifiche di proprietà — la sola barriera fra un utente e i dati di un altro.
 *
 * ⚠️ Il backend interroga Supabase con la SERVICE ROLE KEY, che BYPASSA la Row
 * Level Security. Le policy sul database non filtrano nulla di ciò che passa da
 * qui: proteggono l'altro ingresso (PostgREST con la chiave anon), non questo.
 * L'unico controllo che resta su questo percorso è quello scritto a mano.
 *
 * Regola: se un id arriva dal client — parametro di rotta, body, query string —
 * va verificato PRIMA di usarlo. Un `.eq('id', x)` senza `user_id` è legittimo
 * solo se la proprietà è già stata accertata poche righe sopra, nella stessa
 * funzione.
 *
 * Attenzione al caso subdolo: una verifica che esiste ma non blocca (risultato
 * mai controllato, `if` senza `return`, errore ingoiato) non è una verifica.
 * Per questo le funzioni qui sotto SOLLEVANO invece di restituire un booleano:
 * ignorarne l'esito richiede di ignorare un'eccezione, che è molto più difficile
 * da fare per distrazione.
 */
import { supabaseAdmin } from '../config/supabase.js';
import { NotFoundError } from '../middleware/errorHandler.js';

/**
 * Verifica che il tile appartenga all'utente.
 *
 * Solleva 404 e non 403: un 403 confermerebbe che l'id esiste, e per chi sonda
 * a tentativi la differenza fra "non esiste" e "esiste ma non è tuo" è già
 * un'informazione. Stesso criterio già adottato in `routes/flow.ts`.
 */
export async function assertTileOwned(userId: string, tileId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from('tiles')
    .select('id')
    .eq('id', tileId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new NotFoundError('Tile not found');
}

/** Come sopra, per un tag. */
export async function assertTagOwned(userId: string, tagId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from('tags')
    .select('id')
    .eq('id', tagId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new NotFoundError('Tag not found');
}

/**
 * Verifica in UNA sola query che tutti i tile passati appartengano all'utente.
 *
 * Un ciclo di `assertTileOwned` costerebbe una query per elemento su operazioni
 * che sono per natura in blocco (taggare 40 tile insieme). Qui si confrontano
 * gli insiemi: se anche un solo id non torna indietro, l'intera operazione
 * fallisce — nessun risultato parziale, che su una scrittura in blocco sarebbe
 * peggio del rifiuto.
 *
 * Gli id elencati nel messaggio d'errore sono quelli che il client ha appena
 * inviato: non rivelano nulla che non sapesse già.
 */
export async function assertTilesOwned(userId: string, tileIds: string[]): Promise<void> {
  const unique = [...new Set(tileIds)];
  if (unique.length === 0) return;

  const { data, error } = await supabaseAdmin
    .from('tiles')
    .select('id')
    .eq('user_id', userId)
    .in('id', unique);
  if (error) throw error;

  const owned = new Set((data ?? []).map((t) => t.id as string));
  const missing = unique.filter((id) => !owned.has(id));
  if (missing.length > 0) {
    throw new NotFoundError(`Tile not found: ${missing.join(', ')}`);
  }
}
