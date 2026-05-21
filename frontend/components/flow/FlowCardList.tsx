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
import { usePixelTheme } from '@/components/pixel';
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
  const theme = usePixelTheme();
  const { graph, isLoading, addNode, updateNode, deleteNode, reorderNodes } = useFlow(tileId);
  const nodes = graph.nodes;

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
    return (
      <p style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 12, color: theme.ink3, padding: 12 }}>
        Caricamento flow...
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {nodes.length === 0 && (
        <p
          style={{
            fontFamily: 'var(--font-pixel-head)',
            fontSize: 9,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: theme.ink3,
            textAlign: 'center',
            padding: '8px 0',
            margin: 0,
          }}
        >
          Nessun nodo nel flow.
        </p>
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
        style={{
          width: '100%',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          padding: '6px 8px',
          background: 'transparent',
          color: theme.ink3,
          border: `2px dashed ${theme.border}`,
          fontFamily: 'var(--font-pixel-head)',
          fontSize: 9,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          cursor: addNode.isPending ? 'not-allowed' : 'pointer',
          opacity: addNode.isPending ? 0.4 : 1,
        }}
      >
        <IconPlus size={11} />
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
  const theme = usePixelTheme();
  const [label, setLabel] = useState(node.label);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [expanded, setExpanded] = useState<ExpandedField>(null);
  const labelDirty = useRef(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!labelDirty.current) setLabel(node.label);
  }, [node.label]);

  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [label]);

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
      className="group"
      style={{
        background: theme.surfaceVariant,
        border: `2px solid ${theme.border}`,
        padding: 10,
        position: 'relative',
        opacity: isDragging ? 0.4 : 1,
        borderTopWidth: isDropTarget ? 4 : 2,
        borderTopColor: isDropTarget ? theme.accent : theme.border,
      }}
    >
      {/* Header row — grip + label + delete */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <div
          style={{ cursor: 'grab', color: theme.ink3, marginTop: 2, flexShrink: 0 }}
          title="Trascina per riordinare"
        >
          <IconGripVertical size={14} />
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
          style={{
            flex: 1,
            minWidth: 0,
            background: 'transparent',
            color: theme.ink,
            fontFamily: 'var(--font-pixel-body)',
            fontSize: 12,
            lineHeight: 1.3,
            resize: 'none',
            outline: 'none',
            border: 'none',
            overflow: 'hidden',
          }}
        />

        <button
          onClick={() => {
            if (confirmDelete) onDelete();
            else setConfirmDelete(true);
          }}
          style={{
            padding: 2,
            background: confirmDelete ? '#E24B4A' : 'transparent',
            color: confirmDelete ? '#FFFFFF' : theme.ink3,
            border: confirmDelete ? `2px solid ${theme.border}` : 'none',
            cursor: 'pointer',
            display: 'inline-flex',
            flexShrink: 0,
          }}
          title={confirmDelete ? 'Conferma eliminazione' : 'Elimina'}
        >
          <IconTrash size={11} />
        </button>
      </div>

      {/* Row 1: Contatto */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, paddingLeft: 20 }}>
        <ContactChip
          contactId={node.contact_id}
          active={expanded === 'contact'}
          onClick={() => setExpanded(expanded === 'contact' ? null : 'contact')}
        />
      </div>
      {expanded === 'contact' && (
        <div style={{ marginTop: 6, paddingLeft: 20 }}>
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

      {/* Row 2: Status + Data */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6, paddingLeft: 20 }}>
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
        <div style={{ marginTop: 6, paddingLeft: 20 }}>
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
        <div style={{ marginTop: 6, paddingLeft: 20 }}>
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
  const theme = usePixelTheme();
  const Icon = state === 'active' ? null : STATUS_ICON[state];
  const color = state === 'active' ? theme.ink3 : FLOW_STATE_COLORS[state];
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 28,
        height: 24,
        background: active ? theme.accent : theme.surface,
        border: `2px solid ${active ? theme.border : theme.border}`,
        cursor: 'pointer',
      }}
      title={state === 'active' ? 'Imposta status' : FLOW_STATE_LABELS[state]}
    >
      {Icon ? (
        <Icon size={13} style={{ color: active ? theme.onAccent : color }} stroke={2.5} />
      ) : (
        <span style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 11, color: theme.ink3, lineHeight: 1 }}>—</span>
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
  const theme = usePixelTheme();
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
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '0 8px',
        height: 24,
        maxWidth: 150,
        background: active ? theme.accent : theme.surface,
        color: active ? theme.onAccent : theme.ink2,
        border: `2px solid ${theme.border}`,
        fontFamily: 'var(--font-pixel-body)',
        fontSize: 11,
        cursor: 'pointer',
      }}
    >
      <IconUser size={11} style={{ flexShrink: 0 }} />
      <span
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          ...(contact?.color && !active ? { color: contact.color } : {}),
        }}
      >
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
  const theme = usePixelTheme();
  const text = iso ? formatShortDate(iso) : 'Data';
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '0 8px',
        height: 24,
        background: active ? theme.accent : theme.surface,
        color: active ? theme.onAccent : theme.ink2,
        border: `2px solid ${theme.border}`,
        fontFamily: 'var(--font-pixel-body)',
        fontSize: 11,
        cursor: 'pointer',
      }}
    >
      <IconCalendar size={11} style={{ flexShrink: 0 }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{text}</span>
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
  const theme = usePixelTheme();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {STATUSES.map((s) => {
        const isActive = current === s;
        const Icon = STATUS_ICON[s];
        const color = FLOW_STATE_COLORS[s];
        const label = `${STATUS_SHORT[s]} · ${FLOW_STATE_LABELS[s]}`;
        return (
          <button
            key={s}
            onClick={() => onPick(isActive ? 'active' : s)}
            style={{
              height: 30,
              width: '100%',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '0 10px',
              background: isActive ? color : theme.surfaceVariant,
              border: `2px solid ${theme.border}`,
              color: isActive ? '#000000' : theme.ink,
              fontFamily: 'var(--font-pixel-head)',
              fontSize: 9,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              boxShadow: isActive ? `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}` : 'none',
            }}
          >
            <Icon size={13} style={{ color: isActive ? '#000000' : color }} stroke={2.5} />
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
  const theme = usePixelTheme();
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 4 }}>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commitFromText}
          placeholder="gg/mm/aaaa"
          style={{
            flex: 1,
            background: theme.surfaceVariant,
            border: `2px solid ${theme.border}`,
            padding: '0 8px',
            height: 30,
            color: theme.ink,
            fontFamily: 'var(--font-pixel-body)',
            fontSize: 12,
            outline: 'none',
          }}
        />
        {iso && (
          <button
            onClick={() => {
              setText('');
              onChange(null);
            }}
            style={{
              padding: '0 8px',
              height: 30,
              background: theme.surface,
              color: '#E24B4A',
              border: `2px solid ${theme.border}`,
              cursor: 'pointer',
              fontFamily: 'var(--font-pixel-body)',
              fontSize: 14,
            }}
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
  const theme = usePixelTheme();
  const days = useMemo(() => monthGridDays(anchor), [anchor]);
  const stepMonth = (delta: number) => {
    const next = new Date(anchor);
    next.setMonth(next.getMonth() + delta);
    onAnchorChange(next);
  };
  const navBtn: React.CSSProperties = {
    width: 24,
    height: 24,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: theme.surface,
    color: theme.ink2,
    border: `2px solid ${theme.border}`,
    cursor: 'pointer',
    fontFamily: 'var(--font-pixel-body)',
    fontSize: 14,
  };
  return (
    <div style={{ background: theme.surface, border: `2px solid ${theme.border}`, padding: 8 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <button onClick={() => stepMonth(-1)} style={navBtn}>‹</button>
        <span
          style={{
            fontFamily: 'var(--font-pixel-head)',
            fontSize: 10,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: theme.ink,
          }}
        >
          {anchor.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
        </span>
        <button onClick={() => stepMonth(1)} style={navBtn}>›</button>
      </div>
      {/* Weekday labels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
        {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((w, i) => (
          <div
            key={i}
            style={{
              fontFamily: 'var(--font-pixel-head)',
              fontSize: 9,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: theme.ink3,
              textAlign: 'center',
            }}
          >
            {w}
          </div>
        ))}
      </div>
      {/* Day grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {days.map((d) => {
          const inMonth = d.getMonth() === anchor.getMonth();
          const isSel = selected && sameDay(d, selected);
          const isTd = sameDay(d, new Date());
          return (
            <button
              key={d.toISOString()}
              onClick={() => onSelect(d)}
              style={{
                height: 28,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: isSel ? theme.accent : 'transparent',
                color: isSel ? theme.onAccent : inMonth ? theme.ink : theme.ink3,
                border: isTd && !isSel ? `2px solid ${theme.accent}` : `2px solid transparent`,
                fontFamily: 'var(--font-pixel-body)',
                fontSize: 11,
                fontWeight: isSel ? 700 : 400,
                cursor: 'pointer',
              }}
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

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dow = x.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  x.setDate(x.getDate() + diff);
  return x;
}

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

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)}`;
}
