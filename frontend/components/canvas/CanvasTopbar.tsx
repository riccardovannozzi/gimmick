'use client';

import { IconRefresh, IconMaximize, IconNote } from '@tabler/icons-react';
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
  onToggleTextMode: () => void;
  onReset: () => void;
  onFit: () => void;
}

export function CanvasTopbar({ tag, tileCount, textMode, onToggleTextMode, onReset, onFit }: CanvasTopbarProps) {
  return (
    <div className="h-11 border-b border-zinc-800 flex items-center justify-between px-4 shrink-0 bg-zinc-950">
      {tag ? (
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-sm font-medium text-zinc-200">
          {tag.name}
          <span className="text-[11px] text-zinc-500 font-normal">{tileCount} tile</span>
        </div>
      ) : (
        <div />
      )}

      <div className="flex items-center gap-1">
        <ToolbarToggle icon={<IconNote size={13} />} label="Testo" active={textMode} onClick={onToggleTextMode} />
        <div className="w-px h-5 bg-zinc-700 mx-1" />
        <ToolbarButton icon={<IconRefresh size={13} />} label="Reset" onClick={onReset} />
        <ToolbarButton icon={<IconMaximize size={13} />} label="Fit" onClick={onFit} />
      </div>
    </div>
  );
}
