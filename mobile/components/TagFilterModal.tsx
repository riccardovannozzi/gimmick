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
import { usePixelTheme, PixelButton } from '@/components/pixel';
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
  const theme = usePixelTheme();
  // Adapter — mantiene la compatibilità del corpo originale che usa `colors.*`
  const colors = {
    border: theme.border,
    tertiary: theme.ink2,
    secondary: theme.ink2,
    primary: theme.ink,
    accent: theme.accent,
    background1: theme.bg1,
    background2: theme.bg2,
    surfaceVariant: theme.surface,
  } as const;
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
      <View style={{ flex: 1, backgroundColor: theme.bg1, paddingTop: insets.top }}>
        {/* Header — Pixel style */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 14,
            borderBottomWidth: 2,
            borderBottomColor: theme.border,
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              fontFamily: theme.fontHead,
              fontSize: 12,
              color: theme.ink,
              letterSpacing: 1.2,
              flex: 1,
            }}
          >
            {title.toUpperCase()}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {visibleTypeSlugs.size > 0 && (
              <TouchableOpacity
                onPress={onToggleAll}
                hitSlop={6}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                {hasClosedSection ? (
                  <IconArrowsMaximize size={12} color={theme.ink2} />
                ) : (
                  <IconArrowsMinimize size={12} color={theme.ink2} />
                )}
                <Text
                  style={{
                    fontFamily: theme.fontHead,
                    fontSize: 8,
                    color: theme.ink2,
                    letterSpacing: 1,
                  }}
                >
                  {hasClosedSection ? 'EXPAND' : 'COLLAPSE'}
                </Text>
              </TouchableOpacity>
            )}
            {selectedTagIds.size > 0 && (
              <TouchableOpacity onPress={() => onChange(new Set())} hitSlop={6}>
                <Text
                  style={{
                    fontFamily: theme.fontHead,
                    fontSize: 9,
                    color: theme.accent,
                    letterSpacing: 1,
                  }}
                >
                  PULISCI
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={onClose}
              hitSlop={10}
              style={{
                width: 32, height: 32,
                borderWidth: 2, borderColor: theme.border,
                backgroundColor: theme.surfaceVariant,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <IconX size={16} color={theme.ink} strokeWidth={2.4} />
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
                <Text
                  style={{
                    fontFamily: theme.fontHead,
                    color: theme.ink2,
                    fontSize: 10,
                    textAlign: 'center',
                    paddingVertical: 40,
                    letterSpacing: 1,
                  }}
                >
                  {availableTags.length === 0 ? 'CARICAMENTO TAG…' : 'NESSUN TAG PERSONALIZZATO'}
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
                customType?.color ?? TAG_TYPE_FALLBACK_COLORS[tp] ?? theme.ink2;
              const label = tp === '__untyped__'
                ? 'ALTRO'
                : (customType?.name
                    ?? TAG_TYPE_LABELS[tp]
                    ?? tp).toUpperCase();
              const isOpen = !closedTypes.has(tp);
              return (
                <View key={tp} style={{ marginBottom: 10 }}>
                  {/* Section header — Pixel style: border 2px, bg surface,
                      icona quadrata col color del tipo + label PressStart2P */}
                  <TouchableOpacity
                    onPress={() => toggleType(tp)}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingHorizontal: 10,
                      paddingVertical: 10,
                      borderWidth: 2,
                      borderColor: theme.border,
                      backgroundColor: theme.surface,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View
                        style={{
                          width: 26, height: 26,
                          borderWidth: 2, borderColor: theme.border,
                          backgroundColor: typeColor,
                          alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <TagTypeIcon
                          emoji={customType?.emoji}
                          fallbackSlug={tp}
                          color="#FFFFFF"
                          size={14}
                        />
                      </View>
                      <Text
                        style={{
                          fontFamily: theme.fontHead,
                          fontSize: 10,
                          color: theme.ink,
                          letterSpacing: 1,
                        }}
                      >
                        {label}
                      </Text>
                    </View>
                    <IconChevronDown
                      size={16}
                      color={theme.ink2}
                      strokeWidth={2.2}
                      style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }}
                    />
                  </TouchableOpacity>

                  {/* Tag rows */}
                  {isOpen && (
                    <View style={{ marginTop: 6, gap: 4, paddingLeft: 8 }}>
                      {groupTags.map((tag) => {
                        const isSelected = selectedTagIds.has(tag.id);
                        return (
                          <TouchableOpacity
                            key={tag.id}
                            onPress={() => toggle(tag.id)}
                            activeOpacity={0.7}
                          >
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingVertical: 10,
                                paddingHorizontal: 10,
                                borderWidth: 2,
                                borderColor: theme.border,
                                backgroundColor: isSelected ? theme.accent : theme.surface,
                              }}
                            >
                              <Text
                                style={{
                                  flex: 1,
                                  fontFamily: theme.fontBody,
                                  fontSize: 13,
                                  fontWeight: '700',
                                  color: isSelected ? (theme.onAccent as string) : theme.ink,
                                }}
                              >
                                {tag.name}
                              </Text>
                              {isSelected && (
                                <IconCheck
                                  size={16}
                                  color={theme.onAccent as string}
                                  strokeWidth={2.6}
                                />
                              )}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
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
            borderTopWidth: 2,
            borderTopColor: colors.border,
            backgroundColor: colors.background1,
          }}
        >
          <PixelButton
            theme={theme}
            big
            full
            bg={theme.accent}
            color={theme.onAccent}
            label={selectedTagIds.size > 0 ? `APPLICA (${selectedTagIds.size})` : 'APPLICA'}
            onPress={onClose}
          />
        </View>
      </View>
    </Modal>
  );
}
