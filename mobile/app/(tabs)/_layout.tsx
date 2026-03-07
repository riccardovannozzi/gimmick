import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Tabs, usePathname, useRouter } from 'expo-router';
import { Home, LayoutGrid, Settings } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '@/lib/theme';

const tabs = [
  { name: 'index', path: '/', label: 'Home', icon: Home },
  { name: 'history', path: '/history', label: 'Tiles', icon: LayoutGrid },
  { name: 'settings', path: '/settings', label: 'Settings', icon: Settings },
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
              size={20}
              color={isActive ? colors.primary : colors.tertiary}
              strokeWidth={isActive ? 2 : 1.5}
            />
            {isActive && (
              <Text
                style={{
                  fontSize: 13,
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
        <Tabs.Screen name="history" />
        <Tabs.Screen name="settings" />
      </Tabs>
    </View>
  );
}
