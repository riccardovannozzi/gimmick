/**
 * Chrono screen — mobile equivalent of frontend/app/(dashboard)/calendar.
 *
 * Three view modes:
 *   Daily   — vertical 06:00-22:00 timeline with draggable event blocks
 *   Week    — 7-column day grid
 *   Month   — 6×7 grid with event dots; tap a day → switch to Daily on it
 */
import React, { useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import {
  IconChevronLeft,
  IconChevronRight,
  IconRefresh,
} from '@tabler/icons-react-native';
import { useCalendarEvents } from '@/hooks/useCalendarEvents';
import { usePixelTheme } from '@/components/pixel';
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
  const theme = usePixelTheme();
  const [view, setView] = useState<ChronoView>('daily');
  const [anchor, setAnchor] = useState<Date>(() => new Date());

  const { start, end } = useMemo(() => {
    if (view === 'daily') {
      return { start: startOfDay(anchor), end: endOfDay(anchor) };
    }
    if (view === 'week') {
      return { start: startOfWeek(anchor), end: endOfWeek(anchor) };
    }
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

  const NavBtn = ({
    onPress, children, wide,
  }: { onPress: () => void; children: React.ReactNode; wide?: boolean }) => (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
      <View
        style={{
          width: wide ? undefined : 32,
          height: 32,
          paddingHorizontal: wide ? 10 : 0,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 2,
          borderColor: theme.border,
          backgroundColor: theme.surface,
        }}
      >
        {children}
      </View>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg1 }}>
      {/* Top toolbar */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderBottomWidth: 2,
          borderBottomColor: theme.border,
        }}
      >
        <NavBtn onPress={stepPrev}>
          <IconChevronLeft size={16} color={theme.ink} strokeWidth={2.4} />
        </NavBtn>
        <NavBtn onPress={() => setAnchor(new Date())} wide>
          <Text
            style={{
              fontFamily: theme.fontHead,
              fontSize: 9,
              color: theme.ink,
              letterSpacing: 1,
            }}
          >
            OGGI
          </Text>
        </NavBtn>
        <NavBtn onPress={stepNext}>
          <IconChevronRight size={16} color={theme.ink} strokeWidth={2.4} />
        </NavBtn>
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            fontFamily: theme.fontBody,
            fontSize: 13,
            fontWeight: '700',
            color: theme.ink,
            marginLeft: 4,
            textTransform: 'capitalize',
          }}
        >
          {title}
        </Text>
        <NavBtn onPress={() => refetch()}>
          <IconRefresh size={14} color={theme.ink2} strokeWidth={2.2} />
        </NavBtn>
      </View>

      {/* View switcher — DAILY / WEEK / MONTH */}
      <View
        style={{
          flexDirection: 'row',
          gap: 6,
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderBottomWidth: 2,
          borderBottomColor: theme.border,
        }}
      >
        {(['daily', 'week', 'month'] as const).map((v) => {
          const isActive = view === v;
          return (
            <Pressable
              key={v}
              onPress={() => setView(v)}
              style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.85 : 1 })}
            >
              <View
                style={{
                  height: 30,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderColor: theme.border,
                  backgroundColor: isActive ? theme.accent : theme.surface,
                }}
              >
                <Text
                  style={{
                    fontFamily: theme.fontHead,
                    fontSize: 9,
                    color: isActive ? (theme.onAccent as string) : theme.ink,
                    letterSpacing: 1,
                  }}
                >
                  {v.toUpperCase()}
                </Text>
              </View>
            </Pressable>
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
