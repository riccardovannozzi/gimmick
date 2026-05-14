'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { IconX } from '@tabler/icons-react';
import { FlowTrack } from './FlowTrack';
import { FlowInspector } from './FlowInspector';
import { useFlow } from '@/lib/hooks/useFlow';
import { useFlowModalStore } from '@/store/flow-modal-store';

/**
 * Global Flow modal — mounted once at the dashboard layout, rendered into a
 * portal so it floats above sidebars/panels. Driven by `useFlowModalStore`:
 * any tile's FLOW badge can call `useFlowModalStore.getState().open(tileId)`
 * and this component appears.
 *
 * Layout: centered overlay, 90vw × 80vh (capped at 1200×800). Closes on
 * backdrop click, Esc, or the X button. Node selection inside the modal is
 * local-only — closing the modal clears it, no parent-page sync.
 */
export function FlowModal() {
  const router = useRouter();
  const { tileId, tileTitle, close } = useFlowModalStore();
  const [mounted, setMounted] = useState(false);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  // Tracks whether we've already auto-selected the focus node for the current
  // open. Reset every time the modal opens for a (possibly different) tile.
  const initializedFocusRef = useRef(false);

  // Read the graph for the open tile so we can auto-select the focus node.
  // useFlow is idempotent — FlowTrack uses the same cache key, so this does
  // not cause a second fetch.
  const { graph, setFocus } = useFlow(tileId ?? null);

  useEffect(() => setMounted(true), []);

  // When the modal opens for a new tile, reset local selection and the
  // initialization flag so the auto-select effect below can fire again.
  useEffect(() => {
    setSelectedNodeIds([]);
    initializedFocusRef.current = false;
  }, [tileId]);

  // Auto-select the focus node when the graph first loads. If no node has
  // is_focus=true, fall back to the root (= oldest node with no incoming
  // edges) and PERSIST it as focus — the invariant is "every Flow has a
  // focus once viewed". One-shot per modal-open thanks to initializedFocusRef.
  useEffect(() => {
    if (!tileId) return;
    if (initializedFocusRef.current) return;
    if (graph.nodes.length === 0) return;

    let focusNode = graph.nodes.find((n) => n.is_focus);
    if (!focusNode) {
      const childIds = new Set(graph.edges.map((e) => e.child_id));
      const roots = graph.nodes
        .filter((n) => !childIds.has(n.id))
        .sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        );
      focusNode = roots[0] ?? graph.nodes[0];
      if (focusNode) {
        setFocus.mutate({ id: focusNode.id, focus: true });
      }
    }
    if (focusNode) {
      setSelectedNodeIds([focusNode.id]);
      initializedFocusRef.current = true;
    }
  }, [tileId, graph.nodes, graph.edges, setFocus]);

  // Esc closes the modal.
  useEffect(() => {
    if (!tileId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tileId, close]);

  if (!mounted || !tileId) return null;

  const handleSelectNode = (nodeId: string | null, opts?: { multi?: boolean }) => {
    if (nodeId === null) {
      setSelectedNodeIds([]);
      return;
    }
    if (opts?.multi) {
      setSelectedNodeIds((prev) =>
        prev.includes(nodeId) ? prev.filter((id) => id !== nodeId) : [...prev, nodeId],
      );
    } else {
      setSelectedNodeIds([nodeId]);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9990] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className="relative bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl flex flex-col overflow-hidden"
        style={{
          width: 'min(90vw, 1400px)',
          height: 'min(85vh, 900px)',
        }}
      >
        {/* Close X — positioned in the absolute top-right of the modal so it
            sits cleanly outside FlowTrack's own header (FlowTrack already
            renders its own close button which we wire to the same handler). */}
        <button
          onClick={close}
          className="absolute top-2 right-2 z-10 w-8 h-8 flex items-center justify-center rounded text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
          title="Chiudi (Esc)"
        >
          <IconX size={16} />
        </button>

        {/* Split: FlowTrack diagram on the left, FlowInspector sidebar on the
            right — always present so the user can see the editing surface
            exists. Placeholder when no/multiple nodes selected; full
            inspector when exactly one node is selected. */}
        <div className="flex flex-1 min-h-0">
          <div className="flex-1 min-w-0 flex flex-col">
            <FlowTrack
              tileId={tileId}
              tileTitle={tileTitle ?? undefined}
              onClose={close}
              onSelectNode={handleSelectNode}
              selectedNodeIds={selectedNodeIds}
              onOpenTile={() => {
                // Close the modal and jump to the canvas with this tile
                // selected. Canvas resolves the tag from the tile's first
                // non-root tag (same path as the Hub deep-link).
                close();
                router.push(`/canvas?tile=${tileId}`);
              }}
            />
          </div>
          <div className="w-80 shrink-0 border-l border-zinc-800 flex flex-col overflow-hidden bg-zinc-950">
            {selectedNodeIds.length === 1 ? (
              <FlowInspector
                nodeId={selectedNodeIds[0]}
                tileId={tileId}
                onClose={() => setSelectedNodeIds([])}
                onSelectNode={(id) => setSelectedNodeIds(id ? [id] : [])}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Inspector
                </span>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  {selectedNodeIds.length === 0
                    ? 'Seleziona un nodo per modificarne etichetta, stato, contatto, data e note.'
                    : `${selectedNodeIds.length} nodi selezionati. Seleziona un solo nodo per modificarlo.`}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
