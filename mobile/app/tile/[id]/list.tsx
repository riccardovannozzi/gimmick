/**
 * Tile LIST view — mobile equivalent of the frontend TileSidebar "List" tab
 * (frontend/components/tileview/SubtaskList.tsx).
 *
 * Drag-and-drop reordering from the web version is replaced by an explicit
 * SPOSTA toggle on each row that exposes up/down arrows — native DnD on RN
 * requires extra libs and behaves poorly inside a scrollview.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  IconChevronUp,
  IconChevronDown,
  IconPlus,
  IconTrash,
  IconCheck,
} from '@tabler/icons-react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { SafeAreaWrapper } from '@/components/layout/SafeAreaWrapper';
import { TopNav } from '@/components/layout/TopNav';
import { TileHeaderNav } from '@/components/layout/TileHeaderNav';
import { useHorizontalSwipe } from '@/hooks/useHorizontalSwipe';
import { useThemeColors } from '@/lib/theme';
import { subtasksApi } from '@/lib/api';
import type { Subtask } from '@/types';

export default function TileListScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useThemeColors();
  const queryClient = useQueryClient();

  const queryKey = ['subtasks', id];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => subtasksApi.list(id!),
    enabled: !!id,
  });
  const subtasks: Subtask[] = data?.data ?? [];

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const addMutation = useMutation({
    mutationFn: () => subtasksApi.create({ tile_id: id!, content: '' }),
    onSuccess: invalidate,
  });

  // Optimistic update — keeps the row state snappy when toggling/typing.
  const updateMutation = useMutation({
    mutationFn: ({ subId, updates }: { subId: string; updates: { content?: string; is_done?: boolean } }) =>
      subtasksApi.update(subId, updates),
    onMutate: async ({ subId, updates }) => {
      await queryClient.cancelQueries({ queryKey });
      const prev = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old?.data) return old;
        return { ...old, data: old.data.map((s: Subtask) => (s.id === subId ? { ...s, ...updates } : s)) };
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (subId: string) => subtasksApi.delete(subId),
    onSuccess: invalidate,
  });

  const reorderMutation = useMutation({
    mutationFn: (items: { id: string; sort_order: number }[]) => subtasksApi.reorder(items),
    onSuccess: invalidate,
  });

  const moveByIndex = useCallback(
    (from: number, to: number) => {
      if (from === to || from < 0 || to < 0 || from >= subtasks.length || to >= subtasks.length) return;
      const reordered = [...subtasks];
      const [moved] = reordered.splice(from, 1);
      reordered.splice(to, 0, moved);
      const items = reordered.map((s, i) => ({ id: s.id, sort_order: i }));
      queryClient.setQueryData(queryKey, { data: reordered.map((s, i) => ({ ...s, sort_order: i })) });
      reorderMutation.mutate(items);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [subtasks],
  );

  // Track which row is in "reorder mode" (shows up/down arrows).
  const [reorderingId, setReorderingId] = useState<string | null>(null);

  // Swipe-right → back to EDIT, swipe-left → forward to FLOW. Mirrors the
  // segmented header buttons.
  const swipe = useHorizontalSwipe({
    onSwipeRight: () => router.replace(`/tile/${id}` as any),
    onSwipeLeft: () => router.replace(`/tile/${id}/flow` as any),
  });

  return (
    <SafeAreaWrapper edges={['bottom']}>
      <TopNav activePath="/history" />
      <GestureDetector gesture={swipe}>
      <View style={{ flex: 1, backgroundColor: colors.background1 }}>
        {/* Header — TILES (square) | EDIT | LIST (active) | FLOW */}
        <TileHeaderNav
          colors={colors}
          active="list"
          onTiles={() => router.replace('/history' as any)}
          onEdit={() => router.replace(`/tile/${id}` as any)}
          onList={() => { /* already here */ }}
          onFlow={() => router.replace(`/tile/${id}/flow` as any)}
        />

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.tertiary} style={{ marginTop: 24 }} />
          ) : subtasks.length === 0 ? (
            <Text
              style={{
                fontSize: 12,
                color: colors.tertiary,
                textAlign: 'center',
                paddingVertical: 12,
              }}
            >
              Nessun elemento
            </Text>
          ) : (
            subtasks.map((s, i) => (
              <SubtaskRow
                key={s.id}
                subtask={s}
                colors={colors}
                isReordering={reorderingId === s.id}
                canMoveUp={i > 0}
                canMoveDown={i < subtasks.length - 1}
                onToggleReorder={() => setReorderingId(reorderingId === s.id ? null : s.id)}
                onMoveUp={() => moveByIndex(i, i - 1)}
                onMoveDown={() => moveByIndex(i, i + 1)}
                onToggleDone={() =>
                  updateMutation.mutate({ subId: s.id, updates: { is_done: !s.is_done } })
                }
                onChangeContent={(content) =>
                  updateMutation.mutate({ subId: s.id, updates: { content } })
                }
                onDelete={() => deleteMutation.mutate(s.id)}
              />
            ))
          )}

          <TouchableOpacity
            onPress={() => addMutation.mutate()}
            disabled={addMutation.isPending}
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
              opacity: addMutation.isPending ? 0.4 : 1,
            }}
          >
            <IconPlus size={14} color={colors.tertiary} />
            <Text style={{ fontSize: 12, color: colors.tertiary }}>Aggiungi elemento</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
      </GestureDetector>
    </SafeAreaWrapper>
  );
}

function SubtaskRow({
  subtask,
  colors,
  isReordering,
  canMoveUp,
  canMoveDown,
  onToggleReorder,
  onMoveUp,
  onMoveDown,
  onToggleDone,
  onChangeContent,
  onDelete,
}: {
  subtask: Subtask;
  colors: any;
  isReordering: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onToggleReorder: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleDone: () => void;
  onChangeContent: (content: string) => void;
  onDelete: () => void;
}) {
  const [value, setValue] = useState(subtask.content);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const dirty = useRef(false);

  // Sync from server when not actively edited (mirrors web SubtaskRow logic).
  useEffect(() => {
    if (!dirty.current) setValue(subtask.content);
  }, [subtask.content]);

  // Auto-clear delete confirmation after 3s.
  useEffect(() => {
    if (!confirmDelete) return;
    const t = setTimeout(() => setConfirmDelete(false), 3000);
    return () => clearTimeout(t);
  }, [confirmDelete]);

  const handleDelete = () => {
    if (confirmDelete) onDelete();
    else setConfirmDelete(true);
  };

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
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        {/* Checkbox */}
        <TouchableOpacity
          onPress={onToggleDone}
          activeOpacity={0.7}
          hitSlop={6}
          style={{
            width: 22,
            height: 22,
            borderRadius: 5,
            borderWidth: 1.5,
            borderColor: subtask.is_done ? colors.accent : colors.tertiary,
            backgroundColor: subtask.is_done ? colors.accent : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 2,
          }}
        >
          {subtask.is_done && <IconCheck size={14} color="#fff" strokeWidth={3} />}
        </TouchableOpacity>

        {/* Editable content — multiline auto-grows */}
        <TextInput
          value={value}
          onChangeText={(t) => {
            setValue(t);
            dirty.current = true;
          }}
          onBlur={() => {
            if (dirty.current) {
              onChangeContent(value);
              dirty.current = false;
            }
          }}
          placeholder="Scrivi…"
          placeholderTextColor={colors.tertiary}
          multiline
          style={{
            flex: 1,
            fontSize: 14,
            color: subtask.is_done ? colors.tertiary : colors.primary,
            textDecorationLine: subtask.is_done ? 'line-through' : 'none',
            padding: 0,
            textAlignVertical: 'top',
            minHeight: 22,
          }}
        />
      </View>

      {/* Action toolbar — visible always (no hover on mobile). */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          marginTop: 8,
          paddingTop: 6,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        {/* Reorder toggle */}
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
            <TouchableOpacity
              onPress={onMoveUp}
              disabled={!canMoveUp}
              hitSlop={6}
              style={{ padding: 4, opacity: canMoveUp ? 1 : 0.3 }}
            >
              <IconChevronUp size={16} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onMoveDown}
              disabled={!canMoveDown}
              hitSlop={6}
              style={{ padding: 4, opacity: canMoveDown ? 1 : 0.3 }}
            >
              <IconChevronDown size={16} color={colors.primary} />
            </TouchableOpacity>
          </>
        )}

        <View style={{ flex: 1 }} />

        <TouchableOpacity
          onPress={handleDelete}
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
