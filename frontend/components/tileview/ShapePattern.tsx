'use client';

import type { PatternShape } from '@/types';

export function ShapePattern({ shape, color }: { shape: PatternShape; color: string }) {
  const svgClass = "absolute top-4 bottom-3 left-0 right-0 w-full";
  switch (shape) {
    case 'solid':
      return null;
    case 'square':
      return (
        <svg className={svgClass} viewBox="0 0 80 68" preserveAspectRatio="none">
          <rect x={6} y={4} width={68} height={60} fill="none" stroke={color} strokeWidth={5} strokeOpacity={0.2} rx={3} />
        </svg>
      );
    case 'diagonal_ltr':
      return (
        <svg className={svgClass} viewBox="0 0 80 68" preserveAspectRatio="none">
          <defs>
            <pattern id="diag-ltr" patternUnits="userSpaceOnUse" width={20} height={20} patternTransform="rotate(45)">
              <line x1={0} y1={0} x2={0} y2={20} stroke={color} strokeWidth={10} strokeOpacity={0.18} />
            </pattern>
          </defs>
          <rect width={80} height={68} fill="url(#diag-ltr)" />
        </svg>
      );
    case 'diagonal_rtl':
      return (
        <svg className={svgClass} viewBox="0 0 80 68" preserveAspectRatio="none">
          <defs>
            <pattern id="diag-rtl" patternUnits="userSpaceOnUse" width={20} height={20} patternTransform="rotate(-45)">
              <line x1={0} y1={0} x2={0} y2={20} stroke={color} strokeWidth={10} strokeOpacity={0.18} />
            </pattern>
          </defs>
          <rect width={80} height={68} fill="url(#diag-rtl)" />
        </svg>
      );
    case 'target':
      return (
        <svg className={svgClass} viewBox="0 0 80 68" preserveAspectRatio="xMidYMid meet">
          <circle cx={40} cy={34} r={20} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={0.3} />
          <circle cx={40} cy={34} r={12} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={0.3} />
          <circle cx={40} cy={34} r={4} fill={color} fillOpacity={0.4} />
        </svg>
      );
    case 'cross':
      return (
        <svg className={svgClass} viewBox="0 0 80 68" preserveAspectRatio="none">
          <line x1={10} y1={6} x2={70} y2={62} stroke={color} strokeWidth={5} strokeOpacity={0.4} strokeLinecap="round" />
          <line x1={70} y1={6} x2={10} y2={62} stroke={color} strokeWidth={5} strokeOpacity={0.4} strokeLinecap="round" />
        </svg>
      );
    case 'bubble':
      return (
        <svg className={svgClass} viewBox="0 0 80 68" preserveAspectRatio="xMidYMid meet">
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
        <svg className={svgClass} viewBox="0 0 80 68" preserveAspectRatio="xMidYMid meet">
          <text x={40} y={50} textAnchor="middle" fontSize={48} fontWeight="bold" fill={color} fillOpacity={0.2} fontFamily="sans-serif">?</text>
        </svg>
      );
    case 'exclamation':
      return (
        <svg className={svgClass} viewBox="0 0 80 68" preserveAspectRatio="xMidYMid meet">
          <text x={40} y={50} textAnchor="middle" fontSize={48} fontWeight="bold" fill={color} fillOpacity={0.2} fontFamily="sans-serif">!</text>
        </svg>
      );
    case 'arrows':
      return (
        <svg className={svgClass} viewBox="0 0 80 68" preserveAspectRatio="xMidYMid meet">
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
