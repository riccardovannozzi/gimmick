/**
 * Domain-specific Italian synonyms for the unified `find` tool.
 *
 * Used as the first (deterministic, free) step of query expansion before the
 * LLM expansion. Keeps the keyword search robust against the most common
 * naming variations the user actually types.
 *
 * Maintenance: keep entries grouped by category. New rows should come from
 * observed query failures in the find logs (queries that returned 0 results
 * even though matching content existed).
 */
const DOMAIN_SYNONYMS: Record<string, string[]> = {
  // ── GTD / produttività ──
  'appunto': ['nota', 'memo', 'promemoria'],
  'nota': ['appunto', 'memo', 'promemoria'],
  'da fare': ['task', 'todo', 'attività', 'azione'],
  'task': ['da fare', 'todo', 'attività'],
  'scadenza': ['deadline', 'termine'],
  'deadline': ['scadenza', 'termine'],
  'evento': ['appuntamento', 'impegno', 'meeting', 'riunione'],
  'appuntamento': ['evento', 'impegno', 'meeting'],
  'impegno': ['evento', 'appuntamento'],
  'meeting': ['riunione', 'incontro', 'evento'],
  'riunione': ['meeting', 'incontro'],
  'call': ['chiamata', 'videocall', 'videochiamata'],

  // ── Formazione / professionale ──
  'corso': ['formazione', 'lezione', 'seminario', 'workshop', 'training'],
  'corso di aggiornamento': ['seminario', 'workshop', 'formazione professionale'],
  'seminario': ['corso', 'workshop', 'lezione', 'convegno'],
  'workshop': ['seminario', 'corso pratico', 'laboratorio'],
  'aggiornamento': ['formazione', 'corso', 'refresh'],

  // ── Edilizia / professione ──
  'sopralluogo': ['ispezione', 'visita in cantiere', 'verifica sul posto'],
  'ispezione': ['sopralluogo', 'verifica', 'controllo'],
  'cantiere': ['lavori', 'sito di costruzione'],
  'ordine': ['albo', 'associazione professionale'],
  'ordine degli ingegneri': ['albo ingegneri', 'ordine ingegneri'],
  'ingegneri': ['albo', 'ordine'],

  // ── Gimmick interno ──
  'tile': ['scheda', 'card', 'elemento'],
  'spark': ['frammento', 'contenuto', 'appunto rapido'],
  'tag': ['etichetta', 'categoria', 'contesto'],
};

/**
 * Expand a natural-language query using the local dictionary.
 * Returns at minimum [query], at most [query, ...synonyms].
 *
 * Matching strategy:
 *   1. Whole-query lookup (case-insensitive)
 *   2. Per-token lookup
 *   3. Bigram (two consecutive tokens) lookup
 */
export function expandWithDictionary(query: string): string[] {
  const normalized = query.toLowerCase().trim();
  const expansions = new Set<string>([query]);

  if (DOMAIN_SYNONYMS[normalized]) {
    DOMAIN_SYNONYMS[normalized].forEach((s) => expansions.add(s));
  }

  const tokens = normalized.split(/\s+/);
  for (let i = 0; i < tokens.length; i++) {
    if (DOMAIN_SYNONYMS[tokens[i]]) {
      DOMAIN_SYNONYMS[tokens[i]].forEach((s) => expansions.add(s));
    }
    if (i < tokens.length - 1) {
      const bigram = `${tokens[i]} ${tokens[i + 1]}`;
      if (DOMAIN_SYNONYMS[bigram]) {
        DOMAIN_SYNONYMS[bigram].forEach((s) => expansions.add(s));
      }
    }
  }

  return Array.from(expansions);
}
