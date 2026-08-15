'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subtasksApi } from '@/lib/api';
import { invalidateTileCaches, patchTileCaches } from '@/lib/tile-cache';
import type { Subtask, SubtaskState } from '@/types';
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
 */
interface SubtaskListProps {
  tileId: string;
}

export function SubtaskList({ tileId }: SubtaskListProps) {
  const theme = usePixelTheme();
  const queryClient = useQueryClient();
  const queryKey = ['subtasks', tileId];

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
    </div>
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
  onChange: (content: string) => void;
  onDelete: () => void;
  onCopy: () => void;
  onDragStart: () => void;
  onDragOver: () => void;
  onDragEnd: () => void;
}

function SubtaskRow({ subtask, isDragging, isDropTarget, onToggle, onToggleBlocked, onChange, onDelete, onCopy, onDragStart, onDragOver, onDragEnd }: SubtaskRowProps) {
  const theme = usePixelTheme();
  const [value, setValue] = useState(subtask.content);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const dirty = useRef(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const blocked = subtask.state === 'blocked';
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
          cui il lucchetto si spiega. */}
      <div
        className={blocked ? 'transition-opacity' : 'opacity-0 group-hover:opacity-100 transition-opacity'}
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
