/**
 * Ping di raggiungibilità del backend (indicatore online/offline).
 *
 * Gli interceptor in lib/api.ts aggiornano lo stato dalle richieste reali; qui
 * aggiungiamo un ping periodico a `/health` per: (a) tenere fresco l'indicatore
 * quando l'app è ferma e non parte traffico, (b) rilevare il ritorno online
 * anche a buffer vuoto. Nessun modulo nativo di rete: solo `fetch` + `AppState`.
 *
 * Cadenza adattiva: rada quando online, fitta quando offline (recupero veloce).
 * Attivo solo in foreground.
 */
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { apiBaseUrl } from '@/lib/api';
import { useConnectivityStore } from '@/store/connectivityStore';

const PING_TIMEOUT_MS = 6000;
const DELAY_ONLINE_MS = 25000;
const DELAY_OFFLINE_MS = 8000;

async function ping(): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
  try {
    const res = await fetch(`${apiBaseUrl()}/health`, { method: 'GET', signal: controller.signal });
    useConnectivityStore.getState().setOnline(res.ok);
  } catch {
    useConnectivityStore.getState().setOnline(false);
  } finally {
    clearTimeout(timer);
  }
}

export function useConnectivity(): void {
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      if (cancelled) return;
      await ping();
      if (cancelled) return;
      const delay = useConnectivityStore.getState().online ? DELAY_ONLINE_MS : DELAY_OFFLINE_MS;
      timer = setTimeout(tick, delay);
    };

    const restart = () => {
      if (timer) { clearTimeout(timer); timer = null; }
      tick();
    };

    restart();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') restart();
      else if (timer) { clearTimeout(timer); timer = null; } // niente ping in background
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      sub.remove();
    };
  }, []);
}
