import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useThemeColors } from '@/lib/theme';

type DaySeparatorProps = {
  label: string;
  isToday: boolean;
  height: number;
};

export function DaySeparator({ label, isToday, height }: DaySeparatorProps) {
  const colors = useThemeColors();

  return (
    <View style={[styles.container, { height }]}>
      <View style={[styles.line, { backgroundColor: colors.border }]} />
      <View style={styles.labelWrapper}>
        <Text
          style={[
            styles.label,
            {
              color: isToday ? colors.primary : colors.tertiary,
              fontWeight: isToday ? '600' : '400',
            },
          ]}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  line: {
    width: 0.5,
    height: '100%',
  },
  labelWrapper: {
    transform: [{ rotate: '-90deg' }],
    width: 50,
    alignItems: 'center',
    marginLeft: -24,
  },
  label: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
