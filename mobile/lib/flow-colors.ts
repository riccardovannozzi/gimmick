/**
 * Flow node visual vocabulary — port of frontend/lib/flow-colors.ts. Single
 * source of truth for status colors/labels shared by FlowTrack and
 * FlowInspector on mobile.
 */
import type { FlowNodeState } from '@/types';

export const FLOW_STATE_COLORS: Record<FlowNodeState, string> = {
  active: '#A1A1AA', // zinc — no decorator drawn; color used only by Inspector swatches
  done: '#1D9E75',   // greenBright   — check
  wait: '#EF9F27',   // orangeBright  — hourglass
  undo: '#EF9F27',   // orangeBright  — slash
  stop: '#E24B4A',   // redBright     — X
};

export const FLOW_STATE_LABELS: Record<FlowNodeState, string> = {
  active: 'Attivo',
  done: 'Fatto',
  wait: 'In attesa',
  undo: 'Annullato',
  stop: 'Bloccato',
};
