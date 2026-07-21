/**
 * Gimmick · Obsidian — Capture screen wired to the buffer + upload pipeline.
 *
 * The six capture bars route to the existing `/capture/*` flows rather than to
 * the Obsidian `CaptureFlows` mockups: those flows own the device permissions
 * (camera, mic, document picker) and already feed `bufferStore`, so reusing
 * them keeps capture — the app's core function — on proven code while the
 * chrome moves to Obsidian. Sending reuses `uploadBufferItems`, the same helper
 * the legacy home calls.
 */
import React from 'react';
import { useRouter } from 'expo-router';
import { useBufferStore } from '@/store/bufferStore';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store';
import { uploadBufferItems } from '@/lib/api';
import { ObsidianCaptureScreen } from './CaptureScreen';
import type { MobileViewId } from '../TopNav';

const CAPTURE_ROUTE = {
  photo: '/capture/photo',
  video: '/capture/video',
  gallery: '/capture/gallery',
  text: '/capture/text',
  voice: '/capture/voice',
  file: '/capture/file',
} as const;

const VIEW_ROUTE: Record<MobileViewId, string> = {
  tiles: '/history',
  flows: '/flows',
  chrono: '/chrono',
  settings: '/settings',
};

export function ObsidianCaptureScreenLive() {
  const router = useRouter();
  const items = useBufferStore((s) => s.items);
  const clearBuffer = useBufferStore((s) => s.clearBuffer);
  const accessToken = useAuthStore((s) => s.accessToken);
  const [uploading, setUploading] = React.useState(false);

  const send = React.useCallback(async () => {
    if (items.length === 0 || uploading) return;
    if (!accessToken) {
      toast.warning('Accedi per inviare gli spark');
      router.push('/auth/login' as never);
      return;
    }
    setUploading(true);
    try {
      const result = await uploadBufferItems(items);
      if (result.success) {
        toast.success(`${result.results.length} elementi inviati`);
        clearBuffer();
      } else if (result.results.length > 0) {
        toast.warning(`${result.results.length} inviati, ${result.errors.length} errori`);
      } else {
        toast.error(result.errors[0] ?? 'Invio fallito');
      }
    } catch {
      toast.error('Invio fallito');
    } finally {
      setUploading(false);
    }
  }, [items, uploading, accessToken, clearBuffer, router]);

  return (
    <ObsidianCaptureScreen
      bufferCount={items.length}
      onCapture={(key) => router.push(CAPTURE_ROUTE[key] as never)}
      onSend={send}
      onOpenBuffer={() => router.push('/obsidian-buffer' as never)}
      onNavigateView={(id) => router.replace(VIEW_ROUTE[id] as never)}
      onSettings={() => router.replace('/settings' as never)}
    />
  );
}
