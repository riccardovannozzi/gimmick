/**
 * Top app-wide navigation strip (Home / Tiles / Settings).
 *
 * Lives in the (tabs) layout but also rendered on top of the tile detail
 * (`/tile/[id]`) and tile-list (`/tile/[id]/list`) screens so the user always
 * sees the same primary navigation. Tapping a tab uses `router.replace` so we
 * don't grow the back stack with redundant entries.
 */
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import {
  IconHome,
  IconLayoutGrid,
  IconRoute,
  IconCalendarTime,
  IconSettings,
} from '@tabler/icons-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '@/lib/theme';

const TABS = [
  { name: 'index', path: '/', label: 'Home', icon: IconHome },
  { name: 'history', path: '/history', label: 'Tiles', icon: IconLayoutGrid },
  { name: 'flows', path: '/flows', label: 'Flows', icon: IconRoute },
  { name: 'chrono', path: '/chrono', label: 'Chrono', icon: IconCalendarTime },
  { name: 'settings', path: '/settings', label: 'Settings', icon: IconSettings },
] as const;

interface TopNavProps {
  /** Force a specific tab to render as active (used on non-tab screens like
   *  /tile/[id] where pathname won't match any tab path). */
  activePath?: '/' | '/history' | '/flows' | '/chrono' | '/settings';
}

export function TopNav({ activePath }: TopNavProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // `flexGrow: 0` keeps a horizontal ScrollView from stretching down the
      // parent flex column — without it the bar takes up the whole screen.
      style={{ backgroundColor: colors.background1, flexGrow: 0 }}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: 8,
        paddingHorizontal: 16,
        alignItems: 'center',
        gap: 6,
      }}
    >
      {TABS.map((tab) => {
        const matchPath = activePath ?? pathname;
        const isActive =
          matchPath === tab.path || (tab.path === '/' && matchPath === '/index');
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
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.primary }}>
                {tab.label}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
