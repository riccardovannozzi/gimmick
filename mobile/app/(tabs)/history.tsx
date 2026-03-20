import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { IconClock, IconFileText, IconPhoto, IconMicrophone, IconMovie, IconFile, IconTrash, IconCircle, IconBolt, IconCalendar } from '@tabler/icons-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaWrapper } from '@/components/layout/SafeAreaWrapper';
import { sparksApi, tilesApi } from '@/lib/api';
import { captureColors } from '@/constants/colors';
import { useThemeColors } from '@/lib/theme';
import { formatDate, formatFileSize } from '@/utils/formatters';
import { ActionTypeDropdown } from '@/components/ActionTypeDropdown';
import { ActionTypePicker } from '@/components/ActionTypePicker';
import type { Spark, Tile, ActionType } from '@/types';

// ============ Spark helpers ============

const typeIcons: Record<string, typeof IconFileText> = {
  photo: IconPhoto,
  image: IconPhoto,
  video: IconMovie,
  audio_recording: IconMicrophone,
  text: IconFileText,
  file: IconFile,
};

const typeColors: Record<string, string> = {
  photo: captureColors.photo,
  image: captureColors.gallery,
  video: captureColors.video,
  audio_recording: captureColors.voice,
  text: captureColors.text,
  file: captureColors.file,
};

const sparkFilterOptions = [
  { id: 'all', label: 'Tutti' },
  { id: 'photo', label: 'Foto' },
  { id: 'video', label: 'Video' },
  { id: 'audio_recording', label: 'Audio' },
  { id: 'text', label: 'Testo' },
  { id: 'file', label: 'File' },
];

const tileFilterOptions: { id: ActionType | 'all'; label: string }[] = [
  { id: 'all', label: 'Tutti' },
  { id: 'none', label: 'Appunti' },
  { id: 'anytime', label: 'Da fare' },
  { id: 'deadline', label: 'Scadenze' },
  { id: 'event', label: 'Eventi' },
];

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

// ============ SparkItem ============

function SparkItem({ spark, onDelete, colors }: { spark: Spark; onDelete: (id: string) => void; colors: any }) {
  const Icon = typeIcons[spark.type] || IconFileText;
  const iconColor = typeColors[spark.type] || colors.secondary;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 }}>
      <View
        style={{
          width: 44, height: 44, borderRadius: 22,
          backgroundColor: colors.surfaceVariant,
          alignItems: 'center', justifyContent: 'center', marginRight: 14,
        }}
      >
        <Icon size={22} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '500', color: colors.primary }} numberOfLines={1}>
          {spark.file_name || spark.content?.substring(0, 40) || spark.type}
        </Text>
        <Text style={{ fontSize: 13, color: colors.tertiary, marginTop: 2 }}>
          {formatDate(spark.created_at)}
          {spark.file_size ? ` · ${formatFileSize(spark.file_size)}` : ''}
        </Text>
      </View>
      <View
        style={{
          width: 10, height: 10, borderRadius: 5, marginRight: 12,
          borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
          backgroundColor:
            spark.ai_status === 'completed' ? '#22C55E' :
            spark.ai_status === 'processing' ? '#F59E0B' :
            spark.ai_status === 'failed' ? '#EF4444' : '#6B7280',
        }}
      />
      <TouchableOpacity
        onPress={() => onDelete(spark.id)}
        style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}
      >
        <IconTrash size={18} color={colors.tertiary} />
      </TouchableOpacity>
    </View>
  );
}

// ============ TileItem ============

function TileItem({
  tile,
  colors,
  onActionTypeChange,
}: {
  tile: Tile;
  colors: any;
  onActionTypeChange: (tileId: string, actionType: ActionType) => void;
}) {
  const sparkCount = tile.spark_count ?? tile.sparks?.length ?? 0;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, height: 72 }}>
      {/* Action type dropdown */}
      <View style={{ width: 90, marginRight: 10 }}>
        <ActionTypeDropdown
          value={tile.action_type || 'none'}
          onSelect={(type) => onActionTypeChange(tile.id, type)}
          subtitle={formatActionSubtitle(tile)}
        />
      </View>

      {/* Title + description */}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '500', color: colors.primary }} numberOfLines={1}>
          {tile.title || 'Senza titolo'}
        </Text>
        {tile.description ? (
          <Text style={{ fontSize: 13, color: colors.tertiary, marginTop: 2 }} numberOfLines={1}>
            {tile.description}
          </Text>
        ) : null}
      </View>

      {/* Spark count */}
      <View
        style={{
          minWidth: 24, height: 24, borderRadius: 12,
          backgroundColor: colors.surfaceVariant,
          alignItems: 'center', justifyContent: 'center',
          paddingHorizontal: 6, marginLeft: 8,
        }}
      >
        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.secondary }}>
          {sparkCount}
        </Text>
      </View>
    </View>
  );
}

// ============ Main screen ============

type ViewMode = 'sparks' | 'tiles';

export default function HistoryScreen() {
  const colors = useThemeColors();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>('tiles');
  const [activeFilter, setActiveFilter] = useState('all');

  // Picker state
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerMode, setPickerMode] = useState<'deadline' | 'event'>('deadline');
  const [pendingTileId, setPendingTileId] = useState<string | null>(null);

  // ---- Sparks data ----
  const { data: sparksData, isLoading: sparksLoading, refetch: refetchSparks } = useQuery({
    queryKey: ['sparks', { page: 1, limit: 50 }],
    queryFn: () => sparksApi.list({ page: 1, limit: 50 }),
    enabled: viewMode === 'sparks',
  });

  // ---- Tiles data ----
  const { data: tilesData, isLoading: tilesLoading, refetch: refetchTiles } = useQuery({
    queryKey: ['tiles', { page: 1, limit: 50 }],
    queryFn: () => tilesApi.list({ page: 1, limit: 50 }),
    enabled: viewMode === 'tiles',
  });

  const deleteMutation = useMutation({
    mutationFn: sparksApi.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sparks'] }),
  });

  const updateTileMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Parameters<typeof tilesApi.update>[1] }) =>
      tilesApi.update(id, updates),
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
  const filterOptions = viewMode === 'sparks' ? sparkFilterOptions : tileFilterOptions;

  const allSparks = sparksData?.data || [];
  const filteredSparks =
    activeFilter === 'all'
      ? allSparks
      : allSparks.filter((m: Spark) => m.type === activeFilter || (activeFilter === 'photo' && m.type === 'image'));

  const allTiles: Tile[] = tilesData?.data || [];
  const filteredTiles =
    activeFilter === 'all'
      ? allTiles
      : allTiles.filter((t: Tile) => (t.action_type || 'none') === activeFilter);

  // ---- Grouped data ----
  const groupedSparks = useMemo(() => groupByDate(filteredSparks), [filteredSparks]);
  const groupedTiles = useMemo(() => groupByDate(filteredTiles), [filteredTiles]);

  const flatSparks = useMemo(() => {
    const result: ({ type: 'header'; title: string } | { type: 'spark'; spark: Spark })[] = [];
    for (const group of groupedSparks) {
      result.push({ type: 'header', title: group.title });
      for (const spark of group.data) result.push({ type: 'spark', spark });
    }
    return result;
  }, [groupedSparks]);

  const flatTiles = useMemo(() => {
    const result: ({ type: 'header'; title: string } | { type: 'tile'; tile: Tile })[] = [];
    for (const group of groupedTiles) {
      result.push({ type: 'header', title: group.title });
      for (const tile of group.data) result.push({ type: 'tile', tile });
    }
    return result;
  }, [groupedTiles]);

  const isLoading = viewMode === 'sparks' ? sparksLoading : tilesLoading;
  const isEmpty = viewMode === 'sparks' ? filteredSparks.length === 0 : filteredTiles.length === 0;
  const onRefresh = viewMode === 'sparks' ? refetchSparks : refetchTiles;

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background1 }}>
      <View className="flex-1">
        {/* View mode toggle */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8, gap: 0 }}>
          {(['tiles', 'sparks'] as ViewMode[]).map((m) => {
            const isActive = viewMode === m;
            return (
              <TouchableOpacity
                key={m}
                onPress={() => {
                  setViewMode(m);
                  setActiveFilter('all');
                }}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  borderBottomWidth: 2,
                  borderBottomColor: isActive ? colors.accent : 'transparent',
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: isActive ? colors.accent : colors.tertiary,
                  }}
                >
                  {m === 'tiles' ? 'Tiles' : 'Sparks'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Filter chips */}
        <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={filterOptions}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const isActive = activeFilter === item.id;
              return (
                <TouchableOpacity
                  onPress={() => setActiveFilter(item.id)}
                  activeOpacity={0.7}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 20,
                    backgroundColor: isActive ? colors.accentContainer : colors.surfaceVariant,
                    marginRight: 8,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '600',
                      color: isActive ? colors.accent : colors.secondary,
                    }}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>

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
              {viewMode === 'sparks' ? 'Nessuno spark' : 'Nessun tile'}
            </Text>
            <Text style={{ fontSize: 14, color: colors.tertiary, textAlign: 'center' }}>
              {viewMode === 'sparks'
                ? 'I tuoi contenuti catturati appariranno qui'
                : 'I tuoi tile appariranno qui'}
            </Text>
          </View>
        ) : viewMode === 'sparks' ? (
          <FlatList
            data={flatSparks}
            keyExtractor={(item, index) => (item.type === 'header' ? `h-${item.title}` : `s-${item.spark.id}`)}
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
                <SparkItem
                  spark={item.spark}
                  onDelete={(id) => deleteMutation.mutate(id)}
                  colors={colors}
                />
              );
            }}
            onRefresh={() => onRefresh()}
            refreshing={isLoading}
          />
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
                  onActionTypeChange={handleActionTypeChange}
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
    </View>
  );
}
