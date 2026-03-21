import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import isToday from 'dayjs/plugin/isToday';
import isTomorrow from 'dayjs/plugin/isTomorrow';
import { SafeAreaWrapper } from '@/components/layout/SafeAreaWrapper';
import { TileSquare } from '@/components/TileSquare';
import { DaySeparator } from '@/components/DaySeparator';
import { useThemeColors } from '@/lib/theme';
import { tilesApi } from '@/lib/api';
import type { Tile } from '@/types';

dayjs.extend(isToday);
dayjs.extend(isTomorrow);

const FALLBACK_COLOR = '#888780';
const BAND_COLORS = {
  events: '#D85A30',
  deadlines: '#BA7517',
  todos: '#94A3B8',
};

function dayLabel(dateStr: string): string {
  const d = dayjs(dateStr);
  if (d.isToday()) return 'Oggi';
  if (d.isTomorrow()) return 'Domani';
  return d.format('ddd D');
}

function groupByDay(tiles: Tile[], dateField: 'start_at' | 'end_at'): Record<string, Tile[]> {
  const groups: Record<string, Tile[]> = {};
  tiles.forEach((t) => {
    const val = dateField === 'start_at' ? t.start_at : t.end_at;
    if (!val) return;
    const day = dayjs(val).format('YYYY-MM-DD');
    if (!groups[day]) groups[day] = [];
    groups[day].push(t);
  });
  return groups;
}

function BandHeader({ color, label, badge }: { color: string; label: string; badge?: string }) {
  const colors = useThemeColors();
  return (
    <View style={styles.bandHeader}>
      <View style={[styles.bandDot, { backgroundColor: color }]} />
      <Text style={[styles.bandLabel, { color: colors.primary }]}>{label}</Text>
      {badge ? (
        <Text style={[styles.bandBadge, { color: colors.tertiary }]}>{badge}</Text>
      ) : null}
    </View>
  );
}

function HorizontalBand({
  tiles,
  dateField,
  actionType,
}: {
  tiles: Tile[];
  dateField: 'start_at' | 'end_at';
  actionType: 'event' | 'deadline';
}) {
  const days = useMemo(
    () => Array.from({ length: 14 }, (_, i) => dayjs().add(i, 'day').format('YYYY-MM-DD')),
    []
  );
  const grouped = useMemo(() => groupByDay(tiles, dateField), [tiles, dateField]);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll} contentContainerStyle={styles.horizontalContent}>
      {days.map((day) => {
        const dayTiles = grouped[day] || [];
        const d = dayjs(day);
        const today = d.isToday();
        return (
          <React.Fragment key={day}>
            <DaySeparator label={dayLabel(day)} isToday={today} height={64} />
            {dayTiles.map((tile) => {
              const tileColor = tile.color || FALLBACK_COLOR;
              const isDeadlineToday = actionType === 'deadline' && d.isToday();
              let subtitle: string | undefined;
              if (actionType === 'event' && tile.start_at) {
                subtitle = dayjs(tile.start_at).format('HH:mm');
              } else if (actionType === 'deadline') {
                if (d.isToday()) subtitle = 'Scade oggi';
                else if (d.isTomorrow()) subtitle = 'Scade domani';
                else subtitle = `Scade ${dayjs(tile.end_at || tile.start_at).format('ddd D')}`;
              }
              return (
                <View key={tile.id} style={styles.tileWrapper}>
                  <TileSquare
                    title={tile.title || 'Senza titolo'}
                    subtitle={subtitle}
                    color={tileColor}
                    actionType={actionType}
                    completed={!!tile.is_completed}
                    highlight={isDeadlineToday}
                  />
                </View>
              );
            })}
          </React.Fragment>
        );
      })}
    </ScrollView>
  );
}

function TodoBand({ tiles }: { tiles: Tile[] }) {
  const sorted = useMemo(() => {
    const active = tiles.filter((t) => !t.is_completed);
    const done = tiles.filter((t) => t.is_completed);
    return [...active, ...done];
  }, [tiles]);

  return (
    <View style={styles.todoGrid}>
      {sorted.map((tile) => {
        const tileColor = tile.color || FALLBACK_COLOR;
        const isCta = tile.is_cta;
        return (
          <TileSquare
            key={tile.id}
            title={tile.title || 'Senza titolo'}
            color={tileColor}
            actionType={isCta ? 'call_to_action' : 'anytime'}
            completed={!!tile.is_completed}
          />
        );
      })}
    </View>
  );
}

export default function TileViewScreen() {
  const colors = useThemeColors();

  const { data, isLoading } = useQuery({
    queryKey: ['tiles-tileview'],
    queryFn: () => tilesApi.list({ limit: 100 }),
    staleTime: 60_000,
  });

  const allTiles = data?.data || [];

  const { events, deadlines, todos } = useMemo(() => {
    const events: Tile[] = [];
    const deadlines: Tile[] = [];
    const todos: Tile[] = [];
    allTiles.forEach((t) => {
      if (t.action_type === 'event') events.push(t);
      else if (t.action_type === 'deadline') deadlines.push(t);
      else if (t.action_type === 'anytime') todos.push(t);
    });
    return { events, deadlines, todos };
  }, [allTiles]);

  const activeTodos = todos.filter((t) => !t.is_completed).length;

  if (isLoading) {
    return (
      <SafeAreaWrapper>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaWrapper>
    );
  }

  return (
    <SafeAreaWrapper>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Band 1 — Events */}
        <View style={styles.band}>
          <BandHeader color={BAND_COLORS.events} label="EVENTI" />
          <HorizontalBand tiles={events} dateField="start_at" actionType="event" />
        </View>

        {/* Band 2 — Deadlines */}
        <View style={styles.band}>
          <BandHeader color={BAND_COLORS.deadlines} label="SCADENZE" />
          <HorizontalBand tiles={deadlines} dateField="start_at" actionType="deadline" />
        </View>

        {/* Band 3 — Todos */}
        <View style={styles.band}>
          <BandHeader color={BAND_COLORS.todos} label="DA FARE" badge={`${activeTodos} attivi`} />
          <TodoBand tiles={todos} />
        </View>
      </ScrollView>
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  band: {
    marginBottom: 16,
  },
  bandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  bandDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  bandLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  bandBadge: {
    fontSize: 11,
    marginLeft: 'auto',
  },
  horizontalScroll: {
    minHeight: 80,
  },
  horizontalContent: {
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 4,
  },
  tileWrapper: {
    marginRight: 4,
  },
  todoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    padding: 12,
  },
});
