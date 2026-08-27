'use client';

/**
 * Gimmick · Canvas — EdgeSidebar.
 *
 * Pannello destro (analogo a GroupSidebar/TextSidebar) per modificare le
 * proprietà di un edge selezionato: colore, verso e misura della freccia, tipologia
 * linea (come il bordo dei gruppi), spessore e testo mostrato al centro.
 */
import { useState, useEffect } from 'react';
import {
  IconLayoutSidebarRightCollapse, IconLayoutSidebarRightExpand, IconTrash,
  IconArrowsRightLeft, IconLine, IconLineDashed, IconLineDotted, IconRestore,
  IconArrowNarrowRight, IconArrowNarrowLeft, IconArrowsHorizontal, IconMinus,
} from '@tabler/icons-react';
import { usePixelTheme } from '@/components/pixel';
import { OB_WEIGHT, OB_TEXT, obLabel } from '@/lib/theme/ob-typography';
import { GIMMICK_PALETTE } from '@/lib/palette';
import { ColorField, Segmented } from '@/components/canvas/GroupSidebar';
import { ARROW_SIZE_DEFAULT, EDGE_LABEL_ALIGN_DEFAULT } from '@/components/canvas/CanvasBoard';
import type { CanvasEdge, EdgeArrow, EdgeLabelAlign } from '@/components/canvas/CanvasBoard';

type EdgeLineStyle = 'solid' | 'dashed' | 'dotted';

/**
 * I quattro stati della freccia. `EdgeArrow` ne ha tre — l'assenza è `null` sul
 * modello, ma un controllo segmentato ha bisogno di un valore per ogni pulsante:
 * `'none'` esiste solo qui e viene ritradotto in `null` quando si scrive.
 */
type ArrowChoice = 'none' | EdgeArrow;

/**
 * Intestazione di sezione del pannello.
 *
 * Due livelli di gerarchia SENZA inventare un corpo nuovo: sezione e campo
 * usano la stessa ricetta `obLabel`, e a distinguerli bastano il colore (ink2
 * contro ink3) e la hairline che apre la sezione. Aggiungere un terzo corpo
 * tipografico per quattro parole avrebbe allargato la scala per niente.
 *
 * `first` toglie la hairline alla prima sezione: lì non separa niente, sarebbe
 * solo una riga appiccicata sotto la testata.
 *
 * I controlli che stanno da soli in una sezione NON ripetono l'etichetta — è
 * per questo che `Segmented` e `ColorField` accettano ora un `label`
 * opzionale: "SFONDO / Colore" diceva due volte la stessa cosa.
 */
/**
 * I tre modi in cui l'etichetta si posa sulla linea, disegnati invece che
 * descritti: tre parole ("Centro", "Sopra", "Orizzontale") non entrerebbero in
 * un terzo di pannello, e abbreviate non direbbero più niente. Ogni glifo è la
 * stessa linea inclinata con la pillola messa dove finirà davvero.
 */
function LabelAlignGlyph({ mode }: { mode: EdgeLabelAlign }) {
  const pill = mode === 'center'
    ? <rect x="3.5" y="6" width="9" height="4" rx="1.2" transform="rotate(-40 8 8)" />
    : mode === 'above'
      ? <rect x="1.25" y="3.3" width="9" height="4" rx="1.2" transform="rotate(-40 5.75 5.3)" />
      : <rect x="3.5" y="6" width="9" height="4" rx="1.2" />;
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
      <path d="M2 13 L14 3" />
      {pill}
    </svg>
  );
}

function Section({ label, first, children }: { label: string; first?: boolean; children: React.ReactNode }) {
  const theme = usePixelTheme();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {!first && <div style={{ height: 1, background: theme.border, marginBottom: 4 }} />}
      <span style={{ ...obLabel(theme), color: theme.ink2 }}>{label}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
    </div>
  );
}

interface EdgeSidebarProps {
  edge: CanvasEdge;
  open: boolean;
  onToggle: () => void;
  onUpdate: (patch: Partial<Pick<CanvasEdge, 'color' | 'lineStyle' | 'lineWidth' | 'label' | 'arrow' | 'arrowSize' | 'labelAlign'>>) => void;
  onDelete: () => void;
}

export function EdgeSidebar({ edge, open, onToggle, onUpdate, onDelete }: EdgeSidebarProps) {
  const theme = usePixelTheme();
  const [label, setLabel] = useState(edge.label || '');

  useEffect(() => { setLabel(edge.label || ''); }, [edge.id, edge.label]);


  const commitLabel = () => {
    const trimmed = label.trim();
    if (trimmed !== (edge.label || '')) onUpdate({ label: trimmed || null });
  };

  const style: EdgeLineStyle = edge.lineStyle ?? 'dashed';
  const arrow: ArrowChoice = edge.arrow ?? 'none';
  const arrowSize = edge.arrowSize ?? ARROW_SIZE_DEFAULT;
  const labelAlign = edge.labelAlign ?? EDGE_LABEL_ALIGN_DEFAULT;

  return (
    <div
      style={{
        borderLeft: `1px solid ${theme.border}`,
        background: 'var(--ob-rail-bg)',
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
          height: 'var(--ob-toolbar-height)',
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
          {/* Il COLORE sta qui e non in una sezione sua: su un collegamento
              tinge la linea e la sua punta — non c'è nessun fondo da colorare.
              Stava fuori come "Sfondo", che prometteva una cosa che l'edge non
              ha.
              Gli stili della linea sono gli stessi del bordo dei gruppi. */}
          <Section label="Linea" first>
            <ColorField
              label="Colore"
              value={edge.color}
              allowNone
              palette={GIMMICK_PALETTE}
              onChange={(hex) => onUpdate({ color: hex })}
            />
            <Segmented<EdgeLineStyle>
              label="Tipo"
              value={style}
              onChange={(v) => onUpdate({ lineStyle: v })}
              options={[
                { value: 'solid', content: <IconLine size={16} />, title: 'Continua' },
                { value: 'dashed', content: <IconLineDashed size={16} />, title: 'Tratteggiata' },
                { value: 'dotted', content: <IconLineDotted size={16} />, title: 'Puntinata' },
              ]}
            />
            <Segmented<number>
              label="Spessore"
              value={edge.lineWidth ?? 1.5}
              onChange={(w) => onUpdate({ lineWidth: w })}
              options={[
                { value: 1, content: '1', title: '1 px' },
                { value: 2, content: '2', title: '2 px' },
                { value: 3, content: '3', title: '3 px' },
                { value: 4, content: '4', title: '4 px' },
              ]}
            />
          </Section>

          {/* A è il capo da cui il collegamento è stato tirato, B quello su cui
              è stato posato. Il primo pulsante è l'assenza: serve a TOGLIERE la
              freccia, ed è lo stato in cui nascono tutti i collegamenti —
              compresi quelli disegnati prima che questa opzione esistesse, che
              così non cambiano faccia.
              La misura resta visibile anche a freccia spenta: una proprietà che
              sparisce si legge come non implementata. */}
          <Section label="Freccia">
            <Segmented<ArrowChoice>
              value={arrow}
              onChange={(a) => onUpdate({ arrow: a === 'none' ? null : a })}
              options={[
                { value: 'none', content: <IconMinus size={16} />, title: 'Nessuna freccia' },
                { value: 'forward', content: <IconArrowNarrowRight size={16} />, title: 'A → B' },
                { value: 'backward', content: <IconArrowNarrowLeft size={16} />, title: 'B → A' },
                { value: 'both', content: <IconArrowsHorizontal size={16} />, title: 'A ↔ B' },
              ]}
            />
            <Segmented<number>
              label="Dimensione"
              value={arrowSize}
              onChange={(n) => onUpdate({ arrowSize: n })}
              options={[
                { value: 1, content: '1', title: 'Piccola' },
                { value: 2, content: '2', title: 'Media' },
                { value: 3, content: '3', title: 'Grande' },
                { value: 4, content: '4', title: 'Molto grande' },
              ]}
            />
          </Section>

          <Section label="Testo">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={commitLabel}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur(); } }}
              placeholder="Etichetta del collegamento"
              style={{
                width: '100%', padding: '8px 10px',
                background: 'var(--ob-rail-field)', border: `1px solid ${theme.border}`, borderRadius: 'var(--ob-radius-sm)',
                color: theme.ink, fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.control, outline: 'none',
              }}
            />
            <Segmented<EdgeLabelAlign>
              label="Disposizione"
              value={labelAlign}
              onChange={(v) => onUpdate({ labelAlign: v })}
              options={[
                { value: 'center', content: <LabelAlignGlyph mode="center" />, title: "Allineata al centro dell'edge" },
                { value: 'above', content: <LabelAlignGlyph mode="above" />, title: "Allineata sopra l'edge" },
                { value: 'horizontal', content: <LabelAlignGlyph mode="horizontal" />, title: 'Orizzontale' },
              ]}
            />
          </Section>

          {/* Azioni */}
          <button
            onClick={() => { setLabel(''); onUpdate({ color: null, lineStyle: null, lineWidth: null, label: null, arrow: null, arrowSize: null, labelAlign: null }); }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              width: '100%', padding: '9px 12px', background: 'transparent',
              border: `1px solid ${theme.border}`, borderRadius: 'var(--ob-radius-sm)', color: theme.ink2,
              fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.control, cursor: 'pointer',
            }}
            title="Riporta linea, freccia e testo ai valori di default"
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
