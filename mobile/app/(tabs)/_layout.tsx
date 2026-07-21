import React from 'react';
import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { TopNav } from '@/components/layout/TopNav';
import { usePixelTheme } from '@/components/pixel';
import { isObsidianShellEnabled } from '@/lib/feature-flags';

export default function TabsLayout() {
  const theme = usePixelTheme();

  // Strangler: every Obsidian tab now draws its own chrome — the views a
  // TopNav, Capture an AppHeader whose drawer carries the view links — so the
  // legacy strip would only double up.
  const showLegacyNav = !isObsidianShellEnabled();

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg1 }}>
      {showLegacyNav && <TopNav />}
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
