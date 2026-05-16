'use client';

import { computeEdgeWidth } from '@/lib/flow-edge-width';
import { FLOW_STATE_COLORS } from '@/lib/flow-colors';
import type { FlowNode } from '@/types/flow';

interface Props {
  parent: FlowNode;
  child: FlowNode;
  /** SVG path data (`d` attribute). Callers generate the geometry — straight
   *  vertical for same-column edges, bezier for column-crossing branches. */
  d: string;
  /** Current time in ms (Date.now()) — passed in so the whole drawer ticks
   *  from a single clock and edge widths update atomically each refetch. */
  now: number;
}

/**
 * One edge of the Flow DAG: a path whose stroke-width encodes the time
 * elapsed between parent and child. Open child → width keeps growing until
 * the user advances the flow.
 *
 * Color is always white; opacity differentiates lifecycle states (cancelled
 * = dimmest, open = light, done/stop = mid).
 */
export function FlowEdgeView({ parent, child, d, now }: Props) {
  const strokeWidth = computeEdgeWidth(parent, child, now);
  const isOpen = child.state === 'active' || child.state === 'wait';
  const opacity = child.state === 'undo' ? 0.4 : isOpen ? 0.55 : 0.6;

  return (
    <path
      d={d}
      fill="none"
      stroke="#FFFFFF"
      strokeOpacity={opacity}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}
