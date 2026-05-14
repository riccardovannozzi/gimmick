'use client';

import { computeEdgeWidth } from '@/lib/flow-edge-width';
import { FLOW_STATE_COLORS } from '@/lib/flow-colors';
import type { FlowNode } from '@/types/flow';

interface Props {
  parent: FlowNode;
  child: FlowNode;
  /** Dagre-provided polyline points (entry/exit + control nodes). */
  points: Array<{ x: number; y: number }>;
  /** Current time in ms (Date.now()) — passed in so the whole drawer ticks
   *  from a single clock and edge widths update atomically each refetch. */
  now: number;
}

/**
 * One edge of the FlowTrack DAG: a curved path whose stroke-width
 * encodes the time elapsed between parent and child. Open child →
 * width keeps growing until the user advances the flow.
 */
export function FlowEdgeView({ parent, child, points, now }: Props) {
  if (!points || points.length < 2) return null;

  const strokeWidth = computeEdgeWidth(parent, child, now);
  // Edge color: dim grey for cancelled flows, owner-tinted for open (active/wait),
  // dim grey for done/stop. The stroke-width carries the visual weight; hue
  // is just a subtle signal of state.
  const isOpen = child.state === 'active' || child.state === 'wait';
  const ownerHue = child.owner === 'mine' ? '#378ADD' : '#EF9F27';
  const color = child.state === 'undo' ? '#444' : isOpen ? ownerHue : '#5A5A60';
  const opacity = child.state === 'undo' ? 0.4 : isOpen ? 0.55 : 0.6;

  return (
    <path
      d={polylinePath(points)}
      fill="none"
      stroke={color}
      strokeOpacity={opacity}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

/** Polyline of straight segments through the supplied points. */
function polylinePath(pts: Array<{ x: number; y: number }>): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    d += ` L ${pts[i].x},${pts[i].y}`;
  }
  return d;
}
