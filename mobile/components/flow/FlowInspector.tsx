/**
 * Mobile port of frontend/components/flow/FlowInspector.tsx.
 *
 * Same shape as the web inspector — label / status / contact / date / vertical
 * flow / notes / actions row — adapted for touch:
 *   - Status buttons use a 4-column grid with the same icon set
 *   - Contact picker is a bottom-sheet (ContactPicker)
 *   - Date field is tap-to-open with a simple text input for "dd/MM/yyyy HH:mm"
 *   - Actions live in a 2x2 grid at the bottom (Figlio / Predecessore /
 *     Fratello / Elimina with two-tap confirm)
 *
 * Autosave: text fields debounce 500ms; non-text fields save on change.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';
import {
  IconArrowLeft,
  IconArrowRight,
  IconArrowsHorizontal,
  IconCheck,
  IconHourglassHigh,
  IconSlash,
  IconTrash,
  IconX,
} from '@tabler/icons-react-native';
import { useFlow } from '@/hooks/useFlow';
import { useThemeColors } from '@/lib/theme';
import { FLOW_STATE_COLORS, FLOW_STATE_LABELS } from '@/lib/flow-colors';
import { ContactPicker } from './ContactPicker';
import { VerticalFlowTrack } from './VerticalFlowTrack';
import type { FlowNode, FlowNodeState } from '@/types';

interface Props {
  /** The currently-selected node — must belong to `tileId`. */
  nodeId: string;
  tileId: string;
  onSelectNode: (id: string | null) => void;
  /** When true, hide the Notes textarea + skip autosave for it. The sidebar
   *  tab sets this so the bottom action grid stays visible without scrolling. */
  hideNote?: boolean;
  /** Render the vertical flow diagram below the Date input. */
  showVerticalFlow?: boolean;
}

const STATUSES: Exclude<FlowNodeState, 'active'>[] = ['done', 'wait', 'undo', 'stop'];
const STATUS_SHORT_LABELS: Record<Exclude<FlowNodeState, 'active'>, string> = {
  done: 'DONE',
  wait: 'WAIT',
  undo: 'UNDO',
  stop: 'STOP',
};
const STATUS_ICONS: Record<Exclude<FlowNodeState, 'active'>, typeof IconCheck> = {
  done: IconCheck,
  wait: IconHourglassHigh,
  undo: IconSlash,
  stop: IconX,
};
const AUTOSAVE_MS = 500;

// Grid constants — kept in sync with the web inspector so node positions stay
// stable across platforms even when nodes are created from mobile.
const GRID_X = 120;
const GRID_Y = 80;

export function FlowInspector({
  nodeId,
  tileId,
  onSelectNode,
  hideNote = false,
  showVerticalFlow = false,
}: Props) {
  const colors = useThemeColors();
  const { graph, updateNode, deleteNode, addNode, addEdge } = useFlow(tileId);
  const node: FlowNode | null = graph.nodes.find((n) => n.id === nodeId) ?? null;

  const [label, setLabel] = useState(node?.label ?? '');
  const [state, setState] = useState<FlowNodeState>(node?.state ?? 'active');
  const [contactId, setContactId] = useState<string | null>(node?.contact_id ?? null);
  const [occurredAt, setOccurredAt] = useState<string | null>(node?.occurred_at ?? null);
  const [notes, setNotes] = useState<string>(node?.notes ?? '');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Reset local form when the selected node changes (clicking another node).
  const lastNodeIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!node) return;
    if (lastNodeIdRef.current !== node.id) {
      lastNodeIdRef.current = node.id;
      setLabel(node.label);
      setState(node.state);
      setContactId(node.contact_id);
      setOccurredAt(node.occurred_at);
      setNotes(node.notes ?? '');
      setConfirmingDelete(false);
    }
  }, [node]);

  // Autosave label (debounced).
  const labelSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!node) return;
    if (label === node.label) return;
    if (labelSaveRef.current) clearTimeout(labelSaveRef.current);
    labelSaveRef.current = setTimeout(() => {
      updateNode.mutate({ id: nodeId, updates: { label } });
    }, AUTOSAVE_MS);
    return () => {
      if (labelSaveRef.current) clearTimeout(labelSaveRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label]);

  // Autosave notes (debounced) — only when the caller opted in.
  const notesSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (hideNote) return;
    if (!node) return;
    if ((notes || '') === (node.notes || '')) return;
    if (notesSaveRef.current) clearTimeout(notesSaveRef.current);
    notesSaveRef.current = setTimeout(() => {
      updateNode.mutate({ id: nodeId, updates: { notes: notes || null } });
    }, AUTOSAVE_MS);
    return () => {
      if (notesSaveRef.current) clearTimeout(notesSaveRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, hideNote]);

  // ─── Actions (add child/predecessor/sibling, delete) ─────────────────────

  /** Best-effort reference position relative to the current node. Falls back
   *  to (240, 80) when the node has no manual x/y yet (Dagre fallback case). */
  const refPos = node && node.x != null && node.y != null
    ? { x: node.x, y: node.y }
    : { x: 240, y: 80 };

  const handleAddChild = useCallback(async () => {
    const res = await addNode.mutateAsync({
      label: 'Nuovo nodo',
      state: 'active',
      parent_node_id: nodeId,
      x: refPos.x + GRID_X,
      y: refPos.y,
    });
    if (res?.node) onSelectNode(res.node.id);
  }, [addNode, nodeId, refPos, onSelectNode]);

  const handleAddPredecessor = useCallback(async () => {
    const res = await addNode.mutateAsync({
      label: 'Nuovo nodo',
      state: 'active',
      x: refPos.x - GRID_X,
      y: refPos.y,
    });
    if (res?.node) {
      try {
        await addEdge.mutateAsync({ parent_id: res.node.id, child_id: nodeId });
      } catch {
        // Edge creation failed; leave the orphan node so the user can repair.
      }
      onSelectNode(res.node.id);
    }
  }, [addNode, addEdge, nodeId, refPos, onSelectNode]);

  const handleAddSibling = useCallback(async () => {
    const parentIds = graph.edges.filter((e) => e.child_id === nodeId).map((e) => e.parent_id);
    const siblingPos = { x: refPos.x, y: refPos.y + GRID_Y };

    if (parentIds.length === 0) {
      const res = await addNode.mutateAsync({
        label: 'Nuovo nodo',
        state: 'active',
        x: siblingPos.x,
        y: siblingPos.y,
      });
      if (res?.node) onSelectNode(res.node.id);
      return;
    }
    if (parentIds.length === 1) {
      const res = await addNode.mutateAsync({
        label: 'Nuovo nodo',
        state: 'active',
        parent_node_id: parentIds[0],
        x: siblingPos.x,
        y: siblingPos.y,
      });
      if (res?.node) onSelectNode(res.node.id);
      return;
    }
    const res = await addNode.mutateAsync({
      label: 'Nuovo nodo',
      state: 'active',
      x: siblingPos.x,
      y: siblingPos.y,
    });
    if (!res?.node) return;
    for (const pid of parentIds) {
      try {
        await addEdge.mutateAsync({ parent_id: pid, child_id: res.node.id });
      } catch {
        // Partial failure leaves an orphan; user can inspect/repair.
      }
    }
    onSelectNode(res.node.id);
  }, [addNode, addEdge, graph.edges, nodeId, refPos, onSelectNode]);

  const handleDelete = useCallback(async () => {
    await deleteNode.mutateAsync(nodeId);
    onSelectNode(null);
  }, [deleteNode, nodeId, onSelectNode]);

  // Date picker bottom-sheet
  const [dateOpen, setDateOpen] = useState(false);

  if (!node) {
    return (
      <View style={{ padding: 16 }}>
        <Text style={{ color: colors.tertiary, fontSize: 12 }}>Nodo non trovato</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        {/* Label */}
        <SectionLabel text="Etichetta" colors={colors} />
        <TextInput
          value={label}
          onChangeText={setLabel}
          placeholder="Es. Mandato preventivo"
          placeholderTextColor={colors.tertiary}
          multiline
          style={{
            backgroundColor: colors.background2,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 12,
            fontSize: 14,
            color: colors.primary,
            minHeight: 56,
            textAlignVertical: 'top',
          }}
        />

        {/* Status — 4 buttons grid. Click active → back to 'active'. */}
        <SectionLabel text="Status" colors={colors} top={16} />
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {STATUSES.map((s) => {
            const isActive = state === s;
            const Icon = STATUS_ICONS[s];
            const color = FLOW_STATE_COLORS[s];
            return (
              <TouchableOpacity
                key={s}
                onPress={() => {
                  const next: FlowNodeState = isActive ? 'active' : s;
                  setState(next);
                  updateNode.mutate({ id: nodeId, updates: { state: next } });
                }}
                activeOpacity={0.7}
                style={{
                  flex: 1,
                  height: 40,
                  borderRadius: 8,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 4,
                  backgroundColor: isActive ? '#000' : '#27272A',
                  borderWidth: 1.5,
                  borderColor: isActive ? color : 'transparent',
                }}
                accessibilityLabel={FLOW_STATE_LABELS[s]}
              >
                <Icon size={12} color={isActive ? color : '#71717A'} strokeWidth={2.5} />
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '700',
                    letterSpacing: 0.5,
                    color: isActive ? color : '#A1A1AA',
                  }}
                >
                  {STATUS_SHORT_LABELS[s]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Contact */}
        <SectionLabel text="Contatto" colors={colors} top={16} />
        <ContactPicker
          value={contactId}
          onChange={(id) => {
            setContactId(id);
            updateNode.mutate({ id: nodeId, updates: { contact_id: id } });
          }}
        />

        {/* Date — tap to edit in a bottom-sheet */}
        <SectionLabel text="Data" colors={colors} top={16} />
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <TouchableOpacity
            onPress={() => setDateOpen(true)}
            activeOpacity={0.7}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: colors.background2,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: colors.border,
              paddingHorizontal: 12,
              height: 40,
            }}
          >
            <Text
              style={{
                flex: 1,
                fontSize: 14,
                color: occurredAt ? colors.primary : colors.tertiary,
                fontStyle: occurredAt ? 'normal' : 'italic',
              }}
            >
              {occurredAt ? fmtDateTime(occurredAt) : 'gg/mm/aaaa hh:mm'}
            </Text>
          </TouchableOpacity>
          {occurredAt && (
            <TouchableOpacity
              onPress={() => {
                setOccurredAt(null);
                updateNode.mutate({ id: nodeId, updates: { occurred_at: null } });
              }}
              activeOpacity={0.7}
              style={{
                width: 40,
                height: 40,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 8,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.background2,
              }}
            >
              <IconX size={16} color={colors.tertiary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Vertical flow diagram — only when caller opts in */}
        {showVerticalFlow && (
          <View style={{ marginTop: 12, marginHorizontal: -16 }}>
            <VerticalFlowTrack
              tileId={tileId}
              selectedNodeId={nodeId}
              onSelectNode={onSelectNode}
            />
          </View>
        )}

        {/* Notes — hidden when caller opts out */}
        {!hideNote && (
          <>
            <SectionLabel text="Note" colors={colors} top={16} />
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Dettagli, contesto, link…"
              placeholderTextColor={colors.tertiary}
              multiline
              style={{
                backgroundColor: colors.background2,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: colors.border,
                padding: 12,
                fontSize: 14,
                color: colors.primary,
                minHeight: 100,
                textAlignVertical: 'top',
              }}
            />
          </>
        )}
      </ScrollView>

      {/* Action bar — 2 columns, sticky to bottom of the inspector */}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 6,
          padding: 8,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.background1,
        }}
      >
        <ActionButton
          icon={<IconArrowRight size={12} color={colors.primary} />}
          label="Figlio"
          onPress={handleAddChild}
          colors={colors}
        />
        <ActionButton
          icon={<IconArrowLeft size={12} color={colors.primary} />}
          label="Predecessore"
          onPress={handleAddPredecessor}
          colors={colors}
        />
        <ActionButton
          icon={<IconArrowsHorizontal size={12} color={colors.primary} />}
          label="Fratello"
          onPress={handleAddSibling}
          colors={colors}
        />
        {confirmingDelete ? (
          <ActionButton
            icon={<IconTrash size={12} color="#fff" />}
            label="Conferma"
            onPress={handleDelete}
            colors={colors}
            destructive
          />
        ) : (
          <ActionButton
            icon={<IconTrash size={12} color="#EF4444" />}
            label="Elimina"
            onPress={() => setConfirmingDelete(true)}
            colors={colors}
            danger
          />
        )}
      </View>

      {/* Date editor bottom-sheet */}
      <DateEditor
        visible={dateOpen}
        initialIso={occurredAt}
        onCancel={() => setDateOpen(false)}
        onConfirm={(iso) => {
          setOccurredAt(iso);
          updateNode.mutate({ id: nodeId, updates: { occurred_at: iso } });
          setDateOpen(false);
        }}
      />
    </View>
  );
}

// ─── Subcomponents ─────────────────────────────────────────────────────────

function ActionButton({
  icon,
  label,
  onPress,
  colors,
  danger,
  destructive,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  colors: any;
  danger?: boolean;
  destructive?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flexBasis: '48%',
        flexGrow: 1,
        height: 36,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderRadius: 8,
        backgroundColor: destructive ? '#DC2626' : colors.background2,
      }}
    >
      {icon}
      <Text
        style={{
          fontSize: 12,
          fontWeight: '500',
          color: destructive ? '#fff' : danger ? '#EF4444' : colors.primary,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function SectionLabel({
  text,
  colors,
  top,
}: {
  text: string;
  colors: any;
  top?: number;
}) {
  return (
    <Text
      style={{
        fontSize: 10,
        fontWeight: '600',
        color: colors.tertiary,
        letterSpacing: 0.5,
        marginTop: top ?? 0,
        marginBottom: 6,
      }}
    >
      {text.toUpperCase()}
    </Text>
  );
}

/**
 * Bottom-sheet date editor — accepts free-form "dd/MM/yyyy HH:mm" input.
 * Validates on confirm; emits an ISO string (or null on Cancella).
 */
function DateEditor({
  visible,
  initialIso,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  initialIso: string | null;
  onCancel: () => void;
  onConfirm: (iso: string | null) => void;
}) {
  const colors = useThemeColors();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setDraft(initialIso ? fmtDateTime(initialIso) : fmtDateTime(new Date().toISOString()));
      setError(null);
    }
  }, [visible, initialIso]);

  const handleConfirm = () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      onConfirm(null);
      return;
    }
    const parsed = parseDateTime(trimmed);
    if (!parsed) {
      setError('Formato non valido. Usa dd/mm/aaaa hh:mm');
      return;
    }
    onConfirm(parsed.toISOString());
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <View
          style={{
            backgroundColor: colors.background2,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingBottom: 24,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 20,
              paddingVertical: 16,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <TouchableOpacity onPress={onCancel} hitSlop={8}>
              <Text style={{ fontSize: 14, color: colors.tertiary }}>Annulla</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.primary }}>
              Data e ora
            </Text>
            <TouchableOpacity onPress={handleConfirm} hitSlop={8}>
              <Text style={{ fontSize: 14, color: colors.accent, fontWeight: '600' }}>
                Salva
              </Text>
            </TouchableOpacity>
          </View>
          <View style={{ padding: 16 }}>
            <TextInput
              value={draft}
              onChangeText={(t) => {
                setDraft(t);
                setError(null);
              }}
              placeholder="dd/mm/aaaa hh:mm"
              placeholderTextColor={colors.tertiary}
              autoFocus
              style={{
                backgroundColor: colors.background1,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: error ? '#EF4444' : colors.border,
                paddingHorizontal: 12,
                height: 44,
                fontSize: 15,
                color: colors.primary,
              }}
            />
            {error ? (
              <Text style={{ fontSize: 12, color: '#EF4444', marginTop: 6 }}>{error}</Text>
            ) : (
              <Text style={{ fontSize: 11, color: colors.tertiary, marginTop: 6 }}>
                Lascia vuoto per cancellare
              </Text>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Date helpers ──────────────────────────────────────────────────────────

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Parse "dd/MM/yyyy HH:mm" (HH:mm optional → defaults to 00:00). */
function parseDateTime(s: string): Date | null {
  // Tolerate "-" and "." separators alongside "/", and allow either a space or
  // a "T" between date and time so a user pasting an ISO chunk still works.
  const match = s.match(/^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{4})(?:[ T](\d{1,2}):(\d{2}))?$/);
  if (!match) return null;
  const [, dd, mm, yyyy, hh = '0', mins = '0'] = match;
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(mins));
  return Number.isNaN(d.getTime()) ? null : d;
}
