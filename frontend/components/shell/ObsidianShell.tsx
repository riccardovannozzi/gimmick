'use client';

/**
 * Gimmick · Obsidian — Shell live (Fase 0 della migrazione).
 *
 * Compone l'`AppShell` con dati REALI: Sidebar dai tag dell'utente, Header con
 * callback effettive (Ask/Bell/Settings/Avatar + navigazione viste via router),
 * Inspector come contenitore del dettaglio tile. A differenza di
 * `app/obsidian-shell/page.tsx` (anteprima con mock), questo wrapper si collega
 * a React Query, agli store e al routing Next.js per-URL.
 *
 * Il routing resta per-URL: `onViewChange` fa `router.push`, e la vista attiva
 * è derivata dal pathname. Così deep-link, back/forward e le query string
 * esistenti (`?tile=`, `?flow=`, `?tag=`) restano intatti.
 *
 * In Fase 0 le `children` sono ancora le vecchie pagine: lo shell le ospita
 * senza modificarle. L'Inspector mostra un empty-state finché una vista
 * migrata non inietta il proprio dettaglio tramite la prop `inspector`.
 */
import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AppShell, Sidebar, Inspector, type ViewId } from '@/components/shell';
import { tagsApi } from '@/lib/api';
import { prefetchView } from '@/lib/view-prefetch';
import { useTagTypes } from '@/store/tag-types-store';
import { useTagFilterStore } from '@/store/tag-filter-store';
import { useChatStore } from '@/store/chat-store';
import { useAuthStore } from '@/store/auth-store';
import { useTileSelectionStore } from '@/store/tile-selection-store';
import { TileSidebar } from '@/components/tileview/TileSidebar';
import { useObsidianTheme } from '@/lib/theme/obsidian-provider';
import { tagsToSidebarGroups } from '@/lib/theme/tags-to-groups';
import type { Tag } from '@/types';

/** Mappa vista → rotta. Single source of truth per la navigazione dello shell. */
const VIEW_TO_PATH: Record<ViewId, string> = {
  sparks: '/sparks',
  tiles: '/tiles',
  tags: '/tags',
  flows: '/flows',
  chrono: '/calendar',
  canvas: '/canvas',
  kanban: '/kanban',
  panopticon: '/graph',
};

const PATH_TO_VIEW: Record<string, ViewId> = Object.fromEntries(
  Object.entries(VIEW_TO_PATH).map(([view, path]) => [path, view as ViewId]),
) as Record<string, ViewId>;

export interface ObsidianShellProps {
  children: React.ReactNode;
  /** Override del pannello dettaglio. Default: empty-state Obsidian. */
  inspector?: React.ReactNode;
}

export function ObsidianShell({ children, inspector }: ObsidianShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { mode } = useObsidianTheme();

  const user = useAuthStore((s) => s.user);
  const setChatOpen = useChatStore((s) => s.setOpen);
  const selectedTagIds = useTagFilterStore((s) => s.selectedTagIds);
  const selectOnly = useTagFilterStore((s) => s.selectOnly);
  const selectedTileId = useTileSelectionStore((s) => s.selectedTileId);
  const clearTile = useTileSelectionStore((s) => s.clear);
  const { tagTypes } = useTagTypes();

  const { data: tagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagsApi.list(),
    enabled: !!user,
  });

  const { groups, count } = React.useMemo(
    () => tagsToSidebarGroups((tagsData?.data ?? []) as Tag[], tagTypes),
    [tagsData?.data, tagTypes],
  );

  // Navigazione ottimistica: il tab attivo deriva dal pathname, che si aggiorna
  // solo a transizione completata → il clic sembrava "non rispondere". Teniamo
  // una vista ottimistica che evidenzia subito il tab cliccato, mentre la rotta
  // carica in background (useTransition), e la azzeriamo quando il pathname
  // raggiunge la destinazione.
  const derivedView: ViewId = PATH_TO_VIEW[pathname ?? ''] ?? 'tiles';
  const [optimisticView, setOptimisticView] = React.useState<ViewId | null>(null);
  const [, startTransition] = React.useTransition();
  const activeView = optimisticView ?? derivedView;

  React.useEffect(() => {
    if (optimisticView && derivedView === optimisticView) setOptimisticView(null);
  }, [derivedView, optimisticView]);

  // Prefetch di tutte le rotte delle viste al mount: il cambio pagina diventa
  // istantaneo (bundle + payload RSC già pronti) invece di caricare on-click.
  React.useEffect(() => {
    for (const path of Object.values(VIEW_TO_PATH)) router.prefetch(path);
  }, [router]);

  // Prefetch dei DATI di TUTTE le viste quando il browser è inattivo. L'hover
  // sul tab copriva solo il mouse (e solo se ci passavi sopra abbastanza): al
  // clic diretto la vista montava e restava ad aspettare la rete. Scaldando la
  // cache a idle, il cambio vista trova i dati già pronti. Le viste diverse da
  // quella corrente vengono scaldate in coda, una per callback di idle, per non
  // competere con il rendering della vista attiva.
  React.useEffect(() => {
    const others = (Object.keys(VIEW_TO_PATH) as ViewId[]).filter((v) => v !== activeView);
    let cancelled = false;
    type IdleWindow = Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    };
    const w = window as IdleWindow;
    const schedule = (cb: () => void) =>
      w.requestIdleCallback ? w.requestIdleCallback(cb, { timeout: 2000 }) : window.setTimeout(cb, 300);

    const next = (i: number) => {
      if (cancelled || i >= others.length) return;
      schedule(() => {
        if (cancelled) return;
        prefetchView(queryClient, others[i]);
        next(i + 1);
      });
    };
    next(0);
    return () => { cancelled = true; };
    // Si rilancia al cambio vista: la nuova "corrente" esce dalla coda e le
    // altre restano calde.
  }, [activeView, queryClient]);

  const handleViewChange = React.useCallback((v: ViewId) => {
    if (v === activeView) return;
    setOptimisticView(v); // feedback immediato sul tab
    startTransition(() => router.push(VIEW_TO_PATH[v]));
  }, [activeView, router]);

  // Hover su un tab → prefetch dei dati della vista: al clic il contenuto è
  // spesso già in cache (niente spinner), oltre alla rotta già prefetchata.
  const handleHoverView = React.useCallback((v: ViewId) => {
    router.prefetch(VIEW_TO_PATH[v]);
    prefetchView(queryClient, v);
  }, [router, queryClient]);

  // Filtro Sidebar (Tutti / Pinned).
  const [tagFilter, setTagFilter] = React.useState('all');

  // Pin/unpin di un tag: aggiornamento ottimistico della cache ['tags'].
  const handleTogglePin = React.useCallback((tagId: string, pinned: boolean) => {
    queryClient.setQueryData(['tags'], (old: { data?: Tag[] } | undefined) => {
      if (!old?.data) return old;
      return { ...old, data: old.data.map((t) => (t.id === tagId ? { ...t, is_pinned: pinned } : t)) };
    });
    tagsApi.update(tagId, { is_pinned: pinned })
      .finally(() => queryClient.invalidateQueries({ queryKey: ['tags'] }));
  }, [queryClient]);

  // Apri il tag nel Canvas (con navigazione ottimistica come i tab).
  const handleOpenCanvas = React.useCallback((tagId: string) => {
    setOptimisticView('canvas');
    startTransition(() => router.push(`/canvas?tag=${tagId}`));
  }, [router]);

  // Conteggio pinnati per l'etichetta del segmento.
  const pinnedCount = React.useMemo(
    () => ((tagsData?.data ?? []) as Tag[]).filter((t) => t.is_pinned && !t.is_root).length,
    [tagsData],
  );

  // Canvas e Panopticon (D3) gestiscono il proprio pannello destro: lo shell
  // non monta il suo Inspector su queste rotte per evitare doppio right-rail.
  const pageOwnsInspector = activeView === 'canvas' || activeView === 'panopticon';
  // Single tag per tile → un solo tag selezionato alla volta lato sidebar.
  const activeChildId =
    selectedTagIds.size === 1 ? [...selectedTagIds][0] : undefined;

  const userInitials = (user?.email ?? 'GM').slice(0, 2).toUpperCase();

  return (
    <AppShell
      mode={mode}
      fill
      activeView={activeView}
      onViewChange={handleViewChange}
      header={{
        userInitials,
        onHoverView: handleHoverView,
        onAsk: () => setChatOpen(true),
        onBell: () => router.push('/tiles'),
        onSettings: () => router.push('/settings'),
        onAvatar: () => router.push('/settings'),
      }}
      sidebar={
        <Sidebar
          groups={groups}
          count={count}
          activeChildId={activeChildId}
          onSelectChild={(id) => selectOnly(id)}
          filter={tagFilter}
          onFilterChange={setTagFilter}
          pinnedLabel={pinnedCount > 0 ? `Pinned · ${pinnedCount}` : 'Pinned'}
          onTogglePin={handleTogglePin}
          onOpenCanvas={handleOpenCanvas}
        />
      }
      inspector={
        inspector ??
        (pageOwnsInspector ? undefined : selectedTileId ? (
          <TileSidebar
            tileId={selectedTileId}
            open
            onToggle={clearTile}
            invalidateKeys={['tiles']}
          />
        ) : (
          <Inspector><InspectorEmpty /></Inspector>
        ))
      }
    >
      {children}
    </AppShell>
  );
}

function InspectorEmpty() {
  return (
    <div
      style={{
        padding: '48px 20px',
        textAlign: 'center',
        color: 'var(--ob-subtle)',
        fontSize: 13,
        lineHeight: 1.5,
        fontFamily: 'var(--ob-font-sans)',
      }}
    >
      Seleziona un tile per vederne il dettaglio.
    </div>
  );
}
