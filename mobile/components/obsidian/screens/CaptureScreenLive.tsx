/**
 * Gimmick · Obsidian — Capture screen wired to the buffer + upload pipeline.
 *
 * The six capture bars route to the existing `/capture/*` flows rather than to
 * the Obsidian `CaptureFlows` mockups: those flows own the device permissions
 * (camera, mic, document picker) and already feed `bufferStore`, so reusing
 * them keeps capture — the app's core function — on proven code while the
 * chrome moves to Obsidian. Sending reuses `uploadBufferItems`, the same helper
 * the legacy home calls.
 *
 * Outbox: il buffer separa gli item "in composizione" (nel composer) da quelli
 * "in coda" (status 'queued', committati da un invio offline). L'invio online
 * carica subito; offline committa in coda e resetta il composer. Il contatore
 * accanto al pallino conta i TILE in coda (batch), non i singoli item.
 */
import React from 'react';
import { useRouter } from 'expo-router';
import { useBufferStore } from '@/store/bufferStore';
import { useAuthStore } from '@/store/authStore';
import { usePendingTagStore } from '@/store/pendingTagStore';
import { toast } from '@/store';
import { useConnectivityStore } from '@/store/connectivityStore';
import { sendComposing } from '@/lib/outbox';
import { ObsidianCaptureScreen, EMPTY_CAPTURE_OPTIONS, type CaptureOptions, type ConnectionStatus } from './CaptureScreen';
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
  const batches = useBufferStore((s) => s.batches);
  const addItem = useBufferStore((s) => s.addItem);
  const removeItem = useBufferStore((s) => s.removeItem);
  const accessToken = useAuthStore((s) => s.accessToken);
  const online = useConnectivityStore((s) => s.online);
  // Pallino header: rosso senza sessione, altrimenti verde/arancio per online/offline.
  const connection: ConnectionStatus = !accessToken ? 'signed-out' : online ? 'online' : 'offline';
  const [uploading, setUploading] = React.useState(false);
  // FAB arancione dopo un invio offline: conferma "tile messo in coda".
  const [queuedFlash, setQueuedFlash] = React.useState(false);
  const flashTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current); }, []);
  // Metadati scelti nel pannello "Set options", persistiti all'invio.
  const [tileOptions, setTileOptions] = React.useState<CaptureOptions>(EMPTY_CAPTURE_OPTIONS);

  // Solo gli item in composizione popolano il composer (la lista spark + il FAB).
  // Quelli 'queued' sono già committati: vivono nel contatore header e
  // sincronizzano da soli.
  const composing = React.useMemo(() => items.filter((i) => i.status !== 'queued'), [items]);
  // Tile ancora da sincronizzare = numero di batch in coda.
  const pendingTiles = Object.keys(batches).length;

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
  // Testo dei contenuti in composizione: alimenta la bacchetta AI del picker tag
  // (che suggerisce i tag esistenti pertinenti, come sul web col testo del tile).
  const suggestText = React.useMemo(
    () => composing.map((i) => i.preview || i.fileName || '').filter(Boolean).join(' '),
    [composing],
  );

  const resetComposer = React.useCallback(() => {
    setTileOptions(EMPTY_CAPTURE_OPTIONS);
    clearPendingTag();
  }, [clearPendingTag]);

  const send = React.useCallback(async () => {
    if (composing.length === 0 || uploading) return;
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
      const { result, count } = await sendComposing({ tagIds, options: tileOptions });
      if (result === 'sent') {
        toast.success(`${count} ${count === 1 ? 'elemento inviato' : 'elementi inviati'}`);
        resetComposer();
      } else if (result === 'queued') {
        // Offline: tile messo in coda. FAB arancione (conferma) + reset del
        // composer, pronto per una nuova cattura. Il contatore header sale.
        setQueuedFlash(true);
        if (flashTimer.current) clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => setQueuedFlash(false), 1400);
        toast.info('Sei offline — tile in coda, invieremo appena torni online');
        resetComposer();
      } else if (result === 'no-auth') {
        toast.warning('Accedi per inviare gli spark');
      }
    } catch {
      toast.error('Invio fallito');
    } finally {
      setUploading(false);
    }
  }, [composing.length, uploading, accessToken, router, tileOptions, resetComposer]);

  return (
    <ObsidianCaptureScreen
      bufferCount={composing.length}
      onCapture={(key) => router.push(CAPTURE_ROUTE[key] as never)}
      onSaveNote={(text) => { addItem({ type: 'text', uri: '', preview: text }); toast.success('Nota aggiunta al buffer'); }}
      onSend={send}
      onOpenBuffer={() => router.push('/obsidian-buffer' as never)}
      onAsk={() => router.push('/obsidian-ask' as never)}
      onNavigateView={(id) => router.replace(VIEW_ROUTE[id] as never)}
      onSettings={() => router.replace('/settings' as never)}
      options={tileOptions}
      onOptionsChange={setTileOptions}
      suggestText={suggestText}
      items={composing}
      onRemoveItem={removeItem}
      connection={connection}
      pendingCount={pendingTiles}
      queuedFlash={queuedFlash}
    />
  );
}
