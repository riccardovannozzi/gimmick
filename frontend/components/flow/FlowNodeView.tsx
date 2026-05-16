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
  /** 'square' when the node's contact is the user's self contact (or null);
   *  'circle' when the contact is someone else. Derived once by FlowTrack. */
  shape: 'square' | 'circle';
  /** Skip the label and contact-subline text rendering. Callers that lay out
   *  the label themselves (e.g. fishbone column with label-to-the-right) use
   *  this to keep only the body + decorations from FlowNodeView. */
  hideLabel?: boolean;
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
export function FlowNodeView({ node, x, y, radius = 16, selected = false, contactName, shape, hideLabel = false, onPointerDownBody, onContextMenuBody }: Props) {
  const tsLabel = formatTs(node.occurred_at ?? node.scheduled_at);
  const subParts = [contactName, tsLabel].filter(Boolean) as string[];
  const labelMain = node.label.trim() || '—';
  // Shape encodes ownership: square = self/null contact, circle = other.
  const useSquare = shape === 'square';
  const side = radius * 2;
  // Body is normally black; when the node is selected the fill switches to a
  // mid-grey instead of drawing a white ring around the node (cleaner read in
  // tight clusters). White border + optional status icon stay the same.
  const bodyFill = selected ? '#3F3F46' : '#000000';
  const bodyStroke = '#FFFFFF';
  const statusColor = FLOW_STATE_COLORS[node.state];

  return (
    <g
      transform={`translate(${x},${y})`}
      onPointerDown={(e) => onPointerDownBody?.(e, node.id)}
      onContextMenu={(e) => onContextMenuBody?.(e, node.id)}
      style={{ cursor: 'grab', touchAction: 'none' }}
    >
      {/* Focus halo — red soft "corona" rendered as a slightly larger shape
          behind the body with a CSS blur filter. Reads as a glowing aura
          rather than the previous hard dashed ring, much softer in dense
          clusters but still visually unmistakable. */}
      {node.is_focus && (
        useSquare ? (
          <rect
            x={-radius - 12}
            y={-radius - 12}
            width={side + 24}
            height={side + 24}
            rx={8}
            fill="#EF4444"
            opacity={0.55}
            style={{ filter: 'blur(6px)', pointerEvents: 'none' }}
          />
        ) : (
          <circle
            r={radius + 12}
            fill="#EF4444"
            opacity={0.55}
            style={{ filter: 'blur(6px)', pointerEvents: 'none' }}
          />
        )
      )}

      {/* Selection is conveyed via bodyFill (grey) rather than a ring — see
          the body element below. */}

      {useSquare ? (
        <rect
          x={-radius}
          y={-radius}
          width={side}
          height={side}
          rx={4}
          fill={bodyFill}
          stroke={bodyStroke}
          strokeWidth={1}
        />
      ) : (
        <circle r={radius} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
      )}

      {/* Status decorator inside the body. 'active' draws nothing.
          - done → green check
          - wait → orange hourglass
          - undo → orange slash
          - stop → red X
          Drawn at ~60% of the node radius, centered. */}
      {node.state !== 'active' && (
        <StatusIcon state={node.state} color={statusColor} size={radius * 1.2} />
      )}

      {/* scheduled badge — empty dot inside if future-only and no status
          decorator (decorator takes priority for the inner glyph). */}
      {node.state === 'active' && !node.occurred_at && node.scheduled_at && (
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
          lines are truncated with an ellipsis. Skipped when the caller renders
          its own label (e.g. fishbone column with label-to-the-right). */}
      {!hideLabel && (() => {
        const lines = wrapText(labelMain, 16, 2);
        return lines.map((line, i) => (
          <text
            key={i}
            y={radius + 20 + i * 13}
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
      {!hideLabel && subParts.length > 0 && (() => {
        const labelLines = wrapText(labelMain, 16, 2).length;
        const subY = radius + 20 + labelLines * 13 + 1;
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

/** Status decorator drawn inside the node body. Inline SVG paths sized
 *  relative to the body's radius — no external icon library needed.
 *  Exported so the FlowHub mini-badge can render the exact same glyphs. */
export function StatusIcon({
  state,
  color,
  size,
}: {
  state: 'done' | 'wait' | 'undo' | 'stop';
  color: string;
  size: number;
}) {
  const s = size / 2; // half-extent; glyphs are drawn around origin
  const sw = Math.max(1.6, size * 0.16);
  if (state === 'done') {
    // Check mark: down-stroke from upper-left to mid-bottom, up-stroke to upper-right
    return (
      <path
        d={`M ${-s * 0.7},0 L ${-s * 0.15},${s * 0.55} L ${s * 0.75},${-s * 0.55}`}
        fill="none"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ pointerEvents: 'none' }}
      />
    );
  }
  if (state === 'wait') {
    // Hourglass: two FILLED triangles meeting at the center. Filled looks
    // lighter than a thick outline at this size and keeps a clean silhouette.
    return (
      <g style={{ pointerEvents: 'none' }}>
        <path d={`M ${-s * 0.7},${-s * 0.75} L ${s * 0.7},${-s * 0.75} L 0,0 Z`} fill={color} />
        <path d={`M ${-s * 0.7},${s * 0.75} L ${s * 0.7},${s * 0.75} L 0,0 Z`} fill={color} />
      </g>
    );
  }
  if (state === 'undo') {
    // Slash: a single diagonal line from bottom-left to top-right.
    return (
      <path
        d={`M ${-s * 0.7},${s * 0.7} L ${s * 0.7},${-s * 0.7}`}
        fill="none"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        style={{ pointerEvents: 'none' }}
      />
    );
  }
  // stop → X
  return (
    <g style={{ pointerEvents: 'none' }}>
      <path
        d={`M ${-s * 0.65},${-s * 0.65} L ${s * 0.65},${s * 0.65}`}
        fill="none"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
      />
      <path
        d={`M ${s * 0.65},${-s * 0.65} L ${-s * 0.65},${s * 0.65}`}
        fill="none"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
      />
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
