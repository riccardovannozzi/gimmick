/**
 * Full-screen multi-select modal used by the Tiles filter row. Mirrors
 * TagFilterModal's UX (full-screen native Modal + footer Apply/Close button)
 * so all four filter pills feel identical.
 *
 * Generic over an item type — the caller supplies the list, an identity
 * function (`getId`), and an optional `leading` renderer for the row icon.
 * Selection state is owned by the parent (Set<string>); this component is
 * purely presentational.
 */
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconX, IconCheck } from '@tabler/icons-react-native';
import { useThemeColors } from '@/lib/theme';

export interface FilterPickerModalProps<T> {
  visible: boolean;
  title: string;
  items: T[];
  selected: Set<string>;
  getId: (item: T) => string;
  getLabel: (item: T) => string;
  /** Optional leading element (icon/badge) rendered before the label. */
  leading?: (item: T) => React.ReactNode;
  onChange: (next: Set<string>) => void;
  onClose: () => void;
}

export function FilterPickerModal<T>({
  visible,
  title,
  items,
  selected,
  getId,
  getLabel,
  leading,
  onChange,
  onClose,
}: FilterPickerModalProps<T>) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
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
            {selected.size > 0 && (
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
          {items.length === 0 ? (
            <Text
              style={{
                color: colors.tertiary,
                fontSize: 14,
                textAlign: 'center',
                paddingVertical: 40,
              }}
            >
              Nessun elemento disponibile
            </Text>
          ) : (
            items.map((item) => {
              const id = getId(item);
              const isSelected = selected.has(id);
              return (
                <TouchableOpacity
                  key={id}
                  onPress={() => toggle(id)}
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
                  {leading ? (
                    <View style={{ marginRight: 12 }}>{leading(item)}</View>
                  ) : null}
                  <Text style={{ flex: 1, fontSize: 15, color: colors.primary }}>
                    {getLabel(item)}
                  </Text>
                  {isSelected && (
                    <IconCheck size={18} color={colors.accent} strokeWidth={2.5} />
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>

        {/* Footer — Apply/Close button, same UX as TagFilterModal. */}
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
              {selected.size > 0 ? `Applica (${selected.size})` : 'Chiudi'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
