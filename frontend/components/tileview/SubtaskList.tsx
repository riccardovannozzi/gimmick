'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subtasksApi } from '@/lib/api';
import { invalidateTileCaches, patchTileCaches } from '@/lib/tile-cache';
import { useContacts } from '@/lib/hooks/useContacts';
import { subtaskBall } from '@/lib/tile-visual';
import type { ActionType, Subtask, SubtaskState } from '@/types';
import type { Contact } from '@/types/contact';
import { usePixelTheme } from '@/components/pixel';
import { OB_LEADING, OB_WEIGHT, OB_TEXT } from '@/lib/theme/ob-typography';
import {
  IconPlus,
  IconTrash,
  IconCopy,
  IconCheck,
  IconGripVertical,
  IconLock,
  IconLockOpen,
  IconSearch,
  IconUser,
  IconUserFilled,
} from '@tabler/icons-react';
/**
 * Una riga = UN CAMPO. Vale per ogni tile, flow compresi.
 *
 * I passi di un flow hanno avuto per un momento tre controlli in più — contatto,
 * data, stato — ereditati dal tab Flow. Sono stati tolti: una voce di checklist
 * con tre chip sotto non è più una voce di checklist. Ciò che quei campi
 * dicevano è stato ripiegato nel testo al momento della migrazione
 * ("Attesa risposta — Alessandro Bisdomini · 03/06/26"), che è anche l'unico
 * modo perché due attese sulla stessa cosa ma su persone diverse restino due
 * righe distinguibili.
 *
 * Le colonne `contact_id` / `occurred_at` / `state` esistono ancora sul dato e
 * conservano il valore originale: se un giorno servisse una resa strutturata,
 * la sorgente non è stata buttata.
 *
 * ⚠️ `state` È tornato in interfaccia, e vale la pena dire perché non contraddice
 * quanto sopra: non come chip sotto la riga, ma come un LUCCHETTO nella barretta
 * di azioni che la riga aveva già, accanto a copia ed elimina. Il motivo non è
 * completezza del modello — è che il segmento ROSSO della barra di avanzamento
 * sulle card non aveva nessuna sorgente, e un colore che non può accendersi è
 * una regola di lettura che nessuno impara. Solo `blocked`: `cancelled` resta
 * senza comando, perché una voce annullata si elimina.
 *
 * ⚠️ `contact_id` è tornato anche lui, e per la stessa ragione: senza un comando
 * che lo scriva, le due liste del Cockpit — «Tocca a me» e «Tocca a te» —
 * nascevano vuote (98 passi aperti su 123 non hanno un contatto, e i 25 che ce
 * l'hanno sono un lascito della migrazione dei vecchi `flow_nodes`).
 *
 * Ma NON come il chip di allora: è un pulsantino nella stessa barretta, che apre
 * un menu. E fa DUE cose con un gesto solo — accendere la palla e, se vuoi,
 * dire a chi — perché era proprio il costo di compilare due controlli separati
 * ad aver fatto sospendere la marcatura. Compare solo sui tile `flow`: fuori da
 * un flusso fra più soggetti la palla non ha significato.
 */
interface SubtaskListProps {
  tileId: string;
  /**
   * Serve a una cosa sola: sapere se il tile è un `flow`, e quindi se mostrare
   * la palla. Chi monta questo componente il tile ce l'ha già in mano.
   */
  actionType?: ActionType;
}

export function SubtaskList({ tileId, actionType }: SubtaskListProps) {
  const theme = usePixelTheme();
  const queryClient = useQueryClient();
  const queryKey = ['subtasks', tileId];
  const isFlow = actionType === 'flow';

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => subtasksApi.list(tileId),
    enabled: !!tileId,
  });

  const subtasks: Subtask[] = data?.data || [];

  /**
   * La checklist non vive solo qui: le card la disegnano come barra di
   * spuntini, e il footer come «3 di 5». Quel dato arriva dalla lista dei tile
   * (`subtasks`, forma compatta: solo `is_done`, in ordine di `sort_order`), che
   * è una cache diversa da questa.
   *
   * Senza questa proiezione, spuntare un passo nella sidebar destra lasciava la
   * card del Kanban lì accanto con il vecchio conteggio — due numeri diversi
   * sullo stesso schermo per lo stesso tile.
   */
  const projectToCards = useCallback((list: { is_done?: boolean; sort_order?: number; state?: SubtaskState }[]) => {
    const compact = list
      .slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((s) => ({ is_done: !!s.is_done, state: s.state ?? null }));
    patchTileCaches(queryClient, tileId, { subtasks: compact });
  }, [queryClient, tileId]);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey });
    // Aggiungere o togliere un passo cambia il denominatore («3 di 5» → «3 di
    // 4»): la forma nuova la conosce il server, quindi qui si rilegge.
    invalidateTileCaches(queryClient);
  }, [queryClient, queryKey]);

  const addMutation = useMutation({
    mutationFn: () => subtasksApi.create({ tile_id: tileId, content: '' }),
    // La strip sulla card cresce nel momento in cui premi «Aggiungi», non
    // quando il server risponde: la voce nuova esiste già qui sotto: gli manca
    // solo l'id. `sort_order` massimo perché la voce nasce in fondo.
    onMutate: () => projectToCards([...subtasks, { is_done: false, sort_order: Number.MAX_SAFE_INTEGER }]),
    onSuccess: invalidate,
    // Il server non l'ha creata: la strip torna alla lista che c'è davvero.
    onError: () => projectToCards(subtasks),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Pick<Subtask, 'content' | 'is_done' | 'contact_id' | 'occurred_at' | 'state'>> }) =>
      subtasksApi.update(id, updates),
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey });
      const prev = queryClient.getQueryData<{ data?: Subtask[] }>(queryKey);
      if (!prev?.data) return { prev };
      const data = prev.data.map((s) => (s.id === id ? { ...s, ...updates } : s));
      queryClient.setQueryData(queryKey, { ...prev, data });
      // Fuori dall'updater: scrive in ALTRE cache, e un updater di React Query
      // deve restare una funzione pura del valore che riceve.
      projectToCards(data);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (!ctx?.prev) return;
      queryClient.setQueryData(queryKey, ctx.prev);
      projectToCards(((ctx.prev as { data?: Subtask[] })?.data) ?? []);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => subtasksApi.delete(id),
    onMutate: (id) => projectToCards(subtasks.filter((s) => s.id !== id)),
    onSuccess: invalidate,
    onError: () => projectToCards(subtasks),
  });

  const reorderMutation = useMutation({
    mutationFn: (items: { id: string; sort_order: number }[]) => subtasksApi.reorder(items),
    onSuccess: invalidate,
  });

  const moveByIndex = useCallback((from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= subtasks.length || to >= subtasks.length) return;
    const reordered = [...subtasks];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    const items = reordered.map((s, i) => ({ id: s.id, sort_order: i }));
    const next = reordered.map((s, i) => ({ ...s, sort_order: i }));
    queryClient.setQueryData(queryKey, { data: next });
    // La barra sulla card è in ordine di `sort_order`: riordinando qui, i
    // quadratini pieni devono spostarsi anche là.
    projectToCards(next);
    reorderMutation.mutate(items);
  }, [subtasks, reorderMutation, queryClient, queryKey, projectToCards]);

  const copy = useCallback(async (content: string) => {
    try { await navigator.clipboard.writeText(content); } catch { /* ignore */ }
  }, []);

  // Drag-and-drop state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  // ─── LA PALLA ──────────────────────────────────────────────────────────────
  // La rubrica si carica solo sui flow: sugli altri tile il pulsante non c'è, e
  // una richiesta di rete per un menu che non si apre è sprecata.
  const { contacts } = useContacts({ enabled: isFlow });
  const selfContactId = useMemo(() => contacts.find((c) => c.is_self)?.id ?? null, [contacts]);
  /**
   * Il menu è UNO SOLO per tutta la lista, non uno per riga: una copia per riga
   * significherebbe N ascoltatori di chiusura in attesa insieme. Stessa scelta,
   * e stessa motivazione, del menu delle appartenenze in `ContactsModal`.
   *
   * Tiene l'ID e non il subtask intero, così quel che il menu mostra resta
   * allineato alla cache anche dopo una scrittura.
   */
  const [ballMenu, setBallMenu] = useState<{ id: string; rect: DOMRect } | null>(null);
  const ballSubtask = ballMenu ? subtasks.find((s) => s.id === ballMenu.id) ?? null : null;

  /** Le tre risposte del menu, scritte come una sola mutazione. */
  const setBall = useCallback((id: string, next: { is_theirs: boolean; contact_id: string | null }) => {
    updateMutation.mutate({ id, updates: next });
    setBallMenu(null);
  }, [updateMutation]);

  if (isLoading) {
    return (
      <p style={{ fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.card, color: theme.ink3, marginTop: 16 }}>
        Caricamento...
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {subtasks.length === 0 && (
        <p
          style={{
            fontFamily: 'var(--ob-font-mono)',
            fontSize: OB_TEXT.meta,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: theme.ink3,
            textAlign: 'center',
            padding: '8px 0',
            margin: 0,
          }}
        >
          Nessun elemento
        </p>
      )}
      {subtasks.map((s, i) => (
        <SubtaskRow
          key={s.id}
          subtask={s}
          index={i}
          isDragging={dragIndex === i}
          isDropTarget={dropIndex === i && dragIndex !== null && dragIndex !== i}
          // Spuntare un passo lo SBLOCCA: un passo finito non è più fermo, e
          // lasciargli addosso `blocked` lo terrebbe rosso sulla card per
          // sempre (lo stato vince su `is_done`, vedi `subtaskToStep`).
          // Toglierne la spunta non tocca niente: era già senza stato.
          //
          // `state: null` è scritto qui ANCHE se il server lo imporrebbe da sé
          // (vedi l'invariante nella PATCH): è quello che rende immediato
          // l'aggiornamento ottimistico — lucchetto spento e segmento verde
          // nello stesso fotogramma del click, senza aspettare la risposta.
          onToggle={() => updateMutation.mutate({
            id: s.id,
            updates: s.is_done ? { is_done: false } : { is_done: true, state: null },
          })}
          // Bloccare è il gesto opposto: il passo è fermo, quindi non è fatto.
          onToggleBlocked={() => updateMutation.mutate({
            id: s.id,
            updates: s.state === 'blocked' ? { state: null } : { state: 'blocked', is_done: false },
          })}
          // La palla vive solo nei flow. Fuori, `showBall` è falso e la riga
          // torna esattamente la checklist di prima.
          showBall={isFlow}
          ball={subtaskBall(s, selfContactId)}
          ballName={s.contact_id ? contacts.find((c) => c.id === s.contact_id)?.name : undefined}
          onOpenBall={(rect) => setBallMenu((prev) => (prev?.id === s.id ? null : { id: s.id, rect }))}
          onChange={(content) => updateMutation.mutate({ id: s.id, updates: { content } })}
          onDelete={() => deleteMutation.mutate(s.id)}
          onCopy={() => copy(s.content)}
          onDragStart={() => setDragIndex(i)}
          onDragOver={() => setDropIndex(i)}
          onDragEnd={() => {
            if (dragIndex !== null && dropIndex !== null && dragIndex !== dropIndex) {
              moveByIndex(dragIndex, dropIndex);
            }
            setDragIndex(null);
            setDropIndex(null);
          }}
        />
      ))}
      <button
        onClick={() => addMutation.mutate()}
        disabled={addMutation.isPending}
        style={{
          width: '100%',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          padding: '9px 8px',
          background: 'transparent',
          color: theme.ink2,
          border: `1px dashed ${theme.border}`,
          borderRadius: 'var(--ob-radius-sm)',
          fontFamily: 'var(--ob-font-sans)',
          fontSize: OB_TEXT.control,
          fontWeight: OB_WEIGHT.emphasis,
          letterSpacing: 0,
          textTransform: 'none',
          cursor: addMutation.isPending ? 'not-allowed' : 'pointer',
          opacity: addMutation.isPending ? 0.4 : 1,
        }}
      >
        <IconPlus size={14} />
        Aggiungi elemento
      </button>

      {ballMenu && ballSubtask && (
        <BallPicker
          anchor={ballMenu.rect}
          contacts={contacts}
          selfContactId={selfContactId}
          current={ballSubtask}
          onClose={() => setBallMenu(null)}
          onPick={(next) => setBall(ballMenu.id, next)}
        />
      )}
    </div>
  );
}

/**
 * IL MENU DELLA PALLA — a chi tocca la mossa successiva.
 *
 * Tre risposte, un gesto solo:
 *   «Qualcuno, senza nome»  → tocca a te, ma non dico a chi
 *   un contatto             → tocca a te, a quella persona
 *   «Tocca a me»            → azzera entrambi
 *
 * In un PORTALE su `document.body` e in `position: fixed` come `.ob-ctx`: la
 * sidebar del tile scorre, e un pannello figlio della riga verrebbe tagliato al
 * primo bordo con `overflow`. Le coordinate arrivano dal rettangolo del pulsante
 * e vengono riportate dentro la finestra.
 *
 * Selezione SINGOLA — si sceglie e si chiude. È la differenza dal menu delle
 * appartenenze in `ContactsModal`, che resta aperto perché lì le risposte si
 * spuntano a più d'una: la palla ce l'ha uno solo.
 *
 * ⚠️ Il contatto «io» non compare in elenco. Assegnarlo a sé stessi vorrebbe
 * dire «tocca a me», che è già la riga in fondo — e siccome `subtaskBall` legge
 * il proprio contatto come `mine`, sceglierlo lascerebbe il pulsante acceso su
 * una riga che si legge spenta.
 */
function BallPicker({ anchor, contacts, selfContactId, current, onClose, onPick }: {
  anchor: DOMRect;
  contacts: Contact[];
  selfContactId: string | null;
  current: Subtask;
  onClose: () => void;
  onPick: (next: { is_theirs: boolean; contact_id: string | null }) => void;
}) {
  const theme = usePixelTheme();
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const W = 260;
  const maxH = 280;

  useEffect(() => {
    // `mousedown` e non `click`: il click che ha aperto il menu è ancora in volo
    // e lo richiuderebbe all'istante.
    //
    // ⚠️ Il pulsante che apre è ESCLUSO dalla chiusura. Senza, premerlo a menu
    // aperto lo chiuderebbe sul `mousedown` e il `click` immediatamente dopo lo
    // riaprirebbe: il menu non si chiude più dal suo stesso pulsante, che è il
    // gesto che chiunque prova per primo. Escluderlo lascia fare il lavoro
    // all'interruttore in `onOpenBall`.
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('[data-ball-trigger]')) return;
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    // Il fuoco dopo il montaggio: si può digitare senza un secondo clic.
    const t = requestAnimationFrame(() => searchRef.current?.focus());
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      cancelAnimationFrame(t);
    };
  }, [onClose]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contacts
      .filter((c) => !c.is_self && (!q || c.name.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [contacts, query]);

  const left = Math.max(8, Math.min(anchor.left, window.innerWidth - W - 8));
  // Sotto il pulsante se c'è posto, sopra altrimenti: un passo in fondo alla
  // lista aprirebbe un menu fuori dallo schermo.
  const below = anchor.bottom + 4;
  const top = below + maxH > window.innerHeight - 8
    ? Math.max(8, anchor.top - maxH - 4)
    : below;

  const marked = subtaskBall(current, selfContactId) === 'theirs';

  return createPortal(
    <div
      ref={ref}
      className="ob-ctx"
      style={{ top, left, width: W, maxHeight: maxH, overflowY: 'auto', padding: 4 }}
    >
      <div style={{ position: 'relative', marginBottom: 4 }}>
        <IconSearch
          size={13}
          style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: theme.ink3, pointerEvents: 'none' }}
        />
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
            // Invio sceglie il primo risultato: cercare e confermare senza
            // staccare le mani dalla tastiera è il motivo per cui la ricerca è
            // la prima riga e non un campo a parte.
            else if (e.key === 'Enter' && visible.length > 0) {
              e.preventDefault();
              onPick({ is_theirs: false, contact_id: visible[0].id });
            }
          }}
          placeholder="Cerca un contatto..."
          style={{
            width: '100%',
            height: 30,
            padding: '0 8px 0 26px',
            background: theme.surfaceVariant,
            color: theme.ink,
            border: `1px solid ${theme.border}`,
            borderRadius: 'var(--ob-radius-sm)',
            fontFamily: 'var(--ob-font-sans)',
            fontSize: OB_TEXT.control,
            outline: 'none',
          }}
        />
      </div>

      {/* Il generico sta in cima perché è la risposta più frequente: dei 28
          passi fermi in archivio, 27 non dicono a chi. */}
      <button
        type="button"
        className="ob-ctx__item"
        onClick={() => onPick({ is_theirs: true, contact_id: null })}
      >
        <IconUserFilled size={13} style={{ flexShrink: 0, color: theme.ink3 }} />
        <span style={{ flex: 1, minWidth: 0 }}>Qualcuno, senza nome</span>
        {current.is_theirs && !current.contact_id && <IconCheck size={12} stroke={3} />}
      </button>

      {visible.length === 0 ? (
        <div style={{ padding: '8px 9px', color: theme.ink3, fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.meta, lineHeight: 1.5 }}>
          {query.trim() ? 'Nessun contatto con questo nome.' : 'Rubrica vuota: i contatti si aggiungono da Contatti.'}
        </div>
      ) : visible.map((c) => (
        <button
          key={c.id}
          type="button"
          className="ob-ctx__item"
          onClick={() => onPick({ is_theirs: false, contact_id: c.id })}
          title={c.name}
        >
          <IconUser size={13} style={{ flexShrink: 0, color: theme.ink3 }} />
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {c.name}
          </span>
          {current.contact_id === c.id && <IconCheck size={12} stroke={3} />}
        </button>
      ))}

      {/* Solo se c'è qualcosa da togliere: un comando che non fa niente insegna
          a non fidarsi degli altri. */}
      {marked && (
        <>
          <div className="ob-ctx__sep" />
          <button
            type="button"
            className="ob-ctx__item"
            onClick={() => onPick({ is_theirs: false, contact_id: null })}
          >
            <IconUser size={13} style={{ flexShrink: 0, color: theme.ink3 }} />
            <span style={{ flex: 1, minWidth: 0 }}>Tocca a me</span>
          </button>
        </>
      )}
    </div>,
    document.body,
  );
}

interface SubtaskRowProps {
  subtask: Subtask;
  index: number;
  isDragging: boolean;
  isDropTarget: boolean;
  onToggle: () => void;
  /** Segna il passo come FERMO (o lo rimette in moto). */
  onToggleBlocked: () => void;
  /** La palla si mostra solo sui flow. Altrove la riga resta la checklist nuda. */
  showBall: boolean;
  ball: 'mine' | 'theirs';
  /** Il nome, quando la palla è di qualcuno in particolare. */
  ballName?: string;
  onOpenBall: (rect: DOMRect) => void;
  onChange: (content: string) => void;
  onDelete: () => void;
  onCopy: () => void;
  onDragStart: () => void;
  onDragOver: () => void;
  onDragEnd: () => void;
}

function SubtaskRow({ subtask, isDragging, isDropTarget, onToggle, onToggleBlocked, showBall, ball, ballName, onOpenBall, onChange, onDelete, onCopy, onDragStart, onDragOver, onDragEnd }: SubtaskRowProps) {
  const theme = usePixelTheme();
  const [value, setValue] = useState(subtask.content);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const dirty = useRef(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const blocked = subtask.state === 'blocked';
  /** La palla è di qualcun altro: il pulsante resta acceso e sempre visibile. */
  const ballOn = showBall && ball === 'theirs';
  /** Il colore del perimetro: rosso se il passo è fermo, altrimenti hairline. */
  const edge = blocked ? 'var(--ob-error)' : theme.border;

  // Sync from server when not dirty
  useEffect(() => {
    if (!dirty.current) setValue(subtask.content);
  }, [subtask.content]);

  // Auto-resize textarea to content
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, [value]);

  useEffect(() => {
    if (!confirmDelete) return;
    const t = setTimeout(() => setConfirmDelete(false), 3000);
    return () => clearTimeout(t);
  }, [confirmDelete]);

  const handleDeleteClick = () => {
    if (confirmDelete) onDelete();
    else setConfirmDelete(true);
  };

  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart(); }}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; onDragOver(); }}
      onDragEnd={onDragEnd}
      onDrop={(e) => { e.preventDefault(); onDragEnd(); }}
      className="group"
      style={{
        background: theme.surface,
        // ⚠️ Bordo scritto PER LATO e non con lo shorthand `border`. Il lato
        // superiore ha una vita sua — si ingrossa e si colora quando la riga è
        // il bersaglio di un trascinamento — e mescolare `border` con
        // `borderTop*` nello stesso oggetto è un conflitto: React avverte che a
        // ogni render l'ordine di applicazione decide chi vince, e il bordo di
        // drop poteva sparire.
        //
        // Il perimetro è l'unico segnale SEMPRE visibile che il passo è fermo:
        // la barretta di azioni compare al passaggio del mouse, e uno stato non
        // può dipendere dal fatto che tu ci passi sopra. È lo stesso rosso del
        // segmento sulla card.
        borderStyle: 'solid',
        borderTopWidth: isDropTarget ? 2 : 1,
        borderRightWidth: 1,
        borderBottomWidth: 1,
        borderLeftWidth: 1,
        borderTopColor: isDropTarget ? theme.accent : edge,
        borderRightColor: edge,
        borderBottomColor: edge,
        borderLeftColor: edge,
        borderRadius: 'var(--ob-radius-md)',
        padding: 10,
        position: 'relative',
        opacity: isDragging ? 0.4 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        {/* Drag handle */}
        <div
          style={{ cursor: 'grab', color: theme.ink3, marginTop: 2, flexShrink: 0 }}
          title="Trascina per riordinare"
        >
          <IconGripVertical size={14} />
        </div>

        {/* Check */}
        <button
          onClick={onToggle}
          style={{
            width: 16,
            height: 16,
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: subtask.is_done ? theme.accent : 'transparent',
            border: `1.5px solid ${subtask.is_done ? (theme.accent) : theme.ink3}`,
            borderRadius: 'var(--ob-radius-sm)',
            cursor: 'pointer',
            marginTop: 2,
          }}
          title={subtask.is_done ? 'Segna come da fare' : 'Segna come fatto'}
        >
          {subtask.is_done && <IconCheck size={10} color={theme.onAccent} stroke={3} />}
        </button>

        {/* Auto-resize textarea */}
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => { setValue(e.target.value); dirty.current = true; }}
          onBlur={() => { if (dirty.current) { onChange(value); dirty.current = false; } }}
          rows={1}
          placeholder="Scrivi..."
          style={{
            flex: 1,
            minWidth: 0,
            background: 'transparent',
            // Un passo annullato si legge come uno fatto — barrato e spento —
            // perché in entrambi i casi non c'è più niente da farci. Il perché
            // lo dice il chip. Un passo BLOCCATO invece resta a piena voce: è
            // fermo, non chiuso, ed è quello che devi ancora sbloccare.
            color: subtask.is_done || subtask.state === 'cancelled' ? theme.ink3 : theme.ink,
            fontFamily: 'var(--ob-font-sans)',
            fontSize: OB_TEXT.card,
            lineHeight: OB_LEADING.tight,
            resize: 'none',
            outline: 'none',
            border: 'none',
            overflow: 'hidden',
            textDecoration: subtask.is_done || subtask.state === 'cancelled' ? 'line-through' : 'none',
          }}
        />
      </div>

      {/* Actions toolbar. Bloccata resta APERTA: il comando per sbloccare non
          può nascondersi dietro un passaggio del mouse, ed è l'unico posto in
          cui il lucchetto si spiega.
          Stessa eccezione per la PALLA: se un passo aspetta qualcun altro, è
          l'informazione più importante della riga — nasconderla dietro l'hover
          la renderebbe la meno visibile di tutte. */}
      <div
        className={blocked || ballOn ? 'transition-opacity' : 'opacity-0 group-hover:opacity-100 transition-opacity'}
        style={{ display: 'flex', alignItems: 'center', gap: 2, marginTop: 4 }}
      >
        <button
          onClick={onCopy}
          style={{
            padding: 2,
            background: 'transparent',
            color: theme.ink3,
            border: 'none',
            cursor: 'pointer',
            display: 'inline-flex',
          }}
          title="Copia"
        >
          <IconCopy size={11} />
        </button>
        {/* FERMO — lo stesso lucchetto con cui l'app dice «bloccato» sugli
            status dei tile (vedi `STATUS_GLYPH`): un secondo glifo per lo stesso
            concetto sarebbe un secondo linguaggio da imparare.
            Un passo fermo diventa il segmento ROSSO nella barra di avanzamento
            della card — è l'unica cosa che accende quel colore. */}
        <button
          onClick={onToggleBlocked}
          style={{
            padding: 2,
            background: 'transparent',
            color: blocked ? 'var(--ob-error)' : theme.ink3,
            border: 'none',
            cursor: 'pointer',
            display: 'inline-flex',
          }}
          title={blocked ? 'Rimetti in moto: il passo torna da fare' : 'Segna come bloccato: il passo è fermo, non da fare'}
          aria-pressed={blocked}
        >
          {blocked ? <IconLock size={11} /> : <IconLockOpen size={11} />}
        </button>
        {/* LA PALLA — a chi tocca la mossa successiva. Un pulsante solo per due
            cose: accendere l'attesa e, volendo, dirne il nome. Erano due
            controlli separati, ed è il loro costo di compilazione ad averli
            tenuti fuori dall'app fino a qui. */}
        {showBall && (
          <button
            data-ball-trigger
            onClick={(e) => onOpenBall(e.currentTarget.getBoundingClientRect())}
            style={{
              padding: 2,
              background: 'transparent',
              color: ballOn ? theme.accent : theme.ink3,
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
            }}
            title={
              ballName ? `Aspetta ${ballName}`
                : ballOn ? 'Aspetta qualcuno: scegli chi, o rimetti la palla a te'
                : 'Tocca a me. Passa la palla a qualcun altro'
            }
            aria-pressed={ballOn}
          >
            {ballOn ? <IconUserFilled size={11} /> : <IconUser size={11} />}
          </button>
        )}
        <div style={{ flex: 1 }} />
        <button
          onClick={handleDeleteClick}
          style={{
            padding: 2,
            background: confirmDelete ? 'var(--ob-danger)' : 'transparent',
            color: confirmDelete ? '#FFFFFF' : theme.ink3,
            border: confirmDelete ? `1px solid ${theme.border}` : 'none',
            borderRadius: 'var(--ob-radius-sm)',
            cursor: 'pointer',
            display: 'inline-flex',
            ...(confirmDelete ? { opacity: 1 } : {}),
          }}
          title={confirmDelete ? 'Conferma eliminazione' : 'Elimina'}
        >
          <IconTrash size={11} />
        </button>
      </div>
    </div>
  );
}
