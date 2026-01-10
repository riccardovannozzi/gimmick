import React from 'react';
import { View, ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { colors } from '@/constants';

interface SafeAreaWrapperProps extends ViewProps {
  children: React.ReactNode;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  statusBarStyle?: 'light' | 'dark' | 'auto';
}

export function SafeAreaWrapper({
  children,
  edges = ['top', 'bottom'],
  statusBarStyle = 'light',
  className,
  ...props
}: SafeAreaWrapperProps) {
  return (
    <SafeAreaView
      edges={edges}
      className={`flex-1 bg-background-1 ${className ?? ''}`}
      style={{ backgroundColor: colors.background1 }}
      {...props}
    >
      <StatusBar style={statusBarStyle} />
      {children}
    </SafeAreaView>
  );
}
