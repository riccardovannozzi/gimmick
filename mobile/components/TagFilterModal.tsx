/**
 * Full-screen modal to pick a set of tags, grouped by `tag_type` (project /
 * person / context / place / topic — mirrors the web sidebar). Used as a
 * filter on the Tiles list: returning a non-empty set narrows the view to
 * tiles owning at least one of the selected tags.
 *
 * Loads the user's tags on first open; subsequent opens reuse the cached
 * list. The component is stateless w.r.t. the active selection — the parent
 * owns the set and passes it back in via `selectedTagIds`.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as TablerIcons from '@tabler/icons-react-native';
import {
  IconX,
  IconCheck,
  IconTag,
  IconFolder,
  IconUser,
  IconMapPin,
  IconBookmark,
  IconChevronDown,
  IconArrowsMaximize,
  IconArrowsMinimize,
} from '@tabler/icons-react-native';
import { tagsApi, tagTypesApi, type TagTypeEntity } from '@/lib/api';
import { useAuthStore } from '@/store';
import { useThemeColors } from '@/lib/theme';
import type { Tag as TagInterface } from '@/types';

// Tag-type metadata mirrors frontend/components/layout/sidebar.tsx.
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
// Fallback colors for the canonical 5 types (used when the user has no
// custom TagType row defining a color). Mirrors captureColors palette.
const TAG_TYPE_FALLBACK_COLORS: Record<string, string> = {
  project: '#5B8DEF',
  person: '#6FCF97',
  context: '#F2C94C',
  place: '#EF4444',
  topic: '#AB9FF2',
};

/** Render a tag-type icon, mirroring web's resolveIcon(): supports either a
 *  Tabler icon name ("IconHome") or a unicode emoji stored in `emoji`. */
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

interface Props {
  visible: boolean;
  selectedTagIds: Set<string>;
  onClose: () => void;
  onChange: (next: Set<string>) => void;
  /** Optional title; defaults to "Filtra per tag". */
  title?: string;
}

export function TagFilterModal({
  visible,
  selectedTagIds,
  onClose,
  onChange,
  title = 'Filtra per tag',
}: Props) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [availableTags, setAvailableTags] = useState<TagInterface[]>([]);
  const [tagTypes, setTagTypes] = useState<TagTypeEntity[]>([]);
  // Collapse state per tag_type slug — open by default. Closing a section
  // hides its tag rows; chevron rotates 180° to indicate state (mirrors web).
  const [closedTypes, setClosedTypes] = useState<Set<string>>(new Set());

  const toggleType = (slug: string) => {
    setClosedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  useEffect(() => {
    if (!visible) return;
    // Sync auth tokens before fetching (same pattern used by the home screen
    // modal — protects against stale tokens after a session restore).
    const state = useAuthStore.getState();
    if (state.accessToken && state.refreshToken) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { setTokens } = require('@/lib/api');
      setTokens({
        access_token: state.accessToken,
        refresh_token: state.refreshToken,
        expires_at: 0,
      });
    }
    tagsApi
      .list()
      .then((res) => {
        if (res.success && res.data) setAvailableTags(res.data);
      })
      .catch(() => {
        // Silent — leaves the existing list visible if the refetch fails.
      });
    // Tag types carry the color/emoji used to render each type's section icon.
    tagTypesApi
      .list()
      .then((res) => {
        if (res.success && res.data) setTagTypes(res.data);
      })
      .catch(() => {
        // Silent — falls back to TAG_TYPE_FALLBACK_COLORS.
      });
  }, [visible]);

  const tagTypeBySlug = useMemo(() => {
    const map = new Map<string, TagTypeEntity>();
    for (const tt of tagTypes) map.set(tt.slug, tt);
    return map;
  }, [tagTypes]);

  // All tag_type slugs that actually have at least one (non-root) tag — used
  // by the Expand/Collapse-all toggle to know which sections to operate on.
  const visibleTypeSlugs = useMemo(() => {
    const nonRoot = availableTags.filter((t) => !t.is_root);
    const slugs = new Set<string>();
    for (const t of nonRoot) {
      slugs.add(t.tag_type ? t.tag_type : '__untyped__');
    }
    return slugs;
  }, [availableTags]);

  // "Any section currently closed" → button reads "Expand all" and opens all.
  // Otherwise → "Collapse all" and closes all.
  const hasClosedSection = [...visibleTypeSlugs].some((s) => closedTypes.has(s));
  const onToggleAll = () => {
    if (hasClosedSection) {
      setClosedTypes(new Set());
    } else {
      setClosedTypes(new Set(visibleTypeSlugs));
    }
  };

  const toggle = (tagId: string) => {
    const next = new Set(selectedTagIds);
    if (next.has(tagId)) next.delete(tagId);
    else next.add(tagId);
    console.log('[TagFilterModal] toggle', tagId, 'now has', next.size, 'selected');
    onChange(next);
  };

  // Native <Modal> without `presentationStyle="fullScreen"` — that prop is
  // iOS-only and on Android is silently ignored, but the combination of it
  // with animationType="slide" inside an Expo Router Stack sometimes blocks
  // rendering. The plain Modal here renders full-screen on Android by
  // default and slides in on iOS via animationType.
  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: colors.background1, paddingTop: insets.top }}>
        {/* Header */}
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
          <Text style={{ fontSize: 19, fontWeight: '700', color: colors.primary }}>
            {title}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {/* Expand/Collapse all — visible whenever there's at least one
                section to act on. Toggles based on current state. */}
            {visibleTypeSlugs.size > 0 && (
              <TouchableOpacity
                onPress={onToggleAll}
                hitSlop={6}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                {hasClosedSection ? (
                  <IconArrowsMaximize size={14} color={colors.secondary} />
                ) : (
                  <IconArrowsMinimize size={14} color={colors.secondary} />
                )}
                <Text style={{ fontSize: 13, color: colors.secondary }}>
                  {hasClosedSection ? 'Expand all' : 'Collapse all'}
                </Text>
              </TouchableOpacity>
            )}
            {selectedTagIds.size > 0 && (
              <TouchableOpacity onPress={() => onChange(new Set())} hitSlop={6}>
                <Text style={{ fontSize: 13, color: colors.accent }}>Pulisci</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <IconX size={24} color={colors.secondary} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 }}
          keyboardShouldPersistTaps="handled"
        >
          {(() => {
            const nonRoot = availableTags.filter((t) => !t.is_root);
            if (nonRoot.length === 0) {
              return (
                <Text style={{ color: colors.tertiary, fontSize: 14, textAlign: 'center', paddingVertical: 40 }}>
                  {availableTags.length === 0 ? 'Caricamento tag...' : 'Nessun tag personalizzato'}
                </Text>
              );
            }
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
              const customType = tagTypeBySlug.get(tp);
              const typeColor =
                customType?.color ?? TAG_TYPE_FALLBACK_COLORS[tp] ?? colors.tertiary;
              // Custom-type name wins over the canonical label (so the
              // section header reads "Ortano Mare", not "Topic"). Title-case
              // preserved — matches the casing used in Action filter rows.
              const label = tp === '__untyped__'
                ? 'Altro'
                : (customType?.name
                    ?? TAG_TYPE_LABELS[tp]
                    ?? tp);
              const isOpen = !closedTypes.has(tp);
              return (
                <View key={tp} style={{ marginBottom: 6 }}>
                  {/* Section header — collapsible button with grey bg + chevron.
                      Mirrors the web sidebar pattern. Font/weight/height/color
                      match the Action filter rows for visual consistency
                      across modals. */}
                  <TouchableOpacity
                    onPress={() => toggleType(tp)}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingHorizontal: 12,
                      paddingVertical: 12,
                      borderRadius: 10,
                      backgroundColor: colors.surfaceVariant,
                      marginBottom: 2,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <TagTypeIcon
                        emoji={customType?.emoji}
                        fallbackSlug={tp}
                        color={typeColor}
                        size={18}
                      />
                      <Text style={{ fontSize: 15, color: colors.primary }}>
                        {label}
                      </Text>
                    </View>
                    <IconChevronDown
                      size={16}
                      color={colors.tertiary}
                      style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }}
                    />
                  </TouchableOpacity>

                  {/* Tag rows — no background, selected = subtle accent tint.
                      Hidden when the section is collapsed. */}
                  {isOpen && groupTags.map((tag) => {
                    const isSelected = selectedTagIds.has(tag.id);
                    return (
                      <TouchableOpacity
                        key={tag.id}
                        onPress={() => toggle(tag.id)}
                        activeOpacity={0.6}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingVertical: 10,
                          paddingHorizontal: 12,
                          borderRadius: 6,
                          backgroundColor: isSelected ? `${colors.accent}1F` : 'transparent',
                        }}
                      >
                        <Text
                          style={{
                            flex: 1,
                            fontSize: 14,
                            color: isSelected ? colors.primary : colors.secondary,
                            fontWeight: isSelected ? '600' : '400',
                          }}
                        >
                          {tag.name}
                        </Text>
                        {isSelected && (
                          <IconCheck size={16} color={colors.accent} strokeWidth={2.5} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            });
          })()}
        </ScrollView>

        {/* Done button */}
        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: insets.bottom + 16,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.background1,
          }}
        >
          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.7}
            style={{
              backgroundColor: '#2196F3',
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>
              {selectedTagIds.size > 0 ? `Applica (${selectedTagIds.size})` : 'Applica'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
