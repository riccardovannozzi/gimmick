/**
 * Segmented header used on the TILE detail flow:
 *   [TILES (square)] [ EDIT ] [ LIST ] [ FLOW ]
 *
 * The square TILES button always navigates back to the tiles list. The EDIT,
 * LIST and FLOW buttons switch between the three views of the same tile. The
 * button matching the current screen renders in the "active" style (filled
 * bg, white border) to match the existing Action segmented control on EDIT.
 */
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { IconLayoutGrid } from '@tabler/icons-react-native';

interface Props {
  colors: any;
  active: 'edit' | 'list' | 'flow';
  onTiles: () => void;
  onEdit: () => void;
  onList: () => void;
  onFlow: () => void;
}

export function TileHeaderNav({ colors, active, onTiles, onEdit, onList, onFlow }: Props) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <TouchableOpacity
        onPress={onTiles}
        activeOpacity={0.7}
        style={{
          width: 44,
          height: 44,
          borderRadius: 8,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background2,
        }}
      >
        <IconLayoutGrid size={20} color={colors.primary} />
      </TouchableOpacity>

      <SegmentedButton
        label="EDIT"
        active={active === 'edit'}
        onPress={onEdit}
        colors={colors}
      />
      <SegmentedButton
        label="LIST"
        active={active === 'list'}
        onPress={onList}
        colors={colors}
      />
      <SegmentedButton
        label="FLOW"
        active={active === 'flow'}
        onPress={onFlow}
        colors={colors}
      />
    </View>
  );
}

function SegmentedButton({
  label,
  active,
  onPress,
  colors,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  colors: any;
}) {
  // Active style mirrors the web sidebar tabs (frontend TileSidebar):
  // bg-blue-600/20 + text-blue-400, no border.
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flex: 1,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        backgroundColor: active ? 'rgba(37, 99, 235, 0.2)' : colors.background2,
      }}
    >
      <Text
        style={{
          fontSize: 13,
          fontWeight: '700',
          letterSpacing: 1,
          color: active ? '#60A5FA' : colors.tertiary,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
