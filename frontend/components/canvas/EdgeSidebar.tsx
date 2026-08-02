'use client';

/**
 * Gimmick · Canvas — EdgeSidebar.
 *
 * Pannello destro (analogo a GroupSidebar/TextSidebar) per modificare le
 * proprietà di un edge selezionato: colore, tipologia linea (come il bordo dei
 * gruppi), spessore e testo mostrato al centro dell'edge.
 */
import { useState, useEffect } from 'react';
import {
  IconLayoutSidebarRightCollapse, IconLayoutSidebarRightExpand, IconTrash,
  IconArrowsRightLeft, IconLine, IconLineDashed, IconLineDotted, IconRestore,
} from '@tabler/icons-react';
import { usePixelTheme } from '@/components/pixel';
import { OB_WEIGHT, OB_TEXT, obLabel } from '@/lib/theme/ob-typography';
import { GIMMICK_PALETTE } from '@/lib/palette';
import { ColorField, Segmented } from '@/components/canvas/GroupSidebar';
import type { CanvasEdge } from '@/components/canvas/CanvasBoard';

type EdgeLineStyle = 'solid' | 'dashed' | 'dotted';

interface EdgeSidebarProps {
  edge: CanvasEdge;
  open: boolean;
  onToggle: () => void;
  onUpdate: (patch: Partial<Pick<CanvasEdge, 'color' | 'lineStyle' | 'lineWidth' | 'label'>>) => void;
  onDelete: () => void;
}

export function EdgeSidebar({ edge, open, onToggle, onUpdate, onDelete }: EdgeSidebarProps) {
  const theme = usePixelTheme();
  const [label, setLabel] = useState(edge.label || '');

  useEffect(() => { setLabel(edge.label || ''); }, [edge.id, edge.label]);

  const eyebrow = obLabel(theme);

  const commitLabel = () => {
    const trimmed = label.trim();
    if (trimmed !== (edge.label || '')) onUpdate({ label: trimmed || null });
  };

  const style: EdgeLineStyle = edge.lineStyle ?? 'dashed';

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: theme.ink, fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.control, fontWeight: OB_WEIGHT.emphasis }}>
            <IconArrowsRightLeft size={15} style={{ color: theme.accent }} />
            Collegamento
          </div>
        )}
      </div>

      {open && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Colore */}
          <ColorField
            label="Colore"
            value={edge.color}
            allowNone
            palette={GIMMICK_PALETTE}
            onChange={(hex) => onUpdate({ color: hex })}
          />

          {/* Tipologia linea (stessi stili del bordo dei gruppi) */}
          <Segmented<EdgeLineStyle>
            label="Tipo linea"
            value={style}
            onChange={(s) => onUpdate({ lineStyle: s })}
            options={[
              { value: 'solid', content: <IconLine size={16} />, title: 'Continua' },
              { value: 'dashed', content: <IconLineDashed size={16} />, title: 'Tratteggiata' },
              { value: 'dotted', content: <IconLineDotted size={16} />, title: 'Puntinata' },
            ]}
          />

          {/* Spessore linea */}
          <Segmented<number>
            label="Spessore linea"
            value={edge.lineWidth ?? 1.5}
            onChange={(w) => onUpdate({ lineWidth: w })}
            options={[
              { value: 1, content: '1', title: '1 px' },
              { value: 2, content: '2', title: '2 px' },
              { value: 3, content: '3', title: '3 px' },
              { value: 4, content: '4', title: '4 px' },
            ]}
          />

          {/* Testo al centro dell'edge */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={eyebrow}>Testo al centro</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={commitLabel}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur(); } }}
              placeholder="Etichetta del collegamento"
              style={{
                width: '100%', padding: '8px 10px',
                background: theme.bg1, border: `1px solid ${theme.border}`, borderRadius: 'var(--ob-radius-sm)',
                color: theme.ink, fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.control, outline: 'none',
              }}
            />
          </div>

          {/* Azioni */}
          <button
            onClick={() => { setLabel(''); onUpdate({ color: null, lineStyle: null, lineWidth: null, label: null }); }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              width: '100%', padding: '9px 12px', background: 'transparent',
              border: `1px solid ${theme.border}`, borderRadius: 'var(--ob-radius-sm)', color: theme.ink2,
              fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.control, cursor: 'pointer',
            }}
            title="Riporta colore, linea, spessore e testo ai valori di default"
          >
            <IconRestore size={14} />
            Reset
          </button>
          <button
            onClick={onDelete}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              width: '100%', padding: '9px 12px', background: 'transparent',
              border: `1px solid ${theme.border}`, borderRadius: 'var(--ob-radius-sm)', color: 'var(--ob-danger)',
              fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.control, cursor: 'pointer',
            }}
          >
            <IconTrash size={14} />
            Elimina collegamento
          </button>
        </div>
      )}
    </div>
  );
}
