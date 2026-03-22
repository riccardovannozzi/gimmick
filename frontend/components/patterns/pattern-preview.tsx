'use client';

import type { PatternShape } from '@/types';

const PREVIEW_COLOR = '#888780';

function PatternSvg({ shape, color }: { shape: PatternShape; color: string }) {
  // Pattern positioned below the header stripe, same as in TileSquare
  const svgStyle = "absolute left-0 right-0 w-full";
  // Use top ~15% for stripe, bottom ~5% for footer margin
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
          <rect width={80} height={68} fill="url(#prev-diag-ltr)" />
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
          <rect width={80} height={68} fill="url(#prev-diag-rtl)" />
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
      return (
        <svg className={svgClass} style={{ top: '15%', bottom: '5%' }} viewBox="0 0 80 68" preserveAspectRatio="none">
          <line x1={10} y1={6} x2={70} y2={62} stroke={color} strokeWidth={5} strokeOpacity={0.4} strokeLinecap="round" />
          <line x1={70} y1={6} x2={10} y2={62} stroke={color} strokeWidth={5} strokeOpacity={0.4} strokeLinecap="round" />
        </svg>
      );
    case 'bubble':
      return (
        <svg className={svgClass} style={{ top: '15%', bottom: '5%' }} viewBox="0 0 80 68" preserveAspectRatio="xMidYMid meet">
          <circle cx={18} cy={14} r={8} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={0.25} />
          <circle cx={58} cy={10} r={5} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={0.2} />
          <circle cx={40} cy={30} r={11} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={0.3} />
          <circle cx={14} cy={48} r={6} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={0.2} />
          <circle cx={62} cy={38} r={9} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={0.25} />
          <circle cx={35} cy={56} r={7} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={0.22} />
          <circle cx={68} cy={58} r={4} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={0.18} />
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
    default:
      return null;
  }
}

interface PatternPreviewProps {
  shape: PatternShape;
  size?: number;
  color?: string;
  selected?: boolean;
}

export function PatternPreview({ shape, size = 40, color = PREVIEW_COLOR, selected }: PatternPreviewProps) {
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
      {/* Pattern */}
      <PatternSvg shape={shape} color={color} />
    </div>
  );
}

export const SHAPE_LABELS: Record<PatternShape, string> = {
  solid: 'Solid',
  diagonal_ltr: 'Diagonal /',
  diagonal_rtl: 'Diagonal \\',
  square: 'Square',
  target: 'Target',
  cross: 'Cross',
  bubble: 'Bubble',
  question: '?',
  exclamation: '!',
  arrows: 'Arrows',
};

export const ALL_SHAPES: PatternShape[] = ['solid', 'diagonal_ltr', 'diagonal_rtl', 'square', 'target', 'cross', 'bubble', 'question', 'exclamation', 'arrows'];
