import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Tabs, usePathname, useRouter } from 'expo-router';
import { IconHome, IconLayoutGrid, IconSettings, IconTimeline } from '@tabler/icons-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '@/lib/theme';

const tabs = [
  { name: 'index', path: '/', label: 'Home', icon: IconHome },
  { name: 'tileview', path: '/tileview', label: 'Timeline', icon: IconTimeline },
  { name: 'history', path: '/history', label: 'Tiles', icon: IconLayoutGrid },
  { name: 'settings', path: '/settings', label: 'Settings', icon: IconSettings },
] as const;

function TopNav() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <View
      style={{
        paddingTop: insets.top + 16,
        paddingBottom: 8,
        paddingHorizontal: 16,
        backgroundColor: colors.background1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {tabs.map((tab) => {
        const isActive = pathname === tab.path || (tab.path === '/' && pathname === '/index');
        const Icon = tab.icon;
        return (
          <TouchableOpacity
            key={tab.name}
            onPress={() => router.replace(tab.path as any)}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: isActive ? 16 : 12,
              paddingVertical: 8,
              borderRadius: 20,
              backgroundColor: isActive ? colors.surfaceVariant : 'transparent',
              gap: 6,
            }}
          >
            <Icon
              size={30}
              color={isActive ? colors.primary : colors.tertiary}
              strokeWidth={isActive ? 2 : 1.5}
            />
            {isActive && (
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: '600',
                  color: colors.primary,
                }}
              >
                {tab.label}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

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
        <Tabs.Screen name="tileview" />
        <Tabs.Screen name="history" />
        <Tabs.Screen name="settings" />
      </Tabs>
    </View>
  );
}
