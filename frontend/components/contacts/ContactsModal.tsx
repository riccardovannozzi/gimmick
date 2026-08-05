'use client';

/**
 * Gimmick · Obsidian — Gestione contatti.
 *
 * Fino a ora i contatti erano una rubrica cieca: si creavano digitando un nome
 * nel combobox del tab Flow e non esisteva nessun posto per rivederli. Sono 27,
 * e 68 passi di flow ne referenziano uno tramite `tile_subtasks.contact_id` —
 * troppo per restare senza una porta d'ingresso.
 *
 * La tabella è quella della pagina TAGS: stessi primitivi `Table`, stesso
 * `cellBorder`, stessa intestazione appiccicata su `surfaceVariant`, stessa
 * modifica in cella (click → input → Invio o blur per salvare, Esc per
 * annullare). Non è una somiglianza estetica cercata a mano: è lo stesso
 * vocabolario, così chi sa usare i tag sa già usare questa.
 *
 * ─── Il contatto "io" ────────────────────────────────────────────────────────
 *
 * Ogni utente ne ha esattamente uno (`is_self`, indice unico parziale), creato
 * al signup. Vale "la palla è mia" e va tenuto in cima. Si può rinominare, ma
 * NON eliminare: senza, un passo non saprebbe più dire che tocca a te. La riga
 * lo dichiara con la stessa forma che il combobox già usa — `[ nome ]`.
 */
import { useMemo, useState } from 'react';
import { IconPlus, IconTrash, IconArchive, IconArchiveOff } from '@tabler/icons-react';
import { Modal } from '@/components/primitives';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePixelTheme } from '@/components/pixel';
import { useContacts } from '@/lib/hooks/useContacts';
import { OB_TEXT } from '@/lib/theme/ob-typography';
import type { Contact, ContactKind } from '@/types/contact';

const KIND_LABEL: Record<ContactKind, string> = {
  person: 'Persona',
  company: 'Azienda',
  professional: 'Professionista',
  institution: 'Ente',
  other: 'Altro',
};
const KINDS = Object.keys(KIND_LABEL) as ContactKind[];

/** Campi modificabili in cella. `kind` ha un select, non un input di testo. */
type EditField = 'name' | 'phone' | 'email';

const COL = { name: 200, kind: 140, phone: 140, email: 200, actions: 76 };
const TABLE_W = COL.name + COL.kind + COL.phone + COL.email + COL.actions;

export function ContactsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const theme = usePixelTheme();
  // Due liste separate: gli archiviati non si mescolano agli attivi, si
  // raggiungono con l'interruttore in testa.
  const [showArchived, setShowArchived] = useState(false);
  const { contacts, isLoading, create, update, archive, unarchive, remove } = useContacts({ archived: showArchived });

  const [editing, setEditing] = useState<{ id: string; field: EditField } | null>(null);
  const [draft, setDraft] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? contacts.filter((c) => c.name.toLowerCase().includes(q)) : contacts;
    // "Io" in cima, poi alfabetico: è il soggetto più usato e va trovato senza cercarlo.
    return [...list].sort((a, b) => {
      if (a.is_self !== b.is_self) return a.is_self ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [contacts, query]);

  const cellBorder: React.CSSProperties = {
    borderRight: `1px solid ${theme.border}`,
    borderBottom: `1px solid ${theme.border}`,
  };
  const headStyle = (w: number): React.CSSProperties => ({
    width: w, minWidth: w, maxWidth: w,
    background: theme.surfaceVariant,
    borderRight: `1px solid ${theme.border}`,
    borderBottom: `1px solid ${theme.border}`,
    fontFamily: 'var(--ob-font-mono)',
    fontSize: OB_TEXT.micro,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: theme.ink2,
    padding: '0 12px',
  });
  const cell = (w: number): React.CSSProperties => ({
    ...cellBorder, width: w, minWidth: w, maxWidth: w,
    overflow: 'hidden', padding: '0 12px',
  });
  const textStyle: React.CSSProperties = {
    fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.card, color: theme.ink,
    display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  };

  const startEdit = (c: Contact, field: EditField) => {
    setEditing({ id: c.id, field });
    setDraft((c[field] ?? '') as string);
  };

  const commit = (c: Contact) => {
    if (!editing) return;
    const field = editing.field;
    const value = draft.trim();
    setEditing(null);
    // Il nome è l'unico campo obbligatorio: svuotarlo lascerebbe una riga muta.
    if (field === 'name' && !value) return;
    if ((c[field] ?? '') === value) return;
    update.mutate({ id: c.id, updates: { [field]: value || undefined } });
  };

  const editableCell = (c: Contact, field: EditField, w: number) => {
    const isEditing = editing?.id === c.id && editing.field === field;
    const value = (c[field] ?? '') as string;
    return (
      <TableCell style={{ ...cell(w), cursor: 'pointer' }} onClick={() => !isEditing && startEdit(c, field)}>
        {isEditing ? (
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit(c);
              if (e.key === 'Escape') setEditing(null);
            }}
            onBlur={() => commit(c)}
            autoFocus
            onClick={(e) => e.stopPropagation()}
            style={{
              height: 28, width: '100%',
              background: theme.surfaceVariant,
              border: `1px solid ${theme.border}`,
              padding: '0 6px', color: theme.ink,
              fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.card, outline: 'none',
            }}
          />
        ) : (
          <span style={{ ...textStyle, color: value ? theme.ink : theme.ink3 }}>
            {value || (field === 'name' ? '—' : '')}
          </span>
        )}
      </TableCell>
    );
  };

  const barBtn: React.CSSProperties = {
    height: 30, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 10px',
    background: theme.surfaceVariant, color: theme.ink, border: `1px solid ${theme.border}`,
    borderRadius: 'var(--ob-radius-sm)', cursor: 'pointer',
    fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.control,
  };

  return (
    <Modal open={open} onClose={onClose} title="Contatti" maxWidth={TABLE_W + 48}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 320 }}>
        {/* Barra */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca…"
            style={{
              flex: 1, height: 30,
              background: theme.surface, border: `1px solid ${theme.border}`,
              borderRadius: 'var(--ob-radius-sm)', padding: '0 10px', color: theme.ink,
              fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.control, outline: 'none',
            }}
          />
          <button
            type="button"
            style={{ ...barBtn, ...(showArchived ? { background: theme.accent, color: theme.onAccent } : {}) }}
            onClick={() => { setShowArchived((v) => !v); setEditing(null); }}
            title={showArchived ? 'Mostra i contatti attivi' : 'Mostra gli archiviati'}
          >
            {showArchived ? <IconArchiveOff size={14} /> : <IconArchive size={14} />}
            {showArchived ? 'Attivi' : 'Archiviati'}
          </button>
          {!showArchived && (
            <button
              type="button"
              style={barBtn}
              onClick={() => create.mutate({ name: 'Nuovo contatto', kind: 'person' })}
              disabled={create.isPending}
            >
              <IconPlus size={14} />Nuovo
            </button>
          )}
        </div>

        {/* Tabella — stessa cornice della pagina TAGS: superficie, bordo, ombra piena. */}
        <div
          style={{
            background: theme.surface,
            border: `1px solid ${theme.border}`,
            boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
            display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden',
          }}
        >
          <div style={{ flex: 1, overflow: 'auto', maxHeight: '58vh' }}>
            <Table style={{ tableLayout: 'fixed', width: TABLE_W, minWidth: TABLE_W }}>
              <TableHeader className="sticky top-0 z-10" style={{ background: theme.surfaceVariant }}>
                <TableRow style={{ background: 'transparent', borderBottom: 'none' }}>
                  <TableHead style={headStyle(COL.name)}>Nome</TableHead>
                  <TableHead style={headStyle(COL.kind)}>Tipo</TableHead>
                  <TableHead style={headStyle(COL.phone)}>Telefono</TableHead>
                  <TableHead style={headStyle(COL.email)}>Email</TableHead>
                  <TableHead style={headStyle(COL.actions)} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => (
                  <TableRow key={c.id} style={{ height: 44, maxHeight: 44, background: 'transparent' }}>
                    {/* Nome — "io" si riconosce dalle quadre, come nel combobox. */}
                    <TableCell
                      style={{ ...cell(COL.name), cursor: 'pointer' }}
                      onClick={() => !(editing?.id === c.id && editing.field === 'name') && startEdit(c, 'name')}
                    >
                      {editing?.id === c.id && editing.field === 'name' ? (
                        <input
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commit(c);
                            if (e.key === 'Escape') setEditing(null);
                          }}
                          onBlur={() => commit(c)}
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            height: 28, width: '100%',
                            background: theme.surfaceVariant, border: `1px solid ${theme.border}`,
                            padding: '0 6px', color: theme.ink,
                            fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.card, outline: 'none',
                          }}
                        />
                      ) : (
                        <span style={textStyle}>{c.is_self ? `[ ${c.name} ]` : c.name}</span>
                      )}
                    </TableCell>

                    {/* Tipo — insieme chiuso, quindi select e non testo libero. */}
                    <TableCell style={cell(COL.kind)}>
                      <select
                        value={c.kind}
                        onChange={(e) => update.mutate({ id: c.id, updates: { kind: e.target.value as ContactKind } })}
                        style={{
                          width: '100%', height: 28,
                          background: 'transparent', border: 'none', outline: 'none',
                          color: theme.ink, fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.card,
                          cursor: 'pointer',
                        }}
                      >
                        {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
                      </select>
                    </TableCell>

                    {editableCell(c, 'phone', COL.phone)}
                    {editableCell(c, 'email', COL.email)}

                    {/* Azioni */}
                    <TableCell style={{ ...cell(COL.actions), padding: '0 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        {showArchived ? (
                          <button
                            type="button"
                            onClick={() => unarchive.mutate(c.id)}
                            title="Riporta fra gli attivi"
                            style={{ padding: 3, background: 'transparent', border: 'none', color: theme.ink3, cursor: 'pointer', display: 'inline-flex' }}
                          >
                            <IconArchiveOff size={13} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => archive.mutate(c.id)}
                            disabled={c.is_self}
                            title={c.is_self ? 'Il contatto "io" non si archivia' : 'Archivia'}
                            style={{
                              padding: 3, background: 'transparent', border: 'none',
                              color: theme.ink3, cursor: c.is_self ? 'not-allowed' : 'pointer',
                              opacity: c.is_self ? 0.3 : 1, display: 'inline-flex',
                            }}
                          >
                            <IconArchive size={13} />
                          </button>
                        )}
                        {/* Eliminare è definitivo e sgancia i passi che lo citavano
                            (ON DELETE SET NULL): due click, come altrove. */}
                        <button
                          type="button"
                          onClick={() => {
                            if (c.is_self) return;
                            if (confirmDelete === c.id) { remove.mutate(c.id); setConfirmDelete(null); }
                            else setConfirmDelete(c.id);
                          }}
                          disabled={c.is_self}
                          title={c.is_self ? 'Il contatto "io" non si elimina' : confirmDelete === c.id ? 'Conferma eliminazione' : 'Elimina'}
                          style={{
                            padding: 3,
                            background: confirmDelete === c.id ? 'var(--ob-danger)' : 'transparent',
                            color: confirmDelete === c.id ? '#FFFFFF' : theme.ink3,
                            border: 'none', borderRadius: 'var(--ob-radius-sm)',
                            cursor: c.is_self ? 'not-allowed' : 'pointer',
                            opacity: c.is_self ? 0.3 : 1, display: 'inline-flex',
                          }}
                        >
                          <IconTrash size={13} />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {!isLoading && rows.length === 0 && (
              <p style={{
                fontFamily: 'var(--ob-font-mono)', fontSize: OB_TEXT.meta,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                color: theme.ink3, textAlign: 'center', padding: '18px 0', margin: 0,
              }}>
                {query ? 'Nessun risultato' : showArchived ? 'Nessun archiviato' : 'Nessun contatto'}
              </p>
            )}
          </div>
        </div>

        <p style={{ fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.meta, color: theme.ink3, margin: 0 }}>
          {rows.length} contatt{rows.length === 1 ? 'o' : 'i'}
          {showArchived ? ' in archivio' : ''}
        </p>
      </div>
    </Modal>
  );
}
