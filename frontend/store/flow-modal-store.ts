import { create } from 'zustand';

interface FlowOpenRequestState {
  /** Last tile requested for opening in the right sidebar's Flow tab.
   *  Consumer pages subscribe and forward this into their own sidebar state,
   *  then call `close()` to consume the request. `null` = no pending request. */
  tileId: string | null;
  /** Monotonically incrementing generation. Bumped on every `open()` even when
   *  the same tile is requested again — lets effects re-fire so the user can
   *  re-trigger the same tile (e.g. clicking its FLOW badge twice). */
  gen: number;
  open: (tileId: string) => void;
  close: () => void;
}

/**
 * Global "open Flow for this tile in the right sidebar" signal. Any FLOW
 * badge (canvas, calendar, kanban, staging, hub) calls `open(tileId)`, and
 * the current page's `useFlowOpenRequest` effect forwards the request into
 * the right sidebar (sets tile + opens panel + switches active tab to Flow).
 */
export const useFlowOpenStore = create<FlowOpenRequestState>((set) => ({
  tileId: null,
  gen: 0,
  open: (tileId) => set((s) => ({ tileId, gen: s.gen + 1 })),
  close: () => set({ tileId: null }),
}));
