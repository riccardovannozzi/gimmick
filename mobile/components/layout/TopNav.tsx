/**
 * Top app-wide navigation strip (Home / Tiles / Flows / Chrono / Settings).
 *
 * Lives in the (tabs) layout but is also rendered on top of `/tile/[id]` and
 * `/tile/[id]/list` so the user always sees the same primary navigation.
 * `router.replace` avoids growing the back stack with redundant entries.
 *
 * Pixel Arcade design: bordo inferiore 2px, pill attiva con bordo + accent,
 * icone monochrome con la stessa famiglia (Tabler) usata altrove.
 */
import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import {
  IconHome,
  IconLayoutGrid,
  IconRoute,
  IconCalendarTime,
  IconSettings,
} from '@tabler/icons-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePixelTheme } from '@/components/pixel';

const TABS = [
  { name: 'index', path: '/', label: 'HOME', icon: IconHome },
  { name: 'history', path: '/history', label: 'TILES', icon: IconLayoutGrid },
  { name: 'flows', path: '/flows', label: 'FLOWS', icon: IconRoute },
  { name: 'chrono', path: '/chrono', label: 'CHRONO', icon: IconCalendarTime },
  { name: 'settings', path: '/settings', label: 'SETTINGS', icon: IconSettings },
] as const;

interface TopNavProps {
  /** Force a specific tab to render as active (used on non-tab screens like
   *  /tile/[id] where pathname won't match any tab path). */
  activePath?: '/' | '/history' | '/flows' | '/chrono' | '/settings';
}

export function TopNav({ activePath }: TopNavProps) {
  const theme = usePixelTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <View style={{ backgroundColor: theme.bg1, borderBottomWidth: 2, borderBottomColor: theme.border }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        // `flexGrow: 0` keeps a horizontal ScrollView from stretching down the
        // parent flex column — without it the bar takes up the whole screen.
        style={{ flexGrow: 0 }}
        contentContainerStyle={{
          paddingTop: insets.top + 10,
          paddingBottom: 8,
          paddingHorizontal: 12,
          alignItems: 'center',
          gap: 10,
        }}
      >
        {TABS.map((tab) => {
          const matchPath = activePath ?? pathname;
          const isActive =
            matchPath === tab.path || (tab.path === '/' && matchPath === '/index');
          const Icon = tab.icon;
          if (!isActive) {
            return (
              <Pressable
                key={tab.name}
                onPress={() => router.replace(tab.path as any)}
                android_ripple={null}
                style={({ pressed }) => ({
                  padding: 4,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Icon size={18} color={theme.ink2} strokeWidth={1.8} />
              </Pressable>
            );
          }
          return (
            <Pressable
              key={tab.name}
              onPress={() => router.replace(tab.path as any)}
              android_ripple={null}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderWidth: 2,
                borderColor: theme.border,
                backgroundColor: theme.accent,
                gap: 6,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Icon size={16} color={theme.onAccent as string} strokeWidth={2.2} />
              <Text
                style={{
                  fontFamily: theme.fontHead,
                  fontSize: 9,
                  color: theme.onAccent as string,
                  letterSpacing: 1,
                }}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
