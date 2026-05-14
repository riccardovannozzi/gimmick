'use client';

import { useRef } from 'react';
import { IconInbox } from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import type { Tile } from '@/types';

interface Props {
  /** Tiles belonging to the current tag that are NOT yet positioned on the
   *  canvas (no entry in canvas_layout). Drag them into the canvas to place. */
  tiles: Tile[];
  /** Element ref forwarded out — the canvas page uses it for hit-testing
   *  when a canvas tile is dragged back here. */
  panelRef: React.RefObject<HTMLDivElement | null>;
  /** True while a canvas-side tile is being dragged. The panel highlights
   *  itself as a drop target. */
  isCanvasDragActive?: boolean;
  /** Whether the panel is currently the active drop target (mouse inside). */
  isDropTargetHover?: boolean;
  /** Click handler — opens the tile in the right sidebar. */
  onTileClick?: (tileId: string) => void;
}

const TILE_W = 160;
const TILE_H = 56;

/**
 * Vertical "parcheggio" sandwiched between the left Sidebar (tag list) and
 * the canvas. Lists tiles that exist in the current tag but have no canvas
 * position yet. Each tile is HTML5-draggable; the canvas listens for the
 * matching drop and creates the layout entry at drop coordinates.
 *
 * Drag-back (canvas tile dragged here): the D3 drag in CanvasBoard publishes
 * mouse coords via a custom event/callback; if the gesture ends over this
 * panel's bounding rect, the canvas page removes that tile's canvas_layout
 * entry, sending it back to staging.
 */
export function StagingPanel({
  tiles,
  panelRef,
  isCanvasDragActive,
  isDropTargetHover,
  onTileClick,
}: Props) {
  const onDragStart = (e: React.DragEvent, tileId: string) => {
    e.dataTransfer.setData('text/x-canvas-tile-id', tileId);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      ref={panelRef}
      data-staging-panel
      className={cn(
        'w-44 shrink-0 border-r border-zinc-800 bg-zinc-950/40 flex flex-col transition-colors',
        isCanvasDragActive && 'bg-blue-500/[0.06] border-blue-500/30',
        isDropTargetHover && 'bg-blue-500/[0.18] border-blue-500',
      )}
    >
      <div className="h-10 flex items-center gap-1.5 px-3 border-b border-zinc-800 text-[10px] uppercase tracking-wider text-zinc-500">
        <IconInbox size={11} />
        <span>Staging</span>
        <span className="ml-auto tabular-nums">{tiles.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {tiles.length === 0 ? (
          <p className="text-[10px] text-zinc-600 text-center py-6 px-2 leading-relaxed">
            {isCanvasDragActive
              ? 'Rilascia qui per togliere il tile dal canvas'
              : 'I nuovi tile compaiono qui. Trascinali nel canvas per posizionarli.'}
          </p>
        ) : (
          tiles.map((t) => (
            <button
              key={t.id}
              type="button"
              draggable
              onDragStart={(e) => onDragStart(e, t.id)}
              onClick={() => onTileClick?.(t.id)}
              className="block w-full text-left rounded border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 hover:border-zinc-700 transition-colors cursor-grab active:cursor-grabbing px-2 py-1.5"
              style={{ width: TILE_W, height: TILE_H, minHeight: TILE_H }}
              title={t.title || 'Senza titolo'}
            >
              <p
                className="text-[11px] leading-[14px] text-zinc-200 font-normal"
                style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  wordBreak: 'break-word',
                }}
              >
                {t.title || 'Senza titolo'}
              </p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
