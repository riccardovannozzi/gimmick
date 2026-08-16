import { create } from 'zustand';
import type { ChatTile } from '@/lib/api';

/**
 * Gimmick · Obsidian — Stato della chat "Ask Gimmick".
 *
 * Due cose nello stesso posto, con destini opposti:
 *   · `open` — il pannello è aperto. Effimero: si riparte sempre chiusi.
 *   · `messages` — la conversazione. Persistita, perché il pannello si SMONTA
 *     alla chiusura (`AskPanel` ritorna null) e i pulsanti "Spark (n)" /
 *     "Tile (n)" chiudono il pannello per portarti alla lista filtrata: senza
 *     persistenza, *usare* una risposta voleva dire perderla.
 *
 * Stessa impostazione del mobile (`mobile/store/chatStore.ts`), scadenza
 * compresa. L'idratazione è esplicita (`hydrate()`, come in
 * `view-prefs-store.ts`) e non alla creazione dello store: leggere il
 * localStorage a import-time farebbe divergere il primo render dall'HTML reso
 * dal server.
 */

const LS_KEY = 'ob-ask-chat';

/**
 * Dopo quanta INATTIVITÀ la conversazione si svuota da sola. Conta l'ultimo
 * turno, non l'età del primo messaggio: una chat ripresa poco fa non è vecchia.
 * Un giorno, come il default del mobile (`chatRetentionMinutes`).
 */
export const CHAT_TTL_MINUTES = 1440;

export interface AskMessage {
  role: 'user' | 'assistant';
  content: string;
  foundSparkIds?: string[];
  foundTileIds?: string[];
  /** Tile trovate in QUESTO turno, disegnate come card cliccabili. */
  tiles?: ChatTile[];
  /** Nome del file allegato a QUESTO turno (solo messaggi utente). */
  attachmentName?: string;
}

interface Persisted {
  messages: AskMessage[];
  lastActivityAt: number | null;
}

const EMPTY: Persisted = { messages: [], lastActivityAt: null };

function readLocal(): Persisted {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return EMPTY;
    const v = JSON.parse(raw) as Partial<Persisted>;
    if (!Array.isArray(v.messages)) return EMPTY;
    // Scarta le voci malformate invece dell'intera conversazione: un solo
    // messaggio corrotto non deve azzerare tutto il resto.
    const messages = v.messages.filter(
      (m): m is AskMessage =>
        !!m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string'
    );
    return { messages, lastActivityAt: typeof v.lastActivityAt === 'number' ? v.lastActivityAt : null };
  } catch {
    return EMPTY;
  }
}

function writeLocal(p: Persisted) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(p));
  } catch {
    /* storage pieno o non disponibile: la chat resta comunque in memoria */
  }
}

interface ChatState {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;

  messages: AskMessage[];
  lastActivityAt: number | null;
  /** L'idratazione locale è avvenuta: prima di allora la chat risulta vuota. */
  hydrated: boolean;

  /** Legge il localStorage. Idempotente — si chiama all'apertura del pannello. */
  hydrate: () => void;
  /**
   * Svuota se dall'ultimo turno è passato più di `CHAT_TTL_MINUTES`. Da
   * richiamare a OGNI apertura, non solo alla prima: una scheda lasciata aperta
   * per due giorni non deve ritrovarsi la conversazione di ieri.
   */
  expireIfStale: () => void;
  /** Sostituisce l'intera conversazione (il turno aggiunge utente + risposta). */
  setMessages: (messages: AskMessage[]) => void;
  clear: () => void;
}

// Global chat panel open/close state — shared between Header (Ask Gimmick button)
// and the dashboard layout (which mounts the actual AskPanel).
export const useChatStore = create<ChatState>((set, get) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),

  messages: [],
  lastActivityAt: null,
  hydrated: false,

  hydrate: () => {
    if (get().hydrated) return;
    set({ ...readLocal(), hydrated: true });
  },

  expireIfStale: () => {
    const { messages, lastActivityAt } = get();
    if (messages.length === 0 || lastActivityAt === null) return;
    if (Date.now() - lastActivityAt < CHAT_TTL_MINUTES * 60_000) return;
    // Ripulisce anche il disco: lasciarcela farebbe rileggere a ogni avvio una
    // conversazione già scaduta, solo per riscartarla.
    set({ ...EMPTY, hydrated: true });
    writeLocal(EMPTY);
  },

  setMessages: (messages) => {
    const next: Persisted = { messages, lastActivityAt: Date.now() };
    set({ ...next, hydrated: true });
    writeLocal(next);
  },

  clear: () => {
    set({ ...EMPTY, hydrated: true });
    writeLocal(EMPTY);
  },
}));
