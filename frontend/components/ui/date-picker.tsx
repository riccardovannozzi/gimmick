'use client';

/**
 * Gimmick · Obsidian — Selettore data.
 *
 * Sostituisce `<input type="date">`: il campo nativo disegna i segmenti
 * giorno/mese/anno con spaziatura e cifre a larghezza fissa decise dal browser,
 * quindi non combacia mai tipograficamente col resto del pannello. Qui il
 * trigger è testo normale (stesso font, stessa dimensione, stesso peso degli
 * altri campi) e il calendario è un popover nostro, gemello del `TimePicker`.
 *
 * `value`/`onChange` parlano ISO `YYYY-MM-DD`, come l'input nativo che
 * sostituiscono: i chiamanti non cambiano.
 */
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { usePixelTheme } from '@/components/pixel';
import { OB_LEADING, OB_WEIGHT, OB_TEXT } from '@/lib/theme/ob-typography';

const WEEKDAYS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
const MONTHS = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];

const pad = (n: number) => String(n).padStart(2, '0');
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** ISO → Date locale. `new Date('2026-07-30')` sarebbe UTC e in Italia
 *  arretrerebbe di un giorno nelle ore serali. */
function fromIso(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

interface DatePickerProps {
  /** ISO `YYYY-MM-DD`; stringa vuota = nessuna data. */
  value: string;
  onChange: (iso: string) => void;
  /** Icona di testa (es. un calendario). */
  icon?: React.ReactNode;
  /** Testo mostrato quando `value` è vuoto. */
  placeholder?: string;
  /** Mantiene fondo e dimensioni ma senza bordo: cella dentro un gruppo. */
  noBorder?: boolean;
}

export function DatePicker({ value, onChange, icon, placeholder = 'gg/mm/aaaa', noBorder }: DatePickerProps) {
  const theme = usePixelTheme();
  const sansFont = 'var(--ob-font-sans)';
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const selected = fromIso(value);
  // Mese mostrato nel popover: quello della data scelta, altrimenti quello corrente.
  const [cursor, setCursor] = useState<{ y: number; m: number }>(() => {
    const base = selected ?? new Date();
    return { y: base.getFullYear(), m: base.getMonth() };
  });

  useEffect(() => {
    if (!open) return;
    const base = fromIso(value) ?? new Date();
    setCursor({ y: base.getFullYear(), m: base.getMonth() });
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      const popW = 244;
      const popH = 286;
      let top = r.bottom + 4;
      let left = r.left;
      if (top + popH > window.innerHeight) top = Math.max(8, r.top - popH - 4);
      if (left + popW > window.innerWidth) left = window.innerWidth - popW - 8;
      setPos({ top, left });
    }
    const handler = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (popRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const raf = requestAnimationFrame(() => document.addEventListener('mousedown', handler));
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('mousedown', handler);
    };
  }, [open, value]);

  // Griglia 6×7 che parte dal lunedì della settimana in cui cade il giorno 1.
  const first = new Date(cursor.y, cursor.m, 1);
  const lead = (first.getDay() + 6) % 7; // 0 = lunedì
  const gridStart = new Date(cursor.y, cursor.m, 1 - lead);
  const days = Array.from({ length: 42 }, (_, i) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
  const todayIso = toIso(new Date());

  const label = selected ? `${pad(selected.getDate())}/${pad(selected.getMonth() + 1)}/${selected.getFullYear()}` : placeholder;

  const shiftMonth = (delta: number) => {
    setCursor((c) => {
      const d = new Date(c.y, c.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  };

  const pick = (d: Date) => {
    onChange(toIso(d));
    setOpen(false);
  };

  const navBtn: React.CSSProperties = {
    width: 24, height: 24, borderRadius: 'var(--ob-radius-sm)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: 'transparent', border: 'none', color: theme.ink2, cursor: 'pointer',
    fontFamily: sansFont, fontSize: OB_TEXT.control, lineHeight: OB_LEADING.none,
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          width: '100%',
          height: 30,
          padding: '0 10px',
          background: 'var(--ob-sunken)',
          border: noBorder ? '1px solid transparent' : `1px solid ${theme.border}`,
          borderRadius: 'var(--ob-radius-sm)',
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: sansFont,
          fontSize: OB_TEXT.control,
          fontWeight: OB_WEIGHT.body,
          color: selected ? theme.ink : theme.ink3,
        }}
      >
        {icon && <span style={{ display: 'inline-flex', color: theme.ink3, flexShrink: 0 }}>{icon}</span>}
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      </button>

      {open && createPortal(
        <div
          ref={popRef}
          className="fixed"
          style={{
            top: pos.top,
            left: pos.left,
            zIndex: 9999,
            width: 244,
            background: theme.surface,
            border: `1px solid ${theme.border}`,
            borderRadius: 'var(--ob-radius-md)',
            boxShadow: 'var(--ob-shadow-card)',
            padding: 10,
            fontFamily: sansFont,
          }}
        >
          {/* Testata: mese/anno + navigazione */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
            <button type="button" style={navBtn} onClick={() => shiftMonth(-1)} aria-label="Mese precedente">‹</button>
            <span style={{ flex: 1, textAlign: 'center', fontSize: OB_TEXT.control, fontWeight: OB_WEIGHT.emphasis, color: theme.ink }}>
              {MONTHS[cursor.m]} {cursor.y}
            </span>
            <button type="button" style={navBtn} onClick={() => shiftMonth(1)} aria-label="Mese successivo">›</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 2 }}>
            {WEEKDAYS.map((w, i) => (
              <span key={i} style={{ height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: OB_TEXT.meta, fontWeight: OB_WEIGHT.emphasis, color: theme.ink3 }}>{w}</span>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {days.map((d) => {
              const iso = toIso(d);
              const isSel = iso === value;
              const isToday = iso === todayIso;
              const outside = d.getMonth() !== cursor.m;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => pick(d)}
                  style={{
                    height: 28,
                    borderRadius: 'var(--ob-radius-sm)',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: sansFont,
                    fontSize: OB_TEXT.control,
                    fontWeight: isSel || isToday ? OB_WEIGHT.emphasis : OB_WEIGHT.body,
                    background: isSel ? theme.accent : 'transparent',
                    color: isSel
                      ? theme.onAccent
                      : outside
                        ? theme.ink3
                        : isToday
                          ? theme.accent
                          : theme.ink,
                    opacity: outside && !isSel ? 0.55 : 1,
                  }}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button
              type="button"
              onClick={() => pick(new Date())}
              style={{ flex: 1, height: 26, borderRadius: 'var(--ob-radius-sm)', border: 'none', background: 'var(--ob-sunken)', color: theme.ink2, cursor: 'pointer', fontFamily: sansFont, fontSize: OB_TEXT.card }}
            >
              Oggi
            </button>
            {value && (
              <button
                type="button"
                onClick={() => { onChange(''); setOpen(false); }}
                style={{ flex: 1, height: 26, borderRadius: 'var(--ob-radius-sm)', border: 'none', background: 'var(--ob-sunken)', color: theme.ink3, cursor: 'pointer', fontFamily: sansFont, fontSize: OB_TEXT.card }}
              >
                Cancella
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
