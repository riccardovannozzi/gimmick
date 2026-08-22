import { create } from 'zustand';

/**
 * Gimmick · Obsidian — Le impostazioni sono aperte.
 *
 * Effimero e basta: nessun localStorage, nessun `settingsApi`. Si riparte
 * sempre chiusi, come il pannello Ask (`chat-store.ts`) — riaprire l'app sulle
 * impostazioni sarebbe come tornare a casa e trovare aperto il quadro elettrico.
 *
 * È uno store e non uno `useState` dentro allo shell perché ci sono DUE porte
 * d'ingresso e una non ha modo di parlare con l'altra: l'ingranaggio in barra
 * (dentro lo shell) e la vecchia rotta `/settings`, che ora è un reindirizzo e
 * vive nell'albero dei figli. Un bookmark deve poter aprire quello che apre il
 * pulsante.
 */
interface SettingsModalState {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const useSettingsModal = create<SettingsModalState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
