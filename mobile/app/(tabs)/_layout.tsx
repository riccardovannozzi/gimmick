import React from 'react';
import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { TopNav } from '@/components/layout/TopNav';
import { usePixelTheme } from '@/components/pixel';

export default function TabsLayout() {
  const theme = usePixelTheme();

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg1 }}>
      <TopNav />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: 'none' },
          tabBarShowLabel: false,
          sceneStyle: { backgroundColor: theme.bg1 },
        }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="history" />
        <Tabs.Screen name="flows" />
        <Tabs.Screen name="chrono" />
        <Tabs.Screen name="settings" />
      </Tabs>
    </View>
  );
}
