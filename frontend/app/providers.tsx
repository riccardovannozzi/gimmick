'use client';

import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/sonner';
import { useAuthStore } from '@/store/auth-store';
import { ActionColorsContext, useActionColorsQuery } from '@/store/action-colors-store';

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

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthInitializer>
        <ActionColorsProvider>
          {children}
        </ActionColorsProvider>
        <Toaster position="top-right" />
      </AuthInitializer>
    </QueryClientProvider>
  );
}
