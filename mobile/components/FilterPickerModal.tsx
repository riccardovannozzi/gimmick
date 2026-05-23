/**
 * Full-screen multi-select modal used by the Tiles filter row. Pixel design:
 * border 2px ink, font Press Start 2P, no border-radius.
 */
import React from 'react';
import { View, Text, ScrollView, Pressable, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconX, IconCheck } from '@tabler/icons-react-native';
import { usePixelTheme, PixelButton } from '@/components/pixel';

export interface FilterPickerModalProps<T> {
  visible: boolean;
  title: string;
  items: T[];
  selected: Set<string>;
  getId: (item: T) => string;
  getLabel: (item: T) => string;
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
  const theme = usePixelTheme();
  const insets = useSafeAreaInsets();

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.bg1, paddingTop: insets.top }}>
        {/* Header */}
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
              flex: 1,
              fontFamily: theme.fontHead,
              fontSize: 12,
              color: theme.ink,
              letterSpacing: 1.2,
            }}
          >
            {title.toUpperCase()}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {selected.size > 0 && (
              <Pressable
                onPress={() => onChange(new Set())}
                hitSlop={6}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              >
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
              </Pressable>
            )}
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={({ pressed }) => ({
                width: 32,
                height: 32,
                borderWidth: 2,
                borderColor: theme.border,
                backgroundColor: theme.surfaceVariant,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <IconX size={16} color={theme.ink} strokeWidth={2.4} />
            </Pressable>
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20 }}
          keyboardShouldPersistTaps="handled"
        >
          {items.length === 0 ? (
            <Text
              style={{
                fontFamily: theme.fontBody,
                color: theme.ink2,
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
                <Pressable
                  key={id}
                  onPress={() => toggle(id)}
                  style={({ pressed }) => ({
                    marginBottom: 6,
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 12,
                      paddingHorizontal: 12,
                      borderWidth: 2,
                      borderColor: theme.border,
                      backgroundColor: isSelected ? theme.accent : theme.surface,
                    }}
                  >
                    {leading ? (
                      <View style={{ marginRight: 12 }}>{leading(item)}</View>
                    ) : null}
                    <Text
                      style={{
                        flex: 1,
                        fontFamily: theme.fontBody,
                        fontSize: 14,
                        fontWeight: '600',
                        color: isSelected ? (theme.onAccent as string) : theme.ink,
                      }}
                    >
                      {getLabel(item)}
                    </Text>
                    {isSelected && (
                      <IconCheck
                        size={16}
                        color={theme.onAccent as string}
                        strokeWidth={2.6}
                      />
                    )}
                  </View>
                </Pressable>
              );
            })
          )}
        </ScrollView>

        {/* Footer */}
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: insets.bottom + 12,
            borderTopWidth: 2,
            borderTopColor: theme.border,
            backgroundColor: theme.bg1,
          }}
        >
          <PixelButton
            theme={theme}
            big
            full
            bg={theme.accent}
            color={theme.onAccent}
            label={selected.size > 0 ? `APPLICA (${selected.size})` : 'APPLICA'}
            onPress={onClose}
          />
        </View>
      </View>
    </Modal>
  );
}
