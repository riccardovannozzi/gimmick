'use client';

import { useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/sonner';
import { useAuthStore } from '@/store/auth-store';
import { ActionColorsContext, useActionColorsQuery } from '@/store/action-colors-store';
import { PixelThemeProvider, usePixelSettings, type PixelSettings } from '@/components/pixel';
import { settingsApi } from '@/lib/api';

const PIXEL_SETTINGS_KEY = 'pixel_settings';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
});

function AuthInitializer({ children }: { children: React.ReactNode }) {
  const initialize = useAuthStore((state) => state.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return <>{children}</>;
}

function ActionColorsProvider({ children }: { children: React.ReactNode }) {
  const { actionColors } = useActionColorsQuery();
  return (
    <ActionColorsContext.Provider value={actionColors}>
      {children}
    </ActionColorsContext.Provider>
  );
}

/**
 * Bidirectional sync of pixel settings against the server `user_settings`.
 *
 *   - On login → pull `pixel_settings`, apply if newer than localStorage
 *   - On change → debounce 600ms, push to server in background
 *
 * Local storage is the immediate-persistence layer (handled by the provider
 * itself); the server is an authoritative async copy that lets a user keep
 * the same look across devices.
 */
function PixelSettingsServerSync() {
  const user = useAuthStore((s) => s.user);
  const { settings, setAll } = usePixelSettings();
  const pulledOnce = useRef(false);
  const lastPushedJson = useRef<string>('');
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pull on login. We only pull ONCE per session to avoid clobbering local
  // edits while the user is mid-customisation.
  useEffect(() => {
    if (!user || pulledOnce.current) return;
    pulledOnce.current = true;
    settingsApi.get<PixelSettings>(PIXEL_SETTINGS_KEY).then((res) => {
      if (res.success && res.data && typeof res.data === 'object') {
        // Only apply if it actually differs from current to avoid loops.
        const incoming = res.data;
        const same = (Object.keys(incoming) as (keyof PixelSettings)[]).every(
          (k) => (incoming as any)[k] === (settings as any)[k],
        );
        if (!same) {
          setAll({ ...settings, ...incoming });
          lastPushedJson.current = JSON.stringify(incoming);
        }
      }
    }).catch(() => { /* user might not have any settings yet */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Push on change.
  useEffect(() => {
    if (!user) return;
    const json = JSON.stringify(settings);
    if (json === lastPushedJson.current) return;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      settingsApi.set(PIXEL_SETTINGS_KEY, settings).then(() => {
        lastPushedJson.current = json;
      }).catch(() => { /* best-effort */ });
    }, 600);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [user, settings]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthInitializer>
        <ActionColorsProvider>
          <PixelThemeProvider storageKey={PIXEL_SETTINGS_KEY}>
            <PixelSettingsServerSync />
            {children}
          </PixelThemeProvider>
        </ActionColorsProvider>
        <Toaster position="top-right" />
      </AuthInitializer>
    </QueryClientProvider>
  );
}
