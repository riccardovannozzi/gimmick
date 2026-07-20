/**
 * Gimmick · Obsidian — Beniamini (mascot) sprite data.
 *
 * EXACT transcription of design_handoff_obsidian/Mascot.dc.html:
 *   - the 10 SVG shapes (viewBox 0 0 96 96), and
 *   - the fixed color pairs (`--m1`, `--m2`).
 *
 * ⚠️ The color pairs are IDENTITY — do not modify them. Each sprite uses
 * `var(--m1)` / `var(--m2)` for its body colors and `var(--mascot-ink, #26212f)`
 * for the eyes; those CSS variables are set by <Beniamino> on a wrapper.
 */

export const BENIAMINO_NAMES = [
  'gimmick', 'surfer', 'tilo', 'kron', 'buffy',
  'bito', 'sloth', 'flocky', 'snappy', 'ballerina',
] as const;

export type BeniaminoName = (typeof BENIAMINO_NAMES)[number];

/** Fixed identity color pairs [m1, m2]. Do not change. */
export const BENIAMINO_PAIRS: Record<BeniaminoName, readonly [string, string]> = {
  gimmick:   ['#AB9FF2', '#5B8DEF'],
  surfer:    ['#5B8DEF', '#E87DA0'],
  tilo:      ['#B7AEEA', '#8A7FD6'],
  kron:      ['#7C8AA8', '#5B8DEF'],
  buffy:     ['#6FCF97', '#E0B341'],
  bito:      ['#56C2E6', '#AB9FF2'],
  sloth:     ['#C8A98A', '#6FCF97'],
  flocky:    ['#E0B341', '#EF6A6A'],
  snappy:    ['#E87DA0', '#7C5CCB'],
  ballerina: ['#AB9FF2', '#E87DA0'],
};

/** Display name + role, from the system showcase. */
export const BENIAMINO_META: Record<BeniaminoName, { label: string; role: string }> = {
  gimmick:   { label: 'Gimmick',   role: 'THE MASCOT' },
  surfer:    { label: 'Surfer',    role: 'THE RIDER' },
  tilo:      { label: 'Tilo',      role: 'THE ARCHIVIST' },
  kron:      { label: 'Kron',      role: 'THE TIMEKEEPER' },
  buffy:     { label: 'Buffy',     role: 'THE CARRIER' },
  bito:      { label: 'Bito',      role: 'THE ASSISTANT' },
  sloth:     { label: 'Sloth',     role: 'THE CHILL' },
  flocky:    { label: 'Flocky',    role: 'THE EARLY BIRD' },
  snappy:    { label: 'Snappy',    role: 'THE SNAPPER' },
  ballerina: { label: 'Ballerina', role: 'THE DANCER' },
};

/** Raw SVG markup per mascot — verbatim from Mascot.dc.html. */
export const BENIAMINO_SVG: Record<BeniaminoName, string> = {
  gimmick: '<svg viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg"><line x1="34" y1="22" x2="30" y2="9" stroke="var(--m1)" stroke-width="4" stroke-linecap="round"/><circle cx="30" cy="8" r="4" fill="var(--m2)"/><line x1="62" y1="22" x2="66" y2="9" stroke="var(--m1)" stroke-width="4" stroke-linecap="round"/><circle cx="66" cy="8" r="4" fill="var(--m2)"/><rect x="20" y="20" width="56" height="50" rx="20" fill="var(--m1)"/><circle cx="38" cy="44" r="6" fill="var(--mascot-ink,#26212f)"/><circle cx="58" cy="44" r="6" fill="var(--mascot-ink,#26212f)"/><circle cx="40" cy="42" r="2" fill="#fff"/><circle cx="60" cy="42" r="2" fill="#fff"/><rect x="40" y="56" width="16" height="5" rx="2.5" fill="var(--m2)"/><rect x="30" y="70" width="12" height="14" rx="6" fill="var(--m1)"/><rect x="54" y="70" width="12" height="14" rx="6" fill="var(--m1)"/></svg>',
  surfer: '<svg viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg"><ellipse cx="48" cy="78" rx="40" ry="9" fill="var(--m2)"/><rect x="14" y="40" width="24" height="7" rx="3.5" fill="var(--m1)" transform="rotate(-18 26 43)"/><rect x="58" y="40" width="24" height="7" rx="3.5" fill="var(--m1)" transform="rotate(18 70 43)"/><rect x="34" y="32" width="28" height="32" rx="14" fill="var(--m1)"/><circle cx="48" cy="24" r="13" fill="var(--m1)"/><circle cx="44" cy="23" r="3.5" fill="var(--mascot-ink,#26212f)"/><circle cx="54" cy="23" r="3.5" fill="var(--mascot-ink,#26212f)"/><rect x="43" y="30" width="10" height="3" rx="1.5" fill="var(--m2)"/></svg>',
  tilo: '<svg viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg"><path d="M24 50 a24 24 0 0 1 48 0 v28 l-8 -7 l-8 7 l-8 -7 l-8 7 l-8 -7 z" fill="var(--m1)"/><circle cx="40" cy="46" r="5.5" fill="var(--mascot-ink,#26212f)"/><circle cx="56" cy="46" r="5.5" fill="var(--mascot-ink,#26212f)"/><circle cx="42" cy="44" r="1.8" fill="#fff"/><circle cx="58" cy="44" r="1.8" fill="#fff"/><ellipse cx="33" cy="56" rx="4" ry="3" fill="var(--m2)" opacity="0.5"/><ellipse cx="63" cy="56" rx="4" ry="3" fill="var(--m2)" opacity="0.5"/></svg>',
  kron: '<svg viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg"><rect x="30" y="6" width="12" height="8" rx="3" fill="var(--m2)" transform="rotate(-20 36 10)"/><rect x="54" y="6" width="12" height="8" rx="3" fill="var(--m2)" transform="rotate(20 60 10)"/><circle cx="48" cy="42" r="30" fill="var(--m1)"/><circle cx="48" cy="42" r="22" fill="#fff" opacity="0.16"/><line x1="48" y1="42" x2="48" y2="26" stroke="var(--mascot-ink,#26212f)" stroke-width="4" stroke-linecap="round"/><line x1="48" y1="42" x2="60" y2="48" stroke="var(--mascot-ink,#26212f)" stroke-width="4" stroke-linecap="round"/><circle cx="48" cy="42" r="3.5" fill="var(--mascot-ink,#26212f)"/><rect x="38" y="70" width="7" height="16" rx="3.5" fill="var(--m1)"/><rect x="51" y="70" width="7" height="16" rx="3.5" fill="var(--m1)"/></svg>',
  buffy: '<svg viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg"><rect x="20" y="54" width="20" height="8" rx="4" fill="var(--m1)" transform="rotate(20 30 58)"/><rect x="56" y="54" width="20" height="8" rx="4" fill="var(--m1)" transform="rotate(-20 66 58)"/><rect x="22" y="26" width="52" height="46" rx="22" fill="var(--m1)"/><circle cx="38" cy="44" r="5.5" fill="var(--mascot-ink,#26212f)"/><circle cx="58" cy="44" r="5.5" fill="var(--mascot-ink,#26212f)"/><circle cx="40" cy="42" r="1.8" fill="#fff"/><circle cx="60" cy="42" r="1.8" fill="#fff"/><rect x="36" y="56" width="24" height="20" rx="4" fill="var(--m2)"/><line x1="48" y1="56" x2="48" y2="76" stroke="var(--mascot-ink,#26212f)" stroke-width="2" opacity="0.3"/><rect x="32" y="74" width="11" height="10" rx="5" fill="var(--m1)"/><rect x="53" y="74" width="11" height="10" rx="5" fill="var(--m1)"/></svg>',
  bito: '<svg viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg"><line x1="48" y1="18" x2="48" y2="8" stroke="var(--m1)" stroke-width="4" stroke-linecap="round"/><circle cx="48" cy="6" r="4" fill="var(--m2)"/><rect x="18" y="18" width="60" height="50" rx="16" fill="var(--m1)"/><rect x="26" y="26" width="44" height="34" rx="10" fill="#11131a" opacity="0.18"/><circle cx="40" cy="42" r="5" fill="var(--mascot-ink,#26212f)"/><circle cx="56" cy="42" r="5" fill="var(--mascot-ink,#26212f)"/><path d="M40 52 q8 7 16 0" stroke="var(--m2)" stroke-width="3.5" fill="none" stroke-linecap="round"/><rect x="30" y="68" width="14" height="14" rx="6" fill="var(--m1)"/><rect x="52" y="68" width="14" height="14" rx="6" fill="var(--m1)"/></svg>',
  sloth: '<svg viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg"><rect x="24" y="26" width="48" height="52" rx="24" fill="var(--m1)"/><ellipse cx="38" cy="46" rx="9" ry="11" fill="var(--m2)" opacity="0.45"/><ellipse cx="58" cy="46" rx="9" ry="11" fill="var(--m2)" opacity="0.45"/><path d="M32 47 q6 4 12 0" stroke="var(--mascot-ink,#26212f)" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M52 47 q6 4 12 0" stroke="var(--mascot-ink,#26212f)" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="48" cy="58" r="3" fill="var(--m2)"/><path d="M40 66 q8 6 16 0" stroke="var(--mascot-ink,#26212f)" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.5"/><rect x="30" y="76" width="7" height="14" rx="3.5" fill="var(--m1)"/><rect x="59" y="76" width="7" height="14" rx="3.5" fill="var(--m1)"/></svg>',
  flocky: '<svg viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg"><circle cx="42" cy="17" r="5" fill="var(--m2)"/><circle cx="50" cy="13" r="5" fill="var(--m2)"/><circle cx="58" cy="17" r="5" fill="var(--m2)"/><ellipse cx="48" cy="50" rx="26" ry="28" fill="var(--m1)"/><circle cx="42" cy="42" r="4.5" fill="var(--mascot-ink,#26212f)"/><circle cx="56" cy="42" r="4.5" fill="var(--mascot-ink,#26212f)"/><path d="M44 52 l8 0 l-4 8 z" fill="var(--m2)"/><line x1="40" y1="76" x2="40" y2="87" stroke="var(--m2)" stroke-width="3" stroke-linecap="round"/><line x1="56" y1="76" x2="56" y2="87" stroke="var(--m2)" stroke-width="3" stroke-linecap="round"/></svg>',
  snappy: '<svg viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg"><rect x="30" y="22" width="22" height="10" rx="4" fill="var(--m1)"/><rect x="14" y="30" width="68" height="46" rx="12" fill="var(--m1)"/><circle cx="48" cy="53" r="17" fill="#11131a" opacity="0.22"/><circle cx="48" cy="53" r="11" fill="var(--mascot-ink,#26212f)"/><circle cx="48" cy="53" r="5" fill="var(--m2)"/><circle cx="52" cy="49" r="2.5" fill="#fff" opacity="0.85"/><circle cx="68" cy="40" r="3.5" fill="var(--m2)"/></svg>',
  ballerina: '<svg viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg"><rect x="20" y="26" width="22" height="6" rx="3" fill="var(--m1)" transform="rotate(-35 31 29)"/><rect x="54" y="26" width="22" height="6" rx="3" fill="var(--m1)" transform="rotate(35 65 29)"/><circle cx="48" cy="22" r="11" fill="var(--m1)"/><circle cx="44" cy="21" r="2.5" fill="var(--mascot-ink,#26212f)"/><circle cx="52" cy="21" r="2.5" fill="var(--mascot-ink,#26212f)"/><rect x="42" y="32" width="12" height="22" rx="6" fill="var(--m1)"/><path d="M48 50 l26 14 q-26 10 -52 0 z" fill="var(--m2)"/><rect x="42" y="62" width="5" height="22" rx="2.5" fill="var(--m1)" transform="rotate(12 44 70)"/><rect x="49" y="62" width="5" height="22" rx="2.5" fill="var(--m1)" transform="rotate(-12 52 70)"/></svg>',
};
