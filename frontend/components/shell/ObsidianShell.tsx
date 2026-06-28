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
import { useQuery } from '@tanstack/react-query';
import { AppShell, Sidebar, Inspector, type ViewId } from '@/components/shell';
import { tagsApi } from '@/lib/api';
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

  const activeView: ViewId = PATH_TO_VIEW[pathname ?? ''] ?? 'tiles';
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
      onViewChange={(v) => router.push(VIEW_TO_PATH[v])}
      header={{
        userInitials,
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
