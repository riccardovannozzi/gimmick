'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { ChatPanel } from '@/components/chat/chat-panel';
import { useAuthStore } from '@/store/auth-store';
import { useTypeIcons } from '@/store/type-icons-store';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, isLoading, isInitialized } = useAuthStore();
  const [chatOpen, setChatOpen] = useState(false);
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
      <Sidebar onOpenChat={() => setChatOpen(true)} />
      <main className="flex-1 overflow-hidden">{children}</main>
      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}
