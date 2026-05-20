/**
 * Mobile flow as a linear card list — replaces the old DAG inspector. One
 * card per node, drag-disabled (mobile doesn't have a portable RNGH-based
 * draggable list out of the box), reordering via an explicit SPOSTA toggle
 * that exposes up/down arrows on the active row.
 *
 * Each card holds:
 *   - editable label (textarea, autosave on blur)
 *   - chip row: STATUS / CONTATTO / DATA — tap to expand inline editor
 *   - delete (two-tap confirm)
 *
 * Reordering, add, edit, delete all go through the new `useFlow` hook
 * (sort_order-based, no edges).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import {
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconHourglassHigh,
  IconPlus,
  IconSlash,
  IconTrash,
  IconX,
  IconCalendar,
  IconUser,
} from '@tabler/icons-react-native';
import { useFlow } from '@/hooks/useFlow';
import { useContacts } from '@/hooks/useContacts';
import { FLOW_STATE_COLORS, FLOW_STATE_LABELS } from '@/lib/flow-colors';
import { useThemeColors } from '@/lib/theme';
import { ContactPicker } from './ContactPicker';
import type { FlowNode, FlowNodeState } from '@/types';

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
  const colors = useThemeColors();
  const { graph, isLoading, addNode, updateNode, deleteNode, reorderNodes } = useFlow(tileId);
  const nodes = graph.nodes;

  const [reorderingId, setReorderingId] = useState<string | null>(null);

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
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="small" color={colors.tertiary} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      {nodes.length === 0 && (
        <Text style={{ fontSize: 12, color: colors.tertiary, textAlign: 'center', paddingVertical: 12 }}>
          Nessun nodo nel flow.
        </Text>
      )}

      {nodes.map((node, i) => (
        <FlowCard
          key={node.id}
          node={node}
          colors={colors}
          isReordering={reorderingId === node.id}
          canMoveUp={i > 0}
          canMoveDown={i < nodes.length - 1}
          onToggleReorder={() => setReorderingId(reorderingId === node.id ? null : node.id)}
          onMoveUp={() => moveByIndex(i, i - 1)}
          onMoveDown={() => moveByIndex(i, i + 1)}
          onUpdate={(updates) => updateNode.mutate({ id: node.id, updates })}
          onDelete={() => deleteNode.mutate(node.id)}
        />
      ))}

      <TouchableOpacity
        onPress={() => addNode.mutate({ label: '', state: 'active' })}
        disabled={addNode.isPending}
        activeOpacity={0.7}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          paddingVertical: 10,
          marginTop: 8,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: colors.border,
          borderRadius: 8,
          opacity: addNode.isPending ? 0.5 : 1,
        }}
      >
        <IconPlus size={14} color={colors.tertiary} />
        <Text style={{ fontSize: 12, color: colors.tertiary }}>Aggiungi nodo</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────

type ExpandedField = 'status' | 'contact' | 'date' | null;

function FlowCard({
  node,
  colors,
  isReordering,
  canMoveUp,
  canMoveDown,
  onToggleReorder,
  onMoveUp,
  onMoveDown,
  onUpdate,
  onDelete,
}: {
  node: FlowNode;
  colors: any;
  isReordering: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onToggleReorder: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onUpdate: (updates: Partial<FlowNode>) => void;
  onDelete: () => void;
}) {
  const [label, setLabel] = useState(node.label);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [expanded, setExpanded] = useState<ExpandedField>(null);
  const labelDirty = useRef(false);

  useEffect(() => {
    if (!labelDirty.current) setLabel(node.label);
  }, [node.label]);

  useEffect(() => {
    if (!confirmDelete) return;
    const t = setTimeout(() => setConfirmDelete(false), 3000);
    return () => clearTimeout(t);
  }, [confirmDelete]);

  return (
    <View
      style={{
        backgroundColor: colors.background2,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: isReordering ? colors.accent : colors.border,
        padding: 10,
        marginBottom: 8,
      }}
    >
      {/* Label */}
      <TextInput
        value={label}
        onChangeText={(t) => {
          setLabel(t);
          labelDirty.current = true;
        }}
        onBlur={() => {
          if (labelDirty.current) {
            onUpdate({ label });
            labelDirty.current = false;
          }
        }}
        placeholder="Etichetta…"
        placeholderTextColor={colors.tertiary}
        multiline
        style={{
          fontSize: 14,
          color: colors.primary,
          padding: 0,
          textAlignVertical: 'top',
          minHeight: 22,
        }}
      />

      {/* Chip rows — each row's inline editor sits directly below the row
          itself, so the dropdown is anchored to the chip just tapped. */}

      {/* Row 1: Contatto */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
        <ContactChip
          contactId={node.contact_id}
          active={expanded === 'contact'}
          onPress={() => setExpanded(expanded === 'contact' ? null : 'contact')}
          colors={colors}
        />
      </View>
      {expanded === 'contact' && (
        <ContactPicker
          autoOpen
          hideTrigger
          value={node.contact_id}
          onChange={(id) => {
            onUpdate({ contact_id: id });
            setExpanded(null);
          }}
          onClose={() => setExpanded(null)}
        />
      )}

      {/* Row 2: Status + Data — share the row; their editor opens below. */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
        <StatusChip
          state={node.state}
          active={expanded === 'status'}
          onPress={() => setExpanded(expanded === 'status' ? null : 'status')}
          colors={colors}
        />
        <DateChip
          iso={node.occurred_at}
          active={expanded === 'date'}
          onPress={() => setExpanded(expanded === 'date' ? null : 'date')}
          colors={colors}
        />
      </View>
      {expanded === 'status' && (
        <View style={{ marginTop: 6 }}>
          <StatusEditor
            current={node.state}
            onPick={(s) => {
              onUpdate({ state: s });
              setExpanded(null);
            }}
            colors={colors}
          />
        </View>
      )}
      {expanded === 'date' && (
        <View style={{ marginTop: 6 }}>
          <DateEditor
            iso={node.occurred_at}
            onChange={(iso) => {
              onUpdate({ occurred_at: iso });
              setExpanded(null);
            }}
            colors={colors}
          />
        </View>
      )}

      {/* Toolbar */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          marginTop: 10,
          paddingTop: 6,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <TouchableOpacity
          onPress={onToggleReorder}
          hitSlop={6}
          style={{
            paddingHorizontal: 6,
            paddingVertical: 4,
            borderRadius: 4,
            backgroundColor: isReordering ? `${colors.accent}33` : 'transparent',
          }}
        >
          <Text style={{ fontSize: 10, color: isReordering ? colors.accent : colors.tertiary, fontWeight: '600' }}>
            {isReordering ? 'FINE' : 'SPOSTA'}
          </Text>
        </TouchableOpacity>

        {isReordering && (
          <>
            <TouchableOpacity onPress={onMoveUp} disabled={!canMoveUp} hitSlop={6} style={{ padding: 4, opacity: canMoveUp ? 1 : 0.3 }}>
              <IconChevronUp size={16} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={onMoveDown} disabled={!canMoveDown} hitSlop={6} style={{ padding: 4, opacity: canMoveDown ? 1 : 0.3 }}>
              <IconChevronDown size={16} color={colors.primary} />
            </TouchableOpacity>
          </>
        )}

        <View style={{ flex: 1 }} />

        <TouchableOpacity
          onPress={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}
          hitSlop={6}
          style={{
            padding: 4,
            borderRadius: 4,
            backgroundColor: confirmDelete ? '#EF4444' : 'transparent',
          }}
        >
          <IconTrash size={14} color={confirmDelete ? '#fff' : colors.tertiary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Chips & editors ──────────────────────────────────────────────────────

function StatusChip({
  state,
  active,
  onPress,
  colors,
}: {
  state: FlowNodeState;
  active: boolean;
  onPress: () => void;
  colors: any;
}) {
  // Icon-only chip — the descriptive label is shown in the expanded editor.
  const Icon = state === 'active' ? null : STATUS_ICON[state];
  const color = state === 'active' ? colors.tertiary : FLOW_STATE_COLORS[state];
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        width: 30,
        height: 26,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: active ? colors.accent : colors.border,
        backgroundColor: active ? `${colors.accent}22` : colors.background1,
      }}
      accessibilityLabel={state === 'active' ? 'Imposta status' : FLOW_STATE_LABELS[state]}
    >
      {Icon ? (
        <Icon size={14} color={color} strokeWidth={2.5} />
      ) : (
        <Text style={{ fontSize: 12, color: colors.tertiary, lineHeight: 14 }}>—</Text>
      )}
    </TouchableOpacity>
  );
}

function ContactChip({
  contactId,
  active,
  onPress,
  colors,
}: {
  contactId: string | null;
  active: boolean;
  onPress: () => void;
  colors: any;
}) {
  const { contacts } = useContacts();
  const contact = contactId ? contacts.find((c) => c.id === contactId) : null;
  const text = contact
    ? contact.is_self
      ? `[ ${contact.name} ]`
      : contact.name
    : 'Contatto';
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        height: 26,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: active ? colors.accent : colors.border,
        backgroundColor: active ? `${colors.accent}22` : colors.background1,
        maxWidth: 160,
      }}
    >
      <IconUser size={12} color={colors.tertiary} />
      <Text
        numberOfLines={1}
        style={{ fontSize: 11, color: contact?.color || colors.secondary }}
      >
        {text}
      </Text>
    </TouchableOpacity>
  );
}

function DateChip({
  iso,
  active,
  onPress,
  colors,
}: {
  iso: string | null;
  active: boolean;
  onPress: () => void;
  colors: any;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        height: 26,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: active ? colors.accent : colors.border,
        backgroundColor: active ? `${colors.accent}22` : colors.background1,
      }}
    >
      <IconCalendar size={12} color={colors.tertiary} />
      <Text style={{ fontSize: 11, color: colors.secondary }}>
        {iso ? fmtShortDate(iso) : 'Data'}
      </Text>
    </TouchableOpacity>
  );
}

function StatusEditor({
  current,
  onPick,
  colors,
}: {
  current: FlowNodeState;
  onPick: (s: FlowNodeState) => void;
  colors: any;
}) {
  // Only the four lifecycle decorators are shown. Tapping the active one
  // again resets to 'active' (no decorator) — that's the "deselect" path
  // now that there's no dedicated "Nessuno" row.
  return (
    <View style={{ gap: 4 }}>
      {STATUSES.map((s) => {
        const isActive = current === s;
        const Icon = STATUS_ICON[s];
        const color = FLOW_STATE_COLORS[s];
        const label = `${STATUS_SHORT[s]} · ${FLOW_STATE_LABELS[s]}`;
        return (
          <TouchableOpacity
            key={s}
            onPress={() => onPick(isActive ? 'active' : s)}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingHorizontal: 10,
              height: 34,
              borderRadius: 4,
              borderWidth: isActive ? 1.5 : 1,
              borderColor: isActive ? color : colors.border,
              backgroundColor: isActive ? '#000' : colors.background1,
            }}
          >
            <Icon size={14} color={isActive ? color : colors.tertiary} strokeWidth={2.5} />
            <Text
              style={{
                fontSize: 12,
                fontWeight: '500',
                color: isActive ? color : colors.primary,
              }}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function DateEditor({
  iso,
  onChange,
  colors,
}: {
  iso: string | null;
  onChange: (iso: string | null) => void;
  colors: any;
}) {
  // gg/mm/aaaa input on top + inline mini-calendar below. Picking a day
  // commits immediately; typing in the input commits on blur.
  const initial = iso ? new Date(iso) : null;
  const [text, setText] = useState(initial ? fmtItalianDate(initial) : '');
  const [error, setError] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<Date>(initial ?? new Date());

  useEffect(() => {
    setText(initial ? fmtItalianDate(initial) : '');
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iso]);

  const commitFromText = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      onChange(null);
      return;
    }
    const parsed = parseItalianDate(trimmed);
    if (!parsed) {
      setError('Formato non valido. Usa gg/mm/aaaa');
      return;
    }
    if (initial) parsed.setHours(initial.getHours(), initial.getMinutes(), 0, 0);
    onChange(parsed.toISOString());
  };

  const handlePick = (d: Date) => {
    const out = new Date(d);
    if (initial) out.setHours(initial.getHours(), initial.getMinutes(), 0, 0);
    setText(fmtItalianDate(out));
    setError(null);
    onChange(out.toISOString());
  };

  return (
    <View style={{ gap: 8 }}>
      {/* Row 1: gg/mm/aaaa input */}
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <TextInput
          value={text}
          onChangeText={(t) => {
            setText(t);
            setError(null);
          }}
          onBlur={commitFromText}
          placeholder="gg/mm/aaaa"
          placeholderTextColor={colors.tertiary}
          style={{
            flex: 1,
            backgroundColor: colors.background1,
            borderRadius: 6,
            borderWidth: 1,
            borderColor: error ? '#EF4444' : colors.border,
            paddingHorizontal: 10,
            height: 36,
            fontSize: 13,
            color: colors.primary,
          }}
        />
        {iso && (
          <TouchableOpacity
            onPress={() => {
              setText('');
              onChange(null);
            }}
            style={{
              width: 36,
              height: 36,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 6,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <IconX size={14} color={colors.tertiary} />
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={{ fontSize: 11, color: '#EF4444' }}>{error}</Text>}

      {/* Row 2: inline mini-calendar */}
      <MiniCalendar
        anchor={anchor}
        onAnchorChange={setAnchor}
        selected={initial}
        onSelect={handlePick}
        colors={colors}
      />
    </View>
  );
}

function MiniCalendar({
  anchor,
  onAnchorChange,
  selected,
  onSelect,
  colors,
}: {
  anchor: Date;
  onAnchorChange: (d: Date) => void;
  selected: Date | null;
  onSelect: (d: Date) => void;
  colors: any;
}) {
  const days = monthGridDays(anchor);
  const stepMonth = (delta: number) => {
    const next = new Date(anchor);
    next.setMonth(next.getMonth() + delta);
    onAnchorChange(next);
  };
  const weekdayLabels = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];

  return (
    <View
      style={{
        backgroundColor: colors.background1,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 8,
      }}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 6,
        }}
      >
        <TouchableOpacity
          onPress={() => stepMonth(-1)}
          hitSlop={8}
          style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: colors.tertiary, fontSize: 16 }}>‹</Text>
        </TouchableOpacity>
        <Text
          style={{
            fontSize: 12,
            fontWeight: '600',
            color: colors.primary,
            textTransform: 'capitalize',
          }}
        >
          {anchor.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
        </Text>
        <TouchableOpacity
          onPress={() => stepMonth(1)}
          hitSlop={8}
          style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: colors.tertiary, fontSize: 16 }}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Weekday labels */}
      <View style={{ flexDirection: 'row', marginBottom: 2 }}>
        {weekdayLabels.map((w, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 9, color: colors.tertiary, letterSpacing: 0.5 }}>
              {w}
            </Text>
          </View>
        ))}
      </View>

      {/* Day grid — 6 rows × 7 cols */}
      {[0, 1, 2, 3, 4, 5].map((r) => (
        <View key={r} style={{ flexDirection: 'row' }}>
          {days.slice(r * 7, r * 7 + 7).map((d) => {
            const inMonth = d.getMonth() === anchor.getMonth();
            const isSel = selected && sameDay(d, selected);
            const isTd = sameDay(d, new Date());
            return (
              <TouchableOpacity
                key={d.toISOString()}
                onPress={() => onSelect(d)}
                style={{
                  flex: 1,
                  height: 28,
                  margin: 1,
                  borderRadius: 4,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isSel ? '#60A5FA' : 'transparent',
                  borderWidth: isTd && !isSel ? 1 : 0,
                  borderColor: '#60A5FA',
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: isSel ? '700' : '500',
                    color: isSel
                      ? '#000'
                      : inMonth
                        ? colors.primary
                        : colors.tertiary,
                  }}
                >
                  {d.getDate()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
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

/** Compact GG/MM/AA — used by the chip; the full date sits in the editor. */
function fmtShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)}`;
}
