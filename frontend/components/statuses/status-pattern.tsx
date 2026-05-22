'use client';

import { useMemo } from 'react';
import type { StatusShape } from '@/types';
import { readableOn } from '@/lib/palette';

interface StatusPatternProps {
  shape: StatusShape;
  color: string;
  // Background color of the tile/container the pattern is overlaid on.
  // When provided, certain shapes (currently `diagonal_ltr`) derive their
  // ink from `readableOn(bg)` so the pattern matches the title text color.
  bg?: string;
}

let _patternIdCounter = 0;

const PATTERN_STROKE = 2;
const PATTERN_OPACITY = 0.55;
const ICON_STROKE = 3;
const ICON_OPACITY = 0.7;
const ICON_FILL_OPACITY = 0.5;

const overlayStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  pointerEvents: 'none',
  display: 'block',
};

export function StatusPattern({ shape, color, bg }: StatusPatternProps) {
  const uid = useMemo(() => `sp-${++_patternIdCounter}`, []);

  if (shape === 'solid') return null;

  if (shape === 'shade') {
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: '#000000',
          opacity: 0.5,
        }}
      />
    );
  }

  const patternId = `${uid}-pat`;

  return (
    <svg style={overlayStyle} preserveAspectRatio="none">
      {/* Pattern ripetuti: usano pixel reali del rendering (no viewBox) */}
      {shape === 'diagonal_ltr' && (() => {
        const ink = bg ? readableOn(bg) : color;
        return (
          <>
            <defs>
              <pattern id={patternId} patternUnits="userSpaceOnUse" width={10} height={10} patternTransform="rotate(45)">
                <line x1={0} y1={0} x2={0} y2={10} stroke={ink} strokeWidth={1.5} strokeOpacity={1} />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill={`url(#${patternId})`} />
          </>
        );
      })()}
      {shape === 'diagonal_rtl' && (
        <>
          <defs>
            <pattern id={patternId} patternUnits="userSpaceOnUse" width={10} height={10} patternTransform="rotate(-45)">
              <line x1={0} y1={0} x2={0} y2={10} stroke={color} strokeWidth={PATTERN_STROKE} strokeOpacity={PATTERN_OPACITY} />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#${patternId})`} />
        </>
      )}
      {shape === 'vertical' && (
        <>
          <defs>
            <pattern id={patternId} patternUnits="userSpaceOnUse" width={8} height={10}>
              <line x1={4} y1={0} x2={4} y2={10} stroke={color} strokeWidth={PATTERN_STROKE} strokeOpacity={PATTERN_OPACITY} />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#${patternId})`} />
        </>
      )}
      {shape === 'bubble' && (
        <>
          <defs>
            <pattern id={patternId} patternUnits="userSpaceOnUse" width={18} height={18}>
              <circle cx={9} cy={9} r={3} fill="none" stroke={color} strokeWidth={PATTERN_STROKE} strokeOpacity={PATTERN_OPACITY} />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#${patternId})`} />
        </>
      )}

      {/* Icone centrate: SVG annidato con viewBox + non-scaling-stroke */}
      {shape === 'square' && (
        <svg x="0" y="0" width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <rect
            x={6} y={6} width={88} height={88}
            fill="none" stroke={color}
            strokeWidth={PATTERN_STROKE} strokeOpacity={PATTERN_OPACITY}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}
      {shape === 'cross' && (
        <svg x="0" y="0" width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
          <line x1={22} y1={22} x2={78} y2={78} stroke={color} strokeWidth={ICON_STROKE} strokeOpacity={ICON_OPACITY} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <line x1={78} y1={22} x2={22} y2={78} stroke={color} strokeWidth={ICON_STROKE} strokeOpacity={ICON_OPACITY} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
      )}
      {shape === 'target' && (
        <svg x="0" y="0" width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
          <circle cx={50} cy={50} r={28} fill="none" stroke={color} strokeWidth={2} strokeOpacity={ICON_OPACITY} vectorEffect="non-scaling-stroke" />
          <circle cx={50} cy={50} r={16} fill="none" stroke={color} strokeWidth={2} strokeOpacity={ICON_OPACITY} vectorEffect="non-scaling-stroke" />
          <circle cx={50} cy={50} r={5} fill={color} fillOpacity={ICON_FILL_OPACITY} />
        </svg>
      )}
      {shape === 'hourglass' && (
        <svg x="0" y="0" width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
          <path d="M30,22 L70,22 L50,50 L70,78 L30,78 L50,50 Z" fill="none" stroke={color} strokeWidth={ICON_STROKE} strokeOpacity={ICON_OPACITY} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
      )}
      {shape === 'pause_bars' && (
        <svg x="0" y="0" width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
          <rect x={36} y={24} width={9} height={52} rx={1} fill={color} fillOpacity={ICON_OPACITY} />
          <rect x={55} y={24} width={9} height={52} rx={1} fill={color} fillOpacity={ICON_OPACITY} />
        </svg>
      )}
      {shape === 'lock' && (
        <svg x="0" y="0" width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
          <path d="M38,42 V30 a12,12 0 0 1 24,0 V42" fill="none" stroke={color} strokeWidth={2.5} strokeOpacity={ICON_OPACITY} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <rect x={30} y={42} width={40} height={32} rx={3} fill={color} fillOpacity={ICON_FILL_OPACITY} />
        </svg>
      )}
      {shape === 'question' && (
        <svg x="0" y="0" width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
          <text x={50} y={72} textAnchor="middle" fontSize={64} fontWeight={700} fill={color} fillOpacity={ICON_OPACITY} fontFamily="ui-sans-serif, system-ui, sans-serif">?</text>
        </svg>
      )}
      {shape === 'exclamation' && (
        <svg x="0" y="0" width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
          <text x={50} y={72} textAnchor="middle" fontSize={64} fontWeight={700} fill={color} fillOpacity={ICON_OPACITY} fontFamily="ui-sans-serif, system-ui, sans-serif">!</text>
        </svg>
      )}
      {shape === 'arrows' && (
        <svg x="0" y="0" width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
          <line x1={20} y1={36} x2={72} y2={36} stroke={color} strokeWidth={2.5} strokeOpacity={ICON_OPACITY} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <polyline points="62,28 76,36 62,44" fill="none" stroke={color} strokeWidth={2.5} strokeOpacity={ICON_OPACITY} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <line x1={80} y1={64} x2={28} y2={64} stroke={color} strokeWidth={2.5} strokeOpacity={ICON_OPACITY} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <polyline points="38,56 24,64 38,72" fill="none" stroke={color} strokeWidth={2.5} strokeOpacity={ICON_OPACITY} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
      )}
    </svg>
  );
}
