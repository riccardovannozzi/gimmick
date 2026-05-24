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
      {/* overflow:hidden impedisce alla scene di disegnare sotto la TopNav
         su Android Fabric, dove <Tabs> non sempre rispetta i bounds del flex
         parent. */}
      <View style={{ flex: 1, overflow: 'hidden' }}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarStyle: { display: 'none' },
            tabBarShowLabel: false,
            sceneStyle: { flex: 1, backgroundColor: theme.bg1 },
          }}
        >
          <Tabs.Screen name="index" />
          <Tabs.Screen name="history" />
          <Tabs.Screen name="flows" />
          <Tabs.Screen name="chrono" />
          <Tabs.Screen name="settings" />
        </Tabs>
      </View>
    </View>
  );
}
