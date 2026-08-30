'use client';

/**
 * Gimmick · Canvas — ContactPicker.
 *
 * La domanda che si fa POSANDO un soggetto o un'organizzazione: di chi si
 * tratta? Si risponde in un modo solo — scrivendo — e quello che si scrive fa
 * due cose insieme: cerca fra chi c'è già e, se non c'è, lo crea.
 *
 * ⚠️ Prima di questo pannello, posare una figura creava SEMPRE una riga nuova in
 * rubrica, chiamata «Soggetto senza nome» finché non la si rinominava. Due
 * conseguenze, entrambe sbagliate:
 *   · la stessa persona posata su due lavagne diventava due persone, e da lì in
 *     poi nessuna delle due sapeva più dell'altra;
 *   · un click andato a vuoto lasciava un senza nome in rubrica per sempre.
 * Qui non si scrive niente finché non si è risposto: Esc e non è successo
 * nulla.
 *
 * Le proposte sono filtrate per RUOLO — posando un soggetto si scelgono
 * individui, posando un'organizzazione insiemi di individui. La regola arriva da
 * `types/contact.ts`, che è dove vive per tutta l'app.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconPlus, IconUser, IconBuilding } from '@tabler/icons-react';
import { usePixelTheme } from '@/components/pixel';
import { OB_TEXT, obLabel } from '@/lib/theme/ob-typography';
import { contactRole, ROLE_LABEL } from '@/types/contact';
import type { CanvasContact } from '@/components/canvas/CanvasBoard';

/** Larghezza fissa: il pannello si apre sotto il puntatore, e uno che cambia
 *  larghezza col nome più lungo dell'elenco ballerebbe a ogni lettera. */
const W = 268;
/** Quanto può occupare in verticale, per decidere se aprirsi sopra o sotto. */
const MAX_H = 320;

export interface ContactPickerProps {
  variant: 'subject' | 'organization';
  /** Il punto dello SCHERMO in cui si è cliccato. */
  at: { x: number; y: number };
  /** La rubrica intera: il filtro per ruolo lo fa questo pannello. */
  contacts: CanvasContact[];
  /** Chi è GIÀ su questa lavagna. Si vede ma non si sceglie: due figure per la
   *  stessa persona sarebbero due segni che si rinominano a vicenda. */
  onBoard: string[];
  onPick: (contactId: string) => void;
  onCreate: (name: string) => void;
  onCancel: () => void;
}

export function ContactPicker({
  variant, at, contacts, onBoard, onPick, onCreate, onCancel,
}: ContactPickerProps) {
  const theme = usePixelTheme();
  const isOrg = variant === 'organization';
  const role = isOrg ? 'organization' : 'subject';
  const Glyph = isOrg ? IconBuilding : IconUser;

  const [query, setQuery] = useState('');
  /** Riga evidenziata, fra quelle ATTIVABILI (le già-poste non contano). */
  const [hi, setHi] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  const q = query.trim().toLowerCase();

  /** Le righe MOSTRATE: il ruolo giusto, il testo digitato, in alfabeto. Le
   *  già-poste restano nell'elenco — sparire sarebbe la risposta sbagliata a
   *  «perché non lo trovo». */
  const rows = useMemo(() => {
    const same = contacts.filter((c) => contactRole(c.kind) === role);
    const hit = q ? same.filter((c) => c.name.toLowerCase().includes(q)) : same;
    return [...hit].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 40);
  }, [contacts, role, q]);

  /** Un nome che esiste già non si ricrea: il pulsante «crea» sparisce e resta
   *  la riga da scegliere. Il confronto è sull'intera rubrica e non sulle sole
   *  righe filtrate — un omonimo dell'altro ruolo è comunque un'altra persona,
   *  quindi il confronto resta dentro il ruolo. */
  const exact = useMemo(
    () => rows.some((c) => c.name.trim().toLowerCase() === q),
    [rows, q],
  );
  const canCreate = q.length > 0 && !exact;

  /** Le voci ATTIVABILI, nell'ordine in cui le frecce le percorrono. */
  const options = useMemo(() => {
    const picks = rows
      .filter((c) => !onBoard.includes(c.id))
      .map((c) => ({ kind: 'pick' as const, id: c.id }));
    return canCreate ? [...picks, { kind: 'create' as const, id: '' }] : picks;
  }, [rows, onBoard, canCreate]);

  // Il testo cambia, l'evidenziazione torna in cima: restare sulla terza riga di
  // un elenco che nel frattempo ne ha due sarebbe puntare a caso.
  useEffect(() => { setHi(0); }, [q]);

  const run = (o: { kind: 'pick' | 'create'; id: string }) => {
    if (o.kind === 'create') onCreate(query.trim());
    else onPick(o.id);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onCancel(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi((i) => Math.min(i + 1, options.length - 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHi((i) => Math.max(i - 1, 0)); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      const o = options[hi];
      if (o) run(o);
      return;
    }
  };

  // Riportato dentro la finestra: un click vicino al bordo destro o in fondo
  // aprirebbe il pannello fuori schermo.
  const left = Math.max(8, Math.min(at.x, window.innerWidth - W - 8));
  const top = at.y + MAX_H > window.innerHeight - 8
    ? Math.max(8, window.innerHeight - MAX_H - 8)
    : at.y;

  const rowBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8,
    width: '100%', padding: '6px 8px', textAlign: 'left',
    border: '1px solid transparent', borderRadius: 'var(--ob-radius-sm)',
    fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.card,
    minWidth: 0,
  };

  return createPortal(
    <>
      {/* Lo schermo intero cattura il click fuori: chiudere è annullare, e
          annullare non lascia niente sulla lavagna. */}
      <div
        className="fixed inset-0 z-[9998]"
        onMouseDown={onCancel}
        onContextMenu={(e) => { e.preventDefault(); onCancel(); }}
      />
      <div
        className="fixed"
        onKeyDown={onKeyDown}
        style={{
          top, left, width: W, zIndex: 9999,
          background: theme.surface,
          border: `1px solid ${theme.border}`,
          borderRadius: 'var(--ob-radius-md)',
          boxShadow: 'var(--ob-shadow-card)',
          display: 'flex', flexDirection: 'column',
          maxHeight: MAX_H, overflow: 'hidden',
        }}
      >
        <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
          <span style={{ ...obLabel(theme), display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Glyph size={11} stroke={1.8} />
            {isOrg ? 'Nuova organizzazione' : 'Nuovo soggetto'}
          </span>
          {/* UN campo per due gesti. Il testo che cerca è lo stesso che crea:
              separare «cerca» da «aggiungi» avrebbe voluto dire far scegliere
              PRIMA di sapere se la persona c'è già. */}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={isOrg ? 'Cerca o scrivi una ragione sociale' : 'Cerca o scrivi un nome'}
            style={{
              width: '100%', padding: '7px 9px',
              background: 'var(--ob-rail-field)', border: `1px solid ${theme.border}`,
              borderRadius: 'var(--ob-radius-sm)', color: theme.ink,
              fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.control,
              outline: 'none',
            }}
          />
        </div>

        <div className="ob-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 4px 4px' }}>
          {rows.length === 0 && (
            <div
              style={{
                padding: '6px 8px 8px',
                color: theme.ink3, fontFamily: 'var(--ob-font-sans)',
                fontSize: OB_TEXT.meta, lineHeight: 1.5,
              }}
            >
              {q
                ? `Nessun ${ROLE_LABEL[role].toLowerCase()} con questo nome.`
                : `Nessun ${ROLE_LABEL[role].toLowerCase()} in rubrica. Scrivi un nome per crearne uno.`}
            </div>
          )}

          {rows.map((c) => {
            const placed = onBoard.includes(c.id);
            const active = !placed && options[hi]?.kind === 'pick' && options[hi]?.id === c.id;
            return (
              <button
                key={c.id}
                type="button"
                disabled={placed}
                onClick={() => onPick(c.id)}
                onMouseEnter={() => {
                  const i = options.findIndex((o) => o.kind === 'pick' && o.id === c.id);
                  if (i >= 0) setHi(i);
                }}
                title={placed ? `${c.name} è già su questa lavagna` : c.name}
                style={{
                  ...rowBase,
                  background: active ? theme.surfaceVariant : 'transparent',
                  borderColor: active ? theme.border : 'transparent',
                  color: placed ? theme.ink3 : theme.ink2,
                  cursor: placed ? 'not-allowed' : 'pointer',
                  opacity: placed ? 0.55 : 1,
                }}
              >
                <span style={{ display: 'inline-flex', flexShrink: 0, color: theme.ink3 }}>
                  <Glyph size={13} stroke={1.8} />
                </span>
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.name}
                </span>
                {placed && (
                  <span
                    style={{
                      flexShrink: 0, fontFamily: 'var(--ob-font-mono)',
                      fontSize: OB_TEXT.micro, letterSpacing: '0.04em',
                      textTransform: 'uppercase', color: theme.ink3,
                    }}
                  >
                    già qui
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {canCreate && (() => {
          const active = options[hi]?.kind === 'create';
          return (
            <button
              type="button"
              onClick={() => onCreate(query.trim())}
              onMouseEnter={() => setHi(options.length - 1)}
              style={{
                ...rowBase,
                flexShrink: 0,
                borderRadius: 0,
                borderTop: `1px solid ${theme.border}`,
                borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: 'transparent',
                padding: '8px 12px',
                background: active ? theme.surfaceVariant : 'transparent',
                color: theme.accent,
                cursor: 'pointer',
              }}
            >
              <IconPlus size={13} stroke={2} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Crea <span style={{ color: theme.ink }}>«{query.trim()}»</span>
              </span>
            </button>
          );
        })()}
      </div>
    </>,
    document.body,
  );
}
