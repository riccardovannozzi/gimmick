/**
 * React-query hook for the Flow list of a specific Tile.
 *
 * After the linearisation (migration 030) the model is a flat, ordered list
 * of nodes — no more DAG / edges. The API surface here is:
 *
 *   const { graph, isLoading, addNode, updateNode, deleteNode, reorderNodes }
 *     = useFlow(tileId);
 *
 * All mutations invalidate both ['flow', tileId] (this tile's drawer) and
 * ['flow-hub'] (the cross-tile inbox view, which depends on the same data).
 */
'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { flowApi } from '@/lib/api';
import type {
  FlowNodeState,
  FlowGraph,
  FlowNode,
} from '@/types/flow';

type CreateNodeBody = {
  label?: string;
  state?: FlowNodeState;
  contact_id?: string | null;
  occurred_at?: string | null;
  scheduled_at?: string | null;
  notes?: string | null;
};

type UpdateNodeBody = Partial<
  Pick<FlowNode, 'label' | 'state' | 'contact_id' | 'occurred_at' | 'scheduled_at' | 'notes' | 'sort_order'>
>;

export function useFlow(tileId: string | null | undefined) {
  const qc = useQueryClient();
  const enabled = !!tileId;

  const query = useQuery({
    queryKey: ['flow', tileId],
    queryFn: async (): Promise<FlowGraph> => {
      const res = await flowApi.getByTile(tileId!);
      return (res.data as FlowGraph) ?? { nodes: [] };
    },
    enabled,
    // Status decorations (stalled / blocked) age with time. Refetch every
    // minute so the hub badges stay accurate without manual reloads.
    refetchInterval: 60_000,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['flow', tileId] });
    qc.invalidateQueries({ queryKey: ['flow-hub'] });
  };

  const addNode = useMutation({
    mutationFn: async (body: CreateNodeBody) => {
      const res = await flowApi.createNode(tileId!, body);
      return res.data as { node: FlowNode; edge: null };
    },
    onSuccess: invalidate,
  });

  const updateNode = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: UpdateNodeBody }) => {
      const res = await flowApi.updateNode(id, updates);
      return res.data as FlowNode;
    },
    // Optimistic — text/state edits feel immediate; the server response just
    // confirms the cached row.
    onMutate: async ({ id, updates }) => {
      await qc.cancelQueries({ queryKey: ['flow', tileId] });
      const prev = qc.getQueryData<FlowGraph>(['flow', tileId]);
      qc.setQueryData<FlowGraph>(['flow', tileId], (old) => {
        if (!old) return old;
        return {
          ...old,
          nodes: old.nodes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
        };
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['flow', tileId], ctx.prev);
    },
    onSuccess: invalidate,
  });

  const deleteNode = useMutation({
    mutationFn: async (id: string) => flowApi.deleteNode(id),
    onSuccess: invalidate,
  });

  /**
   * Reorder the whole tile's flow list. The caller sends every node with its
   * new `sort_order` (typically `nodes.map((n, i) => ({ id: n.id, sort_order: i }))`
   * after a drag-and-drop). Optimistic — the cached array is rearranged
   * immediately so the dragged card stays put without flicker.
   */
  const reorderNodes = useMutation({
    mutationFn: async (items: { id: string; sort_order: number }[]) =>
      flowApi.reorderNodes(items),
    onMutate: async (items) => {
      await qc.cancelQueries({ queryKey: ['flow', tileId] });
      const prev = qc.getQueryData<FlowGraph>(['flow', tileId]);
      const order = new Map(items.map((it) => [it.id, it.sort_order]));
      qc.setQueryData<FlowGraph>(['flow', tileId], (old) => {
        if (!old) return old;
        const reordered = old.nodes
          .map((n) => ({ ...n, sort_order: order.get(n.id) ?? n.sort_order }))
          .sort((a, b) => a.sort_order - b.sort_order);
        return { ...old, nodes: reordered };
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['flow', tileId], ctx.prev);
    },
    onSuccess: invalidate,
  });

  return {
    graph: query.data ?? { nodes: [] },
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    addNode,
    updateNode,
    deleteNode,
    reorderNodes,
  };
}
