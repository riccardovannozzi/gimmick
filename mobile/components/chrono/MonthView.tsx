/**
 * Month view — traditional 6×7 grid starting on Monday. Each cell shows the
 * day number and up to 3 colored dots (one per event); a "+N" badge appears
 * when there are more events than the visible dots can show. Drag isn't
 * supported in this view (too cramped on mobile) — tap a day to switch to
 * Daily view on it.
 */
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import {
  isSameDay,
  isToday,
  monthGridDays,
  fmtWeekday,
} from '@/lib/chrono-utils';
import { useTileColors } from '@/hooks/useTileColors';
import { usePixelTheme } from '@/components/pixel';
import type { Tile } from '@/types';

interface Props {
  monthAnchor: Date;
  events: Tile[];
  isLoading: boolean;
  onSelectDay: (day: Date) => void;
}

const MAX_DOTS = 3;

export function MonthView({ monthAnchor, events, isLoading, onSelectDay }: Props) {
  const theme = usePixelTheme();
  const colors = {
    border: theme.border,
    tertiary: theme.ink2,
    secondary: theme.ink2,
    primary: theme.ink,
    accent: theme.accent,
    onAccent: theme.onAccent,
    background1: theme.bg1,
    background2: theme.bg2,
    background3: theme.bg3,
    surfaceVariant: theme.surfaceVariant,
  } as const;
  const { resolve: resolveTileColors } = useTileColors();
  const days = useMemo(() => monthGridDays(monthAnchor), [monthAnchor]);

  const eventsByDay = useMemo(() => {
    const m = new Map<string, Tile[]>();
    for (const e of events) {
      if (!e.start_at) continue;
      const d = new Date(e.start_at);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(e);
    }
    return m;
  }, [events]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="small" color={colors.tertiary} />
      </View>
    );
  }

  // First row is the weekday header (Mon → Sun).
  const weekdayLabels: string[] = [];
  for (let i = 0; i < 7; i++) {
    weekdayLabels.push(fmtWeekday(days[i]));
  }
  // 6 rows × 7 cols. Render row-by-row.
  const rows: Date[][] = [];
  for (let r = 0; r < 6; r++) rows.push(days.slice(r * 7, r * 7 + 7));

  return (
    <View style={{ flex: 1 }}>
      {/* Weekday labels row */}
      <View
        style={{
          flexDirection: 'row',
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          paddingVertical: 6,
        }}
      >
        {weekdayLabels.map((w, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            <Text
              style={{
                fontSize: 10,
                fontWeight: '600',
                letterSpacing: 0.6,
                color: colors.tertiary,
                textTransform: 'uppercase',
              }}
            >
              {w}
            </Text>
          </View>
        ))}
      </View>

      {/* Day grid — 6 rows. Each cell stretches to share the remaining space. */}
      <View style={{ flex: 1 }}>
        {rows.map((row, r) => (
          <View
            key={r}
            style={{
              flex: 1,
              flexDirection: 'row',
              borderBottomWidth: r < 5 ? 1 : 0,
              borderBottomColor: colors.border,
            }}
          >
            {row.map((d) => {
              const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
              const dayEvents = eventsByDay.get(key) ?? [];
              const inMonth = d.getMonth() === monthAnchor.getMonth();
              const today = isToday(d);
              const visibleDots = dayEvents.slice(0, MAX_DOTS);
              const extra = dayEvents.length - visibleDots.length;
              return (
                <TouchableOpacity
                  key={d.toISOString()}
                  onPress={() => onSelectDay(d)}
                  activeOpacity={0.7}
                  style={{
                    flex: 1,
                    borderRightWidth: 1,
                    borderRightColor: colors.border,
                    padding: 4,
                    minHeight: 60,
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                    }}
                  >
                    <View
                      style={{
                        minWidth: 22,
                        height: 22,
                        paddingHorizontal: 4,
                        borderRadius: 11,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: today ? '#2563EB' : 'transparent',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: today ? '700' : '500',
                          color: today
                            ? '#fff'
                            : inMonth
                              ? colors.primary
                              : colors.tertiary,
                        }}
                      >
                        {d.getDate()}
                      </Text>
                    </View>
                  </View>
                  {/* Event dots */}
                  {visibleDots.length > 0 && (
                    <View
                      style={{
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        gap: 3,
                        marginTop: 4,
                      }}
                    >
                      {visibleDots.map((t) => (
                        <View
                          key={t.id}
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: resolveTileColors(t).bg,
                          }}
                        />
                      ))}
                      {extra > 0 && (
                        <Text
                          style={{
                            fontSize: 9,
                            color: colors.tertiary,
                            marginLeft: 2,
                          }}
                        >
                          +{extra}
                        </Text>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}
