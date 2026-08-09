'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { usePixelTheme } from '@/components/pixel';
import { OB_WEIGHT, OB_TEXT } from '@/lib/theme/ob-typography';

// Ore a passi di 1: 00…23. I minuti NON hanno preset — si digitano.
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));

interface TimePickerProps {
  value: string; // "HH:MM"
  onChange: (time: string) => void;
  label?: string;
  /** Optional leading icon node (e.g. a clock) shown before the value. */
  icon?: React.ReactNode;
  compact?: boolean; // smaller trigger for table cells
  borderless?: boolean; // no border/bg for inline use
  noBorder?: boolean; // keeps bg + size ma senza bordo visibile (cella dentro un container)
}

export function TimePicker({ value, onChange, label, icon, compact, borderless, noBorder }: TimePickerProps) {
  const theme = usePixelTheme();
  const monoFont = 'var(--ob-font-mono)';
  const sansFont = 'var(--ob-font-sans)';
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const [h, m] = (value || '00:00').split(':');
  const selectedH = h || '00';
  const selectedM = m || '00';

  useEffect(() => {
    if (!open) return;
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      const popW = 260;
      const popH = 220;
      let top = r.bottom + 4;
      let left = r.left;
      if (top + popH > window.innerHeight) top = r.top - popH - 4;
      if (left + popW > window.innerWidth) left = window.innerWidth - popW - 8;
      setPos({ top, left });
    }
    const handler = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (popRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const raf = requestAnimationFrame(() => {
      document.addEventListener('mousedown', handler);
    });
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('mousedown', handler);
    };
  }, [open]);

  const selectH = (hour: string) => {
    onChange(`${hour}:${selectedM}`);
  };

  // Minuti digitati a mano. `minDraft` tiene lo stato grezzo del campo (può
  // essere vuoto o a una cifra mentre si scrive); il valore vero viene emesso
  // solo quando è un numero valido, e normalizzato a due cifre all'uscita.
  const [minDraft, setMinDraft] = useState(selectedM);
  useEffect(() => { setMinDraft(selectedM); }, [selectedM]);

  const clampMin = (raw: string): string => {
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n)) return '00';
    return String(Math.min(59, Math.max(0, n))).padStart(2, '0');
  };

  const typeMin = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 2);
    setMinDraft(digits);
    if (digits !== '' && parseInt(digits, 10) <= 59) {
      onChange(`${selectedH}:${digits.padStart(2, '0')}`);
    }
  };

  const commitMin = () => {
    const mm = clampMin(minDraft);
    setMinDraft(mm);
    onChange(`${selectedH}:${mm}`);
  };

  const triggerStyle: React.CSSProperties = borderless
    ? {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: 0,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: sansFont,
        fontSize: OB_TEXT.meta,
        color: theme.ink3,
      }
    : {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: compact ? '0 10px' : '6px 8px',
        // Compact = cella dentro un gruppo della sidebar: stesso standard degli
        // altri campi (30 di altezza, raggio 8, testo 12.5). Con `noBorder` il
        // fondo è quello degli OGGETTI DELLE SPONDE — `--ob-rail-field`, lo
        // stesso degli altri campi del pannello del tile. Era `bg1`, che valeva
        // finché il fondo della vista faceva da incasso; da quando l'area di
        // lavoro è bianca, `bg1` è il bianco e la cella sparirebbe.
        height: compact ? 30 : 'auto',
        background: noBorder ? 'var(--ob-rail-field)' : theme.surface,
        border: `1px solid ${noBorder ? 'transparent' : theme.border}`,
        // Compatto o no, è sempre un controllo: la distinzione 8/10 è sparita
        // con la consolidazione su due soli raggi.
        borderRadius: 'var(--ob-radius-sm)',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: sansFont,
        fontSize: compact ? OB_TEXT.control : OB_TEXT.card,
        color: theme.ink,
      };

  const gridBtn = (active: boolean): React.CSSProperties => ({
    background: active ? theme.accent : 'transparent',
    color: active ? theme.onAccent : theme.ink,
    border: `1px solid transparent`,
    borderRadius: 'var(--ob-radius-sm)',
    fontFamily: sansFont,
    fontSize: OB_TEXT.meta,
    fontWeight: OB_WEIGHT.emphasis,
    cursor: 'pointer',
  });

  return (
    <>
      <button ref={triggerRef} onClick={() => setOpen(!open)} style={triggerStyle}>
        {icon && <span style={{ display: 'inline-flex', color: theme.ink3, flexShrink: 0 }}>{icon}</span>}
        {label && (
          <span
            style={{
              fontFamily: monoFont,
              fontSize: OB_TEXT.micro,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: theme.ink3,
              flexShrink: 0,
            }}
          >
            {label}
          </span>
        )}
        {/* Peso normale come ogni altro valore dei campi della sidebar. */}
        <span style={{ fontWeight: OB_WEIGHT.body }}>{selectedH}:{selectedM}</span>
      </button>
      {open && createPortal(
        <div
          ref={popRef}
          className="fixed"
          style={{
            top: pos.top,
            left: pos.left,
            zIndex: 9999,
            background: theme.surface,
            border: `1px solid ${theme.border}`,
            borderRadius: 'var(--ob-radius-md)',
            boxShadow: 'var(--ob-shadow-card)',
            padding: 8,
          }}
        >
          <div style={{ display: 'flex', gap: 8 }}>
            {/* Hours grid */}
            <div>
              <span
                style={{
                  fontFamily: monoFont,
                  fontSize: OB_TEXT.micro,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: theme.ink3,
                  display: 'block',
                  marginBottom: 4,
                  textAlign: 'center',
                }}
              >
                Ore
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 2 }}>
                {HOURS.map((hr) => (
                  <button
                    key={hr}
                    onClick={() => selectH(hr)}
                    style={{ ...gridBtn(selectedH === hr), width: 28, height: 28 }}
                  >
                    {hr}
                  </button>
                ))}
              </div>
            </div>

            {/* Separator */}
            <div style={{ width: 1, background: theme.border, alignSelf: 'stretch' }} />

            {/* Minutes column */}
            <div>
              <span
                style={{
                  fontFamily: monoFont,
                  fontSize: OB_TEXT.micro,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: theme.ink3,
                  display: 'block',
                  marginBottom: 4,
                  textAlign: 'center',
                }}
              >
                Min
              </span>
              <input
                type="text"
                inputMode="numeric"
                autoFocus
                value={minDraft}
                onChange={(e) => typeMin(e.target.value)}
                onBlur={commitMin}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); commitMin(); setOpen(false); }
                  else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
                  // Frecce su/giù: scatti da 1 minuto, comodo per l'aggiustamento fine.
                  else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    const delta = e.key === 'ArrowUp' ? 1 : -1;
                    const n = (parseInt(minDraft || '0', 10) + delta + 60) % 60;
                    const mm = String(n).padStart(2, '0');
                    setMinDraft(mm);
                    onChange(`${selectedH}:${mm}`);
                  }
                }}
                onFocus={(e) => e.currentTarget.select()}
                aria-label="Minuti"
                placeholder="mm"
                style={{
                  width: 44,
                  height: 28,
                  textAlign: 'center',
                  background: 'var(--ob-sunken)',
                  border: 'none',
                  borderRadius: 'var(--ob-radius-sm)',
                  outline: 'none',
                  color: theme.ink,
                  fontFamily: sansFont,
                  fontSize: OB_TEXT.control,
                }}
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
