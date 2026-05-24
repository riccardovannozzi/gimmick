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
  IconArrowLeft,
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
  const canGoBack = router.canGoBack();

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
        {/* Back button — sempre prima icona della nav. Disabilitata (opacity)
           quando non c'è cronologia di navigazione. */}
        <Pressable
          onPress={() => { if (canGoBack) router.back(); }}
          android_ripple={null}
          hitSlop={8}
          disabled={!canGoBack}
          style={({ pressed }) => ({
            padding: 8,
            opacity: !canGoBack ? 0.3 : pressed ? 0.6 : 1,
          })}
        >
          <IconArrowLeft size={28} color={theme.ink} strokeWidth={2} />
        </Pressable>
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
                hitSlop={8}
                style={({ pressed }) => ({
                  padding: 8,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Icon size={28} color={theme.ink} strokeWidth={2} />
              </Pressable>
            );
          }
          // Active tab — pill bg accent + border 2px + offset shadow.
          // Pattern Android-safe: bg/border sul View wrapper esterno (Pressable
          // su Android ignora il backgroundColor); offset shadow tramite un
          // container relative + due View absolute fratelli, z-order garantito
          // dall'ordine JSX. Mirror del PixelTabLink di
          // frontend/components/layout/header.tsx.
          const sh = theme.shadowOffset;
          return (
            <View
              key={tab.name}
              style={{ position: 'relative', paddingRight: sh, paddingBottom: sh }}
            >
              {sh > 0 && (
                <View
                  style={{
                    position: 'absolute',
                    left: sh,
                    top: sh,
                    right: 0,
                    bottom: 0,
                    backgroundColor: theme.shadowColor,
                  }}
                />
              )}
              <Pressable
                onPress={() => router.replace(tab.path as any)}
                android_ripple={null}
                style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    height: 36,
                    paddingHorizontal: 12,
                    gap: 8,
                    backgroundColor: theme.accent,
                    borderWidth: 2,
                    borderColor: theme.border,
                  }}
                >
                  <Icon size={16} color={theme.onAccent as string} strokeWidth={2.4} />
                  <Text
                    numberOfLines={1}
                    style={{
                      fontFamily: theme.fontHead,
                      fontSize: 11,
                      lineHeight: 14,
                      color: theme.onAccent as string,
                      letterSpacing: 1,
                    }}
                  >
                    {tab.label}
                  </Text>
                </View>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
