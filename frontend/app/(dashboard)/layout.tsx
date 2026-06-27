'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { ChatPanel } from '@/components/chat/chat-panel';
import { ObsidianShell } from '@/components/shell/ObsidianShell';
import { isObsidianShellEnabled } from '@/lib/feature-flags';
import { usePixelTheme } from '@/components/pixel';
import { useAuthStore } from '@/store/auth-store';
import { useTypeIcons } from '@/store/type-icons-store';
import { useChatStore } from '@/store/chat-store';
import { useCardRoster } from '@/store/card-roster-store';
import { settingsApi } from '@/lib/api';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const theme = usePixelTheme();
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, isInitialized } = useAuthStore();
  const chatOpen = useChatStore((s) => s.open);
  const setChatOpen = useChatStore((s) => s.setOpen);
  const fetchTypeIcons = useTypeIcons((s) => s.fetchAll);
  const typeIconsLoaded = useTypeIcons((s) => s.loaded);
  const hydrateRoster = useCardRoster((s) => s.hydrateFromServer);
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  useEffect(() => {
    if (isInitialized && !isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, isInitialized, router]);

  // Load type icons from DB on first render
  useEffect(() => {
    if (user && !typeIconsLoaded) {
      fetchTypeIcons();
    }
  }, [user, typeIconsLoaded, fetchTypeIcons]);

  // Idratazione mascot settings dal backend (sostituiscono il local
  // se differiscono). Fa una sola fetch per sessione utente.
  useEffect(() => {
    if (user) hydrateRoster();
  }, [user, hydrateRoster]);

  // Onboarding gating: se l'utente non ha mai completato il welcome wizard,
  // forziamo il redirect su /welcome (tranne se già lì). Un check per sessione.
  useEffect(() => {
    if (!user || onboardingChecked) return;
    if (pathname === '/welcome') {
      // L'utente è già nel wizard — non serve check né redirect.
      setOnboardingChecked(true);
      return;
    }
    (async () => {
      const res = await settingsApi.get<{ completed_at?: string } | null>('onboarding_v1');
      const completed = res.success && res.data && (res.data as { completed_at?: string }).completed_at;
      setOnboardingChecked(true);
      if (!completed) router.replace('/welcome');
    })();
  }, [user, pathname, onboardingChecked, router]);

  if (!isInitialized || isLoading) {
    return (
      <div
        className="flex h-screen items-center justify-center"
        style={{ background: theme.bg1 }}
      >
        <div
          style={{
            color: theme.ink2,
            fontFamily: 'var(--font-pixel-head)',
            fontSize: 10,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          Caricamento...
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Migrazione strangler (Fase 0): dietro feature-flag montiamo lo shell
  // Obsidian con dati reali al posto della shell arcade. Default OFF →
  // produzione invariata. La ChatPanel resta montata in entrambi i casi così
  // che "Ask Gimmick" (onAsk) continui a funzionare.
  if (isObsidianShellEnabled()) {
    return (
      <>
        <ObsidianShell>{children}</ObsidianShell>
        <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
      </>
    );
  }

  return (
    <div className="flex h-screen" style={{ background: theme.bg1 }}>
      <Sidebar />
      <main className="flex-1 overflow-hidden">{children}</main>
      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}
