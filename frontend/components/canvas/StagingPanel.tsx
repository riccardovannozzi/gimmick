'use client';

import { useCallback } from 'react';
import * as TablerIcons from '@tabler/icons-react';
import {
  IconInbox,
  IconBolt,
  IconArrowUp,
  IconClock,
  IconCalendar,
} from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import { readableOn } from '@/lib/palette';
import { useTypeIcons } from '@/store/type-icons-store';
import { useActionColors } from '@/store/action-colors-store';
import { useTilesWithFlows } from '@/lib/hooks/useTilesWithFlows';
import { useFlowOpenStore } from '@/store/flow-modal-store';
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
  /** Currently selected tile (drives the staging card highlight). */
  selectedTileId?: string | null;
  /** Click handler — opens the tile in the right sidebar. */
  onTileClick?: (tileId: string) => void;
}

// Match CanvasBoard's TILE_W / TILE_H exactly so a tile reads at the same
// scale whether it's on the canvas or in staging.
const TILE_W = 130;
const TILE_H = 90;
const FALLBACK_COLOR = '#94A3B8';

/** Map action types (and special 'allday') → icon component. Mirrors the
 *  Kanban/canvas vocabulary. NOTES (none) renders no badge. */
const ACTION_ICON: Record<string, typeof IconBolt | null> = {
  none: null,
  anytime: IconArrowUp,
  deadline: IconBolt,
  event: IconClock,
  allday: IconCalendar,
};

/**
 * Vertical "parcheggio" sandwiched between the left Sidebar (tag list) and
 * the canvas. Lists tiles that exist in the current tag but have no canvas
 * position yet, rendered with the same visual vocabulary used on the canvas
 * (type-icon-tinted background, type/action badges, dashed border for
 * deadlines) so a tile looks consistent everywhere it's shown.
 *
 * Drag-back (canvas tile dragged here): CanvasBoard publishes mouse coords
 * via callback; if the gesture ends over this panel's bounding rect the
 * canvas page removes that tile's canvas_layout entry, sending it back to
 * staging. The panel also highlights itself as a drop target while the
 * cursor is hovering it during the drag.
 */
export function StagingPanel({
  tiles,
  panelRef,
  isCanvasDragActive,
  isDropTargetHover,
  selectedTileId,
  onTileClick,
}: Props) {
  const actionColors = useActionColors();
  const typeIcons = useTypeIcons((s) => s.icons);
  const typeTileIcons = useTypeIcons((s) => s.tileIcons);
  const tilesWithFlows = useTilesWithFlows();
  const openFlow = useFlowOpenStore((s) => s.open);
  const getIconForTile = useCallback(
    (tileId: string) => {
      const iconId = typeTileIcons[tileId];
      if (!iconId) return null;
      return typeIcons.find((i) => i.id === iconId) || null;
    },
    [typeIcons, typeTileIcons],
  );

  const onDragStart = (e: React.DragEvent, tileId: string) => {
    e.dataTransfer.setData('text/x-canvas-tile-id', tileId);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      ref={panelRef}
      data-staging-panel
      className={cn(
        'w-44 shrink-0 border-r flex flex-col transition-colors',
        isDropTargetHover
          ? 'bg-blue-500/[0.18] border-blue-500'
          : isCanvasDragActive
          ? 'bg-blue-500/[0.06] border-blue-500/30'
          : 'bg-zinc-950/40 border-zinc-800',
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
            {isCanvasDragActive || isDropTargetHover
              ? 'Rilascia qui per togliere il tile dal canvas'
              : 'I nuovi tile compaiono qui. Trascinali nel canvas per posizionarli.'}
          </p>
        ) : (
          tiles.map((t) => {
            const si = getIconForTile(t.id);
            const actionKey: string =
              t.all_day && t.action_type === 'event' ? 'allday' : (t.action_type || 'none');
            const actionColor: string =
              actionKey === 'none'
                ? '#e4e4e7'
                : ((actionColors as Record<string, string>)[actionKey] as string)
                  || FALLBACK_COLOR;
            // Background = type-icon color at ~50% alpha (matches canvas/kanban
            // tile bg). When no type icon set, fall back to a neutral zinc.
            const tileBg = si?.color ? `${si.color}80` : '#1C1C1E';
            const isSelected = selectedTileId === t.id;
            const hasFlow = tilesWithFlows.has(t.id);
            return (
              // Outer wrapper allows the FLOW badge to overflow past the
              // tile's rounded body (the body has overflow-hidden for the
              // status patterns, so the badge has to live outside).
              <div key={t.id} className="relative shrink-0" style={{ width: TILE_W }}>
                <div
                  draggable
                  data-tile-id={t.id}
                  onDragStart={(e) => onDragStart(e, t.id)}
                  onClick={() => onTileClick?.(t.id)}
                  className={cn(
                    'shrink-0 rounded overflow-hidden cursor-grab active:cursor-grabbing transition-all border',
                    actionKey === 'deadline'
                      ? 'border-dashed border-red-500'
                      : 'border-white/[0.08]',
                    isSelected && 'ring-2 ring-blue-500',
                    'hover:brightness-110',
                  )}
                  style={{ backgroundColor: tileBg, width: TILE_W, height: TILE_H }}
                  title={t.title || 'Senza titolo'}
                >
                  <div className="relative h-full flex flex-col p-1.5">
                    <div className="flex-1 min-h-0 overflow-hidden">
                      <p
                        className="text-[11px] leading-[14px] text-[#D4D4D8] font-normal"
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
                    </div>
                    <div className="mt-auto flex items-end justify-between gap-1 relative z-10">
                      <ActionBadgeMini actionKey={actionKey} color={actionColor} />
                      {si && <TypeBadgeMini iconName={si.icon} color={si.color} />}
                    </div>
                  </div>
                </div>
                {/* FLOW badge — same overhang and styling as Canvas/Kanban. */}
                {hasFlow && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openFlow(t.id);
                    }}
                    onContextMenu={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onDragStart={(e) => e.stopPropagation()}
                    className="absolute -top-1.5 right-2 z-20 px-1.5 h-4 rounded text-[9px] font-bold tracking-wider text-blue-100 bg-blue-900/95 border border-blue-500 shadow flex items-center hover:bg-blue-800 transition-colors cursor-pointer"
                    title="Apri Flow"
                  >
                    FLOW
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function ActionBadgeMini({ actionKey, color }: { actionKey: string; color: string }) {
  const Icon = ACTION_ICON[actionKey];
  if (!Icon) return <span className="w-3.5 h-3.5" />;
  return (
    <div
      className="w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0"
      style={{ backgroundColor: color }}
    >
      <Icon size={9} color={readableOn(color)} />
    </div>
  );
}

function TypeBadgeMini({ iconName, color }: { iconName: string; color?: string }) {
  const Comp = (TablerIcons as unknown as Record<string, React.ComponentType<{ size?: number; color?: string }>>)[iconName];
  if (!Comp) return null;
  const bg = color || '#27272A';
  return (
    <div
      className="w-3.5 h-3.5 rounded flex items-center justify-center shrink-0"
      style={{ backgroundColor: bg }}
    >
      <Comp size={9} color={readableOn(bg)} />
    </div>
  );
}

