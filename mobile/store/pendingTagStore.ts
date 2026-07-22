import { create } from 'zustand';

/**
 * Ponte tra l'editor di testo (schermata /capture/text) e il pannello
 * "Set options" della home.
 *
 * La cattura del testo è disaccoppiata dalle opzioni del tile: la nota entra nel
 * buffer, il tag si sceglie altrove. Quando nell'editor selezioni un tag
 * dall'autocomplete degli #hashtag, lo depositiamo qui; la home lo legge e lo
 * pre-imposta come tag del tile in creazione. È un singolo valore effimero
 * (l'ultimo tag scelto), consumato all'invio del buffer.
 */
interface PendingTagState {
  tagId: string | null;
  tagName: string | null;
  set: (tagId: string, tagName: string) => void;
  clear: () => void;
}

export const usePendingTagStore = create<PendingTagState>((set) => ({
  tagId: null,
  tagName: null,
  set: (tagId, tagName) => set({ tagId, tagName }),
  clear: () => set({ tagId: null, tagName: null }),
}));
