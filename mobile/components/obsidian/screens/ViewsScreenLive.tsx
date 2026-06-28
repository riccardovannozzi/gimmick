/**
 * Gimmick · Obsidian — Views screen wired to live data.
 *
 * Owns the active tab + per-tab data fetching so queries stay gated to the
 * visible tab. Tiles (tilesApi) and Flows (flowApi.hub, filter-aware) are live;
 * Chrono / Settings tabs still render their static mock for now.
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { tilesApi, flowApi, calendarApi } from '@/lib/api';
import { tilesToGroups, flowHubItemToVM, tileToChronoEvent } from '@/lib/obsidian-adapters';
import type { FlowHubFilter } from '@/types';
import { useSettingsStore } from '@/store/settingsStore';
import { ObsidianViewsScreen } from './ViewsScreen';
import type { MobileViewId } from '../TopNav';

const DAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
const MONTHS_SHORT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

export interface ObsidianViewsScreenLiveProps {
  initial?: MobileViewId;
  onOpenTile?: (id: string) => void;
  onOpenFlow?: (tileId: string) => void;
}

export function ObsidianViewsScreenLive({ initial = 'tiles', onOpenTile, onOpenFlow }: ObsidianViewsScreenLiveProps) {
  const [active, setActive] = React.useState<MobileViewId>(initial);
  const [flowFilter, setFlowFilter] = React.useState<FlowHubFilter>('wait');
  const [dayOffset, setDayOffset] = React.useState(0);

  // Settings tab — persisted via settingsStore (AsyncStorage).
  const haptic = useSettingsStore((s) => s.hapticFeedback);
  const setHaptic = useSettingsStore((s) => s.setHapticFeedback);
  const confirmDelete = useSettingsStore((s) => s.confirmDelete);
  const setConfirmDelete = useSettingsStore((s) => s.setConfirmDelete);
  const themeMode = useSettingsStore((s) => s.theme);
  const setThemeMode = useSettingsStore((s) => s.setTheme);

  const tilesQuery = useQuery({
    queryKey: ['tiles', { page: 1, limit: 100 }],
    queryFn: () => tilesApi.list({ page: 1, limit: 100 }),
    enabled: active === 'tiles',
  });

  const flowsQuery = useQuery({
    queryKey: ['flow-hub', flowFilter],
    queryFn: () => flowApi.hub(flowFilter),
    enabled: active === 'flows',
  });

  // Day window [00:00, 24:00) for the selected day (today + dayOffset).
  const day = React.useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + dayOffset);
    return d;
  }, [dayOffset]);
  const dayEnd = React.useMemo(() => {
    const d = new Date(day);
    d.setDate(d.getDate() + 1);
    return d;
  }, [day]);

  const chronoQuery = useQuery({
    queryKey: ['calendar-events', day.toISOString(), dayEnd.toISOString()],
    queryFn: () => calendarApi.events(day.toISOString(), dayEnd.toISOString()),
    enabled: active === 'chrono',
  });

  const groups = React.useMemo(
    () => tilesToGroups(tilesQuery.data?.data ?? [], new Date()),
    [tilesQuery.data],
  );
  const flows = React.useMemo(
    () => (flowsQuery.data?.data ?? []).map(flowHubItemToVM),
    [flowsQuery.data],
  );
  const chronoEvents = React.useMemo(
    () => (chronoQuery.data?.data ?? []).map(tileToChronoEvent).filter((e): e is NonNullable<typeof e> => e !== null),
    [chronoQuery.data],
  );
  const dayLabel = `${DAYS_SHORT[day.getDay()]} ${day.getDate()} ${MONTHS_SHORT[day.getMonth()]}`;

  return (
    <ObsidianViewsScreen
      active={active}
      onActiveChange={setActive}
      tileGroups={groups}
      tilesLoading={tilesQuery.isLoading}
      onOpenTile={onOpenTile}
      flows={flows}
      flowsLoading={flowsQuery.isLoading}
      flowFilter={flowFilter}
      onFlowFilter={setFlowFilter}
      onOpenFlow={onOpenFlow}
      chronoEvents={chronoEvents}
      chronoLoading={chronoQuery.isLoading}
      chronoDayLabel={dayLabel}
      chronoIsToday={dayOffset === 0}
      onChronoPrev={() => setDayOffset((o) => o - 1)}
      onChronoNext={() => setDayOffset((o) => o + 1)}
      onChronoToday={() => setDayOffset(0)}
      onOpenEvent={onOpenTile}
      haptic={haptic}
      onHaptic={setHaptic}
      confirmDelete={confirmDelete}
      onConfirmDelete={setConfirmDelete}
      themeMode={themeMode}
      onThemeMode={setThemeMode}
    />
  );
}
