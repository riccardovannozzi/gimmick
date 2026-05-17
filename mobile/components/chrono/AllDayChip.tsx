/**
 * Flat colored chip for an all-day event. Used in the "all-day" row above
 * the time grid in both DayView and WeekView. Tap → open the tile detail.
 *
 * Colors come from the parent view (type-icon based) so the chip matches the
 * timed event blocks for the same tile.
 */
import React from 'react';
import { Text, TouchableOpacity, ViewStyle } from 'react-native';
import type { TileColors } from '@/hooks/useTileColors';
import type { Tile } from '@/types';

interface Props {
  tile: Tile;
  colors: TileColors;
  onPress: () => void;
  style?: ViewStyle;
}

export function AllDayChip({ tile, colors, onPress, style }: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        {
          backgroundColor: colors.bg,
          borderRadius: 4,
          borderWidth: 1,
          borderColor: colors.border,
          borderStyle: colors.deadlineBorder ? 'dashed' : 'solid',
          paddingHorizontal: 6,
          paddingVertical: 3,
          marginBottom: 2,
        },
        style,
      ]}
    >
      <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: '600', color: colors.fg }}>
        {tile.title || '(senza titolo)'}
      </Text>
    </TouchableOpacity>
  );
}
