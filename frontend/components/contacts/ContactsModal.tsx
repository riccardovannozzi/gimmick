'use client';

/**
 * Gimmick · Obsidian — Gestione contatti.
 *
 * Fino a ora i contatti erano una rubrica cieca: si creavano digitando un nome
 * nel combobox del tab Flow e non esisteva nessun posto per rivederli. Sono 27,
 * e 68 passi di flow ne referenziano uno tramite `tile_subtasks.contact_id` —
 * troppo per restare senza una porta d'ingresso.
 *
 * Tabella e barra sono quelle CONDIVISE (`components/primitives/table.tsx`), le
 * stesse di Sparks, Tiles e Tags. Erano disegnate qui a mano, con le stesse
 * quaranta righe di stili inline che stavano anche nella pagina TAGS, e il
 * commento in cima diceva «la tabella è quella della pagina TAGS»: una
 * somiglianza mantenuta a memoria, cioè finché qualcuno non toccava la prima.
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
import {
  Modal, ToolButton, ToolWord,
  TableCard, Table, TableBody, TableRow, TableCell, TableText, TableEmpty,
  Toolbar, ToolGroup, ToolSep,
  type TableColumn,
} from '@/components/primitives';
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

/** Email senza larghezza: è il campo più lungo e prende lo spazio che avanza. */
const COLUMNS: TableColumn[] = [
  { key: 'name', label: 'Nome', width: 200 },
  { key: 'kind', label: 'Tipo', width: 150 },
  { key: 'phone', label: 'Telefono', width: 140 },
  { key: 'email', label: 'Email' },
  { key: 'actions', width: 72 },
];

export function ContactsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const theme = usePixelTheme();
  // Due liste separate: gli archiviati non si mescolano agli attivi, si
  // raggiungono con l'interruttore in barra.
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

  /** L'input della modifica in cella: alto 28 per stare dentro la riga da 44
   *  senza spingerla, e sulla superficie variante per distinguersi dal fondo. */
  const cellInput: React.CSSProperties = {
    height: 28, width: '100%',
    background: theme.surfaceVariant,
    border: `1px solid ${theme.border}`,
    padding: '0 6px', color: theme.ink,
    fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.card, outline: 'none',
  };

  const editableCell = (c: Contact, field: EditField) => {
    const isEditing = editing?.id === c.id && editing.field === field;
    const value = (c[field] ?? '') as string;
    return (
      <TableCell style={{ cursor: 'pointer' }} onClick={() => !isEditing && startEdit(c, field)}>
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
            style={cellInput}
          />
        ) : (
          <TableText style={{ color: value ? theme.ink : theme.ink3 }}>
            {value || (field === 'name' ? '—' : '')}
          </TableText>
        )}
      </TableCell>
    );
  };

  const rowAction: React.CSSProperties = {
    padding: 3, background: 'transparent', border: 'none',
    color: theme.ink3, cursor: 'pointer', display: 'inline-flex',
  };

  return (
    <Modal open={open} onClose={onClose} title="Contatti" maxWidth={760}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 320 }}>
        {/* Barra — stessi comandi di canvas e chrono: campo di barra, parole per
            i modi di guardare, icone per quello che crea. */}
        <Toolbar bare>
          <input
            className="ob-toolinput"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca…"
            style={{ flex: 1, minWidth: 0 }}
          />
          <ToolbarGapSpacer />
          <ToolGroup>
            {/* Cambia COSA guardi, non i dati: è una parola, non un'icona. */}
            <ToolWord
              on={showArchived}
              onClick={() => { setShowArchived((v) => !v); setEditing(null); }}
              title={showArchived ? 'Mostra i contatti attivi' : 'Mostra gli archiviati'}
            >
              Archiviati
            </ToolWord>
            {!showArchived && (
              <>
                <ToolSep />
                <ToolButton
                  icon={<IconPlus size={16} stroke={1.6} />}
                  label="Nuovo contatto"
                  onClick={() => create.mutate({ name: 'Nuovo contatto', kind: 'person' })}
                  disabled={create.isPending}
                />
              </>
            )}
          </ToolGroup>
        </Toolbar>

        <TableCard maxHeight="58vh">
          <Table columns={COLUMNS}>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id}>
                  {/* Nome — "io" si riconosce dalle quadre, come nel combobox. */}
                  <TableCell
                    style={{ cursor: 'pointer' }}
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
                        style={cellInput}
                      />
                    ) : (
                      <TableText>{c.is_self ? `[ ${c.name} ]` : c.name}</TableText>
                    )}
                  </TableCell>

                  {/* Tipo — insieme chiuso, quindi select e non testo libero. */}
                  <TableCell>
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

                  {editableCell(c, 'phone')}
                  {editableCell(c, 'email')}

                  {/* Azioni */}
                  <TableCell style={{ padding: '0 8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      {showArchived ? (
                        <button type="button" onClick={() => unarchive.mutate(c.id)} title="Riporta fra gli attivi" style={rowAction}>
                          <IconArchiveOff size={13} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => archive.mutate(c.id)}
                          disabled={c.is_self}
                          title={c.is_self ? 'Il contatto "io" non si archivia' : 'Archivia'}
                          style={{ ...rowAction, cursor: c.is_self ? 'not-allowed' : 'pointer', opacity: c.is_self ? 0.3 : 1 }}
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
                          ...rowAction,
                          background: confirmDelete === c.id ? 'var(--ob-danger)' : 'transparent',
                          color: confirmDelete === c.id ? '#FFFFFF' : theme.ink3,
                          borderRadius: 'var(--ob-radius-sm)',
                          cursor: c.is_self ? 'not-allowed' : 'pointer',
                          opacity: c.is_self ? 0.3 : 1,
                        }}
                      >
                        <IconTrash size={13} />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && rows.length === 0 && (
                <TableEmpty colSpan={COLUMNS.length}>
                  {query ? 'Nessun risultato' : showArchived ? 'Nessun archiviato' : 'Nessun contatto'}
                </TableEmpty>
              )}
            </TableBody>
          </Table>
        </TableCard>

        <p className="ob-table__foot">
          {rows.length} contatt{rows.length === 1 ? 'o' : 'i'}
          {showArchived ? ' in archivio' : ''}
        </p>
      </div>
    </Modal>
  );
}

/** Il campo di ricerca prende già lo spazio (`flex: 1`): qui serve solo il
 *  respiro fra lui e i comandi, non un secondo elemento elastico. */
function ToolbarGapSpacer() {
  return <div style={{ width: 8, flexShrink: 0 }} />;
}
