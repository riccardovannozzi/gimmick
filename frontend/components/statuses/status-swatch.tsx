'use client';

import type { StatusShape } from '@/types';
import { StatusPattern } from './status-pattern';

/**
 * Swatch compatto di uno status: box colorato con la sua `shape` sovrapposta.
 * Usato dai picker/celle dove lo status va reso in piccolo (TileSidebar,
 * tabella Tiles, card Kanban/Chrono). Per `shape === 'solid'` il pattern è
 * assente e resta il solo box pieno.
 */
export function StatusSwatch({ shape, color, size = 16 }: { shape: StatusShape; color: string; size?: number }) {
  return (
    <span
      style={{
        position: 'relative',
        width: size,
        height: size,
        borderRadius: 4,
        overflow: 'hidden',
        flexShrink: 0,
        display: 'inline-block',
        background: `color-mix(in srgb, ${color} 22%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 45%, transparent)`,
      }}
    >
      <StatusPattern shape={shape} color={color} />
    </span>
  );
}
