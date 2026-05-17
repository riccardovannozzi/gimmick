/**
 * Tile FLOW view — mobile equivalent of the frontend TileSidebar "Flow" tab
 * (frontend/components/tileview/TileSidebar.tsx FlowTab function).
 *
 * Loads the tile's flow DAG, picks an initial node (first node) and renders
 * the FlowInspector with the embedded VerticalFlowTrack so the user can see
 * the graph + edit the selected node side-by-side.
 *
 * Empty state shows a "Crea primo nodo" call-to-action that creates an
 * orphan node and selects it.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { GestureDetector } from 'react-native-gesture-handler';
import { SafeAreaWrapper } from '@/components/layout/SafeAreaWrapper';
import { TopNav } from '@/components/layout/TopNav';
import { TileHeaderNav } from '@/components/layout/TileHeaderNav';
import { FlowInspector } from '@/components/flow/FlowInspector';
import { useFlow } from '@/hooks/useFlow';
import { useHorizontalSwipe } from '@/hooks/useHorizontalSwipe';
import { useThemeColors } from '@/lib/theme';

export default function TileFlowScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useThemeColors();
  const { graph, isLoading, addNode } = useFlow(id);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Auto-select the first node whenever the graph changes and the current
  // selection is no longer valid (e.g. just deleted, or fresh page load).
  useEffect(() => {
    if (isLoading) return;
    if (selectedNodeId && graph.nodes.some((n) => n.id === selectedNodeId)) return;
    setSelectedNodeId(graph.nodes[0]?.id ?? null);
  }, [graph.nodes, isLoading, selectedNodeId]);

  // Swipe-right → LIST. No further-right tab exists; leave onSwipeLeft unset.
  const swipe = useHorizontalSwipe({
    onSwipeRight: () => router.replace(`/tile/${id}/list` as any),
  });

  return (
    <SafeAreaWrapper edges={['bottom']}>
      <TopNav activePath="/history" />
      <GestureDetector gesture={swipe}>
        <View style={{ flex: 1, backgroundColor: colors.background1 }}>
          <TileHeaderNav
            colors={colors}
            active="flow"
            onTiles={() => router.replace('/history' as any)}
            onEdit={() => router.replace(`/tile/${id}` as any)}
            onList={() => router.replace(`/tile/${id}/list` as any)}
            onFlow={() => { /* already here */ }}
          />

          {isLoading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator size="small" color={colors.tertiary} />
            </View>
          ) : graph.nodes.length === 0 ? (
            <View
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 24,
                gap: 12,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  color: colors.tertiary,
                  textAlign: 'center',
                  lineHeight: 20,
                }}
              >
                Nessun nodo nel flow di questo tile.
              </Text>
              <TouchableOpacity
                onPress={async () => {
                  const res = await addNode.mutateAsync({
                    label: 'Nuovo nodo',
                    state: 'active',
                  });
                  if (res?.node) setSelectedNodeId(res.node.id);
                }}
                disabled={addNode.isPending}
                activeOpacity={0.7}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 8,
                  backgroundColor: '#2563EB',
                  opacity: addNode.isPending ? 0.5 : 1,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>
                  Crea primo nodo
                </Text>
              </TouchableOpacity>
            </View>
          ) : selectedNodeId ? (
            <FlowInspector
              nodeId={selectedNodeId}
              tileId={id!}
              onSelectNode={(nid) => setSelectedNodeId(nid)}
              hideNote
              showVerticalFlow
            />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 12, color: colors.tertiary }}>
                Nessun nodo selezionabile.
              </Text>
            </View>
          )}
        </View>
      </GestureDetector>
    </SafeAreaWrapper>
  );
}
