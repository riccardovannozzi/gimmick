import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastContainer } from '@/components/ui/Toast';
import { useAuthStore } from '@/store';
import { ThemeProvider, useTheme } from '@/lib/theme';

import '../global.css';

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
      </Stack>
      <ToastContainer />
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <ThemeProvider>
            <AppContent />
          </ThemeProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
