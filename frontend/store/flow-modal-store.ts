import { create } from 'zustand';

interface FlowModalState {
  /** Tile whose Flow is currently shown in the modal. `null` = modal closed. */
  tileId: string | null;
  /** Optional tile title to display in the modal header. */
  tileTitle: string | null;
  open: (tileId: string, tileTitle?: string) => void;
  close: () => void;
}

/**
 * Global Flow modal state. The FLOW badge on any tile (Canvas/Kanban/Calendar)
 * calls `open(tileId)` and the FlowModal component (mounted once at the
 * dashboard layout level) reads `tileId` to know which Flow to render.
 */
export const useFlowModalStore = create<FlowModalState>((set) => ({
  tileId: null,
  tileTitle: null,
  open: (tileId, tileTitle) => set({ tileId, tileTitle: tileTitle ?? null }),
  close: () => set({ tileId: null, tileTitle: null }),
}));
