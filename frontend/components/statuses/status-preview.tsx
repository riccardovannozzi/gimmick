'use client';

import type { StatusShape } from '@/types';
import { StatusPattern } from './status-pattern';

const PREVIEW_COLOR = '#888780';

interface StatusPreviewProps {
  shape: StatusShape;
  size?: number;
  color?: string;
  selected?: boolean;
}

export function StatusPreview({ shape, size = 40, color = PREVIEW_COLOR, selected }: StatusPreviewProps) {
  const stripeH = Math.max(4, Math.round(size * 0.12));
  const previewBg = '#1C1C1E';
  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: size,
        height: size,
        borderRadius: 6,
        border: selected ? `1.5px solid #3B82F6` : '0.5px solid #3f3f46',
        backgroundColor: previewBg,
      }}
    >
      {/* Color stripe */}
      <div
        className="absolute top-0 left-0 right-0"
        style={{ height: stripeH, backgroundColor: color }}
      />
      {/* Pattern (full-bleed) */}
      <StatusPattern shape={shape} color={color} bg={previewBg} />
    </div>
  );
}

export const SHAPE_LABELS: Record<StatusShape, string> = {
  solid: 'Solid',
  diagonal_ltr: 'Diagonal /',
  diagonal_rtl: 'Diagonal \\',
  vertical: 'Vertical',
  bubble: 'Bubble',
  square: 'Square',
  target: 'Target',
  cross: 'Cross',
  question: '?',
  exclamation: '!',
  arrows: 'Arrows',
  hourglass: 'Hourglass',
  pause_bars: 'Pause',
  lock: 'Lock',
  shade: 'Shade',
};

export const ALL_SHAPES: StatusShape[] = [
  'solid', 'diagonal_ltr', 'diagonal_rtl', 'vertical', 'bubble', 'cross',
  'hourglass', 'pause_bars', 'lock', 'shade',
];
