/**
 * Tile FLOW view — mobile equivalent of the frontend TileSidebar "Flow" tab
 * after the linearisation (migration 030).
 *
 * Just renders FlowCardList — a draggable-ish list of cards, one per node.
 * Empty state is the "Aggiungi nodo" button inside FlowCardList itself.
 */
import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { GestureDetector } from 'react-native-gesture-handler';
import { SafeAreaWrapper } from '@/components/layout/SafeAreaWrapper';
import { TopNav } from '@/components/layout/TopNav';
import { TileHeaderNav } from '@/components/layout/TileHeaderNav';
import { FlowCardList } from '@/components/flow/FlowCardList';
import { useHorizontalSwipe } from '@/hooks/useHorizontalSwipe';
import { usePixelTheme } from '@/components/pixel';

export default function TileFlowScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = usePixelTheme();
  // Adapter — TileHeaderNav e FlowCardList legacy aspettano ancora `colors.*`
  const colors = {
    border: theme.border,
    tertiary: theme.ink2,
    secondary: theme.ink2,
    primary: theme.ink,
    accent: theme.accent,
    onAccent: theme.onAccent,
    background1: theme.bg1,
    background2: theme.bg2,
    surfaceVariant: theme.surface,
  } as const;

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

          <FlowCardList tileId={id!} />
        </View>
      </GestureDetector>
    </SafeAreaWrapper>
  );
}
