'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

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
      // Keep within viewport
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

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-1 rounded transition-colors text-left',
          borderless
            ? 'px-0 py-0 text-[11px] text-zinc-500 bg-transparent cursor-pointer'
            : compact
              ? 'px-1 py-1 text-[11px] text-zinc-300 bg-zinc-800/60 border border-zinc-700 hover:border-zinc-600'
              : 'px-2 py-1.5 text-xs text-zinc-300 bg-zinc-800/60 border border-zinc-700 hover:border-zinc-600'
        )}
      >
        {label && <span className="text-zinc-500 shrink-0">{label}</span>}
        <span className="font-medium">{selectedH}:{selectedM}</span>
      </button>
      {open && createPortal(
        <div
          ref={popRef}
          className="fixed bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl p-2 z-[9999]"
          style={{ top: pos.top, left: pos.left }}
        >
          <div className="flex gap-2">
            {/* Hours grid: 6 columns × 4 rows */}
            <div>
              <span className="text-[9px] text-zinc-500 uppercase tracking-wider block mb-1 text-center">Ore</span>
              <div className="grid grid-cols-6 gap-0.5">
                {HOURS.map((hr) => (
                  <button
                    key={hr}
                    onClick={() => selectH(hr)}
                    className={cn(
                      'w-7 h-7 rounded text-[11px] font-medium transition-colors',
                      selectedH === hr
                        ? 'bg-blue-600 text-white'
                        : 'text-zinc-300 hover:bg-zinc-700'
                    )}
                  >
                    {hr}
                  </button>
                ))}
              </div>
            </div>

            {/* Separator */}
            <div className="w-px bg-zinc-700 self-stretch" />

            {/* Minutes column */}
            <div>
              <span className="text-[9px] text-zinc-500 uppercase tracking-wider block mb-1 text-center">Min</span>
              <div className="flex flex-col gap-0.5">
                {MINUTES.map((min) => (
                  <button
                    key={min}
                    onClick={() => selectM(min)}
                    className={cn(
                      'w-10 h-7 rounded text-[11px] font-medium transition-colors',
                      selectedM === min
                        ? 'bg-blue-600 text-white'
                        : 'text-zinc-300 hover:bg-zinc-700'
                    )}
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
