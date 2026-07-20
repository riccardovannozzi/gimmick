import type { QueryClient } from '@tanstack/react-query';
import { sparksApi, tilesApi, tagsApi, kanbanApi, flowApi, canvasApi } from '@/lib/api';
import type { ViewId } from '@/components/shell';

/**
 * Prefetch dei DATI di una vista all'hover sul suo tab (complementare al
 * prefetch di rotta in ObsidianShell). Replica queryKey/queryFn delle viste:
 * al clic i dati sono spesso già in cache → la vista monta con contenuto
 * immediato (niente spinner) mentre eventualmente rivalida in background.
 *
 * Le queryKey DEVONO combaciare con quelle delle viste perché la cache faccia
 * hit; le queryFn rispecchiano il throw su {success:false} introdotto di
 * recente. Panopticon prefetcha le sue 3 query deterministiche; Canvas usa
 * l'ultimo tag aperto (`localStorage.canvas_last_tag`, lo stesso che il canvas
 * riapre in auto-redirect) per precaricare i dati di quel tag.
 */
const PREFETCH_STALE = 30_000;

function prefetchTags(qc: QueryClient): void {
  qc.prefetchQuery({ queryKey: ['tags'], queryFn: () => tagsApi.list(), staleTime: PREFETCH_STALE });
}

function prefetchTileList(qc: QueryClient, key: string): void {
  qc.prefetchQuery({
    queryKey: [key],
    queryFn: async () => {
      const res = await tilesApi.list({ limit: 100 });
      if (!res.success) throw new Error('Errore caricamento tiles');
      return res;
    },
    staleTime: PREFETCH_STALE,
  });
}

export function prefetchView(qc: QueryClient, view: ViewId): void {
  switch (view) {
    case 'sparks':
      qc.prefetchQuery({
        queryKey: ['sparks', { page: 1 }],
        queryFn: () => sparksApi.list({ page: 1, limit: 50 }),
        staleTime: PREFETCH_STALE,
      });
      break;
    case 'tiles':
      qc.prefetchInfiniteQuery({
        queryKey: ['tiles'],
        queryFn: async ({ pageParam = 1 }) => {
          const res = await tilesApi.list({ page: pageParam as number, limit: 50 });
          if (!res.success) throw new Error('Errore caricamento tiles');
          return res;
        },
        initialPageParam: 1,
        staleTime: PREFETCH_STALE,
      });
      prefetchTags(qc);
      break;
    case 'tags':
      prefetchTags(qc);
      break;
    case 'kanban':
      prefetchTileList(qc, 'tiles-kanban');
      qc.prefetchQuery({ queryKey: ['kanban-columns'], queryFn: () => kanbanApi.listColumns(), staleTime: PREFETCH_STALE });
      prefetchTags(qc);
      break;
    case 'chrono':
      prefetchTileList(qc, 'tiles-calendar');
      prefetchTags(qc);
      break;
    case 'flows':
      for (const filter of ['wait', 'undo', 'done', 'stop'] as const) {
        qc.prefetchQuery({
          queryKey: ['flow-hub', filter],
          queryFn: async () => {
            const res = await flowApi.hub(filter);
            if (!res.success) throw new Error('Errore caricamento FlowHub');
            return res.data ?? [];
          },
          staleTime: PREFETCH_STALE,
        });
      }
      break;
    case 'panopticon':
      qc.prefetchQuery({ queryKey: ['graph-data'], queryFn: () => tilesApi.graph(), staleTime: PREFETCH_STALE });
      qc.prefetchQuery({ queryKey: ['tag-graph'], queryFn: () => tagsApi.graph(), staleTime: PREFETCH_STALE });
      prefetchTags(qc);
      break;
    case 'canvas': {
      prefetchTags(qc);
      // Il canvas si riapre sull'ultimo tag (auto-redirect): precarichiamo i suoi
      // dati con la stessa queryKey [<risorsa>, tagId] usata dalla pagina.
      const lastTag = typeof window !== 'undefined' ? window.localStorage.getItem('canvas_last_tag') : null;
      if (lastTag) {
        qc.prefetchQuery({ queryKey: ['canvas-tiles', lastTag], queryFn: () => tagsApi.getTiles(lastTag), staleTime: PREFETCH_STALE });
        qc.prefetchQuery({ queryKey: ['canvas-layout', lastTag], queryFn: () => canvasApi.getLayout(lastTag), staleTime: PREFETCH_STALE });
        qc.prefetchQuery({ queryKey: ['canvas-edges', lastTag], queryFn: () => canvasApi.getEdges(lastTag), staleTime: PREFETCH_STALE });
        qc.prefetchQuery({ queryKey: ['canvas-groups', lastTag], queryFn: () => canvasApi.getGroups(lastTag), staleTime: PREFETCH_STALE });
        qc.prefetchQuery({ queryKey: ['canvas-boxes', lastTag], queryFn: () => canvasApi.getBoxes(lastTag), staleTime: PREFETCH_STALE });
      }
      break;
    }
    default:
      break;
  }
}
