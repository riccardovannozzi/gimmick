import { create } from 'zustand';

interface ChatState {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

// Global chat panel open/close state — shared between Header (Ask Gimmick button)
// and the dashboard layout (which mounts the actual ChatPanel).
export const useChatStore = create<ChatState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),
}));
