/**
 * Sync worker dell'outbox offline.
 *
 * Ritenta l'invio della coda quando è probabile che la rete sia tornata:
 * · all'avvio (dopo che auth e buffer persistito sono pronti),
 * · al ritorno dell'app in foreground (momento tipico di riconnessione),
 * · quando arriva/ritorna il token (login).
 *
 * Niente polling stretto né modulo di connettività nativo: sono trigger a
 * eventi. Un item "incastrato" viene ritentato al massimo a ogni foreground.
 */
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { useBufferStore } from '@/store/bufferStore';
import { useConnectivityStore } from '@/store/connectivityStore';
import { flushOutbox } from '@/lib/outbox';
import { invalidateTileData } from '@/lib/invalidate';
import { toast } from '@/store';

async function runFlush(qc: QueryClient): Promise<void> {
  // Solo i tile GIÀ committati in coda vengono sincronizzati in automatico.
  if (Object.keys(useBufferStore.getState().batches).length === 0) return;
  const res = await flushOutbox();
  // Feedback solo per un successo automatico con contenuti: il resto è silenzioso
  // (offline/busy non sono errori da sbandierare in background).
  if (res.status === 'ok' && res.uploaded > 0) {
    // L'outbox vive FUORI da React Query: crea tile parlando direttamente con
    // le API, e nessuno avvisa la cache che i dati sono cambiati. Col
    // `staleTime` globale di 5 minuti il tile appena sincronizzato non compariva
    // nella lista — non "al prossimo giro", proprio per cinque minuti.
    invalidateTileData(qc);
    toast.success(`${res.uploaded} ${res.uploaded === 1 ? 'tile sincronizzato' : 'tile sincronizzati'}`);
  }
}

export function useOutboxSync(): void {
  const qc = useQueryClient();
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const accessToken = useAuthStore((s) => s.accessToken);
  const online = useConnectivityStore((s) => s.online);

  // Ritorno della rete (online → true) mentre l'app è già aperta: drena subito
  // la coda, senza aspettare un giro background→foreground. Il primo run a
  // `online` iniziale true è innocuo (guardia a buffer vuoto in runFlush).
  useEffect(() => {
    if (online) runFlush(qc);
  }, [online, qc]);

  useEffect(() => {
    let cancelled = false;

    const maybeFlush = () => {
      if (cancelled) return;
      const auth = useAuthStore.getState();
      // Serve auth pronta + token + buffer idratato da AsyncStorage.
      if (!auth.isInitialized || !auth.accessToken) return;
      if (!useBufferStore.persist.hasHydrated()) return;
      runFlush(qc);
    };

    // Se il buffer non è ancora idratato, riprova a idratazione conclusa.
    const unsubHydrate = useBufferStore.persist.onFinishHydration(maybeFlush);
    // Ritorno in foreground = buon momento per ritentare.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') maybeFlush();
    });
    // E prova subito, nel caso sia già tutto pronto.
    maybeFlush();

    return () => {
      cancelled = true;
      unsubHydrate();
      sub.remove();
    };
  }, [isInitialized, accessToken, qc]);
}
