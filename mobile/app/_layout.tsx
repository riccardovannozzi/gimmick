import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { ToastContainer } from '@/components/ui/Toast';
import { useAuthStore, useSettingsStore } from '@/store';
import { ThemeProvider, useTheme } from '@/lib/theme';
import { PixelThemeProvider } from '@/components/pixel';

import '../global.css';

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
});

function AppContent() {
  const initialize = useAuthStore((state) => state.initialize);
  const { colors, isDark } = useTheme();

  useEffect(() => {
    initialize();
  }, []);

  return (
    <View className={`flex-1 ${isDark ? 'dark' : ''}`}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background1 },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="capture/photo"
          options={{
            presentation: 'fullScreenModal',
            animation: 'fade',
          }}
        />
        <Stack.Screen
          name="capture/video"
          options={{
            presentation: 'fullScreenModal',
            animation: 'fade',
          }}
        />
        <Stack.Screen
          name="capture/text"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="capture/voice"
          options={{
            presentation: 'fullScreenModal',
            animation: 'fade',
          }}
        />
        <Stack.Screen
          name="capture/file"
          options={{
            presentation: 'transparentModal',
          }}
        />
        <Stack.Screen
          name="capture/gallery"
          options={{
            presentation: 'transparentModal',
          }}
        />
        <Stack.Screen
          name="auth/login"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="tile/[id]"
          options={{
            presentation: 'fullScreenModal',
            animation: 'slide_from_right',
          }}
        />
      </Stack>
      <ToastContainer />
    </View>
  );
}

// PixelBridge legge i settings Pixel dallo store (persistiti in AsyncStorage)
// e li propaga in modo controllato al PixelThemeProvider. Ogni modifica fatta
// dalla Settings UI (palette / shadow / background / …) finisce direttamente
// nello store, che a sua volta fa re-render di tutto il sub-tree Pixel.
function PixelBridge({ children }: { children: React.ReactNode }) {
  const pixelSettings = useSettingsStore((s) => s.pixelSettings);
  const setPixelSettings = useSettingsStore((s) => s.setPixelSettings);
  return (
    <PixelThemeProvider value={pixelSettings} onChange={setPixelSettings}>
      {children}
    </PixelThemeProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    'PressStart2P-Regular': require('../assets/fonts/PressStart2P-Regular.ttf'),
    'JetBrainsMono-Regular': require('../assets/fonts/JetBrainsMono-Regular.ttf'),
    'JetBrainsMono-Bold': require('../assets/fonts/JetBrainsMono-Bold.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <BottomSheetModalProvider>
            <ThemeProvider>
              {/* Pixel Arcade design system. Sits alongside the legacy
                  ThemeProvider until existing screens are migrated to use
                  `usePixelTheme()` instead of `useThemeColors()`. */}
              <PixelBridge>
                <AppContent />
              </PixelBridge>
            </ThemeProvider>
          </BottomSheetModalProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
