'use client';

import { useState } from 'react';
import { IconMaximize, IconNote, IconLayoutGrid, IconPinnedOff, IconPhoto } from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import type { Tag } from '@/types';

function ToolbarToggle({ icon, label, active, onClick }: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-2.5 h-8 rounded text-xs leading-none font-medium transition-colors',
        active
          ? 'bg-blue-600/20 text-blue-400'
          : 'bg-zinc-800/60 text-zinc-400'
      )}
      title={label}
    >
      {icon}
      {label}
    </button>
  );
}

function ToolbarButton({ icon, label, onClick }: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 h-8 rounded bg-zinc-800/60 text-zinc-400 text-xs leading-none font-medium hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
      title={label}
    >
      {icon}
      {label}
    </button>
  );
}

interface CanvasTopbarProps {
  tag: Tag | null;
  textMode: boolean;
  tileMode: boolean;
  imageMode: boolean;
  onToggleTextMode: () => void;
  onToggleTileMode: () => void;
  onToggleImageMode: () => void;
  onFit: () => void;
  onZoom100: () => void;
  pinnedTags?: Tag[];
  onPinnedTagClick?: (tagId: string) => void;
  onUnpinTag?: (tagId: string) => void;
  /** Called with the new ordered list of tag ids after a drag-drop reorder. */
  onReorderPinned?: (orderedIds: string[]) => void;
}

export function CanvasTopbar({ tag, textMode, tileMode, imageMode, onToggleTextMode, onToggleTileMode, onToggleImageMode, onFit, onZoom100, pinnedTags = [], onPinnedTagClick, onUnpinTag, onReorderPinned }: CanvasTopbarProps) {
  // Drag-drop state for the pinned tag chips (HTML5 native dnd).
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const handleDrop = (targetId: string) => {
    if (!draggingId || draggingId === targetId) {
      setDraggingId(null);
      setDropTargetId(null);
      return;
    }
    const ids = pinnedTags.map((t) => t.id);
    const from = ids.indexOf(draggingId);
    const to = ids.indexOf(targetId);
    if (from === -1 || to === -1) {
      setDraggingId(null);
      setDropTargetId(null);
      return;
    }
    const next = [...ids];
    next.splice(from, 1);
    next.splice(to, 0, draggingId);
    onReorderPinned?.(next);
    setDraggingId(null);
    setDropTargetId(null);
  };

  // The currently-open canvas tag is always rendered as the first chip — even if
  // it's not pinned. Pinned chips that match the current tag are filtered out of
  // the reorderable list (the current chip stands in for them, separated by a
  // vertical divider).
  const otherPinned = tag ? pinnedTags.filter((p) => p.id !== tag.id) : pinnedTags;

  return (
    <div className="h-12 border-b border-zinc-800 flex items-center justify-between px-4 shrink-0 bg-zinc-950">
      <div className="flex items-center gap-1 min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tag && (
          <>
            <div
              className="flex items-center px-2.5 h-8 rounded text-xs bg-amber-500/20 text-amber-300 shrink-0"
              title={`Canvas corrente: ${tag.name}`}
            >
              {tag.name}
            </div>
            {otherPinned.length > 0 && (
              <div className="w-px h-5 bg-zinc-700 mx-1 shrink-0" />
            )}
          </>
        )}
        {otherPinned.map((pt, idx) => {
          const isDragging = draggingId === pt.id;
          const isDropTarget = dropTargetId === pt.id && draggingId !== pt.id;
          // Direction of insertion relative to target:
          //   dragging from earlier → drop AFTER target (indicator on right)
          //   dragging from later   → drop BEFORE target (indicator on left)
          const draggingIdx = draggingId ? otherPinned.findIndex((t) => t.id === draggingId) : -1;
          const insertAfter = draggingIdx !== -1 && draggingIdx < idx;
          return (
          <div
            key={pt.id}
            draggable={!!onReorderPinned}
            onDragStart={(e) => {
              setDraggingId(pt.id);
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', pt.id);
            }}
            onDragOver={(e) => {
              if (!draggingId) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              if (draggingId !== pt.id) setDropTargetId(pt.id);
            }}
            onDragLeave={() => {
              setDropTargetId((curr) => (curr === pt.id ? null : curr));
            }}
            onDrop={(e) => {
              e.preventDefault();
              handleDrop(pt.id);
            }}
            onDragEnd={() => {
              setDraggingId(null);
              setDropTargetId(null);
            }}
            className={cn(
              'relative group flex items-center px-2.5 h-8 rounded text-xs transition-colors shrink-0 cursor-grab active:cursor-grabbing',
              'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-amber-300',
              isDragging && 'opacity-40',
            )}
          >
            <button
              onClick={() => onPinnedTagClick?.(pt.id)}
              className="flex items-center"
              title={`Apri "${pt.name}" in Canvas`}
            >
              {pt.name}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onUnpinTag?.(pt.id); }}
              draggable={false}
              onDragStart={(e) => e.stopPropagation()}
              className="hidden group-hover:flex absolute right-1 top-1/2 -translate-y-1/2 w-4 h-4 items-center justify-center rounded bg-zinc-800 hover:bg-zinc-700 hover:text-red-400"
              title="Rimuovi dal pin"
            >
              <IconPinnedOff size={10} />
            </button>
            {isDropTarget && (
              <div
                className={cn(
                  'pointer-events-none absolute top-0 bottom-0 w-0.5 rounded bg-blue-500',
                  insertAfter ? '-right-1' : '-left-1'
                )}
                style={{ boxShadow: '0 0 6px rgba(59,130,246,0.7)' }}
              />
            )}
          </div>
          );
        })}
      </div>

      <div className="flex items-center gap-1">
        <ToolbarToggle icon={<IconLayoutGrid size={13} />} label="Tile" active={tileMode} onClick={onToggleTileMode} />
        <ToolbarToggle icon={<IconNote size={13} />} label="Testo" active={textMode} onClick={onToggleTextMode} />
        <ToolbarToggle icon={<IconPhoto size={13} />} label="Image" active={imageMode} onClick={onToggleImageMode} />
        <div className="w-px h-5 bg-zinc-700 mx-1" />
        <ToolbarButton icon={<IconMaximize size={13} />} label="Fit" onClick={onFit} />
        <ToolbarButton icon={null} label="100%" onClick={onZoom100} />
      </div>
    </div>
  );
}
