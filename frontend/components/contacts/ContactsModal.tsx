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
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  IconPlus, IconTrash, IconArchive, IconArchiveOff, IconUser, IconBuilding, IconCheck,
} from '@tabler/icons-react';
import {
  Modal, ToolButton, ToolWord, SegmentedControl,
  TableCard, Table, TableBody, TableRow, TableCell, TableText, TableEmpty,
  Toolbar, ToolGroup, ToolSep,
  type TableColumn,
} from '@/components/primitives';
import { usePixelTheme } from '@/components/pixel';
import { useContacts } from '@/lib/hooks/useContacts';
import { OB_TEXT } from '@/lib/theme/ob-typography';
import { ContactGraph } from '@/components/contacts/ContactGraph';
import { contactRole, isOrganizationKind, KIND_FOR_ROLE, ROLE_LABEL, ROLE_LABEL_PLURAL } from '@/types/contact';
import type { Contact, ContactRole } from '@/types/contact';

/** Campi modificabili in cella. Il tipo ha un segmentato, non un input. */
type EditField = 'name' | 'phone' | 'email';

/** Il filtro di barra: i due ruoli, più «tutti». */
type RoleFilter = ContactRole | 'all';

/** Email senza larghezza: è il campo più lungo e prende lo spazio che avanza. */
const COLUMNS: TableColumn[] = [
  { key: 'name', label: 'Nome', width: 200 },
  { key: 'kind', label: 'Tipo', width: 230 },
  { key: 'orgs', label: 'Appartiene a', width: 200 },
  { key: 'phone', label: 'Telefono', width: 140 },
  { key: 'email', label: 'Email' },
  { key: 'actions', width: 72 },
];

/**
 * IL MENU DELLE APPARTENENZE — le organizzazioni di una riga, con le spunte.
 *
 * In un PORTALE su `document.body` e in `position: fixed`, come `.ob-ctx`: la
 * tabella scorre dentro un contenitore con `overflow`, e un pannello figlio
 * della cella verrebbe tagliato al primo bordo. Le coordinate arrivano dal
 * rettangolo del pulsante e vengono riportate dentro la finestra.
 *
 * È attivo su OGNI riga, non solo sui soggetti: una controllata dichiara la
 * capogruppo esattamente come una persona dichiara il proprio studio. A restare
 * sempre uguale è ciò che si può SCEGLIERE — solo righe di tipo Organizzazione.
 */
function OrgPicker({ anchor, options, selected, onToggle, onClose }: {
  anchor: DOMRect;
  options: Contact[];
  selected: string[];
  onToggle: (id: string) => void;
  onClose: () => void;
}) {
  const theme = usePixelTheme();
  const ref = useRef<HTMLDivElement>(null);
  const W = 240;

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    // `mousedown` e non `click`: il click che ha aperto il menu è ancora in volo
    // e lo richiuderebbe all'istante.
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const left = Math.max(8, Math.min(anchor.left, window.innerWidth - W - 8));
  // Sotto il pulsante se c'è posto, sopra altrimenti: una riga in fondo alla
  // tabella aprirebbe un menu fuori dallo schermo.
  const below = anchor.bottom + 4;
  const maxH = 260;
  const top = below + maxH > window.innerHeight - 8
    ? Math.max(8, anchor.top - maxH - 4)
    : below;

  return createPortal(
    <div
      ref={ref}
      className="ob-ctx"
      style={{ top, left, width: W, maxHeight: maxH, overflowY: 'auto', padding: 4 }}
    >
      {options.length === 0 ? (
        <div style={{ padding: '8px 9px', color: theme.ink3, fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.meta, lineHeight: 1.5 }}>
          Nessuna organizzazione in rubrica. Metti «Organizzazione» nella colonna
          Tipo di una riga e comparirà qui.
        </div>
      ) : options.map((o) => {
        const on = selected.includes(o.id);
        return (
          <button
            key={o.id}
            type="button"
            className="ob-ctx__item"
            onClick={() => onToggle(o.id)}
            title={o.name}
          >
            {/* La spunta occupa il posto anche da spenta: senza, le righe
                scorrerebbero di lato a ogni clic. */}
            <span
              style={{
                width: 14, height: 14, flexShrink: 0, borderRadius: 3,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                border: `1px solid ${on ? theme.accent : theme.border}`,
                background: on ? theme.accent : 'transparent',
                color: 'var(--ob-canvas)',
              }}
            >
              {on && <IconCheck size={10} stroke={3} />}
            </span>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {o.name}
            </span>
          </button>
        );
      })}
    </div>,
    document.body,
  );
}

export function ContactsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const theme = usePixelTheme();
  // Due liste separate: gli archiviati non si mescolano agli attivi, si
  // raggiungono con l'interruttore in barra.
  const [showArchived, setShowArchived] = useState(false);
  const { contacts, isLoading, memberships, setOrganizations, create, update, archive, unarchive, remove } = useContacts({ archived: showArchived });

  /** Le righe che si possono SCEGLIERE come organizzazione. Sempre le stesse,
   *  qualunque sia la riga che si sta compilando: è ciò che rende la colonna
   *  leggibile: una cella piena vuol dire «fa parte di», mai «contiene». */
  const orgOptions = useMemo(
    () => contacts.filter((c) => isOrganizationKind(c.kind)).sort((a, b) => a.name.localeCompare(b.name)),
    [contacts],
  );
  /** Da id di contatto → id delle organizzazioni di cui fa parte. */
  const orgsOf = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const { member_id, org_id } of memberships) {
      m.set(member_id, [...(m.get(member_id) ?? []), org_id]);
    }
    return m;
  }, [memberships]);
  /** Menu delle appartenenze aperto: riga e rettangolo del pulsante che l'ha
   *  aperto (il menu vive in un portale e non può misurarsi da sé). */
  const [orgMenu, setOrgMenu] = useState<{ id: string; rect: DOMRect } | null>(null);

  const [editing, setEditing] = useState<{ id: string; field: EditField } | null>(null);
  const [draft, setDraft] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  /**
   * LA VISTA A GRAFO.
   *
   * La tabella risponde a «chi c'è», il grafo a «come sono messi»: la colonna
   * «Appartiene a» dice il primo passo dell'appartenenza e tace sul secondo, e
   * un ufficio dentro un ente dentro un consorzio in una tabella non si legge.
   *
   * È una PAROLA in barra e non un'icona perché cambia il modo di guardare gli
   * stessi dati, come «Archiviati» — non li tocca.
   *
   * Non vale sugli archiviati: un grafo di appartenenze fra contatti ritirati
   * non descrive niente di attuale, e le due liste non si mescolano.
   */
  const [graphMode, setGraphMode] = useState(false);
  const graph = graphMode && !showArchived;
  /**
   * LA RIGA APPENA NATA, tenuta in cima finché non ha un nome.
   *
   * Un contatto nuovo si chiama «Nuovo contatto» e, in una lista alfabetica di
   * quaranta righe, finisce fra la N e la O: si crea qualcosa e non lo si vede
   * comparire. Restare in cima non è però uno stato che vale per sempre — una
   * volta battezzata, la riga va dove le tocca, altrimenti la lista avrebbe una
   * riga fuori posto per tutta la sessione.
   * Quindi: in cima dalla nascita al battesimo. Se ne nasce una seconda prima
   * che la prima abbia un nome, la prima torna in alfabeto: è sempre l'ULTIMA
   * nata quella che si sta guardando.
   */
  const [pinnedId, setPinnedId] = useState<string | null>(null);

  // Chiusa la finestra, il nuovo nato non è più nuovo: riaprendola nessuna riga
  // deve stare in cima per un gesto di dieci minuti prima. Stessa sorte per le
  // modifiche in corso e per le conferme a metà.
  useEffect(() => {
    if (open) return;
    setPinnedId(null);
    setEditing(null);
    setConfirmDelete(null);
    setOrgMenu(null);
  }, [open]);

  /**
   * Crea una riga e la mette subito in modifica sul nome.
   *
   * Il RUOLO lo decide il filtro attivo: col filtro su «Organizzazioni» il «+»
   * fabbrica un'organizzazione, perché l'alternativa — creare una persona —
   * produrrebbe una riga che il filtro stesso nasconde all'istante.
   * La RICERCA invece si azzera: nessun nome di comodo può indovinare un testo
   * digitato, e una riga nuova che non compare è peggio di una ricerca persa.
   */
  const handleCreate = () => {
    const role: ContactRole = roleFilter === 'organization' ? 'organization' : 'subject';
    setQuery('');
    create.mutate(
      {
        name: role === 'organization' ? 'Nuova organizzazione' : 'Nuovo contatto',
        kind: KIND_FOR_ROLE[role],
      },
      {
        onSuccess: (c) => {
          if (!c?.id) return;
          setPinnedId(c.id);
          // Già in modifica, e col campo vuoto: creare un contatto è sempre il
          // preludio a battezzarlo, e «Nuovo contatto» è un segnaposto da
          // sostituire, non un testo da correggere. Uscendo senza scrivere
          // niente il segnaposto resta (vedi la guardia in `commit`).
          setEditing({ id: c.id, field: 'name' });
          setDraft('');
        },
      },
    );
  };

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = contacts.filter((c) => (
      (roleFilter === 'all' || contactRole(c.kind) === roleFilter)
      && (!q || c.name.toLowerCase().includes(q))
    ));
    // Tre scaglioni: la riga appena nata, "io", tutti gli altri in alfabeto.
    // "Io" sta in alto perché è il soggetto più usato e va trovato senza
    // cercarlo; il nuovo nato gli passa davanti perché è l'unica riga che in
    // questo momento si sta guardando.
    const rank = (c: Contact) => (c.id === pinnedId ? 0 : c.is_self ? 1 : 2);
    return list.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  }, [contacts, query, roleFilter, pinnedId]);

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
    // Battezzata: la riga lascia la cima e va al suo posto in alfabeto. È il
    // nome, e solo il nome, a sciogliere l'ancoraggio — telefono e email non
    // spostano niente nell'ordine, e toglierlo lì sarebbe un salto senza causa
    // visibile.
    if (field === 'name' && c.id === pinnedId) setPinnedId(null);
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
    /* 1120 non è un numero tondo scelto a occhio: è quanto serve perché la
       tabella smetta di scorrere di lato. Le colonne a larghezza fissa fanno
       200 + 230 + 200 + 140 + 72 = 842, l'email vuole almeno un paio di
       centinaia di pixel per non troncare ogni indirizzo, e la gronda della
       modale ne mangia 36. A 760 la somma non ci stava e in fondo alla finestra
       compariva una barra di scorrimento orizzontale — su una tabella, il modo
       più sicuro di nascondere una colonna. Sotto i 1120 di finestra il
       `width: 100%` la restringe e si torna a scorrere: è la degradazione
       accettabile, non il caso normale. */
    <Modal open={open} onClose={onClose} title="Contatti" maxWidth={1120}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 420 }}>
        {/* Barra — stessi comandi di canvas e chrono: campo di barra, parole per
            i modi di guardare, icone per quello che crea. */}
        <Toolbar bare>
          {/* La ricerca ha un TETTO: nella finestra allargata un campo elastico
              diventerebbe largo seicento pixel per contenere un nome. */}
          <input
            className="ob-toolinput"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={graph ? 'Evidenzia…' : 'Cerca…'}
            style={{ flex: 1, minWidth: 0, maxWidth: 300 }}
          />
          {/* FILTRO PER TIPO — accanto alla ricerca, perché fa la stessa cosa:
              restringe la lista. I comandi che la CAMBIANO stanno in fondo.
              Stesse due icone e stesse due parole della colonna Tipo, al
              plurale: lì l'etichetta dice che cos'è una riga, qui dice quali
              righe restano. */}
          {/* Il filtro per tipo vale solo sulla TABELLA. Togliere i soggetti da
              un grafo ne toglierebbe anche le linee, e resterebbe un disegno
              che afferma cose false su ciò che resta. */}
          <div style={{ width: 8, flexShrink: 0 }} />
          {!graph && <SegmentedControl<RoleFilter>
            className="ob-seg--tool"
            aria-label="Filtra per tipo"
            value={roleFilter}
            onChange={(v) => { setRoleFilter(v); setEditing(null); }}
            items={[
              { value: 'all', label: 'Tutti' },
              { value: 'subject', label: <><IconUser size={13} stroke={1.8} />{ROLE_LABEL_PLURAL.subject}</> },
              { value: 'organization', label: <><IconBuilding size={13} stroke={1.8} />{ROLE_LABEL_PLURAL.organization}</> },
            ]}
          />}
          <div className="ob-toolbar__gap" />
          <ToolGroup>
            {/* Cambiano COSA guardi, non i dati: sono parole, non icone. */}
            {!showArchived && (
              <ToolWord
                on={graphMode}
                onClick={() => { setGraphMode((v) => !v); setEditing(null); setOrgMenu(null); }}
                title={graphMode ? 'Torna alla tabella' : 'Vedi le appartenenze come grafo'}
              >
                Grafo
              </ToolWord>
            )}
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
                  label={roleFilter === 'organization' ? 'Nuova organizzazione' : 'Nuovo contatto'}
                  onClick={handleCreate}
                  disabled={create.isPending}
                />
              </>
            )}
          </ToolGroup>
        </Toolbar>

        {graph ? (
          <ContactGraph
            contacts={contacts}
            memberships={memberships}
            onSetOrganizations={(id, orgIds) => setOrganizations.mutate({ id, orgIds })}
            query={query}
            height="64vh"
          />
        ) : (
        <TableCard maxHeight="64vh">
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

                  {/* TIPO — due sole voci, e in vista tutte e due.
                      Era un elenco a discesa con cinque valori (Persona,
                      Azienda, Professionista, Ente, Altro): distingueva più di
                      quanto servisse e, soprattutto, teneva NASCOSTA la
                      distinzione che conta — individuo o insieme di individui —
                      dietro un clic. In una tabella dove le due specie stanno
                      mescolate, quella è la prima cosa che deve saltare all'occhio
                      scorrendo la colonna, e un segmentato la mostra su ogni riga
                      senza aprire niente.
                      I cinque `kind` restano nel database: la lettura ne accorpa
                      cinque in due, la scrittura ne sceglie uno canonico. Vedi
                      `contactRole` in types/contact.ts. */}
                  <TableCell>
                    <SegmentedControl<ContactRole>
                      className="ob-seg--sm"
                      aria-label="Tipo di contatto"
                      value={contactRole(c.kind)}
                      onChange={(role) => update.mutate({ id: c.id, updates: { kind: KIND_FOR_ROLE[role] } })}
                      items={[
                        { value: 'subject', label: <><IconUser size={12} stroke={1.8} />{ROLE_LABEL.subject}</> },
                        { value: 'organization', label: <><IconBuilding size={12} stroke={1.8} />{ROLE_LABEL.organization}</> },
                      ]}
                    />
                  </TableCell>

                  {/* APPARTIENE A — le organizzazioni della riga.
                      Attiva su OGNI riga: una persona dichiara il proprio studio,
                      una controllata la propria capogruppo. Quello che non cambia
                      mai è l'insieme delle scelte — solo righe di tipo
                      Organizzazione — e quindi il senso della colonna: qui c'è
                      sempre «fa parte di», mai «contiene».
                      L'unica esclusa è la riga stessa: il CHECK sulla tabella la
                      rifiuterebbe, ma una casella che non si può spuntare è peggio
                      di una casella che non c'è. */}
                  <TableCell style={{ padding: '0 4px' }}>
                    {(() => {
                      const mine = orgsOf.get(c.id) ?? [];
                      const names = mine
                        .map((id) => contacts.find((k) => k.id === id)?.name)
                        .filter(Boolean) as string[];
                      return (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            setOrgMenu((prev) => (prev?.id === c.id ? null : { id: c.id, rect }));
                          }}
                          title={names.length ? names.join(', ') : 'Assegna una o più organizzazioni'}
                          style={{
                            width: '100%', height: 28, padding: '0 6px', textAlign: 'left',
                            background: 'transparent', border: 'none', cursor: 'pointer',
                            color: names.length ? theme.ink : theme.ink3,
                            fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.card,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}
                        >
                          {names.length ? names.join(', ') : '—'}
                        </button>
                      );
                    })()}
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
                  {query || roleFilter !== 'all'
                    ? 'Nessun risultato'
                    : showArchived ? 'Nessun archiviato' : 'Nessun contatto'}
                </TableEmpty>
              )}
            </TableBody>
          </Table>
        </TableCard>
        )}

        {/* «di N» solo quando qualcosa è stato escluso: senza, un filtro attivo
            e una lista intera darebbero lo stesso numero e non si saprebbe di
            stare guardando una parte. */}
        <p className="ob-table__foot">
          {graph ? (
            <>
              {contacts.length} contatt{contacts.length === 1 ? 'o' : 'i'}
              {' · '}
              {memberships.length} appartenenz{memberships.length === 1 ? 'a' : 'e'}
            </>
          ) : (
            <>
              {rows.length} contatt{rows.length === 1 ? 'o' : 'i'}
              {rows.length !== contacts.length ? ` di ${contacts.length}` : ''}
              {showArchived ? ' in archivio' : ''}
            </>
          )}
        </p>

        {/* Il menu delle appartenenze è montato UNA volta qui, non dentro la
            cella: vive comunque in un portale su `document.body`, e tenerne una
            copia per riga avrebbe voluto dire N listener di chiusura in ascolto
            insieme. Resta aperto mentre si spuntano più organizzazioni — sono
            spunte, non una scelta singola. */}
        {orgMenu && (() => {
          const mine = orgsOf.get(orgMenu.id) ?? [];
          return (
            <OrgPicker
              anchor={orgMenu.rect}
              options={orgOptions.filter((o) => o.id !== orgMenu.id)}
              selected={mine}
              onToggle={(orgId) => setOrganizations.mutate({
                id: orgMenu.id,
                orgIds: mine.includes(orgId) ? mine.filter((x) => x !== orgId) : [...mine, orgId],
              })}
              onClose={() => setOrgMenu(null)}
            />
          );
        })()}
      </div>
    </Modal>
  );
}
