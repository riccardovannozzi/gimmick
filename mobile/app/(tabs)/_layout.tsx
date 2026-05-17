import React from 'react';
import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { TopNav } from '@/components/layout/TopNav';
import { useThemeColors } from '@/lib/theme';

export default function TabsLayout() {
  const colors = useThemeColors();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background1 }}>
      <TopNav />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: 'none' },
          tabBarShowLabel: false,
        }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="history" />
        <Tabs.Screen name="flows" />
        <Tabs.Screen name="settings" />
      </Tabs>
    </View>
  );
}
