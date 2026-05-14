/**
 * Flow node visual vocabulary — single source of truth shared by FlowTrack,
 * FlowInspector and FlowHub. Split into two orthogonal axes since the data
 * model now separates "owner" (la palla) and "state" (lifecycle decorator).
 */
import type { FlowNodeOwner, FlowNodeState } from '@/types/flow';

/** Owner palette — only used for the segmented control swatches. Node bodies
 *  themselves are now styled identically (black bg + white border) regardless
 *  of owner; the SHAPE encodes ownership. */
export const FLOW_OWNER_COLORS: Record<FlowNodeOwner, string> = {
  mine: '#378ADD',   // blueBright
  theirs: '#EF9F27', // orangeBright
};

export const FLOW_OWNER_LABELS: Record<FlowNodeOwner, string> = {
  mine: 'Palla mia',
  theirs: 'Palla loro',
};

/** State (status) palette — drives the decorator color inside the node body
 *  for done/wait/undo/stop. 'active' has no decorator. */
export const FLOW_STATE_COLORS: Record<FlowNodeState, string> = {
  active: '#A1A1AA',  // zinc — no decorator drawn; color used only by Inspector swatches
  done: '#1D9E75',    // greenBright   — check
  wait: '#EF9F27',    // orangeBright  — hourglass
  undo: '#EF9F27',    // orangeBright  — slash
  stop: '#E24B4A',    // redBright     — X
};

export const FLOW_STATE_LABELS: Record<FlowNodeState, string> = {
  active: 'Attivo',
  done: 'Fatto',
  wait: 'In attesa',
  undo: 'Annullato',
  stop: 'Bloccato',
};
