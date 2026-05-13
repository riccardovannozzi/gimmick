'use client';

import { FLOW_STATE_COLORS } from '@/lib/flow-colors';
import type { FlowNode } from '@/types/flow';

interface Props {
  node: FlowNode;
  x: number;
  y: number;
  radius?: number;
  selected?: boolean;
  contactName?: string | null;
  /** 'square' for state==='mine' (the user's ball), 'circle' otherwise. */
  shape?: 'square' | 'circle';
  /** Pointer-down on the node body — used by FlowTrack to start a drag
   *  (re-position). The parent decides whether the gesture ends in a
   *  selection (no move) or a position update (move > threshold). */
  onPointerDownBody?: (e: React.PointerEvent<SVGGElement>, id: string) => void;
  /** Right-click on the node — parent shows a context menu. */
  onContextMenuBody?: (e: React.MouseEvent<SVGGElement>, id: string) => void;
}

/**
 * One node of the FlowTrack DAG.
 *   - Filled circle, color from state palette
 *   - Label sotto: `[label or fallback] · [contact?] · [time?]`
 *   - 2px white-tinted ring when selected
 */
export function FlowNodeView({ node, x, y, radius = 11, selected = false, contactName, shape, onPointerDownBody, onContextMenuBody }: Props) {
  const color = FLOW_STATE_COLORS[node.state];
  const tsLabel = formatTs(node.occurred_at ?? node.scheduled_at);
  const subParts = [contactName, tsLabel].filter(Boolean) as string[];
  const labelMain = node.label.trim() || '—';
  // Default rule: "Palla mia" = square, others = circle.
  const useSquare = shape ? shape === 'square' : node.state === 'mine';
  const side = radius * 2;

  return (
    <g
      transform={`translate(${x},${y})`}
      onPointerDown={(e) => onPointerDownBody?.(e, node.id)}
      onContextMenu={(e) => onContextMenuBody?.(e, node.id)}
      style={{ cursor: 'grab', touchAction: 'none' }}
    >
      {/* Focus ring — red, painted UNDER the selection ring so both can
          coexist. Sized at radius + 14 with a thick stroke so it reads as
          a distinct "corona" around the (small) node body. */}
      {node.is_focus && (
        useSquare ? (
          <rect
            x={-radius - 14}
            y={-radius - 14}
            width={side + 28}
            height={side + 28}
            rx={6}
            fill="none"
            stroke="#EF4444"
            strokeWidth={4}
            strokeOpacity={1}
          />
        ) : (
          <circle r={radius + 14} fill="none" stroke="#EF4444" strokeWidth={4} strokeOpacity={1} />
        )
      )}

      {/* Selection ring — white, on top of focus ring. */}
      {selected && (
        useSquare ? (
          <rect
            x={-radius - 4}
            y={-radius - 4}
            width={side + 8}
            height={side + 8}
            rx={4}
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={2}
            strokeOpacity={0.9}
          />
        ) : (
          <circle r={radius + 4} fill="none" stroke="#FFFFFF" strokeWidth={2} strokeOpacity={0.9} />
        )
      )}

      {useSquare ? (
        <rect
          x={-radius}
          y={-radius}
          width={side}
          height={side}
          rx={4}
          fill={color}
          stroke="rgba(0,0,0,0.25)"
          strokeWidth={1}
        />
      ) : (
        <circle r={radius} fill={color} stroke="rgba(0,0,0,0.25)" strokeWidth={1} />
      )}

      {/* scheduled badge — empty dot inside if future-only */}
      {!node.occurred_at && node.scheduled_at && (
        useSquare ? (
          <rect
            x={-radius * 0.45}
            y={-radius * 0.45}
            width={radius * 0.9}
            height={radius * 0.9}
            rx={2}
            fill="none"
            stroke="#FFFFFF"
            strokeOpacity={0.7}
            strokeWidth={2}
          />
        ) : (
          <circle r={radius * 0.45} fill="none" stroke="#FFFFFF" strokeOpacity={0.7} strokeWidth={2} />
        )
      )}
      {/* Label below — wrapped over up to 2 lines (16 chars each); 3rd+
          lines are truncated with an ellipsis. */}
      {(() => {
        const lines = wrapText(labelMain, 16, 2);
        return lines.map((line, i) => (
          <text
            key={i}
            y={radius + 14 + i * 13}
            textAnchor="middle"
            fontSize={11}
            fontWeight={500}
            fill="#E4E4E7"
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            {line}
          </text>
        ));
      })()}
      {subParts.length > 0 && (() => {
        const labelLines = wrapText(labelMain, 16, 2).length;
        const subY = radius + 14 + labelLines * 13 + 1;
        return (
          <text
            y={subY}
            textAnchor="middle"
            fontSize={9}
            fill="#A1A1AA"
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            {clamp(subParts.join(' · '), 36)}
          </text>
        );
      })()}
    </g>
  );
}

/** Greedy word-wrap into at most `maxLines` lines. Each line caps at
 *  `maxChars`; the last line gets an ellipsis if the input doesn't fit. */
function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return ['—'];
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const candidate = cur ? `${cur} ${w}` : w;
    if (candidate.length <= maxChars) {
      cur = candidate;
    } else {
      if (cur) lines.push(cur);
      if (lines.length >= maxLines) {
        cur = '';
        break;
      }
      // Word alone may still exceed maxChars — hard-truncate.
      cur = w.length > maxChars ? `${w.slice(0, maxChars - 1)}…` : w;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  // If we still had words to place, mark the last line as truncated.
  const placed = lines.join(' ').split(/\s+/).filter(Boolean).length;
  if (placed < words.length) {
    const last = lines[lines.length - 1] || '';
    lines[lines.length - 1] = last.slice(0, Math.max(0, maxChars - 1)) + '…';
  }
  return lines;
}

function clamp(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}

function formatTs(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return sameYear ? `${dd}/${mm} ${hh}:${min}` : `${dd}/${mm}/${yy}`;
}
