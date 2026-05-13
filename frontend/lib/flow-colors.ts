/**
 * Flow node state colors — single source of truth shared by FlowTrack,
 * FlowInspector and FlowHub. Taken from the Airtable palette already in use
 * elsewhere in Gimmick (see lib/palette.ts).
 */
import type { FlowNodeState } from '@/types/flow';

export const FLOW_STATE_COLORS: Record<FlowNodeState, string> = {
  mine: '#378ADD',       // blueBright   — la palla è nostra
  theirs: '#EF9F27',     // orangeBright — in attesa dell'altra parte
  done: '#1D9E75',       // tealBright   — chiuso con successo
  blocked: '#E24B4A',    // redBright    — bloccato
  cancelled: '#888780',  // grayDark1    — annullato
};

export const FLOW_STATE_LABELS: Record<FlowNodeState, string> = {
  mine: 'Palla mia',
  theirs: 'In attesa di loro',
  done: 'Fatto',
  blocked: 'Bloccato',
  cancelled: 'Annullato',
};
