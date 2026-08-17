/**
 * audit-ownership.ts — inventario delle query che usano un id senza dire di chi è.
 *
 * ⚠️ Il backend interroga Supabase con la SERVICE ROLE KEY, che bypassa la Row
 * Level Security (vedi `utils/ownership.ts`). Su questo percorso l'unica barriera
 * fra un utente e i dati di un altro è il filtro scritto a mano. Questo script
 * cerca i punti dove quel filtro manca.
 *
 * Perché uno script e non un grep una tantum: chiudere i buchi di oggi senza
 * lasciare una rete significa ritrovarne tre nuovi fra un mese, scritti in buona
 * fede da chi non aveva presente il problema. Girando dentro `npm run check`,
 * questo file trasforma una bonifica in una regola che resta.
 *
 * ─── Come classifica ────────────────────────────────────────────────────────
 *
 * Per ogni statement che interroga una tabella filtrando su un id:
 *
 *   VERDE     filtra anche `user_id` nella stessa query → la riga di un altro
 *             utente non può nemmeno essere selezionata.
 *   ASSERITO  non filtra, ma nella stessa funzione c'è un `assert*Owned()` —
 *             la proprietà è accertata prima, e la query è legittima.
 *   ANNOTATO  dichiarato sicuro a mano, con il motivo scritto accanto:
 *               `// ownership-audit: <motivo>`     sulla singola query
 *               `// ownership-audit-fn: <motivo>`  nel commento di una funzione,
 *                                                  e vale per tutte le sue query
 *             Il secondo serve ai servizi di background, dove l'id non arriva
 *             dal client e la verifica sta al bordo: annotare venti query una
 *             per una sarebbe rumore, e il contratto è della funzione, non della
 *             riga. Resta però per funzione e non per file: una funzione NUOVA
 *             nasce rossa, che è il punto di avere una rete. Il motivo è
 *             obbligatorio — un'esenzione senza spiegazione è indistinguibile da
 *             una dimenticanza.
 *   ROSSO     nessuna delle tre. Fa uscire lo script con codice 1.
 *
 * L'analisi è testuale, non semantica: può sbagliare in eccesso (segnalare una
 * query che un lettore umano assolverebbe) ma è tarata per non sbagliare in
 * difetto. Un falso allarme costa un'annotazione; un falso silenzio costa i dati
 * di un utente.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOTS = ['src/routes', 'src/services'];

type Verdict = 'green' | 'asserted' | 'annotated' | 'red';

interface Finding {
  file: string;
  line: number;
  table: string;
  filters: string;
  /** Scrittura (insert/update/delete/upsert) o sola lettura. */
  writes: boolean;
  verdict: Verdict;
  note?: string;
}

/** Statement che tocca una tabella filtrando su un id: `.eq('id'|'*_id', …)`. */
const ID_FILTER = /\.(?:eq|in)\(\s*['"]((?:[a-z_]+_)?id)['"]/g;
const WRITE_CALL = /\.(?:insert|update|upsert|delete)\(/;
/**
 * Inizio del blocco che "possiede" lo statement: la dichiarazione TOP-LEVEL che
 * lo contiene — handler di rotta o funzione. Deliberatamente a colonna zero (`^`
 * con flag `m`): il proprietario di una query è la funzione, non la callback in
 * cui capita di trovarsi. Prendendo il blocco più vicino, una query dentro un
 * `.map(async …)` risultava fuori dalla sua funzione, e sia gli `assert` sia il
 * contratto dichiarato sopra le passavano accanto senza vederla.
 */
const BLOCK_START = /^(?:\w+Router\.(?:get|post|patch|put|delete)\(|(?:export\s+)?(?:async\s+)?function\s+\w+|(?:export\s+)?const\s+\w+\s*=)/gm;
const ANNOTATION = /\/\/\s*ownership-audit:\s*(.+)/;
/** Contratto dichiarato sul commento della funzione: vale per tutte le sue query. */
const FN_ANNOTATION = /(?:\/\/|\*)\s*ownership-audit-fn:\s*(.+)/;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (entry.name.endsWith('.ts')) out.push(p);
  }
  return out;
}

/** Offset di inizio di ogni riga, per tradurre un indice in numero di riga. */
function lineIndex(src: string): number[] {
  const offsets = [0];
  for (let i = 0; i < src.length; i++) if (src[i] === '\n') offsets.push(i + 1);
  return offsets;
}

/**
 * Toglie i commenti prima di cercare il filtro. Senza, la parola `user_id`
 * scritta in un commento — per esempio proprio per spiegare che lì il filtro
 * NON si può mettere — assolveva la query: la rete si apriva esattamente dove
 * qualcuno si stava dando pena di ragionare sulla proprietà.
 */
function stripComments(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

function lineAt(offsets: number[], index: number): number {
  let lo = 0, hi = offsets.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (offsets[mid] <= index) lo = mid; else hi = mid - 1;
  }
  return lo + 1;
}

function analyse(file: string): Finding[] {
  const src = fs.readFileSync(file, 'utf8');
  const offsets = lineIndex(src);
  const findings: Finding[] = [];

  // Gli statement si separano sul `;`: basta a isolare una catena Supabase, che
  // è sempre una singola espressione anche quando occupa dieci righe.
  let cursor = 0;
  for (const chunk of src.split(';')) {
    const start = cursor;
    cursor += chunk.length + 1;

    if (!chunk.includes('.from(')) continue;
    const code = stripComments(chunk);
    const filters = [...code.matchAll(ID_FILTER)].map((m) => m[1]);
    if (filters.length === 0) continue;

    const table = /\.from\(\s*['"]([a-z_]+)['"]/.exec(code)?.[1] ?? '?';
    // Ci si posiziona sulla QUERY, non sull'inizio dello statement: uno
    // statement comincia dopo il `;` precedente, che può stare righe più su —
    // anche prima della funzione che lo contiene. Con l'offset sbagliato la
    // ricerca del blocco finiva sulla dichiarazione precedente, e il contratto
    // scritto sulla funzione giusta non veniva visto.
    const queryAt = start + Math.max(0, chunk.indexOf('.from('));
    const line = lineAt(offsets, queryAt);
    const writes = WRITE_CALL.test(code);
    const base = { file, line, table, filters: [...new Set(filters)].join(', '), writes };

    if (/user_id/.test(code)) {
      findings.push({ ...base, verdict: 'green' });
      continue;
    }

    // Annotazione: dentro lo statement o nelle due righe che lo precedono.
    const before = src.slice(Math.max(0, start - 240), start);
    const annotation = ANNOTATION.exec(chunk) ?? ANNOTATION.exec(before);
    if (annotation) {
      findings.push({ ...base, verdict: 'annotated', note: annotation[1].trim() });
      continue;
    }

    // Verifica a monte: si guarda dall'inizio del blocco che contiene lo
    // statement, non da tutto il file — un `assert` in un'altra funzione non
    // protegge questa.
    BLOCK_START.lastIndex = 0;
    let blockStart = 0;
    for (const m of src.slice(0, queryAt).matchAll(BLOCK_START)) blockStart = m.index ?? blockStart;
    const window = src.slice(blockStart, queryAt + chunk.length);
    if (/assert\w*Owned\s*\(/.test(window)) {
      findings.push({ ...base, verdict: 'asserted' });
      continue;
    }

    // Contratto dichiarato sulla funzione. Si guarda anche PRIMA della sua
    // dichiarazione, perché è lì che vive il commento che la descrive.
    const fnNote = FN_ANNOTATION.exec(src.slice(Math.max(0, blockStart - 1200), blockStart + 200));
    if (fnNote) {
      findings.push({ ...base, verdict: 'annotated', note: fnNote[1].trim() });
      continue;
    }

    findings.push({ ...base, verdict: 'red' });
  }

  return findings;
}

function main(): void {
  const files = ROOTS.flatMap((r) => (fs.existsSync(r) ? walk(r) : []));
  const all = files.flatMap(analyse);

  const red = all.filter((f) => f.verdict === 'red');
  const grouped = new Map<string, Finding[]>();
  for (const f of all) {
    if (f.verdict === 'green') continue; // il caso normale non si stampa
    const list = grouped.get(f.file) ?? [];
    list.push(f);
    grouped.set(f.file, list);
  }

  const mark: Record<Verdict, string> = {
    green: '  ok  ',
    asserted: ' ASSER',
    annotated: ' ANNOT',
    red: ' ROSSO',
  };

  for (const [file, list] of [...grouped].sort()) {
    console.log(`\n${file}`);
    for (const f of list.sort((a, b) => a.line - b.line)) {
      const kind = f.writes ? 'W' : 'R';
      console.log(`  ${mark[f.verdict]} L${String(f.line).padEnd(5)} ${kind}  ${f.table.padEnd(18)} ${f.filters}${f.note ? `  — ${f.note}` : ''}`);
    }
  }

  const count = (v: Verdict) => all.filter((f) => f.verdict === v).length;
  console.log(`\n─── ${all.length} query con id · ${count('green')} filtrano user_id · ${count('asserted')} verificate a monte · ${count('annotated')} annotate · ${red.length} SENZA PROTEZIONE`);

  if (red.length > 0) {
    console.log('\nOgni ROSSO va chiuso in uno dei tre modi: filtro `user_id`, `assert*Owned()`');
    console.log('nella stessa funzione, oppure `// ownership-audit: <motivo>` se è davvero sicuro.');
    process.exit(1);
  }
}

main();
