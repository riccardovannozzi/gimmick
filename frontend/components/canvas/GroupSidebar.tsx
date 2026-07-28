'use client';

/**
 * Gimmick · Canvas — GroupSidebar.
 *
 * Pannello destro (analogo a TileSidebar) con le proprietà del gruppo
 * selezionato: nome, elenco tile, e i controlli di stile — colore di sfondo,
 * colore/spessore/tipologia del bordo. I colori usano la palette di sistema
 * (GIMMICK_PALETTE). La selezione evidenzia anche i punti di aggancio sul canvas.
 */
import { useState, useEffect, useRef } from 'react';
import { IconLayoutSidebarRightCollapse, IconLayoutSidebarRightExpand, IconTrash, IconBoxMultiple, IconLine, IconLineDashed, IconLineDotted } from '@tabler/icons-react';
import { usePixelTheme } from '@/components/pixel';
import { GIMMICK_PALETTE } from '@/lib/palette';
import type { CanvasGroup, GroupBorderStyle } from '@/components/canvas/CanvasBoard';

// Palette per lo SFONDO del gruppo: toni scuri e DESATURATI (charcoal tinti).
// I pastelli chiari facevano "sparire" i tile, la riga "Bright"/"Dark1" della
// GIMMICK_PALETTE era ancora troppo satura → qui usiamo colori scuri e spenti,
// che fanno da sfondo neutro dietro i tile senza risultare accesi.
export const GROUP_BG_PALETTE = [
  { id: 'g-gray',   hex: '#3A3A3E', name: 'Grigio' },
  { id: 'g-blue',   hex: '#2E3A4C', name: 'Blu' },
  { id: 'g-cyan',   hex: '#264049', name: 'Ciano' },
  { id: 'g-teal',   hex: '#25413C', name: 'Verde acqua' },
  { id: 'g-green',  hex: '#2E3E2C', name: 'Verde' },
  { id: 'g-olive',  hex: '#3F3A28', name: 'Oliva' },
  { id: 'g-orange', hex: '#43352A', name: 'Arancio' },
  { id: 'g-red',    hex: '#432C30', name: 'Rosso' },
  { id: 'g-pink',   hex: '#3E2C3A', name: 'Rosa' },
  { id: 'g-purple', hex: '#332C43', name: 'Viola' },
];

interface GroupSidebarProps {
  group: CanvasGroup;
  tiles: { id: string; title?: string }[];
  open: boolean;
  onToggle: () => void;
  onUpdate: (patch: Partial<CanvasGroup>) => void;
  onDelete: () => void;
  onSelectTile: (id: string) => void;
}

type PT = ReturnType<typeof usePixelTheme>;

function eyebrowStyle(theme: PT): React.CSSProperties {
  return {
    fontFamily: 'var(--ob-font-mono)',
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: theme.ink3,
  };
}

/** Campo colore: swatch cliccabile che apre una palette (GIMMICK_PALETTE). */
export function ColorField({ label, value, onChange, allowNone, palette = GIMMICK_PALETTE }: {
  label: string;
  value: string | null | undefined;
  onChange: (hex: string | null) => void;
  allowNone?: boolean;
  palette?: typeof GIMMICK_PALETTE;
}) {
  const theme = usePixelTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={eyebrowStyle(theme)}>{label}</span>
      <div ref={ref} style={{ position: 'relative' }}>
        <button
          onClick={() => setOpen((o) => !o)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            width: '100%', padding: '6px 8px',
            background: theme.bg1, border: `1px solid ${theme.border}`, borderRadius: 8,
            cursor: 'pointer', color: theme.ink2, fontFamily: 'var(--ob-font-mono)', fontSize: 11,
          }}
        >
          <span
            style={{
              width: 20, height: 20, borderRadius: 6, flexShrink: 0,
              border: `1px solid ${theme.border}`,
              // Solo proprietà longhand: mischiare `background` (shorthand) con
              // backgroundImage/Size/Position genera un warning React.
              backgroundColor: value || 'transparent',
              ...(value ? {} : {
                backgroundImage: 'linear-gradient(45deg,#8884 25%,transparent 25%,transparent 75%,#8884 75%),linear-gradient(45deg,#8884 25%,transparent 25%,transparent 75%,#8884 75%)',
                backgroundSize: '8px 8px',
                backgroundPosition: '0 0,4px 4px',
              }),
            }}
          />
          {value ? value.toUpperCase() : 'Nessuno'}
        </button>
        {open && (
          <div
            style={{
              position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50,
              background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10,
              boxShadow: 'var(--ob-shadow-card)', padding: 8,
              display: 'flex', flexDirection: 'column', gap: 6,
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 3 }}>
              {palette.map((c) => {
                const on = (value || '').toLowerCase() === c.hex.toLowerCase();
                return (
                  <button
                    key={c.id}
                    type="button"
                    title={c.name}
                    onClick={() => { onChange(c.hex); setOpen(false); }}
                    style={{
                      width: '100%', aspectRatio: '1', borderRadius: 4,
                      background: c.hex,
                      border: `2px solid ${on ? theme.ink : 'transparent'}`,
                      cursor: 'pointer',
                    }}
                  />
                );
              })}
            </div>
            {allowNone && (
              <button
                type="button"
                onClick={() => { onChange(null); setOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 8px',
                  background: 'transparent', border: `1px solid ${theme.border}`, borderRadius: 8,
                  cursor: 'pointer', color: theme.ink2, fontFamily: 'var(--ob-font-sans)', fontSize: 12,
                }}
              >
                <span style={{ width: 16, height: 16, borderRadius: 4, border: `1px solid ${theme.border}`, position: 'relative', overflow: 'hidden' }}>
                  <span style={{ position: 'absolute', inset: 0, background: `linear-gradient(to top right, transparent 46%, #E24B4A 46%, #E24B4A 54%, transparent 54%)` }} />
                </span>
                Nessuno
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Gruppo di pulsanti segmentati. */
export function Segmented<T extends string | number>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: { value: T; content: React.ReactNode; title?: string }[];
  onChange: (v: T) => void;
}) {
  const theme = usePixelTheme();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={eyebrowStyle(theme)}>{label}</span>
      <div style={{ display: 'flex', gap: 4 }}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={String(o.value)}
              type="button"
              title={o.title}
              onClick={() => onChange(o.value)}
              style={{
                flex: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: 30,
                // Stato attivo: viola scuro (accent-soft) + testo accent, come i
                // tab della navbar — non il lavanda pieno.
                background: active ? 'var(--ob-accent-soft)' : theme.bg1,
                border: `1px solid ${active ? 'transparent' : theme.border}`,
                borderRadius: 8,
                color: active ? 'var(--ob-accent)' : theme.ink2,
                fontFamily: 'var(--ob-font-mono)', fontSize: 12, fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {o.content}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function GroupSidebar({ group, tiles, open, onToggle, onUpdate, onDelete, onSelectTile }: GroupSidebarProps) {
  const theme = usePixelTheme();
  const [name, setName] = useState(group.label || '');

  useEffect(() => { setName(group.label || ''); }, [group.id, group.label]);

  const groupTiles = group.nodeIds
    .map((id) => tiles.find((t) => t.id === id))
    .filter((t): t is { id: string; title?: string } => !!t);

  const eyebrow = eyebrowStyle(theme);
  const width = group.borderWidth ?? 0;
  const style: GroupBorderStyle = group.borderStyle ?? 'solid';

  const commitName = () => {
    const trimmed = name.trim();
    if (trimmed !== (group.label || '')) onUpdate({ label: trimmed });
  };

  return (
    <div
      style={{
        borderLeft: `1px solid ${theme.border}`,
        background: theme.bg2,
        transition: 'width 200ms',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        width: open ? 280 : 32,
      }}
    >
      {/* Header: collapse + titolo */}
      <div
        style={{
          height: 48,
          padding: open ? '0 8px' : 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: open ? 'flex-start' : 'center',
          gap: 8,
          borderBottom: `1px solid ${theme.border}`,
          flexShrink: 0,
        }}
      >
        <button
          onClick={onToggle}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent', border: 'none', cursor: 'pointer', color: theme.ink2, padding: 4,
          }}
          aria-label={open ? 'Comprimi' : 'Espandi'}
        >
          {open ? <IconLayoutSidebarRightCollapse size={16} /> : <IconLayoutSidebarRightExpand size={16} />}
        </button>
        {open && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: theme.ink, fontFamily: 'var(--ob-font-sans)', fontSize: 13, fontWeight: 600 }}>
            <IconBoxMultiple size={15} style={{ color: theme.accent }} />
            Gruppo
          </div>
        )}
      </div>

      {open && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Nome */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={eyebrow}>Nome</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur(); } }}
              placeholder="Nome del gruppo"
              style={{
                width: '100%', padding: '8px 10px',
                background: theme.bg1, border: `1px solid ${theme.border}`, borderRadius: 8,
                color: theme.ink, fontFamily: 'var(--ob-font-sans)', fontSize: 13, outline: 'none',
              }}
            />
          </div>

          {/* Stile: sfondo / bordo / spessore / tipologia */}
          <ColorField
            label="Colore sfondo"
            value={group.bgColor}
            allowNone
            palette={GROUP_BG_PALETTE}
            onChange={(hex) => onUpdate({ bgColor: hex })}
          />
          <ColorField
            label="Colore bordo"
            value={group.borderColor}
            onChange={(hex) => onUpdate({ borderColor: hex, borderWidth: width > 0 ? width : 1 })}
          />
          <Segmented
            label="Spessore bordo"
            value={width}
            onChange={(w) => onUpdate({ borderWidth: w })}
            options={[
              { value: 0, content: 'No', title: 'Nessun bordo' },
              { value: 1, content: '1', title: '1 px' },
              { value: 2, content: '2', title: '2 px' },
              { value: 3, content: '3', title: '3 px' },
              { value: 4, content: '4', title: '4 px' },
            ]}
          />
          <Segmented<GroupBorderStyle>
            label="Tipologia bordo"
            value={style}
            onChange={(s) => onUpdate({ borderStyle: s })}
            options={[
              { value: 'solid', content: <IconLine size={16} />, title: 'Continuo' },
              { value: 'dashed', content: <IconLineDashed size={16} />, title: 'Tratteggiato' },
              { value: 'dotted', content: <IconLineDotted size={16} />, title: 'Puntinato' },
            ]}
          />

          {/* Tile contenuti */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={eyebrow}>Tile ({groupTiles.length})</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {groupTiles.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onSelectTile(t.id)}
                  title={t.title || 'Senza titolo'}
                  style={{
                    display: 'flex', alignItems: 'center', width: '100%', padding: '7px 10px',
                    textAlign: 'left', background: theme.bg1, border: `1px solid ${theme.border}`,
                    borderRadius: 8, color: theme.ink2, fontFamily: 'var(--ob-font-sans)', fontSize: 12.5,
                    cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                >
                  {t.title || 'Senza titolo'}
                </button>
              ))}
            </div>
          </div>

          {/* Azioni */}
          <button
            onClick={onDelete}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              width: '100%', padding: '9px 12px', background: 'transparent',
              border: `1px solid ${theme.border}`, borderRadius: 8, color: '#E24B4A',
              fontFamily: 'var(--ob-font-sans)', fontSize: 12.5, cursor: 'pointer',
            }}
          >
            <IconTrash size={14} />
            Elimina gruppo
          </button>
        </div>
      )}
    </div>
  );
}
