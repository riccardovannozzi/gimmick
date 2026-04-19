'use client';

import { IconMaximize, IconNote, IconPlus, IconPinnedOff } from '@tabler/icons-react';
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
        'flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-colors',
        active
          ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40'
          : 'bg-zinc-800/60 text-zinc-600 border border-zinc-700'
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
      className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
      title={label}
    >
      {icon}
      {label}
    </button>
  );
}

interface CanvasTopbarProps {
  tag: Tag | null;
  tileCount: number;
  textMode: boolean;
  tileMode: boolean;
  onToggleTextMode: () => void;
  onToggleTileMode: () => void;
  onFit: () => void;
  onZoom100: () => void;
  pinnedTags?: Tag[];
  onPinnedTagClick?: (tagId: string) => void;
  onUnpinTag?: (tagId: string) => void;
}

export function CanvasTopbar({ tag, tileCount, textMode, tileMode, onToggleTextMode, onToggleTileMode, onFit, onZoom100, pinnedTags = [], onPinnedTagClick, onUnpinTag }: CanvasTopbarProps) {
  return (
    <div className="h-11 border-b border-zinc-800 flex items-center justify-between px-4 shrink-0 bg-zinc-950">
      <div className="flex items-center gap-1 min-w-0 overflow-x-auto">
        {pinnedTags.map((pt) => (
          <div
            key={pt.id}
            className={cn(
              'group flex items-center gap-1 pl-2 pr-1 py-0.5 rounded text-[11px] border transition-colors shrink-0',
              tag?.id === pt.id
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:bg-zinc-800 hover:text-amber-300'
            )}
          >
            <button
              onClick={() => onPinnedTagClick?.(pt.id)}
              className="flex items-center gap-1"
              title={`Apri "${pt.name}" in Canvas`}
            >
              {pt.name}
              {tag?.id === pt.id && <span className="text-[10px] text-amber-400/70">· {tileCount}</span>}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onUnpinTag?.(pt.id); }}
              className="opacity-0 group-hover:opacity-100 transition-opacity w-3.5 h-3.5 flex items-center justify-center rounded hover:bg-zinc-700 hover:text-red-400 ml-0.5"
              title="Rimuovi dal pin"
            >
              <IconPinnedOff size={10} />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1">
        <ToolbarToggle icon={<IconPlus size={13} />} label="Tile" active={tileMode} onClick={onToggleTileMode} />
        <ToolbarToggle icon={<IconNote size={13} />} label="Testo" active={textMode} onClick={onToggleTextMode} />
        <div className="w-px h-5 bg-zinc-700 mx-1" />
        <ToolbarButton icon={<IconMaximize size={13} />} label="Fit" onClick={onFit} />
        <ToolbarButton icon={<span className="text-[10px] font-bold">1:1</span>} label="100%" onClick={onZoom100} />
      </div>
    </div>
  );
}
