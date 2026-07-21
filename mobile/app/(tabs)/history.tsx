import React, { useState, useMemo, useCallback } from 'react';
import { ObsidianViewsTabHost } from '@/components/obsidian/ViewsTabHost';
import { isObsidianShellEnabled } from '@/lib/feature-flags';
import { View, Text, FlatList, ActivityIndicator, Pressable } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import * as TablerIcons from '@tabler/icons-react-native';
import {
  IconClock,
  IconTrash,
  IconBolt,
  IconCalendar,
  IconArrowUp,
  IconTag,
  IconBoxMultiple,
  IconCircleDot,
} from '@tabler/icons-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tilesApi, typeIconsApi, statusesApi, type TypeIconEntity, type StatusEntity } from '@/lib/api';
import { usePixelTheme } from '@/components/pixel';
import { hexWithAlpha, type PixelTheme } from '@/constants/pixel-theme';
import { ActionTypePicker } from '@/components/ActionTypePicker';
import { TagFilterModal } from '@/components/TagFilterModal';
import { FilterPickerModal } from '@/components/FilterPickerModal';
import type { Tile, ActionType } from '@/types';

// Spark management is desktop-only — this screen lists Tiles exclusively.

// ============ Action filter vocabulary ============
type ActionKey = 'none' | 'anytime' | 'deadline' | 'allday' | 'timed';

function actionColor(theme: PixelTheme, key: string): string {
  switch (key) {
    case 'none': return theme.ink3;
    case 'anytime': return theme.cap.text;
    case 'deadline': return theme.cap.voice;
    case 'allday': return theme.cap.gallery;
    case 'timed':
    case 'event': return theme.cap.photo;
    default: return theme.ink3;
  }
}

function resolveActionKey(tile: Tile): ActionKey {
  const at = tile.action_type ?? 'none';
  if (at === 'event') return tile.all_day ? 'allday' : 'timed';
  if (at === 'deadline') return 'deadline';
  if (at === 'anytime') return 'anytime';
  return 'none';
}

function readableOn(bg: string): string {
  const hex = bg.replace('#', '').slice(0, 6);
  if (hex.length < 6) return '#FFFFFF';
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.55 ? '#000000' : '#FFFFFF';
}

// ============ Date formatting for action subtitles ============

function formatActionSubtitle(tile: Tile): string | undefined {
  if (!tile.start_at) return undefined;
  const d = new Date(tile.start_at);
  const day = d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });

  if (tile.action_type === 'deadline') {
    return `entro il ${day}`;
  }
  if (tile.action_type === 'event') {
    if (tile.all_day) return day;
    const time = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    let str = `${day} · ${time}`;
    if (tile.end_at) {
      const diffMin = Math.round((new Date(tile.end_at).getTime() - d.getTime()) / 60000);
      if (diffMin > 0 && diffMin <= 480) {
        const h = Math.floor(diffMin / 60);
        const m = diffMin % 60;
        str += ` · ${h > 0 ? `${h}h` : ''}${m > 0 ? `${m}m` : ''}`;
      }
    }
    return str;
  }
  return undefined;
}

// ============ Grouping helpers ============

function groupByDate<T extends { created_at: string }>(items: T[]): { title: string; data: T[] }[] {
  const groups: Record<string, T[]> = {};
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  for (const item of items) {
    const date = new Date(item.created_at);
    let key: string;
    if (date.toDateString() === today.toDateString()) {
      key = 'OGGI';
    } else if (date.toDateString() === yesterday.toDateString()) {
      key = 'IERI';
    } else {
      key = date
        .toLocaleDateString('it-IT', { month: 'long', day: 'numeric' })
        .toUpperCase();
    }
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }

  return Object.entries(groups).map(([title, data]) => ({ title, data }));
}

// ============ TileItem (PixelCard) ============

const ACTION_BADGE_ICON: Record<string, typeof IconBolt | null> = {
  none: null,
  anytime: IconArrowUp,
  deadline: IconBolt,
  event: IconClock,
  allday: IconCalendar,
};

function TileItem({
  tile,
  onOpen,
  onActionTypeChange,
  onDelete,
}: {
  tile: Tile;
  onOpen: (tileId: string) => void;
  onActionTypeChange: (tileId: string, actionType: ActionType) => void;
  onDelete: (id: string) => void;
}) {
  const theme = usePixelTheme();
  const sparkCount = tile.spark_count ?? tile.sparks?.length ?? 0;
  const actionKey: string = tile.all_day && tile.action_type === 'event'
    ? 'allday'
    : (tile.action_type || 'none');
  const aColor = actionColor(theme, actionKey);
  const ActionIcon = ACTION_BADGE_ICON[actionKey];
  // bg = 15% alpha tint dell'action color sopra surface; 'none' → surface plain
  const tileBg = actionKey === 'none'
    ? theme.surface
    : hexWithAlpha(aColor, 0.15);
  const subtitle = formatActionSubtitle(tile);
  const isDeadline = actionKey === 'deadline';

  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
      <Pressable
        onPress={() => onOpen(tile.id)}
        style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
      >
        <View
          style={{
            backgroundColor: tileBg,
            borderWidth: 2,
            borderColor: isDeadline ? theme.cap.voice : theme.border,
            borderStyle: isDeadline ? 'dashed' : 'solid',
            padding: 10,
            minHeight: 84,
          }}
        >
          {/* Top row: title + delete */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: theme.fontBody,
                  fontSize: 14,
                  fontWeight: '700',
                  color: theme.ink,
                  lineHeight: 18,
                }}
                numberOfLines={2}
              >
                {tile.title || 'Senza titolo'}
              </Text>
              {subtitle && (
                <Text
                  style={{
                    fontFamily: theme.fontBody,
                    fontSize: 12,
                    color: theme.ink2,
                    marginTop: 2,
                  }}
                >
                  {subtitle}
                </Text>
              )}
            </View>
            <Pressable
              onPress={(e) => { e.stopPropagation?.(); onDelete(tile.id); }}
              hitSlop={10}
              style={({ pressed }) => ({
                width: 28,
                height: 28,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: -4,
                marginRight: -4,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <IconTrash size={16} color={theme.ink2} />
            </Pressable>
          </View>

          {/* Bottom row: action badge + spark count */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 8,
            }}
          >
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                onActionTypeChange(tile.id, tile.action_type || 'none');
              }}
              hitSlop={8}
              style={({ pressed }) => ({
                width: 32,
                height: 32,
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: -5,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              {ActionIcon ? (
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderWidth: 2,
                    borderColor: theme.border,
                    backgroundColor: aColor,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ActionIcon size={11} color={readableOn(aColor)} strokeWidth={2.4} />
                </View>
              ) : (
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderWidth: 2,
                    borderColor: theme.border,
                    backgroundColor: theme.bg1,
                  }}
                />
              )}
            </Pressable>
            {sparkCount > 0 && (
              <View
                style={{
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  backgroundColor: theme.ink,
                  borderWidth: 2,
                  borderColor: theme.border,
                }}
              >
                <Text
                  style={{
                    fontFamily: theme.fontHead,
                    fontSize: 8,
                    color: theme.bg1,
                    letterSpacing: 1,
                  }}
                >
                  {sparkCount} SPARK
                </Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    </View>
  );
}

// ============ Main screen ============

export default function HistoryRoute() {
  if (isObsidianShellEnabled()) return <ObsidianViewsTabHost view="tiles" />;
  return <HistoryScreenLegacy />;
}

function HistoryScreenLegacy() {
  const theme = usePixelTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedActionKeys, setSelectedActionKeys] = useState<Set<string>>(new Set());
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [selectedTypeIconIds, setSelectedTypeIconIds] = useState<Set<string>>(new Set());
  const [selectedStatusIds, setSelectedStatusIds] = useState<Set<string>>(new Set());

  const [actionFilterOpen, setActionFilterOpen] = useState(false);
  const [tagFilterOpen, setTagFilterOpen] = useState(false);
  const [typeFilterOpen, setTypeFilterOpen] = useState(false);
  const [statusFilterOpen, setStatusFilterOpen] = useState(false);

  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerMode, setPickerMode] = useState<'deadline' | 'event'>('deadline');
  const [pendingTileId, setPendingTileId] = useState<string | null>(null);

  const { data: tilesData, isLoading: tilesLoading, refetch: refetchTiles } = useQuery({
    queryKey: ['tiles', { page: 1, limit: 50 }],
    queryFn: () => tilesApi.list({ page: 1, limit: 50 }),
    refetchInterval: 30_000,
  });

  const typeIconsQuery = useQuery({
    queryKey: ['type-icons'],
    queryFn: () => typeIconsApi.list(),
    staleTime: 5 * 60 * 1000,
  });
  const typeIcons: TypeIconEntity[] = typeIconsQuery.data?.data ?? [];

  const typeAssignmentsQuery = useQuery({
    queryKey: ['type-icons', 'assignments'],
    queryFn: () => typeIconsApi.getAssignments(),
    staleTime: 5 * 60 * 1000,
  });
  const typeAssignments = typeAssignmentsQuery.data?.data ?? [];
  const typeIconByTile = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of typeAssignments) map.set(row.tile_id, row.type_icon_id);
    return map;
  }, [typeAssignments]);

  const statusesQuery = useQuery({
    queryKey: ['statuses'],
    queryFn: () => statusesApi.list(),
    staleTime: 5 * 60 * 1000,
  });
  const statuses: StatusEntity[] = statusesQuery.data?.data ?? [];

  useFocusEffect(
    useCallback(() => {
      refetchTiles();
    }, [refetchTiles]),
  );

  const updateTileMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Parameters<typeof tilesApi.update>[1] }) =>
      tilesApi.update(id, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tiles'] }),
  });

  const deleteTileMutation = useMutation({
    mutationFn: tilesApi.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tiles'] }),
  });

  const handleActionTypeChange = useCallback(
    (tileId: string, actionType: ActionType) => {
      if (actionType === 'deadline' || actionType === 'event') {
        setPendingTileId(tileId);
        setPickerMode(actionType === 'deadline' ? 'deadline' : 'event');
        setPickerVisible(true);
      } else {
        updateTileMutation.mutate({
          id: tileId,
          updates: {
            action_type: actionType,
            start_at: null,
            end_at: null,
            is_event: false,
            all_day: false,
          },
        });
      }
    },
    [updateTileMutation]
  );

  const handlePickerConfirm = useCallback(
    (data: { action_type: ActionType; start_at: string; end_at?: string; all_day?: boolean }) => {
      if (pendingTileId) {
        updateTileMutation.mutate({
          id: pendingTileId,
          updates: {
            action_type: data.action_type,
            start_at: data.start_at,
            end_at: data.end_at ?? null,
            is_event: data.action_type === 'event',
            all_day: data.all_day ?? false,
          },
        });
      }
      setPickerVisible(false);
      setPendingTileId(null);
    },
    [pendingTileId, updateTileMutation]
  );

  const allTiles: Tile[] = tilesData?.data || [];
  const filteredTiles = useMemo(() => {
    return allTiles.filter((t: Tile) => {
      if (selectedActionKeys.size > 0) {
        const key = resolveActionKey(t);
        if (!selectedActionKeys.has(key)) return false;
      }
      if (selectedTagIds.size > 0) {
        const tileTagIds = (t.tags ?? []).map((tg) => tg.id);
        if (!tileTagIds.some((id) => selectedTagIds.has(id))) return false;
      }
      if (selectedTypeIconIds.size > 0) {
        const assigned = typeIconByTile.get(t.id);
        if (!assigned || !selectedTypeIconIds.has(assigned)) return false;
      }
      if (selectedStatusIds.size > 0) {
        if (!t.status_id || !selectedStatusIds.has(t.status_id)) return false;
      }
      return true;
    });
  }, [allTiles, selectedActionKeys, selectedTagIds, selectedTypeIconIds, selectedStatusIds, typeIconByTile]);

  const groupedTiles = useMemo(() => groupByDate(filteredTiles), [filteredTiles]);

  const flatTiles = useMemo(() => {
    const result: ({ type: 'header'; title: string } | { type: 'tile'; tile: Tile })[] = [];
    for (const group of groupedTiles) {
      result.push({ type: 'header', title: group.title });
      for (const tile of group.data) result.push({ type: 'tile', tile });
    }
    return result;
  }, [groupedTiles]);

  const isLoading = tilesLoading;
  const isEmpty = filteredTiles.length === 0;
  const onRefresh = refetchTiles;

  // 5 action options for the picker — define after `theme` is available.
  const ACTION_FILTER_OPTIONS: { id: ActionKey; label: string; color: string; icon?: typeof IconBolt }[] = [
    { id: 'none', label: 'Notes', color: theme.ink3 },
    { id: 'anytime', label: 'ToDo', color: theme.cap.text, icon: IconArrowUp },
    { id: 'deadline', label: 'Due', color: theme.cap.voice, icon: IconBolt },
    { id: 'allday', label: 'All Day', color: theme.cap.gallery, icon: IconCalendar },
    { id: 'timed', label: 'Timed', color: theme.cap.photo, icon: IconClock },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg1 }}>
      <View style={{ flex: 1 }}>
        {/* Filter row — 4 pixel pill */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingTop: 10,
            paddingBottom: 10,
            gap: 6,
          }}
        >
          <FilterPill
            icon={IconBolt}
            label="ACTION"
            count={selectedActionKeys.size}
            onPress={() => setActionFilterOpen(true)}
          />
          <FilterPill
            icon={IconTag}
            label="TAG"
            count={selectedTagIds.size}
            onPress={() => setTagFilterOpen(true)}
          />
          <FilterPill
            icon={IconBoxMultiple}
            label="TYPE"
            count={selectedTypeIconIds.size}
            onPress={() => setTypeFilterOpen(true)}
          />
          <FilterPill
            icon={IconCircleDot}
            label="STATUS"
            count={selectedStatusIds.size}
            onPress={() => setStatusFilterOpen(true)}
          />
        </View>

        {/* Content */}
        {isLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={theme.accent as string} />
          </View>
        ) : isEmpty ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
            <View
              style={{
                width: 80,
                height: 80,
                borderWidth: 2,
                borderColor: theme.border,
                backgroundColor: theme.surface,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <IconClock size={36} color={theme.ink2} strokeWidth={1.6} />
            </View>
            <Text
              style={{
                fontFamily: theme.fontHead,
                fontSize: 12,
                color: theme.ink,
                textAlign: 'center',
                marginBottom: 8,
                letterSpacing: 1,
              }}
            >
              NESSUN TILE
            </Text>
            <Text
              style={{
                fontFamily: theme.fontBody,
                fontSize: 13,
                color: theme.ink2,
                textAlign: 'center',
              }}
            >
              I tuoi tile appariranno qui
            </Text>
          </View>
        ) : (
          <FlatList
            data={flatTiles}
            keyExtractor={(item) => (item.type === 'header' ? `h-${item.title}` : `t-${item.tile.id}`)}
            renderItem={({ item }) => {
              if (item.type === 'header') {
                return (
                  <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 }}>
                    <Text
                      style={{
                        fontFamily: theme.fontHead,
                        fontSize: 10,
                        color: theme.ink2,
                        letterSpacing: 1.2,
                      }}
                    >
                      {item.title}
                    </Text>
                  </View>
                );
              }
              return (
                <TileItem
                  tile={item.tile}
                  onOpen={(tileId) => router.push(`/tile/${tileId}` as any)}
                  onActionTypeChange={handleActionTypeChange}
                  onDelete={(id) => deleteTileMutation.mutate(id)}
                />
              );
            }}
            onRefresh={() => onRefresh()}
            refreshing={isLoading}
          />
        )}
      </View>

      <ActionTypePicker
        visible={pickerVisible}
        mode={pickerMode}
        onConfirm={handlePickerConfirm}
        onCancel={() => {
          setPickerVisible(false);
          setPendingTileId(null);
        }}
      />

      <TagFilterModal
        visible={tagFilterOpen}
        selectedTagIds={selectedTagIds}
        onChange={setSelectedTagIds}
        onClose={() => setTagFilterOpen(false)}
      />

      <FilterPickerModal
        visible={actionFilterOpen}
        title="Filtra per Action"
        items={ACTION_FILTER_OPTIONS}
        selected={selectedActionKeys}
        getId={(o) => o.id}
        getLabel={(o) => o.label}
        leading={(o) => {
          const Icon = o.icon;
          return Icon ? (
            <View
              style={{
                width: 22,
                height: 22,
                borderWidth: 2,
                borderColor: theme.border,
                backgroundColor: o.color,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon size={11} color={readableOn(o.color)} strokeWidth={2.4} />
            </View>
          ) : (
            <View
              style={{
                width: 22,
                height: 22,
                borderWidth: 2,
                borderColor: o.color,
              }}
            />
          );
        }}
        onChange={setSelectedActionKeys}
        onClose={() => setActionFilterOpen(false)}
      />

      <FilterPickerModal
        visible={typeFilterOpen}
        title="Filtra per Type"
        items={typeIcons}
        selected={selectedTypeIconIds}
        getId={(t) => t.id}
        getLabel={(t) => t.name}
        leading={(t) => <TypeIconBadge icon={t.icon} color={t.color} theme={theme} />}
        onChange={setSelectedTypeIconIds}
        onClose={() => setTypeFilterOpen(false)}
      />

      <FilterPickerModal
        visible={statusFilterOpen}
        title="Filtra per Status"
        items={statuses}
        selected={selectedStatusIds}
        getId={(s) => s.id}
        getLabel={(s) => s.name}
        leading={(s) => <StatusShapeBadge shape={s.shape} theme={theme} />}
        onChange={setSelectedStatusIds}
        onClose={() => setStatusFilterOpen(false)}
      />
    </View>
  );
}

// ============ Filter pill (Pixel style) ============

function FilterPill({
  icon: Icon,
  label,
  count,
  onPress,
}: {
  icon: typeof IconTag;
  label: string;
  count: number;
  onPress: () => void;
}) {
  const theme = usePixelTheme();
  const active = count > 0;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.8 : 1 })}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          paddingHorizontal: 6,
          paddingVertical: 8,
          borderWidth: 2,
          borderColor: theme.border,
          backgroundColor: active ? theme.accent : theme.surface,
        }}
      >
        <Icon
          size={12}
          color={active ? (theme.onAccent as string) : theme.ink2}
          strokeWidth={2.2}
        />
        <Text
          numberOfLines={1}
          style={{
            fontFamily: theme.fontHead,
            fontSize: 8,
            color: active ? (theme.onAccent as string) : theme.ink2,
            letterSpacing: 1,
          }}
        >
          {label}{active ? ` (${count})` : ''}
        </Text>
      </View>
    </Pressable>
  );
}

// ============ Type icon badge ============

function TypeIconBadge({ icon, color, theme }: { icon: string; color?: string; theme: PixelTheme }) {
  const Comp = (TablerIcons as unknown as Record<string, React.ComponentType<{ size?: number; color?: string }>>)[icon];
  if (!Comp) return null;
  const bg = color || theme.ink2;
  return (
    <View
      style={{
        width: 22,
        height: 22,
        borderWidth: 2,
        borderColor: theme.border,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Comp size={12} color={readableOn(bg)} />
    </View>
  );
}

// ============ Status shape badge ============
// Mini renderer Pixel per il `shape` di una StatusEntity. Quadrato 22×22
// border 2px ink con un glyph unicode dentro che corrisponde alla forma.

const STATUS_SHAPE_GLYPH: Record<string, string> = {
  circle:    '●',
  ring:      '○',
  square:    '■',
  triangle:  '▲',
  diamond:   '◆',
  star:      '★',
  check:     '✓',
  x:         '✕',
  dot:       '•',
  solid:     '■',
  empty:     '·',
};

function StatusShapeBadge({ shape, theme }: { shape: string; theme: PixelTheme }) {
  const glyph = STATUS_SHAPE_GLYPH[shape?.toLowerCase()] ?? '■';
  return (
    <View
      style={{
        width: 22,
        height: 22,
        borderWidth: 2,
        borderColor: theme.border,
        backgroundColor: theme.surface,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontFamily: theme.fontHead, fontSize: 10, color: theme.ink }}>
        {glyph}
      </Text>
    </View>
  );
}
