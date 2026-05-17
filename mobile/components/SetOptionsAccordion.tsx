/**
 * Accordion shown under the "Set options" button on the Home screen. Lets the
 * user pre-set tile metadata (Action, Date, Tag, Type, Status) for the buffer
 * items that are about to be uploaded. Mirrors the picker UX used in the tile
 * detail screen (mobile/app/tile/[id].tsx) so the two flows feel identical.
 */
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
} from 'react-native';
import * as TablerIcons from '@tabler/icons-react-native';
import {
  IconArrowUp,
  IconBolt,
  IconCalendar,
  IconClock,
  IconChevronDown,
  IconX,
  IconFolder,
  IconUser,
  IconMapPin,
  IconBookmark,
  IconTag,
} from '@tabler/icons-react-native';
import { useQuery } from '@tanstack/react-query';
import { ActionTypePicker } from '@/components/ActionTypePicker';
import {
  statusesApi,
  typeIconsApi,
  tagsApi,
  tagTypesApi,
  type StatusEntity,
  type TypeIconEntity,
  type TagTypeEntity,
} from '@/lib/api';
import type { ActionType, Tag as TagInterface } from '@/types';

// Action vocabulary — same five buttons as the tile detail screen.
type ActionKey = 'none' | 'anytime' | 'deadline' | 'allday' | 'timed';

const ACTION_PRIMARY: { key: ActionKey; label: string; icon?: typeof IconArrowUp }[] = [
  { key: 'none', label: 'NOTES' },
  { key: 'anytime', label: 'TO DO', icon: IconArrowUp },
];
const ACTION_SECONDARY: { key: ActionKey; label: string; icon: typeof IconBolt; color: string }[] = [
  { key: 'deadline', label: 'DUE', icon: IconBolt, color: '#EF4444' },
  { key: 'allday', label: 'ALL DAY', icon: IconCalendar, color: '#F59E0B' },
  { key: 'timed', label: 'TIMED', icon: IconClock, color: '#3B82F6' },
];

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
  project: '#5B8DEF',
  person: '#6FCF97',
  context: '#F2C94C',
  place: '#EF4444',
  topic: '#AB9FF2',
};

export interface TileOptions {
  action_type: ActionType;
  all_day: boolean;
  start_at: string | null;
  end_at: string | null;
  tag_id: string | null;
  type_icon_id: string | null;
  status_id: string | null;
}

export const EMPTY_OPTIONS: TileOptions = {
  action_type: 'none',
  all_day: false,
  start_at: null,
  end_at: null,
  tag_id: null,
  type_icon_id: null,
  status_id: null,
};

// Resolve raw options → action key for the button toggle.
function resolveActionKey(opts: TileOptions): ActionKey {
  if (opts.action_type === 'event') return opts.all_day ? 'allday' : 'timed';
  if (opts.action_type === 'deadline') return 'deadline';
  if (opts.action_type === 'anytime') return 'anytime';
  return 'none';
}

function fmtDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
function fmtTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Pick a readable foreground for a given background hex. */
function readableOn(bg: string): string {
  const hex = bg.replace('#', '').slice(0, 6);
  if (hex.length < 6) return '#FFFFFF';
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.55 ? '#000000' : '#FFFFFF';
}

interface SetOptionsAccordionProps {
  colors: any;
  options: TileOptions;
  onChange: (next: TileOptions) => void;
}

export function SetOptionsAccordion({ colors, options, onChange }: SetOptionsAccordionProps) {
  const actionKey = resolveActionKey(options);
  const showDateRow = actionKey === 'deadline' || actionKey === 'allday' || actionKey === 'timed';
  const showTimeRow = actionKey === 'timed';

  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerMode, setPickerMode] = useState<'deadline' | 'event'>('event');
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [statusPickerOpen, setStatusPickerOpen] = useState(false);

  // Lazy-load options for the pickers — only fetched when the user opens them.
  const tagsListQuery = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagsApi.list(),
    staleTime: 5 * 60 * 1000,
    enabled: tagPickerOpen,
  });
  const availableTags: TagInterface[] = (tagsListQuery.data?.data ?? []).filter((t) => !t.is_root);

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

  const typeIconsQuery = useQuery({
    queryKey: ['type-icons'],
    queryFn: () => typeIconsApi.list(),
    staleTime: 5 * 60 * 1000,
    enabled: typePickerOpen,
  });
  const typeIcons: TypeIconEntity[] = typeIconsQuery.data?.data ?? [];

  const statusesQuery = useQuery({
    queryKey: ['statuses'],
    queryFn: () => statusesApi.list(),
    staleTime: 5 * 60 * 1000,
    enabled: statusPickerOpen,
  });
  const statuses: StatusEntity[] = statusesQuery.data?.data ?? [];

  const currentTag = availableTags.find((t) => t.id === options.tag_id) ?? null;
  const currentTypeIcon = typeIcons.find((t) => t.id === options.type_icon_id) ?? null;
  const currentStatus = statuses.find((s) => s.id === options.status_id) ?? null;

  // Action key change → patch action_type + clear/seed dates appropriately.
  const applyAction = (key: ActionKey) => {
    const now = new Date();
    switch (key) {
      case 'none':
        onChange({ ...options, action_type: 'none', start_at: null, end_at: null, all_day: false });
        return;
      case 'anytime':
        onChange({ ...options, action_type: 'anytime', start_at: null, end_at: null, all_day: false });
        return;
      case 'deadline': {
        const start = options.start_at ? new Date(options.start_at) : now;
        onChange({ ...options, action_type: 'deadline', start_at: start.toISOString(), end_at: null, all_day: false });
        return;
      }
      case 'allday': {
        const start = options.start_at ? new Date(options.start_at) : now;
        const s = new Date(start);
        s.setHours(0, 0, 0, 0);
        const e = new Date(s);
        e.setHours(23, 59, 59, 0);
        onChange({ ...options, action_type: 'event', start_at: s.toISOString(), end_at: e.toISOString(), all_day: true });
        return;
      }
      case 'timed': {
        const start = options.start_at ? new Date(options.start_at) : now;
        const end = options.end_at ? new Date(options.end_at) : new Date(start.getTime() + 3600000);
        onChange({ ...options, action_type: 'event', start_at: start.toISOString(), end_at: end.toISOString(), all_day: false });
        return;
      }
    }
  };

  const openSchedulePicker = () => {
    setPickerMode(actionKey === 'deadline' ? 'deadline' : 'event');
    setPickerVisible(true);
  };

  const startDate = options.start_at ? new Date(options.start_at) : null;
  const endDate = options.end_at ? new Date(options.end_at) : null;

  return (
    <View
      style={{
        backgroundColor: colors.background2,
        borderRadius: 16,
        padding: 14,
        gap: 12,
      }}
    >
      {/* Action — Row 1: NOTES / TO DO */}
      <SectionLabel text="Action" colors={colors} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
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
                borderRadius: 8,
                backgroundColor: colors.background3,
                borderWidth: 1.5,
                borderColor: isActive ? colors.primary : 'transparent',
              }}
            >
              {Icon && (
                <View
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 9,
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
      {/* Action — Row 2: DUE / ALL DAY / TIMED */}
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
                borderRadius: 8,
                backgroundColor: colors.background3,
                borderWidth: 1.5,
                borderColor: isActive ? opt.color : 'transparent',
              }}
            >
              <View
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 9,
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

      {/* Date / Start / End — only when the action expects a date. */}
      {showDateRow && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <SectionLabel text="Date" colors={colors} small />
            <PickerField value={startDate ? fmtDate(startDate) : '—'} onPress={openSchedulePicker} colors={colors} />
          </View>
          {showTimeRow && (
            <>
              <View style={{ flex: 1 }}>
                <SectionLabel text="Start" colors={colors} small />
                <PickerField value={startDate ? fmtTime(startDate) : '—'} onPress={openSchedulePicker} colors={colors} />
              </View>
              <View style={{ flex: 1 }}>
                <SectionLabel text="End" colors={colors} small />
                <PickerField value={endDate ? fmtTime(endDate) : '—'} onPress={openSchedulePicker} colors={colors} />
              </View>
            </>
          )}
        </View>
      )}

      {/* Tag */}
      <View>
        <SectionLabel text="Tag" colors={colors} />
        <TouchableOpacity
          onPress={() => setTagPickerOpen(true)}
          activeOpacity={0.7}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: colors.background3,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 12,
            paddingVertical: 12,
          }}
        >
          {currentTag ? (() => {
            const customType = tagTypeBySlug.get(currentTag.tag_type ?? '');
            const tagColor = customType?.color ?? TAG_TYPE_COLORS[currentTag.tag_type ?? ''] ?? '#71717A';
            return (
              <>
                <TagTypeIcon emoji={customType?.emoji} fallbackSlug={currentTag.tag_type} color={tagColor} size={16} />
                <Text style={{ flex: 1, fontSize: 14, color: colors.primary }}>{currentTag.name}</Text>
              </>
            );
          })() : (
            <Text style={{ flex: 1, fontSize: 14, color: colors.tertiary, fontStyle: 'italic' }}>
              Seleziona tag…
            </Text>
          )}
          <IconChevronDown size={14} color={colors.tertiary} />
        </TouchableOpacity>
      </View>

      {/* Type */}
      <View>
        <SectionLabel text="Type" colors={colors} />
        <TouchableOpacity
          onPress={() => setTypePickerOpen(true)}
          activeOpacity={0.7}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            backgroundColor: colors.background3,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 12,
            paddingVertical: 12,
          }}
        >
          {currentTypeIcon ? (
            <>
              <TypeIconBadge icon={currentTypeIcon.icon} color={currentTypeIcon.color} />
              <Text style={{ flex: 1, fontSize: 14, color: colors.primary }}>{currentTypeIcon.name}</Text>
            </>
          ) : (
            <Text style={{ flex: 1, fontSize: 14, color: colors.tertiary, fontStyle: 'italic' }}>
              Seleziona tipo…
            </Text>
          )}
          <IconChevronDown size={14} color={colors.tertiary} />
        </TouchableOpacity>
      </View>

      {/* Status */}
      <View>
        <SectionLabel text="Status" colors={colors} />
        <TouchableOpacity
          onPress={() => setStatusPickerOpen(true)}
          activeOpacity={0.7}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            backgroundColor: colors.background3,
            borderRadius: 10,
            borderWidth: 1,
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
                  borderRadius: 3,
                  backgroundColor: '#A1A1AA',
                }}
              />
              <Text style={{ flex: 1, fontSize: 14, color: colors.primary }}>{currentStatus.name}</Text>
            </>
          ) : (
            <Text style={{ flex: 1, fontSize: 14, color: colors.tertiary, fontStyle: 'italic' }}>
              Seleziona status…
            </Text>
          )}
          <IconChevronDown size={14} color={colors.tertiary} />
        </TouchableOpacity>
      </View>

      {/* Schedule picker — reuses ActionTypePicker (works in Expo Go without
          the native datetimepicker module). */}
      <ActionTypePicker
        visible={pickerVisible}
        mode={pickerMode}
        initialDate={startDate ?? undefined}
        initialEndDate={endDate ?? undefined}
        initialAllDay={options.all_day}
        onConfirm={(data) => {
          onChange({
            ...options,
            action_type: data.action_type,
            start_at: data.start_at,
            end_at: data.end_at ?? null,
            all_day: data.all_day ?? false,
          });
          setPickerVisible(false);
        }}
        onCancel={() => setPickerVisible(false)}
      />

      {/* Tag picker modal */}
      <PickerModal visible={tagPickerOpen} title="Tag" onClose={() => setTagPickerOpen(false)} colors={colors}>
        <PickerRow
          label="(Nessuno)"
          isActive={!options.tag_id}
          onPress={() => {
            onChange({ ...options, tag_id: null });
            setTagPickerOpen(false);
          }}
          colors={colors}
        />
        {(() => {
          const nonRoot = availableTags;
          if (nonRoot.length === 0) return null;
          const presentTypes = new Set(nonRoot.map((t) => t.tag_type).filter(Boolean));
          const extraTypes = [...presentTypes]
            .filter((tp) => !(TAG_TYPE_ORDER as readonly string[]).includes(tp))
            .sort();
          const orderedTypes = [...TAG_TYPE_ORDER, ...extraTypes];
          const hasUntyped = nonRoot.some((t) => !t.tag_type);
          if (hasUntyped) orderedTypes.push('__untyped__');

          return orderedTypes.map((tp) => {
            const groupTags =
              tp === '__untyped__'
                ? nonRoot.filter((t) => !t.tag_type)
                : nonRoot.filter((t) => t.tag_type === tp);
            if (groupTags.length === 0) return null;
            const Icon = TAG_TYPE_ICONS[tp] ?? IconTag;
            const label =
              tp === '__untyped__' ? 'ALTRO' : TAG_TYPE_LABELS[tp] ?? tp.toUpperCase();
            return (
              <View key={tp} style={{ marginBottom: 8 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    paddingHorizontal: 4,
                    paddingVertical: 6,
                  }}
                >
                  <Icon size={14} color={colors.tertiary} />
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '600',
                      letterSpacing: 0.5,
                      color: colors.tertiary,
                    }}
                  >
                    {label}
                  </Text>
                </View>
                {groupTags.map((tag) => (
                  <PickerRow
                    key={tag.id}
                    label={tag.name}
                    isActive={options.tag_id === tag.id}
                    onPress={() => {
                      onChange({ ...options, tag_id: tag.id });
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

      {/* Type picker modal */}
      <PickerModal visible={typePickerOpen} title="Tipo" onClose={() => setTypePickerOpen(false)} colors={colors}>
        <PickerRow
          label="(Nessuno)"
          isActive={!options.type_icon_id}
          onPress={() => {
            onChange({ ...options, type_icon_id: null });
            setTypePickerOpen(false);
          }}
          colors={colors}
        />
        {typeIcons.map((ti) => (
          <PickerRow
            key={ti.id}
            label={ti.name}
            leading={<TypeIconBadge icon={ti.icon} color={ti.color} />}
            isActive={options.type_icon_id === ti.id}
            onPress={() => {
              onChange({ ...options, type_icon_id: ti.id });
              setTypePickerOpen(false);
            }}
            colors={colors}
          />
        ))}
      </PickerModal>

      {/* Status picker modal */}
      <PickerModal visible={statusPickerOpen} title="Status" onClose={() => setStatusPickerOpen(false)} colors={colors}>
        <PickerRow
          label="(Nessuno)"
          isActive={!options.status_id}
          onPress={() => {
            onChange({ ...options, status_id: null });
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
                  borderRadius: 3,
                  backgroundColor: '#A1A1AA',
                }}
              />
            }
            isActive={options.status_id === s.id}
            onPress={() => {
              onChange({ ...options, status_id: s.id });
              setStatusPickerOpen(false);
            }}
            colors={colors}
          />
        ))}
      </PickerModal>
    </View>
  );
}

// ─── Internal helpers (kept private to this module) ───

function SectionLabel({
  text,
  colors,
  small,
}: {
  text: string;
  colors: any;
  small?: boolean;
}) {
  return (
    <Text
      style={{
        fontSize: small ? 10 : 11,
        fontWeight: '600',
        color: colors.tertiary,
        letterSpacing: 0.5,
        marginBottom: 6,
      }}
    >
      {text}
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
        backgroundColor: colors.background3,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: 10,
        paddingVertical: 12,
      }}
    >
      <Text style={{ fontSize: 14, color: colors.primary }}>{value}</Text>
    </TouchableOpacity>
  );
}

function TypeIconBadge({ icon, color }: { icon: string; color?: string }) {
  const Comp = (TablerIcons as unknown as Record<string, React.ComponentType<{ size?: number; color?: string }>>)[icon];
  if (!Comp) return null;
  const bg = color || '#27272A';
  return (
    <View
      style={{
        width: 18,
        height: 18,
        borderRadius: 4,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Comp size={11} color={readableOn(bg)} />
    </View>
  );
}

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
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
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
        borderRadius: 10,
        marginBottom: 4,
        backgroundColor: isActive ? `${colors.accent}1F` : 'transparent',
        borderWidth: 1,
        borderColor: isActive ? colors.accent : 'transparent',
      }}
    >
      {leading}
      <Text style={{ flex: 1, fontSize: 15, color: colors.primary }}>{label}</Text>
    </TouchableOpacity>
  );
}
