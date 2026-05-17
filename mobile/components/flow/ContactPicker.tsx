/**
 * Contact picker — mobile equivalent of ContactCombobox from the web. Renders
 * as a tappable field; when tapped, opens a bottom-sheet modal with a search
 * input, the existing contacts (self pinned to top), and an inline create
 * action when the query has no exact match.
 */
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';
import { IconChevronDown, IconPlus, IconX } from '@tabler/icons-react-native';
import { useContacts } from '@/hooks/useContacts';
import { useThemeColors } from '@/lib/theme';
import type { Contact } from '@/types';

interface Props {
  value: string | null;
  onChange: (contactId: string | null) => void;
}

export function ContactPicker({ value, onChange }: Props) {
  const colors = useThemeColors();
  const { contacts, create } = useContacts();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);

  const selected: Contact | null = useMemo(() => {
    if (!value) return null;
    return contacts.find((c) => c.id === value) ?? null;
  }, [contacts, value]);

  const normalizedQuery = query.trim().toLowerCase();

  // Pin self contact to the top so "ball on me" is always a one-tap pick.
  const sortedContacts = useMemo(
    () =>
      [...contacts].sort((a, b) => {
        if (a.is_self && !b.is_self) return -1;
        if (!a.is_self && b.is_self) return 1;
        return a.name.localeCompare(b.name);
      }),
    [contacts],
  );

  const matches = useMemo(() => {
    if (!normalizedQuery) return sortedContacts.slice(0, 50);
    return sortedContacts
      .filter((c) => c.name.toLowerCase().includes(normalizedQuery))
      .slice(0, 50);
  }, [sortedContacts, normalizedQuery]);

  const exactMatch = useMemo(
    () => contacts.find((c) => c.name.toLowerCase() === normalizedQuery),
    [contacts, normalizedQuery],
  );

  const handleCreate = async () => {
    const name = query.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const result = await create.mutateAsync({ name, kind: 'person' });
      if (result?.id) {
        onChange(result.id);
        setQuery('');
        setOpen(false);
      }
    } finally {
      setCreating(false);
    }
  };

  const renderSelectedLabel = () => {
    if (!selected) return null;
    return selected.is_self ? `[ ${selected.name} ]` : selected.name;
  };

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          backgroundColor: colors.background2,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: 12,
          height: 40,
        }}
      >
        {selected?.color && (
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: selected.color,
            }}
          />
        )}
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            fontSize: 14,
            color: selected ? colors.primary : colors.tertiary,
            fontStyle: selected ? 'normal' : 'italic',
          }}
        >
          {selected ? renderSelectedLabel() : 'Cerca contatto…'}
        </Text>
        {selected && (
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            hitSlop={8}
          >
            <IconX size={16} color={colors.tertiary} />
          </TouchableOpacity>
        )}
        {!selected && <IconChevronDown size={14} color={colors.tertiary} />}
      </TouchableOpacity>

      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={() => setOpen(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: 'flex-end',
            backgroundColor: 'rgba(0,0,0,0.5)',
          }}
        >
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
              <Text style={{ fontSize: 17, fontWeight: '600', color: colors.primary }}>
                Contatto
              </Text>
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={8}>
                <IconX size={20} color={colors.tertiary} />
              </TouchableOpacity>
            </View>

            <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                autoFocus
                placeholder="Cerca o crea contatto…"
                placeholderTextColor={colors.tertiary}
                style={{
                  backgroundColor: colors.background1,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: 12,
                  height: 40,
                  fontSize: 14,
                  color: colors.primary,
                }}
              />
            </View>

            <ScrollView style={{ marginTop: 12, paddingHorizontal: 12 }} keyboardShouldPersistTaps="handled">
              {matches.length === 0 && !normalizedQuery && (
                <Text
                  style={{
                    fontSize: 12,
                    color: colors.tertiary,
                    paddingHorizontal: 8,
                    paddingVertical: 12,
                  }}
                >
                  Nessun contatto. Digita un nome per crearne uno.
                </Text>
              )}
              {matches.map((c) => {
                const isActive = c.id === value;
                return (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => {
                      onChange(c.id);
                      setQuery('');
                      setOpen(false);
                    }}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      paddingHorizontal: 12,
                      paddingVertical: 12,
                      borderRadius: 8,
                      backgroundColor: isActive ? `${colors.accent}1F` : 'transparent',
                      borderWidth: 1,
                      borderColor: isActive ? colors.accent : 'transparent',
                      marginBottom: 4,
                    }}
                  >
                    {c.color && (
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: c.color,
                        }}
                      />
                    )}
                    <Text style={{ flex: 1, fontSize: 14, color: colors.primary }}>
                      {c.is_self ? `[ ${c.name} ]` : c.name}
                    </Text>
                    {c.kind !== 'person' && (
                      <Text
                        style={{
                          fontSize: 10,
                          color: colors.tertiary,
                          letterSpacing: 0.5,
                        }}
                      >
                        {c.kind.toUpperCase()}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
              {normalizedQuery && !exactMatch && (
                <TouchableOpacity
                  onPress={handleCreate}
                  disabled={creating}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 12,
                    borderRadius: 8,
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                    opacity: creating ? 0.5 : 1,
                  }}
                >
                  <IconPlus size={14} color={colors.accent} />
                  <Text style={{ fontSize: 14, color: colors.accent, fontWeight: '500' }}>
                    {creating ? 'Creazione…' : `Nuovo contatto: "${query.trim()}"`}
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
