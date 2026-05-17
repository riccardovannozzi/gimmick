/**
 * Chrono screen — mobile equivalent of frontend/app/(dashboard)/calendar.
 *
 * Three view modes:
 *   Daily   — vertical 06:00-22:00 timeline with draggable event blocks
 *   Week    — 7-column day grid, drag works across columns to switch day too
 *   Month   — 6×7 grid with event dots; tap a day → switch to Daily on it
 *
 * Header: prev/today/next + view switcher. The fetch range adapts to the
 * active view so we don't pull unnecessary tiles. Tap an event opens the
 * tile detail; tap an empty slot creates a new event at that time.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import {
  IconChevronLeft,
  IconChevronRight,
  IconRefresh,
} from '@tabler/icons-react-native';
import { useCalendarEvents } from '@/hooks/useCalendarEvents';
import { useThemeColors } from '@/lib/theme';
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addDays,
  fmtMonthYear,
  fmtDayShort,
} from '@/lib/chrono-utils';
import { DayView } from '@/components/chrono/DayView';
import { WeekView } from '@/components/chrono/WeekView';
import { MonthView } from '@/components/chrono/MonthView';

type ChronoView = 'daily' | 'week' | 'month';

export default function ChronoScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  // Default to DAILY on today — quickest entry point on mobile. The anchor
  // is seeded with `new Date()` so we always land on "oggi".
  const [view, setView] = useState<ChronoView>('daily');
  const [anchor, setAnchor] = useState<Date>(() => new Date());

  // Range fetched from the backend — overshoot a few days so dragging an event
  // close to a boundary doesn't yield "event vanished" until the next refetch.
  const { start, end } = useMemo(() => {
    if (view === 'daily') {
      return { start: startOfDay(anchor), end: endOfDay(anchor) };
    }
    if (view === 'week') {
      return { start: startOfWeek(anchor), end: endOfWeek(anchor) };
    }
    // month: pad with a leading/trailing week to cover the 6×7 grid
    const s = startOfWeek(startOfMonth(anchor));
    const e = endOfWeek(endOfMonth(anchor));
    return { start: s, end: e };
  }, [view, anchor]);

  const { events, isLoading, refetch, reschedule } = useCalendarEvents(start, end);

  const title = useMemo(() => {
    if (view === 'daily') {
      return anchor.toLocaleDateString('it-IT', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    }
    if (view === 'week') {
      const ws = startOfWeek(anchor);
      const we = endOfWeek(anchor);
      return `${fmtDayShort(ws)} – ${fmtDayShort(we)}`;
    }
    return fmtMonthYear(anchor);
  }, [view, anchor]);

  const stepDays = view === 'daily' ? 1 : view === 'week' ? 7 : 0;
  const stepPrev = () => {
    if (view === 'month') {
      const x = new Date(anchor);
      x.setMonth(x.getMonth() - 1);
      setAnchor(x);
    } else {
      setAnchor(addDays(anchor, -stepDays));
    }
  };
  const stepNext = () => {
    if (view === 'month') {
      const x = new Date(anchor);
      x.setMonth(x.getMonth() + 1);
      setAnchor(x);
    } else {
      setAnchor(addDays(anchor, stepDays));
    }
  };

  const handleOpenTile = (tileId: string) => {
    router.push(`/tile/${tileId}` as any);
  };

  const handleSelectDay = (day: Date) => {
    setAnchor(day);
    setView('daily');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background1 }}>
      {/* Top toolbar — title + prev/today/next + refresh */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 12,
          paddingTop: 10,
          paddingBottom: 8,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <TouchableOpacity
          onPress={stepPrev}
          activeOpacity={0.7}
          style={{
            width: 32,
            height: 32,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 6,
            backgroundColor: colors.background2,
          }}
        >
          <IconChevronLeft size={16} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setAnchor(new Date())}
          activeOpacity={0.7}
          style={{
            paddingHorizontal: 10,
            height: 32,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 6,
            backgroundColor: colors.background2,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: '500', color: colors.tertiary }}>
            Oggi
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={stepNext}
          activeOpacity={0.7}
          style={{
            width: 32,
            height: 32,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 6,
            backgroundColor: colors.background2,
          }}
        >
          <IconChevronRight size={16} color={colors.primary} />
        </TouchableOpacity>
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            fontSize: 13,
            fontWeight: '600',
            color: colors.primary,
            marginLeft: 4,
            textTransform: 'capitalize',
          }}
        >
          {title}
        </Text>
        <TouchableOpacity
          onPress={() => refetch()}
          activeOpacity={0.7}
          style={{
            width: 32,
            height: 32,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 6,
            backgroundColor: colors.background2,
          }}
        >
          <IconRefresh size={14} color={colors.tertiary} />
        </TouchableOpacity>
      </View>

      {/* View switcher — DAILY / WEEK / MONTH */}
      <View
        style={{
          flexDirection: 'row',
          gap: 6,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        {(['daily', 'week', 'month'] as const).map((v) => {
          const isActive = view === v;
          return (
            <TouchableOpacity
              key={v}
              onPress={() => setView(v)}
              activeOpacity={0.7}
              style={{
                flex: 1,
                height: 32,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 6,
                backgroundColor: isActive ? 'rgba(37, 99, 235, 0.2)' : colors.background2,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  letterSpacing: 1,
                  color: isActive ? '#60A5FA' : colors.tertiary,
                }}
              >
                {v.toUpperCase()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* View body */}
      {view === 'daily' && (
        <DayView
          day={anchor}
          events={events}
          isLoading={isLoading}
          onOpenTile={handleOpenTile}
          onReschedule={(id, start_at, end_at) =>
            reschedule.mutate({ id, start_at, end_at })
          }
        />
      )}
      {view === 'week' && (
        <WeekView
          anchor={anchor}
          events={events}
          isLoading={isLoading}
          onOpenTile={handleOpenTile}
          onReschedule={(id, start_at, end_at) =>
            reschedule.mutate({ id, start_at, end_at })
          }
          onSelectDay={handleSelectDay}
        />
      )}
      {view === 'month' && (
        <MonthView
          monthAnchor={anchor}
          events={events}
          isLoading={isLoading}
          onSelectDay={handleSelectDay}
        />
      )}
    </View>
  );
}
