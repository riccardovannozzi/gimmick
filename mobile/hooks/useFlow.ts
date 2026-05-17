/**
 * React-query hook for the Flow DAG of a specific Tile — port of
 * frontend/lib/hooks/useFlow.ts.
 *
 *   const { graph, isLoading, addNode, updateNode, deleteNode,
 *           addEdge, deleteEdge } = useFlow(tileId);
 *
 * All mutations invalidate ['flow', tileId] so the inspector + flow track
 * stay consistent.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { flowApi } from '@/lib/api';
import type { FlowGraph, FlowNode, FlowEdge, FlowNodeState } from '@/types';

type CreateNodeBody = {
  label?: string;
  state?: FlowNodeState;
  contact_id?: string | null;
  occurred_at?: string | null;
  scheduled_at?: string | null;
  notes?: string | null;
  parent_node_id?: string;
  x?: number | null;
  y?: number | null;
};

type UpdateNodeBody = Partial<
  Pick<FlowNode, 'label' | 'state' | 'contact_id' | 'occurred_at' | 'scheduled_at' | 'notes' | 'x' | 'y'>
>;

export function useFlow(tileId: string | null | undefined) {
  const qc = useQueryClient();
  const enabled = !!tileId;

  const query = useQuery({
    queryKey: ['flow', tileId],
    queryFn: async (): Promise<FlowGraph> => {
      const res = await flowApi.getByTile(tileId!);
      return (res.data as FlowGraph) ?? { nodes: [], edges: [] };
    },
    enabled,
    // Edge stroke-width depends on time elapsed since the parent's
    // occurred_at — refetch periodically so the visual signal keeps growing
    // for stale flows even without user interaction.
    refetchInterval: 60_000,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['flow', tileId] });
  };

  const addNode = useMutation({
    mutationFn: async (body: CreateNodeBody) => {
      const res = await flowApi.createNode(tileId!, body);
      return res.data as { node: FlowNode; edge: FlowEdge | null };
    },
    onSuccess: invalidate,
  });

  const updateNode = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: UpdateNodeBody }) => {
      const res = await flowApi.updateNode(id, updates);
      return res.data as FlowNode;
    },
    onSuccess: invalidate,
  });

  const deleteNode = useMutation({
    mutationFn: async (id: string) => flowApi.deleteNode(id),
    onSuccess: invalidate,
  });

  const addEdge = useMutation({
    mutationFn: async (body: { parent_id: string; child_id: string }) => {
      const res = await flowApi.createEdge(body);
      return res.data as FlowEdge;
    },
    onSuccess: invalidate,
  });

  const deleteEdge = useMutation({
    mutationFn: async (id: string) => flowApi.deleteEdge(id),
    onSuccess: invalidate,
  });

  return {
    graph: query.data ?? { nodes: [], edges: [] },
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    addNode,
    updateNode,
    deleteNode,
    addEdge,
    deleteEdge,
  };
}
