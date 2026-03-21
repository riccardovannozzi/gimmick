import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import Svg, { Rect, Line, Circle } from 'react-native-svg';
import { useThemeColors } from '@/lib/theme';

type ActionType = 'none' | 'anytime' | 'deadline' | 'event' | 'call_to_action';

export type TileSquareProps = {
  title: string;
  subtitle?: string;
  color: string;
  actionType: ActionType;
  completed: boolean;
  highlight?: boolean;
  onPress?: () => void;
};

function PatternSvg({ actionType, color }: { actionType: ActionType; color: string }) {
  switch (actionType) {
    case 'none':
      return null;
    case 'anytime':
      return (
        <Svg style={styles.patternSvg} viewBox="0 0 80 80">
          <Rect x={6} y={6} width={68} height={68} fill="none" stroke={color} strokeWidth={5} strokeOpacity={0.2} rx={3} />
        </Svg>
      );
    case 'deadline':
      return (
        <Svg style={styles.patternSvg} viewBox="0 0 80 80">
          <Line x1={-10} y1={0} x2={80} y2={90} stroke={color} strokeWidth={5} strokeOpacity={0.18} />
          <Line x1={10} y1={-10} x2={100} y2={80} stroke={color} strokeWidth={5} strokeOpacity={0.18} />
          <Line x1={-30} y1={0} x2={60} y2={90} stroke={color} strokeWidth={5} strokeOpacity={0.18} />
          <Line x1={30} y1={-10} x2={120} y2={80} stroke={color} strokeWidth={5} strokeOpacity={0.18} />
          <Line x1={50} y1={-10} x2={140} y2={80} stroke={color} strokeWidth={5} strokeOpacity={0.18} />
        </Svg>
      );
    case 'event':
      return (
        <Svg style={styles.patternSvg} viewBox="0 0 80 80">
          <Line x1={80} y1={0} x2={-10} y2={90} stroke={color} strokeWidth={5} strokeOpacity={0.18} />
          <Line x1={100} y1={0} x2={10} y2={90} stroke={color} strokeWidth={5} strokeOpacity={0.18} />
          <Line x1={60} y1={-10} x2={-20} y2={80} stroke={color} strokeWidth={5} strokeOpacity={0.18} />
          <Line x1={120} y1={0} x2={30} y2={90} stroke={color} strokeWidth={5} strokeOpacity={0.18} />
          <Line x1={40} y1={-10} x2={-40} y2={80} stroke={color} strokeWidth={5} strokeOpacity={0.18} />
        </Svg>
      );
    case 'call_to_action':
      return (
        <Svg style={styles.patternSvg} viewBox="0 0 80 80">
          <Circle cx={40} cy={40} r={22} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={0.3} />
          <Circle cx={40} cy={40} r={13} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={0.3} />
          <Circle cx={40} cy={40} r={5} fill={color} fillOpacity={0.4} />
        </Svg>
      );
    default:
      return null;
  }
}

function CompletedPattern({ color }: { color: string }) {
  return (
    <Svg style={styles.patternSvg} viewBox="0 0 80 80">
      <Line x1={10} y1={10} x2={70} y2={70} stroke={color} strokeWidth={5} strokeOpacity={0.4} strokeLinecap="round" />
      <Line x1={70} y1={10} x2={10} y2={70} stroke={color} strokeWidth={5} strokeOpacity={0.4} strokeLinecap="round" />
    </Svg>
  );
}

export function TileSquare({ title, subtitle, color, actionType, completed, highlight, onPress }: TileSquareProps) {
  const colors = useThemeColors();

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.container,
        {
          backgroundColor: colors.background2,
          borderColor: highlight ? '#E24B4A' : colors.border,
          borderWidth: highlight ? 1.5 : 0.5,
          opacity: completed ? 0.5 : 1,
        },
      ]}
    >
      {/* Color stripe */}
      <View style={[styles.stripe, { backgroundColor: color }]} />

      {/* Pattern SVG */}
      {completed ? <CompletedPattern color={color} /> : <PatternSvg actionType={actionType} color={color} />}

      {/* Text content */}
      <View style={styles.textContainer}>
        <Text
          numberOfLines={2}
          style={[
            styles.title,
            {
              color: colors.primary,
              textDecorationLine: completed ? 'line-through' : 'none',
            },
          ]}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={[styles.subtitle, { color: colors.secondary }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 64,
    height: 64,
    borderRadius: 8,
    overflow: 'hidden',
  },
  stripe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 8,
  },
  patternSvg: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 64,
    height: 64,
  },
  textContainer: {
    flex: 1,
    paddingTop: 12,
    paddingHorizontal: 6,
    paddingBottom: 6,
    justifyContent: 'flex-end',
  },
  title: {
    fontSize: 10,
    fontWeight: '500',
  },
  subtitle: {
    fontSize: 9,
    opacity: 0.7,
  },
});
