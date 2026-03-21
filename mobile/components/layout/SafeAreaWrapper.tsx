import React from 'react';
import { View, ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '@/lib/theme';

interface SafeAreaWrapperProps extends ViewProps {
  children: React.ReactNode;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  statusBarStyle?: 'light' | 'dark' | 'auto';
}

export function SafeAreaWrapper({
  children,
  edges = ['top', 'bottom'],
  statusBarStyle,
  style,
  ...props
}: SafeAreaWrapperProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const resolvedStatusBarStyle = statusBarStyle ?? (isDark ? 'light' : 'dark');

  const padding: Record<string, number> = {};
  if (edges.includes('top')) padding.paddingTop = insets.top;
  if (edges.includes('bottom')) padding.paddingBottom = insets.bottom;
  if (edges.includes('left')) padding.paddingLeft = insets.left;
  if (edges.includes('right')) padding.paddingRight = insets.right;

  return (
    <View
      style={[{ flex: 1, backgroundColor: colors.background1 }, padding, style]}
      {...props}
    >
      <StatusBar style={resolvedStatusBarStyle} />
      {children}
    </View>
  );
}
