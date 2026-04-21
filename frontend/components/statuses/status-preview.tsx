'use client';

import type { StatusShape } from '@/types';

const PREVIEW_COLOR = '#888780';

function StatusSvg({ shape, color }: { shape: StatusShape; color: string }) {
  // Shape positioned below the header stripe, same as in TileSquare
  const svgStyle = "absolute left-0 right-0 w-full";
  const svgClass = `${svgStyle}`;
  switch (shape) {
    case 'solid':
      return null;
    case 'square':
      return (
        <svg className={svgClass} style={{ top: '15%', bottom: '5%' }} viewBox="0 0 80 68" preserveAspectRatio="none">
          <rect x={6} y={4} width={68} height={60} fill="none" stroke={color} strokeWidth={5} strokeOpacity={0.2} rx={3} />
        </svg>
      );
    case 'diagonal_ltr':
      return (
        <svg className={svgClass} style={{ top: '15%', bottom: '5%' }} viewBox="0 0 80 68" preserveAspectRatio="none">
          <defs>
            <pattern id="prev-diag-ltr" patternUnits="userSpaceOnUse" width={20} height={20} patternTransform="rotate(45)">
              <line x1={0} y1={0} x2={0} y2={20} stroke={color} strokeWidth={10} strokeOpacity={0.18} />
            </pattern>
          </defs>
          <rect x={5} y={5} width={70} height={58} rx={4} fill="url(#prev-diag-ltr)" />
        </svg>
      );
    case 'diagonal_rtl':
      return (
        <svg className={svgClass} style={{ top: '15%', bottom: '5%' }} viewBox="0 0 80 68" preserveAspectRatio="none">
          <defs>
            <pattern id="prev-diag-rtl" patternUnits="userSpaceOnUse" width={20} height={20} patternTransform="rotate(-45)">
              <line x1={0} y1={0} x2={0} y2={20} stroke={color} strokeWidth={10} strokeOpacity={0.18} />
            </pattern>
          </defs>
          <rect x={5} y={5} width={70} height={58} rx={4} fill="url(#prev-diag-rtl)" />
        </svg>
      );
    case 'target':
      return (
        <svg className={svgClass} style={{ top: '15%', bottom: '5%' }} viewBox="0 0 80 68" preserveAspectRatio="xMidYMid meet">
          <circle cx={40} cy={34} r={20} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={0.3} />
          <circle cx={40} cy={34} r={12} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={0.3} />
          <circle cx={40} cy={34} r={4} fill={color} fillOpacity={0.4} />
        </svg>
      );
    case 'cross':
      // 10-unit padding from edges, thicker stroke.
      return (
        <svg className={svgClass} style={{ top: '15%', bottom: '5%' }} viewBox="0 0 80 68" preserveAspectRatio="none">
          <line x1={10} y1={10} x2={70} y2={58} stroke={color} strokeWidth={8} strokeOpacity={0.45} strokeLinecap="round" />
          <line x1={70} y1={10} x2={10} y2={58} stroke={color} strokeWidth={8} strokeOpacity={0.45} strokeLinecap="round" />
        </svg>
      );
    case 'bubble':
      // Scattered across the tile (padding 10 from each edge), varied sizes.
      return (
        <svg className={svgClass} style={{ top: '15%', bottom: '5%' }} viewBox="0 0 80 68" preserveAspectRatio="none">
          <circle cx={18} cy={16} r={5} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={0.3} />
          <circle cx={38} cy={14} r={3} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={0.22} />
          <circle cx={58} cy={18} r={6} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={0.32} />
          <circle cx={16} cy={34} r={4} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={0.25} />
          <circle cx={38} cy={36} r={7} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={0.35} />
          <circle cx={60} cy={38} r={4} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={0.25} />
          <circle cx={20} cy={54} r={5} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={0.28} />
          <circle cx={42} cy={54} r={4} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={0.22} />
          <circle cx={60} cy={52} r={6} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={0.3} />
        </svg>
      );
    case 'question':
      return (
        <svg className={svgClass} style={{ top: '15%', bottom: '5%' }} viewBox="0 0 80 68" preserveAspectRatio="xMidYMid meet">
          <text x={40} y={50} textAnchor="middle" fontSize={48} fontWeight="bold" fill={color} fillOpacity={0.2} fontFamily="sans-serif">?</text>
        </svg>
      );
    case 'exclamation':
      return (
        <svg className={svgClass} style={{ top: '15%', bottom: '5%' }} viewBox="0 0 80 68" preserveAspectRatio="xMidYMid meet">
          <text x={40} y={50} textAnchor="middle" fontSize={48} fontWeight="bold" fill={color} fillOpacity={0.2} fontFamily="sans-serif">!</text>
        </svg>
      );
    case 'arrows':
      return (
        <svg className={svgClass} style={{ top: '15%', bottom: '5%' }} viewBox="0 0 80 68" preserveAspectRatio="xMidYMid meet">
          <line x1={15} y1={22} x2={60} y2={22} stroke={color} strokeWidth={4} strokeOpacity={0.25} strokeLinecap="round" />
          <polyline points="50,14 62,22 50,30" fill="none" stroke={color} strokeWidth={4} strokeOpacity={0.25} strokeLinecap="round" strokeLinejoin="round" />
          <line x1={65} y1={46} x2={20} y2={46} stroke={color} strokeWidth={4} strokeOpacity={0.25} strokeLinecap="round" />
          <polyline points="30,38 18,46 30,54" fill="none" stroke={color} strokeWidth={4} strokeOpacity={0.25} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'vertical':
      return (
        <svg className={svgClass} viewBox="0 0 80 68" preserveAspectRatio="none">
          <defs>
            <pattern id="prev-vert" patternUnits="userSpaceOnUse" width={16} height={20}>
              <line x1={8} y1={0} x2={8} y2={20} stroke={color} strokeWidth={6} strokeOpacity={0.18} />
            </pattern>
          </defs>
          <rect width={80} height={68} fill="url(#prev-vert)" />
        </svg>
      );
    case 'hourglass':
      // Two triangles meeting at the apex: top pointing down, bottom pointing up.
      return (
        <svg className={svgClass} style={{ top: '15%', bottom: '5%' }} viewBox="0 0 80 68" preserveAspectRatio="xMidYMid meet">
          <path d="M24,18 L56,18 L40,34 L56,50 L24,50 L40,34 Z" fill="none" stroke={color} strokeWidth={4} strokeOpacity={0.5} strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      );
    case 'pause_bars':
      // Two thick vertical bars centered — the classic ⏸ icon.
      return (
        <svg className={svgClass} style={{ top: '15%', bottom: '5%' }} viewBox="0 0 80 68" preserveAspectRatio="xMidYMid meet">
          <rect x={31} y={14} width={7} height={40} rx={1} fill={color} fillOpacity={0.35} />
          <rect x={42} y={14} width={7} height={40} rx={1} fill={color} fillOpacity={0.35} />
        </svg>
      );
    case 'lock':
      // Padlock: body + shackle arc.
      return (
        <svg className={svgClass} style={{ top: '15%', bottom: '5%' }} viewBox="0 0 80 68" preserveAspectRatio="xMidYMid meet">
          <path d="M32,28 V20 a8,8 0 0 1 16,0 V28" fill="none" stroke={color} strokeWidth={2.5} strokeOpacity={0.4} strokeLinecap="round" />
          <rect x={26} y={28} width={28} height={24} rx={3} fill={color} fillOpacity={0.3} />
          <circle cx={40} cy={40} r={2} fill="#1C1C1E" />
        </svg>
      );
    case 'shade':
      // 50% dark overlay covering the whole tile — the "faded out / done" treatment.
      return (
        <svg className={svgClass} style={{ top: '0', bottom: '0' }} viewBox="0 0 80 68" preserveAspectRatio="none">
          <rect width={80} height={68} fill="#000000" opacity={0.5} />
        </svg>
      );
    default:
      return null;
  }
}

interface StatusPreviewProps {
  shape: StatusShape;
  size?: number;
  color?: string;
  selected?: boolean;
}

export function StatusPreview({ shape, size = 40, color = PREVIEW_COLOR, selected }: StatusPreviewProps) {
  const stripeH = Math.max(4, Math.round(size * 0.12));
  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: size,
        height: size,
        borderRadius: 6,
        border: selected ? `1.5px solid #3B82F6` : '0.5px solid #3f3f46',
        backgroundColor: '#1C1C1E',
      }}
    >
      {/* Color stripe */}
      <div
        className="absolute top-0 left-0 right-0"
        style={{ height: stripeH, backgroundColor: color }}
      />
      {/* Shape */}
      <StatusSvg shape={shape} color={color} />
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
