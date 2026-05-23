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
  compact?: boolean; // smaller trigger for table cells
  borderless?: boolean; // no border/bg for inline use
}

export function TimePicker({ value, onChange, label, compact, borderless }: TimePickerProps) {
  const theme = usePixelTheme();
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
        fontFamily: 'var(--font-pixel-body)',
        fontSize: 11,
        color: theme.ink3,
      }
    : {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: compact ? '0 8px' : '6px 8px',
        height: compact ? 30 : 'auto',
        background: theme.surfaceVariant,
        border: `2px solid ${theme.border}`,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'var(--font-pixel-body)',
        fontSize: compact ? 11 : 12,
        color: theme.ink,
      };

  const gridBtn = (active: boolean): React.CSSProperties => ({
    background: active ? theme.accent : 'transparent',
    color: active ? theme.onAccent : theme.ink,
    border: `2px solid ${active ? theme.border : 'transparent'}`,
    fontFamily: 'var(--font-pixel-body)',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
  });

  return (
    <>
      <button ref={triggerRef} onClick={() => setOpen(!open)} style={triggerStyle}>
        {label && (
          <span
            style={{
              fontFamily: 'var(--font-pixel-head)',
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
            border: `2px solid ${theme.border}`,
            boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
            padding: 8,
          }}
        >
          <div style={{ display: 'flex', gap: 8 }}>
            {/* Hours grid */}
            <div>
              <span
                style={{
                  fontFamily: 'var(--font-pixel-head)',
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
            <div style={{ width: 2, background: theme.border, alignSelf: 'stretch' }} />

            {/* Minutes column */}
            <div>
              <span
                style={{
                  fontFamily: 'var(--font-pixel-head)',
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
