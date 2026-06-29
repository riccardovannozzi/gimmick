'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { usePixelTheme } from '@/components/pixel';

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = ['00', '15', '30', '45'];

interface TimePickerProps {
  value: string; // "HH:MM"
  onChange: (time: string) => void;
  label?: string;
  /** Optional leading icon node (e.g. a clock) shown before the value. */
  icon?: React.ReactNode;
  compact?: boolean; // smaller trigger for table cells
  borderless?: boolean; // no border/bg for inline use
}

export function TimePicker({ value, onChange, label, icon, compact, borderless }: TimePickerProps) {
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

  const selectM = (min: string) => {
    onChange(`${selectedH}:${min}`);
    setOpen(false);
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
        fontSize: 11,
        color: theme.ink3,
      }
    : {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: compact ? '0 10px' : '6px 8px',
        height: compact ? 36 : 'auto',
        background: theme.surface,
        border: `1px solid ${theme.border}`,
        borderRadius: 10,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: sansFont,
        fontSize: compact ? 13 : 12,
        color: theme.ink,
      };

  const gridBtn = (active: boolean): React.CSSProperties => ({
    background: active ? theme.accent : 'transparent',
    color: active ? theme.onAccent : theme.ink,
    border: `1px solid transparent`,
    borderRadius: 7,
    fontFamily: sansFont,
    fontSize: 11,
    fontWeight: 600,
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
              fontSize: 9,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: theme.ink3,
              flexShrink: 0,
            }}
          >
            {label}
          </span>
        )}
        <span style={{ fontWeight: 600 }}>{selectedH}:{selectedM}</span>
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
            borderRadius: 12,
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
                  fontSize: 9,
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
                  fontSize: 9,
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {MINUTES.map((min) => (
                  <button
                    key={min}
                    onClick={() => selectM(min)}
                    style={{ ...gridBtn(selectedM === min), width: 40, height: 28 }}
                  >
                    {min}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
