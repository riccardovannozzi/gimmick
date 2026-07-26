import { create } from 'zustand';

/**
 * Raggiungibilità del backend, senza modulo nativo di rete.
 *
 * Aggiornato da due fonti che convergono sullo stesso flag:
 * · le richieste API reali (interceptor in lib/api.ts): offline istantaneo
 *   quando una chiamata fallisce per rete, online quando risponde;
 * · un ping leggero a `/health` (hooks/useConnectivity.ts) che tiene fresco lo
 *   stato quando l'app è ferma e rileva il ritorno online.
 *
 * Ottimista all'avvio (`online: true`) finché la prima richiesta/ping non dice
 * il contrario.
 */
interface ConnectivityState {
  online: boolean;
  setOnline: (online: boolean) => void;
}

export const useConnectivityStore = create<ConnectivityState>((set) => ({
  online: true,
  // Guard: nessun set (nessun re-render) se lo stato non cambia davvero.
  setOnline: (online) => set((s) => (s.online === online ? s : { online })),
}));
