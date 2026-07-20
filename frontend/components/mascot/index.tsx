/**
 * Gimmick · Obsidian — Beniamini (mascots) barrel.
 *
 * <Beniamino name size/> + the 10 sprites, plus the MascotSuggestion callout.
 * Reference: design_handoff_obsidian/Mascot.dc.html (shapes + fixed colors)
 * and GimmickCaptureFlows.dc.html (suggestion pattern).
 */
export { Beniamino } from './beniamino';
export type { BeniaminoProps } from './beniamino';

export { MascotSuggestion } from './mascot-suggestion';
export type { MascotSuggestionProps, MascotSuggestionItem } from './mascot-suggestion';

export { MascotRosterPanel } from './mascot-roster-panel';

export { BENIAMINO_ROSTER } from './roster';
export type { RosterEntry, RosterSurface } from './roster';

export {
  BENIAMINO_NAMES,
  BENIAMINO_PAIRS,
  BENIAMINO_META,
  BENIAMINO_SVG,
} from './sprites';
export type { BeniaminoName } from './sprites';
