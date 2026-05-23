/**
 * Full-screen tile detail. Reachable from the Tiles list (history.tsx) on tap.
 *
 * Mirrors the web TileSidebar layout:
 *   - Title (autosave)
 *   - Action: two rows of buttons (NOTES / TO DO; DUE / ALL DAY / TIMED)
 *   - Date / Start / End (visible per action_type)
 *   - Tag (first non-root tag)
 *   - Sparks list + 6 quick-capture buttons (photo / video / gallery / text / voice / file)
 *
 * Type and Status sections from the web version are omitted on mobile —
 * those rely on stores not yet ported (useTypeIcons, useStatuses).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, ActivityIndicator, Modal, Image, Linking } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as TablerIcons from '@tabler/icons-react-native';
import {
  IconTrash,
  IconBolt,
  IconClock,
  IconCalendar,
  IconArrowUp,
  IconHome,
  IconChevronDown,
  IconX,
  IconFolder,
  IconUser,
  IconMapPin,
  IconBookmark,
  IconTag,
  IconCamera,
  IconVideo,
  IconPhoto,
  IconEdit,
  IconMicrophone,
  IconPaperclip,
  IconFileText,
  IconMovie,
  IconFile,
} from '@tabler/icons-react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { SafeAreaWrapper } from '@/components/layout/SafeAreaWrapper';
import { TopNav } from '@/components/layout/TopNav';
import { TileHeaderNav } from '@/components/layout/TileHeaderNav';
import { ActionTypePicker } from '@/components/ActionTypePicker';
import { useHorizontalSwipe } from '@/hooks/useHorizontalSwipe';
import { usePixelTheme } from '@/components/pixel';
import { tilesApi, sparksApi, statusesApi, typeIconsApi, uploadApi, tagsApi, tagTypesApi, type StatusEntity, type TypeIconEntity, type TagTypeEntity } from '@/lib/api';
import { captureColors, captureColorsBg } from '@/constants/colors';
import type { CaptureKey } from '@/constants/pixel-theme';
import type { ActionType, Spark } from '@/types';

// Tag-type metadata — mirrors web sidebar grouping (PROGETTO/PERSONA/CONTESTO/LUOGO/TOPIC).
const TAG_TYPE_ORDER = ['project', 'person', 'context', 'place', 'topic'] as const;
const TAG_TYPE_LABELS: Record<string, string> = {
  project: 'PROGETTO',
  person: 'PERSONA',
  context: 'CONTESTO',
  place: 'LUOGO',
  topic: 'TOPIC',
};
const TAG_TYPE_ICONS: Record<string, typeof IconFolder> = {
  project: IconFolder,
  person: IconUser,
  context: IconTag,
  place: IconMapPin,
  topic: IconBookmark,
};
const TAG_TYPE_COLORS: Record<string, string> = {
  project: '#5B8DEF',  // blue (capture photo)
  person: '#6FCF97',   // green (capture text)
  context: '#F2C94C',  // yellow (capture file)
  place: '#EF4444',    // red (capture voice)
  topic: '#AB9FF2',    // purple (capture gallery)
};

// Quick-capture row — creation only. Spark management (list/delete/ai-status)
// lives on the desktop client, but capture flows belong here.
const QUICK_CAPTURE: { key: string; icon: typeof IconCamera; color: string; bg: string; route: string }[] = [
  { key: 'photo', icon: IconCamera, color: captureColors.photo, bg: captureColorsBg.photo, route: '/capture/photo' },
  { key: 'video', icon: IconVideo, color: captureColors.video, bg: captureColorsBg.video, route: '/capture/video' },
  { key: 'gallery', icon: IconPhoto, color: captureColors.gallery, bg: captureColorsBg.gallery, route: '/capture/gallery' },
  { key: 'text', icon: IconEdit, color: captureColors.text, bg: captureColorsBg.text, route: '/capture/text' },
  { key: 'voice', icon: IconMicrophone, color: captureColors.voice, bg: captureColorsBg.voice, route: '/capture/voice' },
  { key: 'file', icon: IconPaperclip, color: captureColors.file, bg: captureColorsBg.file, route: '/capture/file' },
];

/** Pick a readable foreground (white/black) for a given background hex. */
function readableOn(bg: string): string {
  // Strip leading '#', take first 6 chars, parse RGB, compute luminance.
  const hex = bg.replace('#', '').slice(0, 6);
  if (hex.length < 6) return '#FFFFFF';
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.55 ? '#000000' : '#FFFFFF';
}

const TITLE_AUTOSAVE_MS = 600;

// Action vocabulary (matches the web TileSidebar buttons).
type ActionKey = 'none' | 'anytime' | 'deadline' | 'allday' | 'timed';

const ACTION_PRIMARY: { key: ActionKey; label: string; icon?: typeof IconArrowUp; iconColor?: string }[] = [
  { key: 'none', label: 'NOTES' },
  { key: 'anytime', label: 'TO DO', icon: IconArrowUp },
];

const ACTION_SECONDARY: { key: ActionKey; label: string; icon: typeof IconBolt; color: string }[] = [
  { key: 'deadline', label: 'DUE', icon: IconBolt, color: '#EF4444' },
  { key: 'allday', label: 'ALL DAY', icon: IconCalendar, color: '#F59E0B' },
  { key: 'timed', label: 'TIMED', icon: IconClock, color: '#3B82F6' },
];

// Derive the ActionKey used by the picker from raw tile fields.
function resolveActionKey(tile: { action_type?: ActionType; all_day?: boolean }): ActionKey {
  const at = tile.action_type ?? 'none';
  if (at === 'event') return tile.all_day ? 'allday' : 'timed';
  if (at === 'deadline') return 'deadline';
  if (at === 'anytime') return 'anytime';
  return 'none';
}

// Convert local Date → ISO string (for backend persistence).
function isoFromDate(d: Date): string {
  return d.toISOString();
}

// Display helpers.
function fmtDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
function fmtTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function TileDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = usePixelTheme();
  const colors = {
    border: theme.border,
    tertiary: theme.ink2,
    secondary: theme.ink2,
    primary: theme.ink,
    accent: theme.accent,
    onAccent: theme.onAccent,
    background1: theme.bg1,
    background2: theme.bg2,
    background3: theme.bg3,
    surfaceVariant: theme.surface,
    error: theme.cap.voice,
    success: theme.cap.text,
    warning: theme.cap.file,
    accentContainer: theme.bg2,
    outline: theme.border,
    overlay: 'rgba(0,0,0,0.5)',
  } as const;
  const queryClient = useQueryClient();

  const tileQuery = useQuery({
    queryKey: ['tile', id],
    queryFn: () => tilesApi.get(id!),
    enabled: !!id,
  });
  const tile = tileQuery.data?.data;

  // Refetch whenever the screen regains focus — picks up new sparks just
  // created via the capture flow without requiring manual reload.
  useFocusEffect(
    useCallback(() => {
      tileQuery.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]),
  );

  const [title, setTitle] = useState('');
  useEffect(() => {
    if (tile?.title !== undefined) setTitle(tile.title ?? '');
  }, [tile?.title]);

  const updateMutation = useMutation({
    mutationFn: (updates: Parameters<typeof tilesApi.update>[1]) => tilesApi.update(id!, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tile', id] });
      queryClient.invalidateQueries({ queryKey: ['tiles'] });
    },
  });

  // Autosave title (debounced).
  useEffect(() => {
    if (!tile) return;
    if (title === (tile.title ?? '')) return;
    const t = setTimeout(() => updateMutation.mutate({ title }), TITLE_AUTOSAVE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title]);

  // ─── Type icons (per-user list + current tile assignment) ───
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
  const currentTypeIconId = useMemo(() => {
    const rows = typeAssignmentsQuery.data?.data ?? [];
    return rows.find((r) => r.tile_id === id)?.type_icon_id ?? null;
  }, [typeAssignmentsQuery.data, id]);
  const currentTypeIcon = typeIcons.find((t) => t.id === currentTypeIconId) ?? null;

  // ─── Spark mutations (delete + edit text) ───
  const deleteSparkMutation = useMutation({
    mutationFn: (sparkId: string) => sparksApi.delete(sparkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tile', id] });
    },
  });

  const updateSparkMutation = useMutation({
    mutationFn: ({ sparkId, updates }: { sparkId: string; updates: Parameters<typeof sparksApi.update>[1] }) =>
      sparksApi.update(sparkId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tile', id] });
    },
  });

  // Inline text-spark editor state.
  const [editingSparkId, setEditingSparkId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');

  const assignTypeMutation = useMutation({
    mutationFn: (typeIconId: string | null) => typeIconsApi.assign(id!, typeIconId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['type-icons', 'assignments'] });
    },
  });

  // ─── Statuses (per-user list + current tile status) ───
  const statusesQuery = useQuery({
    queryKey: ['statuses'],
    queryFn: () => statusesApi.list(),
    staleTime: 5 * 60 * 1000,
  });
  const statuses: StatusEntity[] = statusesQuery.data?.data ?? [];
  const currentStatus = statuses.find((s) => s.id === tile?.status_id) ?? null;

  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [statusPickerOpen, setStatusPickerOpen] = useState(false);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);

  // ─── Tag picker — list of user's non-root tags, single selection ───
  const tagsListQuery = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagsApi.list(),
    staleTime: 5 * 60 * 1000,
    enabled: tagPickerOpen,
  });
  const availableTags = (tagsListQuery.data?.data ?? []).filter((t) => !t.is_root);

  // User's custom tag-types (HOME, LAVORO, custom names, etc. — each with
  // its own emoji/color). Fetched once and cached; falls back to the
  // canonical 5 if the user hasn't created any.
  const tagTypesQuery = useQuery({
    queryKey: ['tag-types'],
    queryFn: () => tagTypesApi.list(),
    staleTime: 5 * 60 * 1000,
    enabled: tagPickerOpen,
  });
  const tagTypes: TagTypeEntity[] = tagTypesQuery.data?.data ?? [];
  const tagTypeBySlug = useMemo(() => {
    const map = new Map<string, TagTypeEntity>();
    for (const tt of tagTypes) map.set(tt.slug, tt);
    return map;
  }, [tagTypes]);

  // Replaces the current non-root tag association of this tile.
  // Per project convention (single-tag-per-tile): untag current, then tag new.
  const setTagMutation = useMutation({
    mutationFn: async (newTagId: string | null) => {
      if (!id || !tile) return;
      const oldId =
        (tile.tags ?? []).find((t) => !t.is_root && t.name !== 'GIMMICK')?.id ?? null;
      if (oldId && oldId !== newTagId) {
        await tagsApi.untagTile(oldId, id).catch(() => {});
      }
      if (newTagId && newTagId !== oldId) {
        await tagsApi.tagTiles(newTagId, [id]);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tile', id] });
      queryClient.invalidateQueries({ queryKey: ['tiles'] });
    },
  });

  // ─── Action change handlers ───
  const applyAction = useCallback(
    (key: ActionKey) => {
      if (!tile) return;
      const now = new Date();
      switch (key) {
        case 'none':
          updateMutation.mutate({
            action_type: 'none',
            start_at: null,
            end_at: null,
            is_event: false,
            all_day: false,
          });
          return;
        case 'anytime':
          updateMutation.mutate({
            action_type: 'anytime',
            start_at: null,
            end_at: null,
            is_event: false,
            all_day: false,
          });
          return;
        case 'deadline': {
          const start = tile.start_at ? new Date(tile.start_at) : now;
          updateMutation.mutate({
            action_type: 'deadline',
            start_at: isoFromDate(start),
            end_at: null,
            is_event: false,
            all_day: false,
          });
          return;
        }
        case 'allday': {
          const start = tile.start_at ? new Date(tile.start_at) : now;
          // All-day → snap to midnight + end at 23:59:59.
          const s = new Date(start);
          s.setHours(0, 0, 0, 0);
          const e = new Date(s);
          e.setHours(23, 59, 59, 0);
          updateMutation.mutate({
            action_type: 'event',
            start_at: isoFromDate(s),
            end_at: isoFromDate(e),
            is_event: true,
            all_day: true,
          });
          return;
        }
        case 'timed': {
          const start = tile.start_at ? new Date(tile.start_at) : now;
          const end = tile.end_at ? new Date(tile.end_at) : new Date(start.getTime() + 3600000);
          updateMutation.mutate({
            action_type: 'event',
            start_at: isoFromDate(start),
            end_at: isoFromDate(end),
            is_event: true,
            all_day: false,
          });
          return;
        }
      }
    },
    [tile, updateMutation],
  );

  // ─── Date / Time picker (reuses the existing ActionTypePicker bottom sheet
  //      so we don't depend on @react-native-community/datetimepicker, which
  //      isn't included in the Expo Go SDK 54 binary). ───
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerMode, setPickerMode] = useState<'deadline' | 'event'>('event');
  const [pickerTab, setPickerTab] = useState<'date' | 'start' | 'end'>('date');

  /** Open the picker on a specific tab — Date/Start/End fields in the form
   *  route their tap straight to the matching pane in the bottom sheet.
   *  `actionKey` is closed over via TDZ-safe lookup (declared via useMemo
   *  below this callback) — empty deps mirrors the original behaviour. */
  const openSchedulePicker = useCallback(
    (tab: 'date' | 'start' | 'end' = 'date') => {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      setPickerMode(actionKeyToPickerMode(actionKey));
      setPickerTab(tab);
      setPickerVisible(true);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  // Re-resolved at the call site to use the live `actionKey` — set via the
  // helper below to keep the dep list explicit.
  function actionKeyToPickerMode(k: ActionKey): 'deadline' | 'event' {
    return k === 'deadline' ? 'deadline' : 'event';
  }

  const handlePickerConfirm = useCallback(
    (data: { action_type: ActionType; start_at: string; end_at?: string; all_day?: boolean }) => {
      updateMutation.mutate({
        action_type: data.action_type,
        start_at: data.start_at,
        end_at: data.end_at ?? null,
        is_event: data.action_type === 'event',
        all_day: data.all_day ?? false,
      });
      setPickerVisible(false);
    },
    [updateMutation],
  );

  // ─── Derived values ───
  const actionKey: ActionKey = useMemo(
    () => (tile ? resolveActionKey(tile) : 'none'),
    [tile],
  );
  const startDate = tile?.start_at ? new Date(tile.start_at) : null;
  const endDate = tile?.end_at ? new Date(tile.end_at) : null;
  const showDateRow = actionKey === 'deadline' || actionKey === 'allday' || actionKey === 'timed';
  const showTimeRow = actionKey === 'timed';
  const primaryTag = (tile?.tags ?? []).find((t) => !t.is_root && t.name !== 'GIMMICK') ?? null;

  // Swipe-left → LIST, swipe-right → back to the previous screen (tile list).
  // Mirrors the arrow buttons in the header.
  const swipe = useHorizontalSwipe({
    onSwipeLeft: () => router.push(`/tile/${id}/list` as any),
    onSwipeRight: () => router.back(),
  });

  if (tileQuery.isLoading || !tile) {
    return (
      <SafeAreaWrapper edges={['bottom']}>
        <TopNav activePath="/history" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaWrapper>
    );
  }

  return (
    <SafeAreaWrapper edges={['bottom']}>
      <TopNav activePath="/history" />
      <GestureDetector gesture={swipe}>
      <View style={{ flex: 1, backgroundColor: colors.background1 }}>
        {/* Header — TILES (square) | EDIT (active) | LIST | FLOW */}
        <TileHeaderNav
          colors={colors}
          active="edit"
          onTiles={() => router.replace('/history' as any)}
          onEdit={() => { /* already here */ }}
          onList={() => router.push(`/tile/${id}/list` as any)}
          onFlow={() => router.push(`/tile/${id}/flow` as any)}
        />

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {/* Title */}
          <SectionLabel text="Title" colors={colors} />
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Senza titolo"
            placeholderTextColor={colors.tertiary}
            multiline
            style={{
              backgroundColor: colors.background2,
              borderRadius: 0,
              borderWidth: 2,
              borderColor: colors.border,
              padding: 12,
              fontSize: 16,
              color: colors.primary,
              minHeight: 64,
              textAlignVertical: 'top',
            }}
          />

          {/* Action */}
          <SectionLabel text="Action" colors={colors} top={20} />
          {/* Row 1: NOTES / TO DO */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
            {ACTION_PRIMARY.map((opt) => {
              const isActive = actionKey === opt.key;
              const Icon = opt.icon;
              return (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => applyAction(opt.key)}
                  activeOpacity={0.7}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    paddingVertical: 14,
                    borderRadius: 0,
                    backgroundColor: isActive ? colors.surfaceVariant : colors.background2,
                    borderWidth: 1.5,
                    borderColor: isActive ? colors.primary : 'transparent',
                  }}
                >
                  {Icon && (
                    <View
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 0,
                        backgroundColor: '#71717A',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon size={11} color="#fff" />
                    </View>
                  )}
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary, letterSpacing: 0.5 }}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {/* Row 2: DUE / ALL DAY / TIMED */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {ACTION_SECONDARY.map((opt) => {
              const isActive = actionKey === opt.key;
              const Icon = opt.icon;
              return (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => applyAction(opt.key)}
                  activeOpacity={0.7}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    paddingVertical: 14,
                    borderRadius: 0,
                    backgroundColor: colors.background2,
                    borderWidth: 1.5,
                    borderColor: isActive ? opt.color : 'transparent',
                  }}
                >
                  <View
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 0,
                      backgroundColor: opt.color,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon size={11} color="#fff" />
                  </View>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '700',
                      color: isActive ? opt.color : colors.primary,
                      letterSpacing: 0.5,
                    }}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Date / Start / End — each field opens the picker on its own tab. */}
          {showDateRow && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
              <View style={{ flex: 1 }}>
                <SectionLabel text="Date" colors={colors} small />
                <PickerField
                  value={startDate ? fmtDate(startDate) : '—'}
                  onPress={() => openSchedulePicker('date')}
                  colors={colors}
                />
              </View>
              {showTimeRow && (
                <>
                  <View style={{ flex: 1 }}>
                    <SectionLabel text="Start" colors={colors} small />
                    <PickerField
                      value={startDate ? fmtTime(startDate) : '—'}
                      onPress={() => openSchedulePicker('start')}
                      colors={colors}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <SectionLabel text="End" colors={colors} small />
                    <PickerField
                      value={endDate ? fmtTime(endDate) : '—'}
                      onPress={() => openSchedulePicker('end')}
                      colors={colors}
                    />
                  </View>
                </>
              )}
            </View>
          )}

          {/* Tag — tappable field that opens the tag picker (single-select). */}
          <SectionLabel text="Tag" colors={colors} top={20} />
          <TouchableOpacity
            onPress={() => setTagPickerOpen(true)}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: colors.background2,
              borderRadius: 0,
              borderWidth: 2,
              borderColor: colors.border,
              paddingHorizontal: 12,
              paddingVertical: 12,
            }}
          >
            {primaryTag ? (() => {
              const customType = tagTypeBySlug.get(primaryTag.tag_type ?? '');
              const tagColor = customType?.color ?? TAG_TYPE_COLORS[primaryTag.tag_type ?? ''] ?? captureColors.file;
              return (
                <>
                  <TagTypeIcon emoji={customType?.emoji} fallbackSlug={primaryTag.tag_type} color={tagColor} size={16} />
                  <Text style={{ flex: 1, fontSize: 14, color: colors.primary }}>{primaryTag.name}</Text>
                </>
              );
            })() : (
              <Text style={{ flex: 1, fontSize: 14, color: colors.tertiary, fontStyle: 'italic' }}>
                Seleziona tag…
              </Text>
            )}
            <IconChevronDown size={14} color={colors.tertiary} />
          </TouchableOpacity>

          {/* Type — tappable field that opens the type-icon picker */}
          <SectionLabel text="Type" colors={colors} top={20} />
          <TouchableOpacity
            onPress={() => setTypePickerOpen(true)}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              backgroundColor: colors.background2,
              borderRadius: 0,
              borderWidth: 2,
              borderColor: colors.border,
              paddingHorizontal: 12,
              paddingVertical: 12,
            }}
          >
            {currentTypeIcon ? (
              <>
                <TypeIconBadge icon={currentTypeIcon.icon} color={currentTypeIcon.color} />
                <Text style={{ flex: 1, fontSize: 14, color: colors.primary }}>
                  {currentTypeIcon.name}
                </Text>
              </>
            ) : (
              <Text style={{ flex: 1, fontSize: 14, color: colors.tertiary, fontStyle: 'italic' }}>
                Seleziona tipo…
              </Text>
            )}
            <IconChevronDown size={14} color={colors.tertiary} />
          </TouchableOpacity>

          {/* Status — tappable field that opens the status picker */}
          <SectionLabel text="Status" colors={colors} top={20} />
          <TouchableOpacity
            onPress={() => setStatusPickerOpen(true)}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              backgroundColor: colors.background2,
              borderRadius: 0,
              borderWidth: 2,
              borderColor: colors.border,
              paddingHorizontal: 12,
              paddingVertical: 12,
            }}
          >
            {currentStatus ? (
              <>
                <View
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 0,
                    backgroundColor: '#A1A1AA',
                  }}
                />
                <Text style={{ flex: 1, fontSize: 14, color: colors.primary }}>
                  {currentStatus.name}
                </Text>
              </>
            ) : (
              <Text style={{ flex: 1, fontSize: 14, color: colors.tertiary, fontStyle: 'italic' }}>
                Seleziona status…
              </Text>
            )}
            <IconChevronDown size={14} color={colors.tertiary} />
          </TouchableOpacity>

          {/* Sparks — capture only (creazione). La gestione della lista
              (delete / AI status / reindex) resta sul desktop. */}
          <SectionLabel
            text={`Sparks (${tile.sparks?.length ?? 0})`}
            colors={colors}
            top={20}
          />
          {/* Six compact pills — height matches the other Tag/Type/Status
              fields so the row sits flush in the narrow sidebar instead of
              ballooning to six big squares. */}
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {QUICK_CAPTURE.map((qc) => {
              const Icon = qc.icon;
              const key = qc.key as CaptureKey;
              const tintBg = theme.tint[key];
              const accent = theme.cap[key];
              return (
                <TouchableOpacity
                  key={qc.key}
                  onPress={() => router.push(`${qc.route}?tile=${id}` as any)}
                  activeOpacity={0.7}
                  style={{
                    flex: 1,
                    height: 48,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 2,
                    borderColor: theme.border,
                    backgroundColor: tintBg,
                    borderRadius: 0,
                  }}
                >
                  <Icon size={20} color={accent} strokeWidth={2} />
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Read-only spark previews — the user wanted to SEE spark content
              even though management (delete/AI status) lives only on desktop. */}
          {(tile.sparks ?? []).map((spark: Spark) => (
            <SparkPreview
              key={spark.id}
              spark={spark}
              colors={colors}
              onDelete={() => deleteSparkMutation.mutate(spark.id)}
              onEditText={() => {
                setEditingSparkId(spark.id);
                setEditDraft(spark.content ?? '');
              }}
            />
          ))}
        </ScrollView>

        {/* Schedule picker moved to a sibling of TopNav (after the
            GestureDetector) so its BottomSheet container is the full
            SafeAreaWrapper — that's what lets `topInset` position the sheet
            to sit just below TopNav. */}

        {/* Type picker modal */}
        <PickerModal
          visible={typePickerOpen}
          title="Tipo"
          onClose={() => setTypePickerOpen(false)}
          colors={colors}
        >
          <PickerRow
            label="(Nessuno)"
            isActive={!currentTypeIcon}
            onPress={() => {
              assignTypeMutation.mutate(null);
              setTypePickerOpen(false);
            }}
            colors={colors}
          />
          {typeIcons.map((ti) => (
            <PickerRow
              key={ti.id}
              label={ti.name}
              leading={<TypeIconBadge icon={ti.icon} color={ti.color} />}
              isActive={currentTypeIcon?.id === ti.id}
              onPress={() => {
                assignTypeMutation.mutate(ti.id);
                setTypePickerOpen(false);
              }}
              colors={colors}
            />
          ))}
        </PickerModal>

        {/* Status picker modal */}
        <PickerModal
          visible={statusPickerOpen}
          title="Status"
          onClose={() => setStatusPickerOpen(false)}
          colors={colors}
        >
          <PickerRow
            label="(Nessuno)"
            isActive={!currentStatus}
            onPress={() => {
              updateMutation.mutate({ status_id: null });
              setStatusPickerOpen(false);
            }}
            colors={colors}
          />
          {statuses.map((s) => (
            <PickerRow
              key={s.id}
              label={s.name}
              leading={
                <View
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 0,
                    backgroundColor: '#A1A1AA',
                  }}
                />
              }
              isActive={currentStatus?.id === s.id}
              onPress={() => {
                updateMutation.mutate({ status_id: s.id });
                setStatusPickerOpen(false);
              }}
              colors={colors}
            />
          ))}
        </PickerModal>

        {/* Tag picker modal — single-select replace, grouped by tag_type */}
        <PickerModal
          visible={tagPickerOpen}
          title="Tag"
          onClose={() => setTagPickerOpen(false)}
          colors={colors}
        >
          <PickerRow
            label="(Nessuno)"
            isActive={!primaryTag}
            onPress={() => {
              setTagMutation.mutate(null);
              setTagPickerOpen(false);
            }}
            colors={colors}
          />
          {(() => {
            // Build the type order: canonical first, then any extra types
            // present in the user's tags (alphabetical), then untyped bucket.
            const presentTypes = new Set(availableTags.map((t) => t.tag_type).filter(Boolean));
            const extraTypes = [...presentTypes]
              .filter((tp) => !(TAG_TYPE_ORDER as readonly string[]).includes(tp))
              .sort();
            const orderedTypes = [...TAG_TYPE_ORDER, ...extraTypes];
            const hasUntyped = availableTags.some((t) => !t.tag_type);
            if (hasUntyped) orderedTypes.push('__untyped__');

            return orderedTypes.map((tp) => {
              const groupTags =
                tp === '__untyped__'
                  ? availableTags.filter((t) => !t.tag_type)
                  : availableTags.filter((t) => t.tag_type === tp);
              if (groupTags.length === 0) return null;
              // Prefer the user's custom tag-type metadata (emoji/color/name)
              // and fall back to the canonical mapping when unavailable.
              const customType = tagTypeBySlug.get(tp);
              const label = tp === '__untyped__'
                ? 'ALTRO'
                : (customType?.name?.toUpperCase() ?? TAG_TYPE_LABELS[tp] ?? tp.toUpperCase());
              const iconColor = customType?.color ?? TAG_TYPE_COLORS[tp] ?? captureColors.file;
              return (
                <View key={tp} style={{ marginTop: 12 }}>
                  {/* Section header — type-specific icon + colored accent.
                      Custom emoji wins over the canonical Tabler fallback. */}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                    }}
                  >
                    <TagTypeIcon emoji={customType?.emoji} fallbackSlug={tp} color={iconColor} size={14} />
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '700',
                        letterSpacing: 0.5,
                        color: iconColor,
                      }}
                    >
                      {label}
                    </Text>
                  </View>
                  {/* Tags in this section — no leading icon (the type icon
                      is on the section header). Keeps rows clean and avoids
                      visual repetition. */}
                  {groupTags.map((t) => (
                    <PickerRow
                      key={t.id}
                      label={t.name}
                      isActive={primaryTag?.id === t.id}
                      onPress={() => {
                        setTagMutation.mutate(t.id);
                        setTagPickerOpen(false);
                      }}
                      colors={colors}
                    />
                  ))}
                </View>
              );
            });
          })()}
        </PickerModal>

        {/* Text spark editor — saves the new content + invalidates the
            tile cache so the SparkPreview updates immediately. */}
        <Modal
          visible={editingSparkId !== null}
          animationType="slide"
          transparent
          onRequestClose={() => setEditingSparkId(null)}
        >
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <View
              style={{
                backgroundColor: colors.background2,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                paddingBottom: 16,
                maxHeight: '85%',
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: 20,
                  paddingVertical: 16,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <TouchableOpacity onPress={() => setEditingSparkId(null)} hitSlop={8}>
                  <IconX size={20} color={colors.tertiary} />
                </TouchableOpacity>
                <Text style={{ fontSize: 17, fontWeight: '600', color: colors.primary }}>
                  Modifica testo
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    if (!editingSparkId) return;
                    updateSparkMutation.mutate({
                      sparkId: editingSparkId,
                      updates: { content: editDraft },
                    });
                    setEditingSparkId(null);
                  }}
                  hitSlop={8}
                >
                  <Text style={{ fontSize: 15, fontWeight: '600', color: colors.accent }}>
                    Salva
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={{ padding: 16 }}>
                <TextInput
                  value={editDraft}
                  onChangeText={setEditDraft}
                  multiline
                  autoFocus
                  placeholder="Scrivi il contenuto…"
                  placeholderTextColor={colors.tertiary}
                  style={{
                    backgroundColor: colors.background1,
                    borderRadius: 0,
                    borderWidth: 2,
                    borderColor: colors.border,
                    padding: 12,
                    fontSize: 16,
                    color: colors.primary,
                    minHeight: 160,
                    textAlignVertical: 'top',
                  }}
                />
              </View>
            </View>
          </View>
        </Modal>
      </View>
      </GestureDetector>
      {/* Schedule picker — rendered at SafeAreaWrapper level so its sheet
          container spans from below TopNav to the screen bottom. */}
      <ActionTypePicker
        visible={pickerVisible}
        mode={pickerMode}
        initialTab={pickerTab}
        initialDate={startDate ?? undefined}
        initialEndDate={endDate ?? undefined}
        initialAllDay={tile.all_day ?? false}
        onConfirm={handlePickerConfirm}
        onCancel={() => setPickerVisible(false)}
      />
    </SafeAreaWrapper>
  );
}

/** Small badge rendering a Tabler icon by name with the type-icon color. */
function TypeIconBadge({ icon, color }: { icon: string; color?: string }) {
  const Comp = (TablerIcons as unknown as Record<string, React.ComponentType<{ size?: number; color?: string }>>)[icon];
  if (!Comp) return null;
  const bg = color || '#27272A';
  return (
    <View
      style={{
        width: 18,
        height: 18,
        borderRadius: 0,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Comp size={11} color={readableOn(bg)} />
    </View>
  );
}

/**
 * Renders a tag-type icon. `emoji` can be either a Tabler icon name
 * ("IconFolder", "IconHome", …) or a unicode emoji string. Matches the web
 * sidebar's resolveIcon() logic. When no emoji is given, falls back to the
 * canonical Tabler component bound to the slug.
 */
function TagTypeIcon({
  emoji,
  fallbackSlug,
  color,
  size = 14,
}: {
  emoji?: string;
  fallbackSlug?: string;
  color: string;
  size?: number;
}) {
  if (emoji) {
    if (emoji.startsWith('Icon')) {
      const Comp = (TablerIcons as unknown as Record<string, React.ComponentType<{ size?: number; color?: string }>>)[emoji];
      if (Comp) return <Comp size={size} color={color} />;
    }
    return <Text style={{ fontSize: size, color }}>{emoji}</Text>;
  }
  const Fallback = TAG_TYPE_ICONS[fallbackSlug ?? ''] ?? IconTag;
  return <Fallback size={size} color={color} />;
}

/** Generic picker modal with header + scrollable rows. */
function PickerModal({
  visible,
  title,
  onClose,
  colors,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  colors: any;
  children: React.ReactNode;
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <View
          style={{
            backgroundColor: colors.background2,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            maxHeight: '70%',
            paddingBottom: 16,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 20,
              paddingVertical: 16,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <Text style={{ fontSize: 17, fontWeight: '600', color: colors.primary }}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <IconX size={20} color={colors.tertiary} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 8 }}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function PickerRow({
  label,
  leading,
  isActive,
  onPress,
  colors,
}: {
  label: string;
  leading?: React.ReactNode;
  isActive: boolean;
  onPress: () => void;
  colors: any;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 0,
        marginBottom: 4,
        backgroundColor: isActive ? `${colors.accent}1F` : 'transparent',
        borderWidth: 2,
        borderColor: isActive ? colors.accent : 'transparent',
      }}
    >
      {leading}
      <Text style={{ flex: 1, fontSize: 15, color: colors.primary }}>{label}</Text>
    </TouchableOpacity>
  );
}

function SectionLabel({
  text,
  colors,
  top,
  small,
}: {
  text: string;
  colors: any;
  top?: number;
  small?: boolean;
}) {
  return (
    <Text
      style={{
        fontFamily: 'PressStart2P-Regular',
        fontSize: small ? 8 : 9,
        color: colors.tertiary,
        letterSpacing: 1.2,
        marginTop: top ?? 0,
        marginBottom: 8,
      }}
    >
      {text.toUpperCase()}
    </Text>
  );
}

function PickerField({
  value,
  onPress,
  colors,
}: {
  value: string;
  onPress: () => void;
  colors: any;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        backgroundColor: colors.background2,
        borderRadius: 0,
        borderWidth: 2,
        borderColor: colors.border,
        paddingHorizontal: 10,
        paddingVertical: 12,
      }}
    >
      <Text style={{ fontSize: 14, color: colors.primary }}>{value}</Text>
    </TouchableOpacity>
  );
}

/** Read-only spark preview card — mirrors the inline blocks shown in the
 *  web TileSidebar. Text → renders the content; everything else → renders
 *  the file_name or a type label. No delete / no AI status / no actions. */
const SPARK_TYPE_LABEL: Record<string, string> = {
  photo: 'FOTO',
  image: 'IMMAGINE',
  video: 'VIDEO',
  audio_recording: 'AUDIO',
  text: 'TESTO',
  file: 'FILE',
};

const SPARK_TYPE_ICON: Record<string, typeof IconFileText> = {
  photo: IconPhoto,
  image: IconPhoto,
  video: IconMovie,
  audio_recording: IconMicrophone,
  text: IconFileText,
  file: IconFile,
};

const SPARK_TYPE_COLOR: Record<string, string> = {
  photo: captureColors.photo,
  image: captureColors.gallery,
  video: captureColors.video,
  audio_recording: captureColors.voice,
  text: captureColors.text,
  file: captureColors.file,
};

function SparkPreview({
  spark,
  colors,
  onDelete,
  onEditText,
}: {
  spark: Spark;
  colors: any;
  onDelete: () => void;
  onEditText: () => void;
}) {
  const label = SPARK_TYPE_LABEL[spark.type] ?? spark.type.toUpperCase();
  const Icon = SPARK_TYPE_ICON[spark.type] ?? IconFileText;
  const iconColor = SPARK_TYPE_COLOR[spark.type] ?? colors.secondary;
  const editable = spark.type === 'text';
  const isImage = spark.type === 'photo' || spark.type === 'image';
  const isPdf = spark.mime_type === 'application/pdf' || spark.file_name?.toLowerCase().endsWith('.pdf');
  const hasStoragePath = !!spark.storage_path;
  const [confirming, setConfirming] = useState(false);

  // Resolve a short-lived signed URL for media sparks. Cached per
  // storage_path; the backend returns expires_in (default 1h) — within an
  // app session that's plenty.
  const signedUrlQuery = useQuery({
    queryKey: ['spark-signed-url', spark.storage_path],
    queryFn: () => uploadApi.getSignedUrl(spark.storage_path!),
    enabled: hasStoragePath && spark.type !== 'text',
    staleTime: 30 * 60 * 1000,
  });
  const signedUrl = signedUrlQuery.data?.data?.url ?? null;

  // PDF thumbnail signed URL — separate query because the path is different.
  // Backend generates a `.thumb.png` next to the original on indexing.
  const thumbnailUrlQuery = useQuery({
    queryKey: ['spark-thumb-url', spark.thumbnail_path],
    queryFn: () => uploadApi.getSignedUrl(spark.thumbnail_path!),
    enabled: isPdf && !!spark.thumbnail_path,
    staleTime: 30 * 60 * 1000,
  });
  const thumbnailUrl = thumbnailUrlQuery.data?.data?.url ?? null;

  const handleOpen = () => {
    if (signedUrl) Linking.openURL(signedUrl).catch(() => undefined);
  };

  return (
    <View
      style={{
        backgroundColor: colors.background2,
        borderRadius: 0,
        borderWidth: 2,
        borderColor: colors.border,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginTop: 8,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <Icon size={11} color={iconColor} />
        <Text style={{ flex: 1, fontSize: 10, fontWeight: '700', color: colors.tertiary, letterSpacing: 0.5 }}>
          {label}
        </Text>
        {/* Two-tap delete — first tap arms the action, second confirms. */}
        <TouchableOpacity
          onPress={() => {
            if (confirming) {
              onDelete();
              setConfirming(false);
            } else {
              setConfirming(true);
              setTimeout(() => setConfirming(false), 3000);
            }
          }}
          hitSlop={10}
          style={{ padding: 4 }}
        >
          <IconTrash
            size={14}
            color={confirming ? '#EF4444' : colors.tertiary}
            strokeWidth={confirming ? 2.5 : 1.8}
          />
        </TouchableOpacity>
      </View>

      {/* Text body — editable */}
      {spark.type === 'text' && (
        <TouchableOpacity onPress={editable ? onEditText : undefined} activeOpacity={0.6}>
          <Text style={{ fontSize: 14, color: colors.primary }}>
            {spark.content?.trim() || '—'}
          </Text>
          <Text style={{ fontSize: 11, color: colors.tertiary, marginTop: 4, fontStyle: 'italic' }}>
            Tap per modificare
          </Text>
        </TouchableOpacity>
      )}

      {/* Image preview — tap to open full-size in system viewer */}
      {isImage && (
        <>
          {signedUrlQuery.isLoading ? (
            <View
              style={{
                width: '100%',
                height: 200,
                borderRadius: 0,
                backgroundColor: colors.background1,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ActivityIndicator size="small" color={colors.tertiary} />
            </View>
          ) : signedUrl ? (
            <TouchableOpacity onPress={handleOpen} activeOpacity={0.85}>
              <Image
                source={{ uri: signedUrl }}
                style={{
                  width: '100%',
                  height: 200,
                  borderRadius: 0,
                  backgroundColor: colors.background1,
                }}
                resizeMode="cover"
              />
              {spark.file_name && (
                <Text style={{ fontSize: 12, color: colors.tertiary, marginTop: 6 }} numberOfLines={1}>
                  {spark.file_name}
                </Text>
              )}
            </TouchableOpacity>
          ) : (
            <Text style={{ fontSize: 13, color: colors.tertiary, fontStyle: 'italic' }}>
              Anteprima non disponibile
            </Text>
          )}
        </>
      )}

      {/* PDF — inline thumbnail (server-rendered first page) + tap to open
          full file in the system PDF viewer. */}
      {isPdf && !isImage && (
        <TouchableOpacity onPress={handleOpen} activeOpacity={0.85}>
          {thumbnailUrl ? (
            <Image
              source={{ uri: thumbnailUrl }}
              style={{
                width: '100%',
                height: 280,
                borderRadius: 0,
                backgroundColor: colors.background1,
              }}
              resizeMode="contain"
            />
          ) : thumbnailUrlQuery.isLoading || (!spark.thumbnail_path && !signedUrl) ? (
            <View
              style={{
                width: '100%',
                height: 280,
                borderRadius: 0,
                backgroundColor: colors.background1,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ActivityIndicator size="small" color={colors.tertiary} />
              <Text style={{ fontSize: 11, color: colors.tertiary, marginTop: 8 }}>
                {spark.thumbnail_path ? 'Caricamento anteprima…' : 'Anteprima in elaborazione…'}
              </Text>
            </View>
          ) : (
            <View
              style={{
                width: '100%',
                height: 120,
                borderRadius: 0,
                backgroundColor: colors.background1,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconFile size={32} color={colors.tertiary} />
            </View>
          )}
          {spark.file_name && (
            <Text style={{ fontSize: 12, color: colors.tertiary, marginTop: 6 }} numberOfLines={1}>
              {spark.file_name}
            </Text>
          )}
          {signedUrl && (
            <Text style={{ fontSize: 12, color: colors.accent, marginTop: 4, fontWeight: '600' }}>
              Apri ↗
            </Text>
          )}
        </TouchableOpacity>
      )}

      {/* Other non-image, non-pdf media (video / audio / generic file) →
          filename + "Apri" link in system viewer. */}
      {!isImage && !isPdf && spark.type !== 'text' && (
        <TouchableOpacity
          onPress={handleOpen}
          activeOpacity={signedUrl ? 0.6 : 1}
          disabled={!signedUrl}
        >
          {spark.file_name && (
            <Text style={{ fontSize: 14, color: colors.primary }} numberOfLines={2}>
              {spark.file_name}
            </Text>
          )}
          {signedUrlQuery.isLoading ? (
            <Text style={{ fontSize: 11, color: colors.tertiary, marginTop: 4 }}>Caricamento…</Text>
          ) : signedUrl ? (
            <Text style={{ fontSize: 12, color: colors.accent, marginTop: 4, fontWeight: '600' }}>
              Apri ↗
            </Text>
          ) : null}
        </TouchableOpacity>
      )}
    </View>
  );
}
