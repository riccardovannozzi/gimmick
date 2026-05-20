/**
 * Linear card list for a tile's flow — replaces the previous DAG inspector.
 *
 * Each card holds one node:
 *   - draggable header with a grip handle
 *   - editable label (textarea, autosave on blur)
 *   - chip row: STATUS / CONTATTO / DATA — tap to expand the inline editor
 *   - delete (two-tap confirm)
 *
 * Drag-and-drop reordering uses the native HTML5 DnD events (mirrors the
 * SubtaskList implementation in this repo) and persists via
 * `reorderNodes` from `useFlow`.
 */
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  IconCheck,
  IconGripVertical,
  IconHourglassHigh,
  IconPlus,
  IconSlash,
  IconTrash,
  IconUser,
  IconX,
  IconCalendar,
} from '@tabler/icons-react';
import { useFlow } from '@/lib/hooks/useFlow';
import { FLOW_STATE_COLORS, FLOW_STATE_LABELS } from '@/lib/flow-colors';
import { ContactCombobox } from './ContactCombobox';
import { useContacts } from '@/lib/hooks/useContacts';
import { cn } from '@/lib/utils';
import type { FlowNode, FlowNodeState } from '@/types/flow';

const STATUSES: Exclude<FlowNodeState, 'active'>[] = ['done', 'wait', 'undo', 'stop'];
const STATUS_SHORT: Record<Exclude<FlowNodeState, 'active'>, string> = {
  done: 'DONE',
  wait: 'WAIT',
  undo: 'UNDO',
  stop: 'STOP',
};
const STATUS_ICON: Record<Exclude<FlowNodeState, 'active'>, typeof IconCheck> = {
  done: IconCheck,
  wait: IconHourglassHigh,
  undo: IconSlash,
  stop: IconX,
};

interface Props {
  tileId: string;
}

export function FlowCardList({ tileId }: Props) {
  const { graph, isLoading, addNode, updateNode, deleteNode, reorderNodes } = useFlow(tileId);
  const nodes = graph.nodes; // already sort_order ASC from the hook

  // DnD state — same pattern as SubtaskList.
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const moveByIndex = useCallback(
    (from: number, to: number) => {
      if (from === to || from < 0 || to < 0 || from >= nodes.length || to >= nodes.length) return;
      const next = [...nodes];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      reorderNodes.mutate(next.map((n, i) => ({ id: n.id, sort_order: i })));
    },
    [nodes, reorderNodes],
  );

  if (isLoading) {
    return <p className="text-xs text-zinc-500 p-3">Caricamento flow...</p>;
  }

  return (
    <div className="space-y-2">
      {nodes.length === 0 && (
        <p className="text-[11px] text-zinc-500 text-center py-2">Nessun nodo nel flow.</p>
      )}

      {nodes.map((node, i) => (
        <FlowCard
          key={node.id}
          node={node}
          isDragging={dragIndex === i}
          isDropTarget={dropIndex === i && dragIndex !== null && dragIndex !== i}
          onUpdate={(updates) => updateNode.mutate({ id: node.id, updates })}
          onDelete={() => deleteNode.mutate(node.id)}
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
        onClick={() =>
          addNode.mutate({ label: '', state: 'active' })
        }
        disabled={addNode.isPending}
        className="w-full flex items-center justify-center gap-1 py-1.5 rounded border border-dashed border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 text-[11px] transition-colors disabled:opacity-40"
      >
        <IconPlus className="h-3 w-3" />
        Aggiungi nodo
      </button>
    </div>
  );
}

// ─── Single card ───────────────────────────────────────────────────────────

interface CardProps {
  node: FlowNode;
  isDragging: boolean;
  isDropTarget: boolean;
  onUpdate: (updates: Partial<FlowNode>) => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragOver: () => void;
  onDragEnd: () => void;
}

type ExpandedField = 'status' | 'contact' | 'date' | null;

function FlowCard({
  node,
  isDragging,
  isDropTarget,
  onUpdate,
  onDelete,
  onDragStart,
  onDragOver,
  onDragEnd,
}: CardProps) {
  const [label, setLabel] = useState(node.label);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [expanded, setExpanded] = useState<ExpandedField>(null);
  const labelDirty = useRef(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Sync label from server when the local edit hasn't started.
  useEffect(() => {
    if (!labelDirty.current) setLabel(node.label);
  }, [node.label]);

  // Auto-resize textarea.
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [label]);

  // Auto-clear delete confirm after 3s of inactivity.
  useEffect(() => {
    if (!confirmDelete) return;
    const t = setTimeout(() => setConfirmDelete(false), 3000);
    return () => clearTimeout(t);
  }, [confirmDelete]);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        onDragOver();
      }}
      onDragEnd={onDragEnd}
      onDrop={(e) => {
        e.preventDefault();
        onDragEnd();
      }}
      className={cn(
        'rounded border border-zinc-800 bg-zinc-900/40 p-2 group relative transition-all',
        isDragging && 'opacity-40',
        isDropTarget && 'border-blue-500 border-t-2',
      )}
    >
      {/* Header row — grip + label + delete */}
      <div className="flex items-start gap-1.5">
        <div
          className="cursor-grab active:cursor-grabbing text-zinc-600 hover:text-zinc-400 mt-1 shrink-0"
          title="Trascina per riordinare"
        >
          <IconGripVertical className="h-3.5 w-3.5" />
        </div>

        <textarea
          ref={taRef}
          value={label}
          onChange={(e) => {
            setLabel(e.target.value);
            labelDirty.current = true;
          }}
          onBlur={() => {
            if (labelDirty.current) {
              onUpdate({ label });
              labelDirty.current = false;
            }
          }}
          rows={1}
          placeholder="Etichetta…"
          className="flex-1 bg-transparent text-xs text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none overflow-hidden leading-snug min-w-0"
        />

        <button
          onClick={() => {
            if (confirmDelete) onDelete();
            else setConfirmDelete(true);
          }}
          className={cn(
            'p-0.5 rounded transition-colors shrink-0',
            confirmDelete
              ? 'bg-red-600 text-white'
              : 'text-zinc-500 hover:text-red-400 hover:bg-zinc-800',
          )}
          title={confirmDelete ? 'Conferma eliminazione' : 'Elimina'}
        >
          <IconTrash className="h-3 w-3" />
        </button>
      </div>

      {/* Chip rows — each row's inline editor sits directly below it, so
          the dropdown is anchored to the chip the user just tapped. */}

      {/* Row 1: Contatto */}
      <div className="flex flex-wrap gap-1.5 mt-2 pl-5">
        <ContactChip
          contactId={node.contact_id}
          active={expanded === 'contact'}
          onClick={() => setExpanded(expanded === 'contact' ? null : 'contact')}
        />
      </div>
      {expanded === 'contact' && (
        <div className="mt-1.5 pl-5">
          {/* autoOpen skips the redundant "selected pill" intermediate state
              — the chip above already plays that role. */}
          <ContactCombobox
            autoOpen
            value={node.contact_id}
            onChange={(id) => {
              onUpdate({ contact_id: id });
              setExpanded(null);
            }}
          />
        </div>
      )}

      {/* Row 2: Status + Data (share the row; their editor opens below if
          either is clicked). */}
      <div className="flex flex-wrap gap-1.5 mt-1.5 pl-5">
        <StatusChip
          state={node.state}
          active={expanded === 'status'}
          onClick={() => setExpanded(expanded === 'status' ? null : 'status')}
        />
        <DateChip
          iso={node.occurred_at}
          active={expanded === 'date'}
          onClick={() => setExpanded(expanded === 'date' ? null : 'date')}
        />
      </div>
      {expanded === 'status' && (
        <div className="mt-1.5 pl-5">
          <StatusEditor
            current={node.state}
            onPick={(s) => {
              onUpdate({ state: s });
              setExpanded(null);
            }}
          />
        </div>
      )}
      {expanded === 'date' && (
        <div className="mt-1.5 pl-5">
          <DateEditor
            iso={node.occurred_at}
            onChange={(iso) => {
              onUpdate({ occurred_at: iso });
              setExpanded(null);
            }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Chips ────────────────────────────────────────────────────────────────

function StatusChip({
  state,
  active,
  onClick,
}: {
  state: FlowNodeState;
  active: boolean;
  onClick: () => void;
}) {
  // Icon-only chip — the full label appears in the inline editor that opens
  // when this chip is clicked.
  const Icon = state === 'active' ? null : STATUS_ICON[state];
  const color = state === 'active' ? '#71717A' : FLOW_STATE_COLORS[state];
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center justify-center w-7 h-6 rounded transition-colors border',
        active
          ? 'border-blue-500 bg-blue-500/15'
          : 'border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900',
      )}
      title={state === 'active' ? 'Imposta status' : FLOW_STATE_LABELS[state]}
    >
      {Icon ? (
        <Icon className="h-3.5 w-3.5" style={{ color }} stroke={2.5} />
      ) : (
        <span className="text-[11px] text-zinc-500 leading-none">—</span>
      )}
    </button>
  );
}

function ContactChip({
  contactId,
  active,
  onClick,
}: {
  contactId: string | null;
  active: boolean;
  onClick: () => void;
}) {
  const { contacts } = useContacts();
  const contact = contactId ? contacts.find((c) => c.id === contactId) : null;
  const text = contact
    ? contact.is_self
      ? `[ ${contact.name} ]`
      : contact.name
    : 'Contatto';
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1 px-2 h-6 rounded text-[11px] transition-colors border max-w-[150px]',
        active
          ? 'border-blue-500 bg-blue-500/15 text-blue-200'
          : 'border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900 text-zinc-400',
      )}
    >
      <IconUser className="h-3 w-3 shrink-0" />
      <span className="truncate" style={contact?.color ? { color: contact.color } : undefined}>
        {text}
      </span>
    </button>
  );
}

function DateChip({
  iso,
  active,
  onClick,
}: {
  iso: string | null;
  active: boolean;
  onClick: () => void;
}) {
  // Compact GG/MM/AA — full datetime stays in the inline editor below.
  const text = iso ? formatShortDate(iso) : 'Data';
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1 px-2 h-6 rounded text-[11px] transition-colors border',
        active
          ? 'border-blue-500 bg-blue-500/15 text-blue-200'
          : 'border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900 text-zinc-400',
      )}
    >
      <IconCalendar className="h-3 w-3 shrink-0" />
      <span className="truncate">{text}</span>
    </button>
  );
}

// ─── Inline editors ───────────────────────────────────────────────────────

function StatusEditor({
  current,
  onPick,
}: {
  current: FlowNodeState;
  onPick: (s: FlowNodeState) => void;
}) {
  // Only the four lifecycle decorators are shown. Clicking the currently
  // selected one again resets to 'active' (no decorator), so the user can
  // still clear a status without a dedicated "Nessuno" row.
  return (
    <div className="flex flex-col gap-1">
      {STATUSES.map((s) => {
        const isActive = current === s;
        const Icon = STATUS_ICON[s];
        const color = FLOW_STATE_COLORS[s];
        const label = `${STATUS_SHORT[s]} · ${FLOW_STATE_LABELS[s]}`;
        return (
          <button
            key={s}
            onClick={() => onPick(isActive ? 'active' : s)}
            className={cn(
              'h-8 w-full rounded text-[11px] font-medium flex items-center gap-2 px-3 border transition-colors',
              isActive ? 'bg-black' : 'bg-zinc-800/60 hover:bg-zinc-800',
            )}
            style={{
              borderColor: isActive ? color : 'rgba(255,255,255,0.08)',
              color: isActive ? color : '#D4D4D8',
              borderWidth: isActive ? 1.5 : 1,
            }}
          >
            <Icon className="h-3.5 w-3.5" style={{ color: isActive ? color : '#71717A' }} stroke={2.5} />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

function DateEditor({
  iso,
  onChange,
}: {
  iso: string | null;
  onChange: (iso: string | null) => void;
}) {
  // Two-row layout: gg/mm/aaaa text input on top, mini-calendar below.
  // Picking a day commits the change (and closes via the caller); typing in
  // the input commits on blur when the value parses.
  const initial = iso ? new Date(iso) : null;
  const [text, setText] = useState(initial ? fmtItalianDate(initial) : '');
  const [anchor, setAnchor] = useState<Date>(initial ?? new Date());

  const commitFromText = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      onChange(null);
      return;
    }
    const parsed = parseItalianDate(trimmed);
    if (parsed) {
      // Preserve the time-of-day if there was one before.
      if (initial) {
        parsed.setHours(initial.getHours(), initial.getMinutes(), 0, 0);
      }
      onChange(parsed.toISOString());
    }
  };

  const handlePick = (d: Date) => {
    if (initial) {
      d.setHours(initial.getHours(), initial.getMinutes(), 0, 0);
    }
    setText(fmtItalianDate(d));
    onChange(d.toISOString());
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commitFromText}
          placeholder="gg/mm/aaaa"
          className="flex-1 bg-zinc-800/60 border border-white/[0.08] rounded px-2 h-8 text-xs text-zinc-200 focus:outline-none focus:border-blue-500"
        />
        {iso && (
          <button
            onClick={() => {
              setText('');
              onChange(null);
            }}
            className="px-2 h-8 rounded text-zinc-500 hover:text-red-400 hover:bg-zinc-800/60 transition-colors"
            title="Cancella"
          >
            ×
          </button>
        )}
      </div>
      <MiniCalendar
        anchor={anchor}
        onAnchorChange={setAnchor}
        selected={initial}
        onSelect={handlePick}
      />
    </div>
  );
}

function MiniCalendar({
  anchor,
  onAnchorChange,
  selected,
  onSelect,
}: {
  anchor: Date;
  onAnchorChange: (d: Date) => void;
  selected: Date | null;
  onSelect: (d: Date) => void;
}) {
  const days = useMemo(() => monthGridDays(anchor), [anchor]);
  const stepMonth = (delta: number) => {
    const next = new Date(anchor);
    next.setMonth(next.getMonth() + delta);
    onAnchorChange(next);
  };
  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded p-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5">
        <button
          onClick={() => stepMonth(-1)}
          className="w-6 h-6 rounded text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 flex items-center justify-center"
        >
          ‹
        </button>
        <span className="text-[11px] font-semibold text-zinc-200 capitalize">
          {anchor.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
        </span>
        <button
          onClick={() => stepMonth(1)}
          className="w-6 h-6 rounded text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 flex items-center justify-center"
        >
          ›
        </button>
      </div>
      {/* Weekday labels */}
      <div className="grid grid-cols-7 gap-0.5 text-[9px] uppercase tracking-wider text-zinc-500 mb-1">
        {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((w, i) => (
          <div key={i} className="text-center">{w}</div>
        ))}
      </div>
      {/* Day grid — 6 rows × 7 cols */}
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((d) => {
          const inMonth = d.getMonth() === anchor.getMonth();
          const isSel = selected && sameDay(d, selected);
          const isTd = sameDay(d, new Date());
          return (
            <button
              key={d.toISOString()}
              onClick={() => onSelect(d)}
              className={cn(
                'h-7 rounded text-[11px] flex items-center justify-center transition-colors',
                isSel
                  ? 'bg-blue-500 text-black font-bold'
                  : isTd
                    ? 'border border-blue-500 text-zinc-200'
                    : inMonth
                      ? 'text-zinc-200 hover:bg-zinc-800'
                      : 'text-zinc-600 hover:bg-zinc-800',
              )}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Calendar helpers ─────────────────────────────────────────────────────

function startOfMonth(d: Date): Date {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Monday-first start-of-week (matches Italian convention). */
function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dow = x.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  x.setDate(x.getDate() + diff);
  return x;
}

/** 6 × 7 calendar grid starting on the Monday on/before the 1st of the
 *  given month. Trailing days spill into the next month. */
function monthGridDays(anchor: Date): Date[] {
  const start = startOfWeek(startOfMonth(anchor));
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function fmtItalianDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function parseItalianDate(s: string): Date | null {
  const m = s.match(/^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{2}|\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyyRaw] = m;
  const yyyy = yyyyRaw.length === 2 ? Number(yyyyRaw) + 2000 : Number(yyyyRaw);
  const d = new Date(yyyy, Number(mm) - 1, Number(dd));
  return Number.isNaN(d.getTime()) ? null : d;
}

// ─── Date helpers ─────────────────────────────────────────────────────────

/** Compact GG/MM/AA used by DateChip. The full datetime stays in the inline
 *  editor (the native <input type="datetime-local">). */
function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)}`;
}

