/**
 * Outbox offline — invio della coda di cattura.
 *
 * Due percorsi che condividono `uploadBufferItems`:
 * · sendComposing(): invio immediato dal pulsante paperplane. Online carica
 *   subito gli item "in composizione"; offline li committa in coda come un tile.
 * · flushOutbox(): il sync worker svuota i tile GIÀ in coda (batch committati),
 *   uno per tile, su avvio / foreground / ritorno online.
 *
 * Nessun modulo nativo per la connettività: lo store `connectivity` (aggiornato
 * da richieste reali + ping /health) dice se siamo online; il `fetch` resta il
 * test finale.
 */
import { useBufferStore, type BufferPending } from '@/store/bufferStore';
import { useAuthStore } from '@/store/authStore';
import { useConnectivityStore } from '@/store/connectivityStore';
import { uploadBufferItems } from '@/lib/api';

export type FlushStatus = 'ok' | 'offline' | 'error' | 'empty' | 'no-auth' | 'busy';
export interface FlushResult {
  status: FlushStatus;
  /** Tile effettivamente sincronizzati. */
  uploaded: number;
  errors: string[];
}

// Un solo flush per volta (worker + eventuale invio manuale condividono questo).
let flushing = false;

/** Errori che sanno di "offline": vanno ritentati, non mostrati come fallimenti. */
function looksOffline(errors: string[]): boolean {
  return (
    errors.length > 0 &&
    errors.every((e) => /network|fetch|timeout|timed out|conness|offline|unreachable/i.test(e))
  );
}

/**
 * Svuota i tile in coda (batch committati offline), uno per tile con le proprie
 * opzioni. Rimuove dalla coda solo gli item davvero caricati (niente duplicati).
 */
export async function flushOutbox(): Promise<FlushResult> {
  if (flushing) return { status: 'busy', uploaded: 0, errors: [] };

  const batchIds = Object.keys(useBufferStore.getState().batches);
  if (batchIds.length === 0) return { status: 'empty', uploaded: 0, errors: [] };
  if (!useAuthStore.getState().accessToken) return { status: 'no-auth', uploaded: 0, errors: [] };

  flushing = true;
  useBufferStore.getState().setUploading(true);
  try {
    let uploaded = 0;
    const errors: string[] = [];
    for (const batchId of batchIds) {
      const meta = useBufferStore.getState().batches[batchId];
      const batchItems = useBufferStore.getState().items.filter((i) => i.batchId === batchId);
      if (batchItems.length === 0) {
        useBufferStore.getState().removeItemsById([]); // pota il batch vuoto
        continue;
      }
      const result = await uploadBufferItems(batchItems, meta?.tagIds, meta?.options);
      // Rimuovi gli item caricati (+ file, + prune del batch se svuotato).
      useBufferStore.getState().removeItemsById(result.uploadedIds ?? []);
      if (result.success) { uploaded++; continue; }
      if (looksOffline(result.errors)) {
        // Offline: fermati e ritenta al prossimo trigger. Coda mantenuta.
        return { status: 'offline', uploaded, errors: result.errors };
      }
      errors.push(...result.errors);
    }
    if (errors.length) return { status: 'error', uploaded, errors };
    return { status: 'ok', uploaded, errors: [] };
  } catch (e) {
    return { status: 'offline', uploaded: 0, errors: [e instanceof Error ? e.message : 'Network error'] };
  } finally {
    useBufferStore.getState().setUploading(false);
    flushing = false;
  }
}

export type SendResult = 'sent' | 'queued' | 'empty' | 'no-auth';

/**
 * Invio immediato dal pulsante. Online: carica subito gli item in composizione
 * (un tile) e li rimuove. Offline (o fallimento rete): li committa in coda come
 * un tile → sincronizzerà da solo al ritorno online.
 */
export async function sendComposing(meta: BufferPending): Promise<{ result: SendResult; count: number }> {
  const composing = useBufferStore.getState().items.filter((i) => i.status !== 'queued');
  if (composing.length === 0) return { result: 'empty', count: 0 };
  if (!useAuthStore.getState().accessToken) return { result: 'no-auth', count: 0 };

  const count = composing.length;

  if (useConnectivityStore.getState().online) {
    useBufferStore.getState().setUploading(true);
    try {
      const res = await uploadBufferItems(composing, meta.tagIds, meta.options);
      useBufferStore.getState().removeItemsById(res.uploadedIds ?? []);
      if (res.success) return { result: 'sent', count };
      // Rete caduta a metà invio / errore: metti in coda ciò che resta.
      useBufferStore.getState().commitToQueue(meta);
      return { result: 'queued', count };
    } finally {
      useBufferStore.getState().setUploading(false);
    }
  }

  // Offline: committa in coda senza nemmeno tentare la rete.
  useBufferStore.getState().commitToQueue(meta);
  return { result: 'queued', count };
}
