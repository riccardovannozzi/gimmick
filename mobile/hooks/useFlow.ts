/**
 * React-query hook for the linear Flow list of a specific Tile (mobile).
 *
 *   const { graph, isLoading, addNode, updateNode, deleteNode, reorderNodes }
 *     = useFlow(tileId);
 *
 * Matches the frontend useFlow hook one-for-one after migration 030 retired
 * the DAG. `graph.nodes` arrives sorted by `sort_order ASC` from the server.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { flowApi } from '@/lib/api';
import type { FlowGraph, FlowNode, FlowNodeState } from '@/types';

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
    // Status decorators (stalled / blocked) age over time — refetch every
    // minute so the FlowHub badges stay accurate without manual reload.
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
