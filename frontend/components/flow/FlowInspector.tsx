'use client';

import { useEffect, useRef, useState } from 'react';
import { IconArrowLeft, IconArrowRight, IconArrowsHorizontal, IconTrash } from '@tabler/icons-react';
import { useFlow } from '@/lib/hooks/useFlow';
import { FLOW_STATE_COLORS, FLOW_STATE_LABELS } from '@/lib/flow-colors';
import { ContactCombobox } from './ContactCombobox';
import type { FlowNode, FlowNodeState } from '@/types/flow';

interface Props {
  /** Id of the selected flow node — must belong to `tileId`. */
  nodeId: string;
  tileId: string;
  onClose: () => void;
  onSelectNode: (id: string | null) => void;
}

const STATES: FlowNodeState[] = ['mine', 'theirs', 'done', 'blocked', 'cancelled'];
const AUTOSAVE_MS = 500;

/**
 * Right sidebar inside FlowTrack. Visible only when a node is selected.
 *
 * Fields autosave 500ms after the last keystroke (text fields) or
 * immediately on change (select / combobox / datetime).
 *
 * Actions at the bottom:
 *   - Aggiungi figlio        → new node with parent_node_id = this.id
 *   - Aggiungi predecessore  → new orphan node + edge to this.id
 *   - Fratello                 → new node that shares the same parents as this one
 *   - Elimina                 → confirm + deleteNode (cascade removes edges)
 */
export function FlowInspector({ nodeId, tileId, onClose, onSelectNode }: Props) {
  const { graph, updateNode, deleteNode, addNode, addEdge } = useFlow(tileId);
  const node: FlowNode | null = graph.nodes.find((n) => n.id === nodeId) ?? null;

  // Local state mirrors the server-side node, but the user can keep typing
  // while the autosave debounce is pending. Hooks must run unconditionally,
  // so we use safe defaults when the node hasn't loaded yet.
  const [label, setLabel] = useState(node?.label ?? '');
  const [state, setState] = useState<FlowNodeState>(node?.state ?? 'mine');
  const [contactId, setContactId] = useState<string | null>(node?.contact_id ?? null);
  const [occurredAt, setOccurredAt] = useState<string>(toLocalInput(node?.occurred_at ?? null));
  const [notes, setNotes] = useState<string>(node?.notes ?? '');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Reset local form when the selected node changes (clicking a different node)
  // or when the node data first loads.
  const lastNodeIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!node) return;
    if (lastNodeIdRef.current !== node.id) {
      lastNodeIdRef.current = node.id;
      setLabel(node.label);
      setState(node.state);
      setContactId(node.contact_id);
      setOccurredAt(toLocalInput(node.occurred_at));
      setNotes(node.notes ?? '');
      setConfirmingDelete(false);
    }
  }, [node]);

  // ─── Autosave ──────────────────────────────────────────────────────────
  // Text fields use debounced save (500ms). Non-text fields (state, contact,
  // datetimes) save immediately.

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

  const notesSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
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
  }, [notes]);

  // ─── Actions ───────────────────────────────────────────────────────────
  // Grid constants — kept in sync with FlowTrack (no shared module yet).
  const GRID_X = 120;
  const GRID_Y = 80;

  /** Best-effort position relative to the current node. Falls back to
   *  (240, 80) when the node has no manual x/y yet (Dagre fallback case). */
  const refPos = node && node.x != null && node.y != null
    ? { x: node.x, y: node.y }
    : { x: 240, y: 80 };

  const handleAddChild = async () => {
    const res = await addNode.mutateAsync({
      label: 'Nuovo nodo',
      state: 'mine',
      parent_node_id: nodeId,
      x: refPos.x + GRID_X,
      y: refPos.y,
    });
    if (res?.node) onSelectNode(res.node.id);
  };

  const handleAddPredecessor = async () => {
    // 1) Create orphan node, then 2) edge new → this
    const res = await addNode.mutateAsync({
      label: 'Nuovo nodo',
      state: 'mine',
      x: refPos.x - GRID_X,
      y: refPos.y,
    });
    if (res?.node) {
      try {
        await addEdge.mutateAsync({ parent_id: res.node.id, child_id: nodeId });
      } catch {
        // Edge creation failed (shouldn't happen for a fresh orphan); the
        // hook still leaves the node behind so the user can inspect it.
      }
      onSelectNode(res.node.id);
    }
  };

  /**
   * Add a sibling: a new node that shares the same parents as the current one.
   *   - 0 parents (root) → orphan new node
   *   - 1 parent  → use parent_node_id shortcut (atomic node + edge)
   *   - N parents → create node, then fan-out edges from each parent
   */
  const handleAddSibling = async () => {
    const parentIds = graph.edges
      .filter((e) => e.child_id === nodeId)
      .map((e) => e.parent_id);

    const siblingPos = { x: refPos.x, y: refPos.y + GRID_Y };

    if (parentIds.length === 0) {
      const res = await addNode.mutateAsync({
        label: 'Nuovo nodo',
        state: 'mine',
        x: siblingPos.x,
        y: siblingPos.y,
      });
      if (res?.node) onSelectNode(res.node.id);
      return;
    }

    if (parentIds.length === 1) {
      const res = await addNode.mutateAsync({
        label: 'Nuovo nodo',
        state: 'mine',
        parent_node_id: parentIds[0],
        x: siblingPos.x,
        y: siblingPos.y,
      });
      if (res?.node) onSelectNode(res.node.id);
      return;
    }

    const res = await addNode.mutateAsync({
      label: 'Nuovo nodo',
      state: 'mine',
      x: siblingPos.x,
      y: siblingPos.y,
    });
    if (!res?.node) return;
    for (const pid of parentIds) {
      try {
        await addEdge.mutateAsync({ parent_id: pid, child_id: res.node.id });
      } catch {
        // Partial failure leaves an orphan node behind; user can still inspect/repair.
      }
    }
    onSelectNode(res.node.id);
  };

  const handleDelete = async () => {
    await deleteNode.mutateAsync(nodeId);
    onSelectNode(null);
    onClose();
  };

  // Node could be momentarily null right after delete or while the graph is
  // still loading after the user switched tile/node. Bail with a placeholder
  // so the JSX below can safely deref `node`.
  if (!node) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-zinc-500">
        Nodo non trovato
      </div>
    );
  }

  return (
    <aside className="w-full shrink-0 bg-zinc-950 flex flex-col h-full">
      <div className="h-10 flex items-center justify-between px-3 border-b border-zinc-800 shrink-0">
        <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Nodo</span>
        <button
          onClick={onClose}
          className="text-[10px] text-zinc-500 hover:text-zinc-200 transition-colors"
        >
          Deseleziona
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 [&::-webkit-scrollbar-thumb]:bg-zinc-800 [&::-webkit-scrollbar-thumb:hover]:bg-zinc-700">
        {/* Label */}
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Etichetta</label>
          <textarea
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Es. Mandato preventivo"
            rows={2}
            className="w-full bg-zinc-800/60 border border-white/[0.08] rounded px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500 resize-none"
          />
        </div>

        {/* State segmented control */}
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Stato</label>
          <div className="grid grid-cols-5 gap-1">
            {STATES.map((s) => {
              const isActive = state === s;
              return (
                <button
                  key={s}
                  onClick={() => {
                    setState(s);
                    updateNode.mutate({ id: nodeId, updates: { state: s } });
                  }}
                  className={`h-8 rounded text-[9px] font-medium uppercase tracking-wider transition-colors flex items-center justify-center gap-1`}
                  style={{
                    backgroundColor: isActive ? FLOW_STATE_COLORS[s] : '#27272A',
                    color: isActive ? '#fff' : '#A1A1AA',
                    border: isActive ? '1px solid rgba(255,255,255,0.3)' : '1px solid rgba(255,255,255,0.08)',
                  }}
                  title={FLOW_STATE_LABELS[s]}
                >
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: isActive ? '#fff' : FLOW_STATE_COLORS[s] }}
                  />
                  {s.slice(0, 3)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Contact */}
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Contatto</label>
          <ContactCombobox
            value={contactId}
            onChange={(id) => {
              setContactId(id);
              updateNode.mutate({ id: nodeId, updates: { contact_id: id } });
            }}
          />
        </div>

        {/* Date */}
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Data</label>
          <div className="flex gap-1">
            <input
              type="datetime-local"
              value={occurredAt}
              onChange={(e) => {
                setOccurredAt(e.target.value);
                updateNode.mutate({
                  id: nodeId,
                  updates: { occurred_at: e.target.value ? fromLocalInput(e.target.value) : null },
                });
              }}
              className="flex-1 bg-zinc-800/60 border border-white/[0.08] rounded px-2 h-8 text-xs text-zinc-200 focus:outline-none focus:border-blue-500"
            />
            {occurredAt && (
              <button
                onClick={() => {
                  setOccurredAt('');
                  updateNode.mutate({ id: nodeId, updates: { occurred_at: null } });
                }}
                className="px-2 h-8 rounded text-zinc-500 hover:text-red-400 hover:bg-zinc-800/60 transition-colors"
                title="Cancella"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Note</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="Dettagli, contesto, link…"
            className="w-full bg-zinc-800/60 border border-white/[0.08] rounded px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500 resize-y"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="border-t border-zinc-800 p-2 grid grid-cols-2 gap-1 shrink-0">
        <button
          onClick={handleAddChild}
          className="flex items-center gap-1.5 px-2 h-8 rounded text-xs leading-none font-medium bg-zinc-800/60 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
        >
          <IconArrowRight size={12} />
          Figlio
        </button>
        <button
          onClick={handleAddPredecessor}
          className="flex items-center gap-1.5 px-2 h-8 rounded text-xs leading-none font-medium bg-zinc-800/60 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
        >
          <IconArrowLeft size={12} />
          Predecessore
        </button>
        <button
          onClick={handleAddSibling}
          className="flex items-center gap-1.5 px-2 h-8 rounded text-xs leading-none font-medium bg-zinc-800/60 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
        >
          <IconArrowsHorizontal size={12} />
          Fratello
        </button>
        {confirmingDelete ? (
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 px-2 h-8 rounded text-xs leading-none font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
          >
            <IconTrash size={12} />
            Conferma
          </button>
        ) : (
          <button
            onClick={() => setConfirmingDelete(true)}
            className="flex items-center gap-1.5 px-2 h-8 rounded text-xs leading-none font-medium bg-zinc-800/60 text-red-400 hover:bg-red-950/40 transition-colors"
          >
            <IconTrash size={12} />
            Elimina
          </button>
        )}
      </div>
    </aside>
  );
}

/** Convert ISO timestamp → datetime-local input value (local time). */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Convert datetime-local input value → ISO timestamp (UTC). */
function fromLocalInput(value: string): string {
  return new Date(value).toISOString();
}
