/**
 * Flat colored chip for an all-day event. Used in the "all-day" row above
 * the time grid in both DayView and WeekView.
 *
 * Pixel design: border 2px, no border-radius, font JetBrainsMono bold.
 * When `colors.hatched` is true, overlay a diagonal hatching pattern
 * (mirror del web StatusPattern diagonal_ltr).
 */
import React from 'react';
import { Text, Pressable, View, StyleSheet, ViewStyle } from 'react-native';
import Svg, { Defs, Pattern, Line, Rect } from 'react-native-svg';
import type { TileColors } from '@/hooks/useTileColors';
import type { Tile } from '@/types';

interface Props {
  tile: Tile;
  colors: TileColors;
  onPress: () => void;
  style?: ViewStyle;
}

function HatchOverlay({ color }: { color: string }) {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <Pattern
          id="hatch-chip"
          patternUnits="userSpaceOnUse"
          width={10}
          height={10}
          patternTransform="rotate(45)"
        >
          <Line x1={0} y1={0} x2={0} y2={10} stroke={color} strokeWidth={1.5} strokeOpacity={0.55} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#hatch-chip)" />
    </Svg>
  );
}

export function AllDayChip({ tile, colors, onPress, style }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: colors.bg,
          borderWidth: 2,
          borderColor: colors.border,
          borderStyle: colors.deadlineBorder ? 'dashed' : 'solid',
          paddingHorizontal: 8,
          paddingVertical: 4,
          marginBottom: 4,
          overflow: 'hidden',
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {colors.hatched && <HatchOverlay color={colors.hatchColor} />}
      {/* Title — sans-serif system per coerenza con FullCalendar/Inter del web */}
      <Text
        numberOfLines={1}
        style={{
          fontSize: 13,
          fontWeight: '700',
          color: colors.fg,
        }}
      >
        {tile.title || '(senza titolo)'}
      </Text>
    </Pressable>
  );
}
