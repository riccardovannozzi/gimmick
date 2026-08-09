/**
 * Gimmick — Conversazione della chat AI, persistente.
 *
 * Stava nello stato locale di `ObsidianAskScreenLive`: uscire dalla schermata la
 * smontava e la conversazione spariva, anche solo aprendo un tile trovato dalla
 * risposta — cioè proprio facendo quello per cui le card esistono.
 *
 * Persistita su AsyncStorage, quindi sopravvive anche alla chiusura dell'app. A
 * ripulirla sono due cose sole: il pulsante nel compositore e la scadenza
 * configurata nei settings (`chatRetentionMinutes`).
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ChatTile } from '@/lib/api';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** Tile trovate dall'AI in QUESTO turno: si ridisegnano come card. */
  tiles?: ChatTile[];
}

interface ChatState {
  messages: ChatMessage[];
  /**
   * Ultimo momento in cui la conversazione è stata toccata (epoch ms). È il
   * riferimento della scadenza: conta l'inattività, non l'età del primo
   * messaggio — una conversazione ripresa poco fa non è vecchia.
   */
  lastActivityAt: number | null;

  append: (message: ChatMessage) => void;
  clear: () => void;
  /**
   * Svuota se dall'ultima attività è passato più di `ttlMinutes`.
   * `ttlMinutes <= 0` significa "non scade mai".
   * Ritorna true se ha davvero ripulito.
   */
  expireIfStale: (ttlMinutes: number) => boolean;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      messages: [],
      lastActivityAt: null,

      append: (message) =>
        set((s) => ({ messages: [...s.messages, message], lastActivityAt: Date.now() })),

      clear: () => set({ messages: [], lastActivityAt: null }),

      expireIfStale: (ttlMinutes) => {
        const { messages, lastActivityAt } = get();
        if (ttlMinutes <= 0) return false;
        if (messages.length === 0 || !lastActivityAt) return false;
        if (Date.now() - lastActivityAt < ttlMinutes * 60_000) return false;
        set({ messages: [], lastActivityAt: null });
        return true;
      },
    }),
    {
      name: 'gimmick-chat',
      storage: createJSONStorage(() => AsyncStorage),
      // Solo i dati: le azioni si ricreano a ogni avvio.
      partialize: (s) => ({ messages: s.messages, lastActivityAt: s.lastActivityAt }),
    }
  )
);
