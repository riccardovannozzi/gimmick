import React from 'react';
import { ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  className,
  ...props
}: SafeAreaWrapperProps) {
  const { colors, isDark } = useTheme();
  const resolvedStatusBarStyle = statusBarStyle ?? (isDark ? 'light' : 'dark');

  return (
    <SafeAreaView
      edges={edges}
      className={`flex-1 ${className ?? ''}`}
      style={{ backgroundColor: colors.background1 }}
      {...props}
    >
      <StatusBar style={resolvedStatusBarStyle} />
      {children}
    </SafeAreaView>
  );
}
