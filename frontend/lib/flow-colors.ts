/**
 * Flow node visual vocabulary — single source of truth shared by FlowTrack,
 * FlowInspector and FlowHub. Node ownership is derived from `contact_id`
 * (self contact = square, other = circle), so there's no owner palette here:
 * only the `state` axis needs colors/labels.
 */
import type { FlowNodeState } from '@/types/flow';

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
