'use client';

import { useState } from 'react';
import { IconMaximize, IconNote, IconLayoutGrid, IconPinnedOff, IconPhoto } from '@tabler/icons-react';
import { usePixelTheme } from '@/components/pixel';
import { pixelToolbarBtn, obsidianToolbarBtn } from '@/lib/pixel-toolbar';
import { isObsidianShellEnabled } from '@/lib/feature-flags';
import type { Tag } from '@/types';

function ToolbarToggle({ icon, label, active, onClick }: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  const theme = usePixelTheme();
  const inShell = isObsidianShellEnabled();
  const style = inShell ? obsidianToolbarBtn(theme, active) : pixelToolbarBtn(theme, active);
  return (
    <button onClick={onClick} className={inShell ? undefined : 'px-press'} style={style} title={label}>
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
  const theme = usePixelTheme();
  const inShell = isObsidianShellEnabled();
  const style = inShell ? obsidianToolbarBtn(theme, false) : pixelToolbarBtn(theme, false);
  return (
    <button onClick={onClick} className={inShell ? undefined : 'px-press'} style={style} title={label}>
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
  const theme = usePixelTheme();
  const inShell = isObsidianShellEnabled();
  // Strutturali (font/bordi/raggi). I colori arrivano già da theme (Obsidian in shell).
  const chipBorderW = inShell ? 1 : 2;
  const chipFont = inShell ? 'var(--ob-font-sans)' : 'var(--font-pixel-head)';
  const chipFontSize = inShell ? 11.5 : 8;
  const chipRadius = inShell ? 8 : 0;
  const chipTransform: 'none' | 'uppercase' = inShell ? 'none' : 'uppercase';
  const chipWeight = inShell ? 600 : 400;
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

  const otherPinned = tag ? pinnedTags.filter((p) => p.id !== tag.id) : pinnedTags;

  return (
    <div
      className="shrink-0"
      style={{
        height: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        borderBottom: `${chipBorderW}px solid ${theme.border}`,
        background: theme.bg2,
      }}
    >
      <div
        className="[scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, overflowX: 'auto' }}
      >
        {tag && (
          <>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '0 12px',
                height: 30,
                background: theme.accent,
                color: theme.onAccent,
                border: `${chipBorderW}px solid ${inShell ? 'transparent' : theme.onAccent}`,
                borderRadius: chipRadius,
                fontFamily: chipFont,
                fontSize: chipFontSize,
                fontWeight: chipWeight,
                letterSpacing: inShell ? 0 : '0.08em',
                textTransform: chipTransform,
                flexShrink: 0,
                boxShadow: inShell ? 'none' : `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.mode === 'dark' ? theme.shadowColor : theme.surface}`,
              }}
              title={`Canvas corrente: ${tag.name}`}
            >
              {tag.name}
            </div>
            {otherPinned.length > 0 && (
              <div style={{ width: chipBorderW, height: 20, background: theme.border, margin: '0 4px', flexShrink: 0 }} />
            )}
          </>
        )}
        {otherPinned.map((pt, idx) => {
          const isDragging = draggingId === pt.id;
          const isDropTarget = dropTargetId === pt.id && draggingId !== pt.id;
          const draggingIdx = draggingId ? otherPinned.findIndex((t) => t.id === draggingId) : -1;
          const insertAfter = draggingIdx !== -1 && draggingIdx < idx;
          // Stesso "swap ink/surface in base al mode" di pixelToolbarBtn.
          const darkSlot = theme.mode === 'dark' ? theme.surface : theme.ink;
          const lightSlot = theme.mode === 'dark' ? theme.ink : theme.surface;
          // In shell: chip neutro Obsidian (surface-2 + hairline); arcade: swap pixel.
          const chipBg = inShell ? theme.surfaceVariant : darkSlot;
          const chipFg = inShell ? theme.ink2 : lightSlot;
          const chipBorderCol = inShell ? theme.border : lightSlot;
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
            className="group"
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0 12px',
              height: 30,
              background: chipBg,
              color: chipFg,
              border: `${chipBorderW}px solid ${chipBorderCol}`,
              borderRadius: chipRadius,
              fontFamily: chipFont,
              fontSize: chipFontSize,
              fontWeight: chipWeight,
              letterSpacing: inShell ? 0 : '0.08em',
              textTransform: chipTransform,
              flexShrink: 0,
              cursor: 'grab',
              opacity: isDragging ? 0.4 : 1,
            }}
          >
            <button
              onClick={() => onPinnedTagClick?.(pt.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'inherit',
                fontFamily: 'inherit',
                fontSize: 'inherit',
                letterSpacing: 'inherit',
                textTransform: 'inherit',
                padding: 0,
              }}
              title={`Apri "${pt.name}" in Canvas`}
            >
              {pt.name}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onUnpinTag?.(pt.id); }}
              draggable={false}
              onDragStart={(e) => e.stopPropagation()}
              className="hidden group-hover:flex"
              style={{
                position: 'absolute',
                right: 2,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 16,
                height: 16,
                alignItems: 'center',
                justifyContent: 'center',
                background: theme.surface,
                border: `${chipBorderW}px solid ${theme.border}`,
                borderRadius: inShell ? 5 : 0,
                color: '#E24B4A',
                cursor: 'pointer',
              }}
              title="Rimuovi dal pin"
            >
              <IconPinnedOff size={9} />
            </button>
            {isDropTarget && (
              <div
                style={{
                  pointerEvents: 'none',
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  width: 3,
                  background: theme.accent,
                  ...(insertAfter ? { right: -4 } : { left: -4 }),
                }}
              />
            )}
          </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <ToolbarToggle icon={<IconLayoutGrid size={12} />} label="Tile" active={tileMode} onClick={onToggleTileMode} />
        <ToolbarToggle icon={<IconNote size={12} />} label="Testo" active={textMode} onClick={onToggleTextMode} />
        <ToolbarToggle icon={<IconPhoto size={12} />} label="Image" active={imageMode} onClick={onToggleImageMode} />
        <div style={{ width: chipBorderW, height: 20, background: theme.border, margin: '0 4px' }} />
        <ToolbarButton icon={<IconMaximize size={12} />} label="Fit" onClick={onFit} />
        <ToolbarButton icon={null} label="100%" onClick={onZoom100} />
      </div>
    </div>
  );
}
