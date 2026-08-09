/**
 * Segmented header used on the TILE detail flow:
 *   [TILES (square)] [ EDIT ] [ LIST ]
 *
 * The square TILES button always navigates back to the tiles list. EDIT and
 * LIST switch between the two views of the same tile.
 * Pixel design: bordo inferiore 2px ink, active = bg accent + label onAccent
 * (mirror del TopNav active pill).
 *
 * I tab erano TRE: c'era anche FLOW, ed è uscito di scena col modello che lo
 * alimentava. I passi di un flow sono voci della LIST, quindi un terzo tab
 * avrebbe mostrato la stessa cosa da un'altra porta — stessa potatura fatta
 * sulla sidebar web (vedi la nota in cima a frontend/components/shell/Inspector.tsx).
 */
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { IconLayoutGrid } from '@tabler/icons-react-native';
import { usePixelTheme } from '@/components/pixel';

interface Props {
  /** Unused — kept for backward-compat with legacy call sites. */
  colors?: any;
  active: 'edit' | 'list';
  onTiles: () => void;
  onEdit: () => void;
  onList: () => void;
}

export function TileHeaderNav({ active, onTiles, onEdit, onList }: Props) {
  const theme = usePixelTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 2,
        borderBottomColor: theme.border,
      }}
    >
      {/* TILES square — torna alla lista tile */}
      <Pressable
        onPress={onTiles}
        style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
      >
        <View
          style={{
            width: 38,
            height: 38,
            borderWidth: 2,
            borderColor: theme.border,
            backgroundColor: theme.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconLayoutGrid size={20} color={theme.ink} strokeWidth={2} />
        </View>
      </Pressable>

      <SegmentedButton label="EDIT" active={active === 'edit'} onPress={onEdit} />
      <SegmentedButton label="LIST" active={active === 'list'} onPress={onList} />
    </View>
  );
}

function SegmentedButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const theme = usePixelTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.85 : 1 })}
    >
      <View
        style={{
          height: 38,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 2,
          borderColor: theme.border,
          backgroundColor: active ? theme.accent : theme.surface,
        }}
      >
        <Text
          style={{
            fontFamily: theme.fontHead,
            fontSize: 9,
            color: active ? (theme.onAccent as string) : theme.ink,
            letterSpacing: 1,
          }}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
