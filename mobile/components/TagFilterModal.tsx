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
import React, { useEffect, useState } from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  IconX,
  IconCheck,
  IconTag,
  IconFolder,
  IconUser,
  IconMapPin,
  IconBookmark,
} from '@tabler/icons-react-native';
import { tagsApi } from '@/lib/api';
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
  }, [visible]);

  const toggle = (tagId: string) => {
    const next = new Set(selectedTagIds);
    if (next.has(tagId)) next.delete(tagId);
    else next.add(tagId);
    onChange(next);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
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
              const Icon = TAG_TYPE_ICONS[tp] ?? IconTag;
              const label = tp === '__untyped__'
                ? 'ALTRO'
                : (TAG_TYPE_LABELS[tp] ?? tp.toUpperCase());
              return (
                <View key={tp} style={{ marginBottom: 16 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      paddingHorizontal: 4,
                      paddingVertical: 8,
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
                  {groupTags.map((tag) => {
                    const isSelected = selectedTagIds.has(tag.id);
                    return (
                      <TouchableOpacity
                        key={tag.id}
                        onPress={() => toggle(tag.id)}
                        activeOpacity={0.7}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingVertical: 12,
                          paddingHorizontal: 12,
                          borderRadius: 10,
                          marginBottom: 4,
                          backgroundColor: isSelected ? `${colors.accent}1F` : colors.background2,
                          borderWidth: 1,
                          borderColor: isSelected ? colors.accent : 'transparent',
                        }}
                      >
                        <View
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 5,
                            backgroundColor: colors.accent,
                            marginRight: 12,
                          }}
                        />
                        <Text style={{ flex: 1, fontSize: 15, color: colors.primary }}>
                          {tag.name}
                        </Text>
                        {isSelected && (
                          <IconCheck size={18} color={colors.accent} strokeWidth={2.5} />
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
              backgroundColor: colors.accent,
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>
              {selectedTagIds.size > 0 ? `Applica (${selectedTagIds.size})` : 'Chiudi'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
