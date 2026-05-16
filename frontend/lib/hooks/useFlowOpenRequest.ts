'use client';

import { useEffect, useState } from 'react';
import { useFlowOpenStore } from '@/store/flow-modal-store';

/**
 * Connect a page-level right-sidebar state to the global Flow-open request
 * signal. When any FLOW badge fires `useFlowOpenStore.open(tileId)`, this
 * hook:
 *   1. selects the requested tile (calls `setTileId`)
 *   2. expands the sidebar (calls `setOpen(true)`)
 *   3. bumps the returned `forceFlowTab` counter, which the consumer feeds
 *      into `<TileSidebar forceFlowTab={...} />` to switch its active tab.
 *   4. consumes the request via `useFlowOpenStore.close()`.
 *
 * Designed to be called once per page that hosts a TileSidebar (canvas,
 * calendar, kanban). Setters are read from refs internally so the effect
 * doesn't re-fire when their identity changes on every render.
 */
export function useFlowOpenRequest(
  setTileId: (id: string) => void,
  setOpen: (open: boolean) => void,
): number {
  const tileId = useFlowOpenStore((s) => s.tileId);
  const gen = useFlowOpenStore((s) => s.gen);
  const [forceFlowTab, setForceFlowTab] = useState(0);

  useEffect(() => {
    if (!tileId) return;
    setTileId(tileId);
    setOpen(true);
    setForceFlowTab((g) => g + 1);
    useFlowOpenStore.getState().close();
    // setTileId / setOpen identity may churn — depend on the request itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tileId, gen]);

  return forceFlowTab;
}
