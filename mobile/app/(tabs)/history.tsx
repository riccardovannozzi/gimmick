import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
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
import { captureColors } from '@/constants/colors';
import { useThemeColors } from '@/lib/theme';
import { ActionTypePicker } from '@/components/ActionTypePicker';
import { TagFilterModal } from '@/components/TagFilterModal';
import { FilterPickerModal } from '@/components/FilterPickerModal';
import type { Tile, ActionType } from '@/types';

// Spark management is desktop-only — this screen lists Tiles exclusively.

// ============ Action filter vocabulary ============
//
// Same 5-key vocabulary used in the SetOptionsAccordion. Each tile resolves
// to exactly one key via `resolveActionKey()`. Multi-select.
type ActionKey = 'none' | 'anytime' | 'deadline' | 'allday' | 'timed';

const ACTION_FILTER_OPTIONS: { id: ActionKey; label: string; color: string; icon?: typeof IconBolt }[] = [
  { id: 'none', label: 'Notes', color: '#71717A' },
  { id: 'anytime', label: 'ToDo', color: captureColors.text, icon: IconArrowUp },
  { id: 'deadline', label: 'Due', color: '#EF4444', icon: IconBolt },
  { id: 'allday', label: 'All Day', color: captureColors.gallery, icon: IconCalendar },
  { id: 'timed', label: 'Timed', color: captureColors.photo, icon: IconClock },
];

function resolveActionKey(tile: Tile): ActionKey {
  const at = tile.action_type ?? 'none';
  if (at === 'event') return tile.all_day ? 'allday' : 'timed';
  if (at === 'deadline') return 'deadline';
  if (at === 'anytime') return 'anytime';
  return 'none';
}

/** Pick a readable foreground (white/black) for a given background hex. */
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
      key = 'Oggi';
    } else if (date.toDateString() === yesterday.toDateString()) {
      key = 'Ieri';
    } else {
      key = date.toLocaleDateString('it-IT', { month: 'long', day: 'numeric' });
    }
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }

  return Object.entries(groups).map(([title, data]) => ({ title, data }));
}

// ============ TileItem ============
//
// Card-style rendering that mirrors the web Kanban/Canvas tile look:
//   - Background tinted from the tile's action_type color
//   - Dashed red border for deadlines
//   - Title (2-line clamp) + scheduled-date subtitle
//   - Bottom row: action badge (tap → action picker) + spark count + delete

const ACTION_BADGE_ICON: Record<string, typeof IconBolt | null> = {
  none: null,
  anytime: IconArrowUp,
  deadline: IconBolt,
  event: IconClock,
  allday: IconCalendar,
};

const ACTION_BADGE_COLOR: Record<string, string> = {
  none: '#71717A',
  anytime: captureColors.text,        // green
  deadline: '#EF4444',                // red
  event: captureColors.photo,         // blue
  allday: captureColors.gallery,      // purple
};

function TileItem({
  tile,
  colors,
  onOpen,
  onActionTypeChange,
  onDelete,
}: {
  tile: Tile;
  colors: any;
  /** Body tap → opens the full-page tile detail. */
  onOpen: (tileId: string) => void;
  /** Action badge tap → opens the action-type picker. */
  onActionTypeChange: (tileId: string, actionType: ActionType) => void;
  onDelete: (id: string) => void;
}) {
  const sparkCount = tile.spark_count ?? tile.sparks?.length ?? 0;
  const actionKey: string = tile.all_day && tile.action_type === 'event'
    ? 'allday'
    : (tile.action_type || 'none');
  const actionColor = ACTION_BADGE_COLOR[actionKey] || colors.secondary;
  const ActionIcon = ACTION_BADGE_ICON[actionKey];
  // bg ≈ 15% alpha tint of the action color (≈ "26" in hex). For 'none'
  // (notes) fall back to the neutral surface so it doesn't bleed grey.
  const tileBg = actionKey === 'none'
    ? colors.background2
    : `${actionColor}26`;
  const subtitle = formatActionSubtitle(tile);
  const isDeadline = actionKey === 'deadline';

  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => onOpen(tile.id)}
        // Tap the body opens the full-page tile detail. Action picker lives
        // on the action badge below (tap target ≈ 32×32) — see web Kanban tile.
        style={{
          backgroundColor: tileBg,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: isDeadline ? '#EF4444' : 'rgba(255,255,255,0.08)',
          borderStyle: isDeadline ? 'dashed' : 'solid',
          padding: 10,
          minHeight: 84,
        }}
      >
        {/* Top row: title + delete */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Text
              style={{ fontSize: 14, fontWeight: '600', color: colors.primary, lineHeight: 18 }}
              numberOfLines={2}
            >
              {tile.title || 'Senza titolo'}
            </Text>
            {subtitle && (
              <Text style={{ fontSize: 12, color: colors.tertiary, marginTop: 2 }}>
                {subtitle}
              </Text>
            )}
          </View>
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation?.(); onDelete(tile.id); }}
            hitSlop={10}
            style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center', marginTop: -4, marginRight: -4 }}
          >
            <IconTrash size={16} color={colors.tertiary} />
          </TouchableOpacity>
        </View>

        {/* Bottom row: action badge (tap → picker) + spark count chip. */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 8,
          }}
        >
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation?.();
              onActionTypeChange(tile.id, tile.action_type || 'none');
            }}
            hitSlop={8}
            // Slightly larger touch area than the visual to keep tap-success
            // high on small badges.
            style={{
              width: 32,
              height: 32,
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: -5,
            }}
          >
            {ActionIcon ? (
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  backgroundColor: actionColor,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ActionIcon size={12} color="#FFFFFF" />
              </View>
            ) : (
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              />
            )}
          </TouchableOpacity>
          {sparkCount > 0 && (
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
                backgroundColor: colors.surfaceVariant,
                borderRadius: 10,
              }}
            >
              <Text style={{ fontSize: 11, color: colors.secondary, fontWeight: '600' }}>
                {sparkCount} spark
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
}

// ============ Main screen ============

export default function HistoryScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  // Multi-select filters (empty = no constraint for that axis).
  const [selectedActionKeys, setSelectedActionKeys] = useState<Set<string>>(new Set());
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [selectedTypeIconIds, setSelectedTypeIconIds] = useState<Set<string>>(new Set());
  const [selectedStatusIds, setSelectedStatusIds] = useState<Set<string>>(new Set());

  // Filter modal visibility.
  const [actionFilterOpen, setActionFilterOpen] = useState(false);
  const [tagFilterOpen, setTagFilterOpen] = useState(false);
  const [typeFilterOpen, setTypeFilterOpen] = useState(false);
  const [statusFilterOpen, setStatusFilterOpen] = useState(false);

  // Picker state (used by the per-tile action-badge tap, not the filter row)
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerMode, setPickerMode] = useState<'deadline' | 'event'>('deadline');
  const [pendingTileId, setPendingTileId] = useState<string | null>(null);

  // ---- Tiles data ----
  // Background polling every 30s while the tab is active — pairs with the
  // focus-refetch below to keep the list fresh without manual reload.
  const { data: tilesData, isLoading: tilesLoading, refetch: refetchTiles } = useQuery({
    queryKey: ['tiles', { page: 1, limit: 50 }],
    queryFn: () => tilesApi.list({ page: 1, limit: 50 }),
    refetchInterval: 30_000,
  });

  // Type icons + assignments — needed for the Type filter and labels.
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
  // Build tile_id → type_icon_id index once per assignments change.
  const typeIconByTile = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of typeAssignments) map.set(row.tile_id, row.type_icon_id);
    return map;
  }, [typeAssignments]);

  // Statuses — needed for the Status filter labels.
  const statusesQuery = useQuery({
    queryKey: ['statuses'],
    queryFn: () => statusesApi.list(),
    staleTime: 5 * 60 * 1000,
  });
  const statuses: StatusEntity[] = statusesQuery.data?.data ?? [];

  // Refetch every time this tab gains focus so newly-created tiles appear
  // immediately. The shared QueryClient has a 5-min staleTime, which would
  // otherwise serve stale data when re-entering the tab.
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

  // ---- Action type change handler ----
  const handleActionTypeChange = useCallback(
    (tileId: string, actionType: ActionType) => {
      if (actionType === 'deadline' || actionType === 'event') {
        setPendingTileId(tileId);
        setPickerMode(actionType === 'deadline' ? 'deadline' : 'event');
        setPickerVisible(true);
      } else {
        // none or anytime — clear dates
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

  // ---- Filter logic ----
  // OR within each axis (any-of), AND across axes (each axis must match).
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

  // ---- Grouped data ----
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

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background1 }}>
      <View className="flex-1">
        {/* Filter row — 4 pills (Action / Tag / Type / Status). Each opens a
            multi-select bottom-sheet picker. Horizontal scroll keeps the row
            usable when counts widen the labels (e.g. "Action (3)"). */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: 8,
            gap: 8,
          }}
        >
          <FilterPill
            icon={IconBolt}
            label="Action"
            count={selectedActionKeys.size}
            onPress={() => setActionFilterOpen(true)}
            colors={colors}
          />
          <FilterPill
            icon={IconTag}
            label="Tag"
            count={selectedTagIds.size}
            onPress={() => setTagFilterOpen(true)}
            colors={colors}
          />
          <FilterPill
            icon={IconBoxMultiple}
            label="Type"
            count={selectedTypeIconIds.size}
            onPress={() => setTypeFilterOpen(true)}
            colors={colors}
          />
          <FilterPill
            icon={IconCircleDot}
            label="Status"
            count={selectedStatusIds.size}
            onPress={() => setStatusFilterOpen(true)}
            colors={colors}
          />
        </ScrollView>

        {/* Content */}
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : isEmpty ? (
          <View className="flex-1 items-center justify-center px-8">
            <View
              style={{
                width: 80, height: 80, borderRadius: 40,
                backgroundColor: colors.surfaceVariant,
                alignItems: 'center', justifyContent: 'center', marginBottom: 16,
              }}
            >
              <IconClock size={36} color={colors.tertiary} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.primary, textAlign: 'center', marginBottom: 8 }}>
              Nessun tile
            </Text>
            <Text style={{ fontSize: 14, color: colors.tertiary, textAlign: 'center' }}>
              I tuoi tile appariranno qui
            </Text>
          </View>
        ) : (
          <FlatList
            data={flatTiles}
            keyExtractor={(item, index) => (item.type === 'header' ? `h-${item.title}` : `t-${item.tile.id}`)}
            renderItem={({ item }) => {
              if (item.type === 'header') {
                return (
                  <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.tertiary, letterSpacing: 0.5 }}>
                      {item.title}
                    </Text>
                  </View>
                );
              }
              return (
                <TileItem
                  tile={item.tile}
                  colors={colors}
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

      {/* Action type picker bottom sheet */}
      <ActionTypePicker
        visible={pickerVisible}
        mode={pickerMode}
        onConfirm={handlePickerConfirm}
        onCancel={() => {
          setPickerVisible(false);
          setPendingTileId(null);
        }}
      />

      {/* Tag filter — full-screen modal grouped by tag_type */}
      <TagFilterModal
        visible={tagFilterOpen}
        selectedTagIds={selectedTagIds}
        onChange={setSelectedTagIds}
        onClose={() => setTagFilterOpen(false)}
      />

      {/* Action filter — multi-select over the 5 action keys. */}
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
                borderRadius: 11,
                backgroundColor: o.color,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon size={12} color="#FFFFFF" />
            </View>
          ) : (
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                borderWidth: 1.5,
                borderColor: o.color,
              }}
            />
          );
        }}
        onChange={setSelectedActionKeys}
        onClose={() => setActionFilterOpen(false)}
      />

      {/* Type filter — multi-select over the user's type icons. */}
      <FilterPickerModal
        visible={typeFilterOpen}
        title="Filtra per Type"
        items={typeIcons}
        selected={selectedTypeIconIds}
        getId={(t) => t.id}
        getLabel={(t) => t.name}
        leading={(t) => <TypeIconBadge icon={t.icon} color={t.color} />}
        onChange={setSelectedTypeIconIds}
        onClose={() => setTypeFilterOpen(false)}
      />

      {/* Status filter — multi-select over the user's statuses. */}
      <FilterPickerModal
        visible={statusFilterOpen}
        title="Filtra per Status"
        items={statuses}
        selected={selectedStatusIds}
        getId={(s) => s.id}
        getLabel={(s) => s.name}
        leading={() => (
          <View
            style={{
              width: 14,
              height: 14,
              borderRadius: 3,
              backgroundColor: '#A1A1AA',
            }}
          />
        )}
        onChange={setSelectedStatusIds}
        onClose={() => setStatusFilterOpen(false)}
      />
    </View>
  );
}

// ============ Filter pill (header row) ============

function FilterPill({
  icon: Icon,
  label,
  count,
  onPress,
  colors,
}: {
  icon: typeof IconTag;
  label: string;
  count: number;
  onPress: () => void;
  colors: any;
}) {
  const active = count > 0;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: active ? `${colors.accent}26` : colors.surfaceVariant,
        borderWidth: 1,
        borderColor: active ? colors.accent : 'transparent',
      }}
    >
      <Icon size={14} color={active ? colors.accent : colors.secondary} />
      <Text
        style={{
          fontSize: 13,
          fontWeight: '600',
          color: active ? colors.accent : colors.secondary,
        }}
      >
        {label}{active ? ` (${count})` : ''}
      </Text>
    </TouchableOpacity>
  );
}

// ============ Type icon badge (used in the Type filter rows) ============

function TypeIconBadge({ icon, color }: { icon: string; color?: string }) {
  const Comp = (TablerIcons as unknown as Record<string, React.ComponentType<{ size?: number; color?: string }>>)[icon];
  if (!Comp) return null;
  const bg = color || '#27272A';
  return (
    <View
      style={{
        width: 22,
        height: 22,
        borderRadius: 4,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Comp size={12} color={readableOn(bg)} />
    </View>
  );
}
