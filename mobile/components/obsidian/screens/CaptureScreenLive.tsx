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
import { usePendingTagStore } from '@/store/pendingTagStore';
import { toast } from '@/store';
import { uploadBufferItems } from '@/lib/api';
import { ObsidianCaptureScreen, EMPTY_CAPTURE_OPTIONS, type CaptureOptions } from './CaptureScreen';
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
  const removeItem = useBufferStore((s) => s.removeItem);
  const clearBuffer = useBufferStore((s) => s.clearBuffer);
  const accessToken = useAuthStore((s) => s.accessToken);
  const [uploading, setUploading] = React.useState(false);
  // Metadati scelti nel pannello "Set options", persistiti all'invio.
  const [tileOptions, setTileOptions] = React.useState<CaptureOptions>(EMPTY_CAPTURE_OPTIONS);

  // Tag scelto via #hashtag nell'editor di testo: lo riflettiamo come tag del
  // tile in creazione, così compare pre-selezionato anche nel pannello Set
  // options. Consumato (azzerato) all'invio.
  const pendingTagId = usePendingTagStore((s) => s.tagId);
  const clearPendingTag = usePendingTagStore((s) => s.clear);
  React.useEffect(() => {
    if (pendingTagId) {
      setTileOptions((o) => (o.tag_id === pendingTagId ? o : { ...o, tag_id: pendingTagId }));
    }
  }, [pendingTagId]);
  // Testo dei contenuti in buffer: alimenta la bacchetta AI del picker tag
  // (che suggerisce i tag esistenti pertinenti, come sul web col testo del tile).
  const suggestText = React.useMemo(
    () => items.map((i) => i.preview || i.fileName || '').filter(Boolean).join(' '),
    [items],
  );

  const send = React.useCallback(async () => {
    if (items.length === 0 || uploading) return;
    if (!accessToken) {
      toast.warning('Accedi per inviare gli spark');
      router.push('/auth/login' as never);
      return;
    }
    setUploading(true);
    try {
      // Il tag viaggia nel parametro dedicato `tagIds` (uploadBufferItems ignora
      // options.tag_id e legge solo quello); il resto va in tileOptions.
      const tagIds = tileOptions.tag_id ? [tileOptions.tag_id] : undefined;
      const result = await uploadBufferItems(items, tagIds, tileOptions);
      if (result.success) {
        toast.success(`${result.results.length} elementi inviati`);
        clearBuffer();
        setTileOptions(EMPTY_CAPTURE_OPTIONS);
        clearPendingTag();
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
  }, [items, uploading, accessToken, clearBuffer, router, tileOptions]);

  return (
    <ObsidianCaptureScreen
      bufferCount={items.length}
      onCapture={(key) => router.push(CAPTURE_ROUTE[key] as never)}
      onSend={send}
      onOpenBuffer={() => router.push('/obsidian-buffer' as never)}
      onAsk={() => router.push('/obsidian-ask' as never)}
      onNavigateView={(id) => router.replace(VIEW_ROUTE[id] as never)}
      onSettings={() => router.replace('/settings' as never)}
      options={tileOptions}
      onOptionsChange={setTileOptions}
      suggestText={suggestText}
      items={items}
      onRemoveItem={removeItem}
    />
  );
}
