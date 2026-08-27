'use client';

/**
 * Gimmick · Canvas — SubjectSidebar.
 *
 * Pannello destro di un SOGGETTO selezionato: la persona a cui una parte della
 * lavagna fa capo. Quattro campi — denominazione, mail, telefono, note.
 *
 * Sulla lavagna il soggetto è un'icona e, sotto, la sola denominazione: gli
 * altri tre campi si leggono da qui. È deliberato — una lavagna è fatta di
 * oggetti che si guardano da lontano, e un indirizzo email disegnato sotto ogni
 * persona sarebbe rumore per il 99% del tempo in cui la si sta guardando per
 * capire com'è messo il lavoro, non per telefonare a qualcuno.
 *
 * ⚠️ NON è un contatto della rubrica. `contacts` è una riga condivisa che i
 * passi dei flow referenziano; questo vive e muore con la sua lavagna. I nomi
 * sono vicini, le cose no — vedi la nota sulla migrazione 046.
 */
import { useEffect, useRef, useState } from 'react';
import {
  IconLayoutSidebarRightCollapse, IconLayoutSidebarRightExpand, IconTrash, IconUser,
} from '@tabler/icons-react';
import { usePixelTheme } from '@/components/pixel';
import { OB_WEIGHT, OB_TEXT, obLabel } from '@/lib/theme/ob-typography';
import type { CanvasBoxSubjectContent } from '@/components/canvas/CanvasBoard';

/** I quattro campi, nell'ordine in cui si compilano. `notes` è l'unico
 *  multiriga: gli altri tre sono dati di una riga sola per definizione. */
const FIELDS: { key: keyof CanvasBoxSubjectContent; label: string; placeholder: string; area?: boolean }[] = [
  { key: 'name', label: 'Denominazione', placeholder: 'Nome e cognome, o ragione sociale' },
  { key: 'email', label: 'Mail', placeholder: 'nome@dominio.it' },
  { key: 'phone', label: 'Telefono', placeholder: '+39 …' },
  { key: 'notes', label: 'Note', placeholder: 'Cosa serve ricordarsi di questa persona', area: true },
];

interface SubjectSidebarProps {
  /** Box soggetto selezionato (già ristretto a type 'subject' dal parent). */
  boxId: string;
  content: CanvasBoxSubjectContent;
  open: boolean;
  onToggle: () => void;
  /** Risale a ogni battuta: è il parent a ritardare specchio e salvataggio. */
  onChange: (patch: Partial<CanvasBoxSubjectContent>) => void;
  onDelete: () => void;
}

export function SubjectSidebar({ boxId, content, open, onToggle, onChange, onDelete }: SubjectSidebarProps) {
  const theme = usePixelTheme();

  // Campi controllati in LOCALE: il valore del parent torna con lo specchio
  // ritardato (il canvas si ridisegna a fine digitazione, non a ogni tasto), e
  // legarli direttamente farebbe saltare il cursore a metà parola.
  const [draft, setDraft] = useState<CanvasBoxSubjectContent>(content);
  const firstRef = useRef<HTMLInputElement>(null);
  // Solo su `boxId`: rileggere a ogni cambio di `content` riporterebbe indietro
  // il campo mentre lo si sta scrivendo.
  useEffect(() => { setDraft(content); }, [boxId]); // eslint-disable-line react-hooks/exhaustive-deps

  const write = (key: keyof CanvasBoxSubjectContent, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }));
    onChange({ [key]: value });
  };

  const eyebrow = obLabel(theme);
  const fieldStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px',
    background: 'var(--ob-rail-field)', border: `1px solid ${theme.border}`,
    borderRadius: 'var(--ob-radius-sm)', color: theme.ink,
    fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.control,
    lineHeight: 1.4, outline: 'none',
  };

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
      {/* Header: collapse + di chi stiamo parlando. Il titolo è la
          denominazione appena c'è: aperti tre pannelli di fila, «Soggetto»
          ripetuto tre volte non distingue i tre. */}
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
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 6, minWidth: 0,
              color: theme.ink, fontFamily: 'var(--ob-font-sans)',
              fontSize: OB_TEXT.control, fontWeight: OB_WEIGHT.emphasis,
            }}
          >
            <span
              style={{
                width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                background: 'var(--ob-surface-2)', border: `1px solid ${theme.border}`,
                color: theme.ink2, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <IconUser size={11} stroke={1.8} />
            </span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {(draft.name || '').trim() || 'Soggetto'}
            </span>
          </div>
        )}
      </div>

      {open && (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {FIELDS.map((f, i) => (
            <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
              <span style={eyebrow}>{f.label}</span>
              {f.area ? (
                <textarea
                  value={(draft[f.key] ?? '') as string}
                  onChange={(e) => write(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  rows={5}
                  style={{ ...fieldStyle, resize: 'vertical', minHeight: 90 }}
                />
              ) : (
                <input
                  ref={i === 0 ? firstRef : undefined}
                  value={(draft[f.key] ?? '') as string}
                  onChange={(e) => write(f.key, e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                  placeholder={f.placeholder}
                  // `type` giusto: su desktop non cambia niente, ma è ciò che
                  // dà la tastiera con la @ e quella numerica sul touch.
                  type={f.key === 'email' ? 'email' : f.key === 'phone' ? 'tel' : 'text'}
                  style={fieldStyle}
                />
              )}
            </div>
          ))}

          {/* Azioni */}
          <button
            onClick={onDelete}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              width: '100%', padding: '9px 12px', background: 'var(--ob-rail-field)',
              border: 'none', borderRadius: 'var(--ob-radius-sm)', color: 'var(--ob-danger)',
              fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.control, cursor: 'pointer',
              flexShrink: 0, marginTop: 'auto',
            }}
          >
            <IconTrash size={14} />
            Elimina soggetto
          </button>
        </div>
      )}
    </div>
  );
}
