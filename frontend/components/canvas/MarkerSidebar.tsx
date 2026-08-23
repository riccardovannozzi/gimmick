'use client';

/**
 * Gimmick · Canvas — MarkerSidebar.
 *
 * Pannello destro di un MARCATORE selezionato (Start, Stop, Goal, Milestone).
 *
 * Prima di questo pannello il click su un marcatore cadeva nel vuoto: la catena
 * delle sidebar riconosceva `text` e `image`, e un marcatore — che è un box come
 * loro — finiva nel ramo di ripiego, cioè in un pannello che parlava d'altro.
 *
 * Serve a UNA cosa: dare un nome al marcatore. Un disco colorato dice «qui
 * succede qualcosa» ma non cosa, e su una lavagna con dieci traguardi la
 * differenza fra loro sta tutta nella didascalia.
 *
 * Il campo è multiriga di proposito (un traguardo si chiama «Consegna bozza al
 * cliente», non «Consegna»), ma la lavagna ne mostra al massimo tre righe: il
 * limite è dichiarato qui sotto il campo invece di essere imposto tagliando il
 * testo, perché troncare mentre si scrive fa perdere quello che si stava
 * battendo — e la parte in eccesso resta comunque salvata, così alzare il tetto
 * un domani non costa una migrazione.
 */
import { useEffect, useRef, useState } from 'react';
import {
  IconLayoutSidebarRightCollapse, IconLayoutSidebarRightExpand, IconTrash, IconX,
} from '@tabler/icons-react';
import { MARKER_SPEC, MARKER_LABEL_LINES, resolveMarkerKind } from '@/components/canvas/CanvasBoard';
import { usePixelTheme } from '@/components/pixel';
import { OB_WEIGHT, OB_TEXT, obLabel } from '@/lib/theme/ob-typography';

interface MarkerSidebarProps {
  /** Box marcatore selezionato (già ristretto a type 'marker' dal parent). */
  boxId: string;
  /** Il `kind` grezzo che sta sulla riga: la normalizzazione è di CanvasBoard. */
  kind: string | undefined;
  initialLabel: string;
  open: boolean;
  onToggle: () => void;
  /** Risale a ogni battuta: è il parent a ritardare specchio e salvataggio. */
  onLabelChange: (label: string) => void;
  onDelete: () => void;
}

export function MarkerSidebar({
  boxId, kind, initialLabel, open, onToggle, onLabelChange, onDelete,
}: MarkerSidebarProps) {
  const theme = usePixelTheme();
  const mk = resolveMarkerKind(kind);
  const spec = MARKER_SPEC[mk];
  const Glyph = spec.Glyph;

  // Campo controllato in locale: il valore del parent torna con lo specchio
  // ritardato, e legarlo direttamente farebbe saltare il cursore a metà parola.
  const [label, setLabel] = useState(initialLabel);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { setLabel(initialLabel); }, [boxId]); // eslint-disable-line react-hooks/exhaustive-deps

  const write = (next: string) => { setLabel(next); onLabelChange(next); };

  const eyebrow = obLabel(theme);
  /** Quante righe la lavagna mostrerà davvero: gli a-capo battuti contano,
   *  perché il canvas rispetta `pre-wrap`. Non conta il ritorno a capo
   *  automatico — quello dipende dalla larghezza, e qui non si può misurare. */
  const hardLines = label.trim() ? label.split('\n').length : 0;
  const overflowing = hardLines > MARKER_LABEL_LINES;

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
      {/* Header: collapse + di quale oggetto stiamo parlando */}
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
            {/* Lo stesso disco della lavagna, in piccolo: dice a quale dei
                quattro marcatori appartiene il campo qui sotto. */}
            <span
              style={{
                width: 18, height: 18, borderRadius: '50%', background: spec.color,
                color: 'var(--ob-marker-ink)', display: 'inline-flex',
                alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}
            >
              <Glyph size={11} stroke={2} />
            </span>
            {spec.label}
          </div>
        )}
      </div>

      {open && (
        <div style={{ flex: 1, minHeight: 0, padding: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={eyebrow}>Didascalia</span>
              {/* Svuota il campo. Sta accanto all'etichetta e non in fondo al
                  pannello perché cancella IL TESTO, non l'oggetto: mescolarlo
                  col cestino rosso qui sotto sarebbe stato un invito a
                  eliminare il marcatore per togliergli il nome. */}
              {label.length > 0 && (
                <button
                  type="button"
                  onClick={() => { write(''); areaRef.current?.focus(); }}
                  title="Cancella la didascalia"
                  aria-label="Cancella la didascalia"
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 20, height: 20, flexShrink: 0, padding: 0,
                    background: 'var(--ob-rail-field)', border: 'none',
                    borderRadius: 'var(--ob-radius-sm)', color: theme.ink2, cursor: 'pointer',
                  }}
                >
                  <IconX size={12} stroke={2} />
                </button>
              )}
            </div>
            <textarea
              ref={areaRef}
              value={label}
              onChange={(e) => write(e.target.value)}
              rows={MARKER_LABEL_LINES}
              placeholder={`Es. ${spec.label} di progetto`}
              style={{
                width: '100%', padding: '8px 10px', resize: 'vertical', minHeight: 62,
                background: 'var(--ob-rail-field)', border: `1px solid ${theme.border}`,
                borderRadius: 'var(--ob-radius-sm)', color: theme.ink,
                fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.control,
                lineHeight: 1.4, outline: 'none',
              }}
            />
            <span
              style={{
                fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.card,
                color: overflowing ? 'var(--ob-danger)' : theme.ink2,
              }}
            >
              {overflowing
                ? `Sulla lavagna si vedono solo le prime ${MARKER_LABEL_LINES} righe.`
                : `Larga quanto un tile, al massimo ${MARKER_LABEL_LINES} righe.`}
            </span>
          </div>

          {/* Azioni */}
          <button
            onClick={onDelete}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              width: '100%', padding: '9px 12px', background: 'var(--ob-rail-field)',
              border: 'none', borderRadius: 'var(--ob-radius-sm)', color: 'var(--ob-danger)',
              fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.control, cursor: 'pointer', flexShrink: 0,
              marginTop: 'auto',
            }}
          >
            <IconTrash size={14} />
            Elimina {spec.label.toLowerCase()}
          </button>
        </div>
      )}
    </div>
  );
}
