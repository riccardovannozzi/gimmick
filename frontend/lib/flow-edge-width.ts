/**
 * Edge stroke-width formula for the FlowTrack DAG.
 *
 * Δt = child.occurred_at (or NOW if still open)
 *      − parent.occurred_at | parent.scheduled_at | parent.created_at
 *
 * stroke_width = clamp(1 + log10(max(Δt / 1h, 1)) * 2.5, min=1, max=12)
 *
 * Edge into a `done`/`undo`/`stop` node → snapshot at the time of closure.
 * Edge into an open node (`active`/`wait`) → grows over time because `now`
 * keeps moving.
 */
import type { FlowNode } from '@/types/flow';

const MIN_WIDTH = 1;
const MAX_WIDTH = 12;
const SLOPE = 2.5;
const HOUR_MS = 60 * 60 * 1000;

export function computeEdgeWidth(parent: FlowNode, child: FlowNode, now: number = Date.now()): number {
  const parentTs = parent.occurred_at ?? parent.scheduled_at ?? parent.created_at;
  if (!parentTs) return MIN_WIDTH;

  // For closed children (done/undo/stop), the snapshot is fixed at
  // occurred_at. For open ones (active/wait), measure against NOW so the line
  // keeps growing.
  const childTs = child.occurred_at ?? (isOpen(child) ? new Date(now).toISOString() : child.updated_at);

  const deltaMs = new Date(childTs).getTime() - new Date(parentTs).getTime();
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) return MIN_WIDTH;

  const hours = Math.max(deltaMs / HOUR_MS, 1);
  const raw = 1 + Math.log10(hours) * SLOPE;
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, raw));
}

function isOpen(node: FlowNode): boolean {
  return node.state === 'active' || node.state === 'wait';
}
