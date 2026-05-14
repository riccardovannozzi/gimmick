'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { ChatPanel } from '@/components/chat/chat-panel';
import { FlowModal } from '@/components/flow/FlowModal';
import { useAuthStore } from '@/store/auth-store';
import { useTypeIcons } from '@/store/type-icons-store';
import { useChatStore } from '@/store/chat-store';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, isLoading, isInitialized } = useAuthStore();
  const chatOpen = useChatStore((s) => s.open);
  const setChatOpen = useChatStore((s) => s.setOpen);
  const fetchTypeIcons = useTypeIcons((s) => s.fetchAll);
  const typeIconsLoaded = useTypeIcons((s) => s.loaded);

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

  if (!isInitialized || isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <div className="text-zinc-400">Caricamento...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-hidden">{children}</main>
      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
      <FlowModal />
    </div>
  );
}
