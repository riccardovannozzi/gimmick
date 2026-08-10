/**
 * Gimmick — La frase della home.
 *
 * Sta in un file suo perché è CONTENUTO, non logica di schermata: si aggiungono
 * righe senza aprire il composer, e chi le scrive non deve leggere del JSX.
 *
 * Due elenchi invece di uno con i segnaposto ovunque: il nome dell'account va
 * citato «ogni tanto», non sempre. Sempre diventerebbe una formula — la terza
 * volta che l'app ti chiama per nome non è più un saluto, è un tic. Pescando da
 * due liste con un peso, capita abbastanza da farsi notare e abbastanza di rado
 * da restare gradito.
 */

/** Frasi che non nominano nessuno. */
const NEUTRAL = [
  'Cos’hai in testa?',
  'Butta dentro, si ordina dopo.',
  'Anche le mezze idee valgono.',
  'Scrivi ora, capirai poi.',
  'Niente è troppo piccolo per finire qui.',
  'La memoria è sopravvalutata.',
  'Prima catturi, poi capisci.',
  'Un pensiero non annotato è un pensiero perso.',
  'Qui non serve che sia ordinato.',
  'Due parole bastano.',
  'Dillo male, tanto lo sistemiamo noi.',
  'Il posto giusto per quel pensiero di prima.',
  'Non pensarci troppo: salvalo.',
  'Le idee migliori arrivano scomode.',
  'Vuoto è pronto.',
];

/** Frasi che nominano l’utente. `{nome}` viene sostituito. */
const NAMED = [
  'Ciao {nome}, cosa salviamo oggi?',
  '{nome}, di’ pure.',
  'Ti ascolto, {nome}.',
  'Allora {nome}, che si dice?',
  'Testa piena, {nome}? Svuotala qui.',
  'Buon lavoro, {nome}.',
  '{nome}, sono tutt’orecchi.',
  'Riprendiamo da dove eravamo, {nome}?',
];

/** Quanto spesso la frase nomina l’utente. */
const NAMED_ODDS = 0.35;

/**
 * Caselle di servizio: sono parole, superano ogni controllo di forma, e
 * darebbero «Ciao Info» — che è più straniante di nessun saluto.
 */
const ROLE_ADDRESSES = new Set([
  'info', 'mail', 'email', 'posta', 'admin', 'amministrazione', 'noreply',
  'no', 'contact', 'contatti', 'contatto', 'hello', 'ciao', 'support',
  'supporto', 'help', 'assistenza', 'team', 'staff', 'ufficio', 'segreteria',
  'me', 'io', 'user', 'utente', 'test', 'demo',
]);

/**
 * Nome da mostrare, ricavato dall’email: la parte prima della @, e di quella
 * solo il primo pezzo.
 *
 * `riccardo.vannozzi@…` → `Riccardo`, non `Riccardo.vannozzi`: un saluto usa il
 * nome, non l’identificativo.
 *
 * Quando quel pezzo non sembra un nome — cifre, una lettera sola, una casella
 * di servizio — si torna `null` e le frasi restano neutre. Non salutare è
 * sempre meglio che salutare male: una riga generica non si nota, «Ciao Info»
 * sì.
 */
export function accountName(email?: string | null): string | null {
  const local = (email ?? '').split('@')[0]?.trim();
  if (!local) return null;

  const first = local.split(/[._\-+]/).filter(Boolean)[0];
  if (!first || first.length < 2) return null;
  if (!/^[a-zà-öø-ÿ]/i.test(first)) return null;
  if (/\d/.test(first)) return null;
  if (ROLE_ADDRESSES.has(first.toLowerCase())) return null;

  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

/**
 * Sceglie la frase. `previous` è quella mostrata l’ultima volta: si evita di
 * ripeterla, perché tornare in home e ritrovare la stessa riga fa sembrare che
 * non sia cambiato nulla — che è l’opposto del punto.
 *
 * Senza un nome utilizzabile pesca solo dalle neutre: un `{nome}` non sostituito
 * a schermo sarebbe peggio di qualunque frase generica.
 */
export function pickGreeting(name: string | null, previous?: string | null): string {
  const useNamed = !!name && Math.random() < NAMED_ODDS;
  const pool = useNamed ? NAMED : NEUTRAL;

  const candidates = pool.length > 1 && previous
    ? pool.filter((l) => render(l, name) !== previous)
    : pool;
  const list = candidates.length > 0 ? candidates : pool;

  return render(list[Math.floor(Math.random() * list.length)], name);
}

function render(line: string, name: string | null): string {
  return name ? line.replace('{nome}', name) : line;
}
