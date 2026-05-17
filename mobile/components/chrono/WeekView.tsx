/**
 * Weekly view — 7 columns (Mon → Sun), each one a vertical time grid like
 * DayView. The body scrolls vertically; the column row scrolls horizontally
 * with it so the day headers stay aligned.
 *
 * Drag works across both axes: vertical pan changes the time-of-day, lateral
 * pan moves the event to another day column. The `EventBlock` component
 * handles both axes via its optional `columnWidth` + `weekDays` props.
 */
import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import {
  addDays,
  isSameDay,
  isToday,
  startOfWeek,
  fmtWeekday,
} from '@/lib/chrono-utils';
import { useThemeColors } from '@/lib/theme';
import { useTileColors } from '@/hooks/useTileColors';
import { EventBlock } from './EventBlock';
import { AllDayChip } from './AllDayChip';
import {
  SLOT_MIN_HOUR,
  SLOT_MAX_HOUR,
  SLOT_MINUTES,
  PX_PER_MINUTE,
  GUTTER_WIDTH,
} from './DayView';
import type { Tile } from '@/types';

interface Props {
  anchor: Date;
  events: Tile[];
  isLoading: boolean;
  onOpenTile: (tileId: string) => void;
  onReschedule: (id: string, start_at: string, end_at?: string) => void;
  /** Tap a day header → switch to Daily on that day. */
  onSelectDay: (day: Date) => void;
}

export function WeekView({
  anchor,
  events,
  isLoading,
  onOpenTile,
  onReschedule,
  onSelectDay,
}: Props) {
  const colors = useThemeColors();
  const { resolve: resolveTileColors } = useTileColors();
  const { width: screenWidth } = useWindowDimensions();

  const days = useMemo(() => {
    const start = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [anchor]);

  const totalMinutes = (SLOT_MAX_HOUR - SLOT_MIN_HOUR) * 60;
  const bodyHeight = totalMinutes * PX_PER_MINUTE;

  // Column width: phone width − left gutter, divided by 7. Allow horizontal
  // scroll if columns get too narrow (< 56 px).
  const minColumnWidth = 56;
  const naturalColumnWidth = (screenWidth - GUTTER_WIDTH) / 7;
  const columnWidth = Math.max(minColumnWidth, naturalColumnWidth);
  const needsHScroll = columnWidth > naturalColumnWidth;
  const gridWidth = columnWidth * 7;

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="small" color={colors.tertiary} />
      </View>
    );
  }

  // Pre-bucket events by (day, isAllDay) so each column section can render
  // in one pass without re-scanning the whole list.
  const eventsByDay = days.map((d) => events.filter((t) => {
    if (!t.start_at) return false;
    return isSameDay(new Date(t.start_at), d);
  }));
  const hasAnyAllDay = eventsByDay.some((arr) => arr.some((t) => !!t.all_day));

  // Same horizontal ScrollView wraps the header AND the body so they stay
  // aligned when the user pans horizontally on narrow screens.
  const Content = (
    <View style={{ width: gridWidth + GUTTER_WIDTH }}>
      {/* Day headers row */}
      <View
        style={{
          flexDirection: 'row',
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.background1,
        }}
      >
        <View style={{ width: GUTTER_WIDTH }} />
        {days.map((d) => {
          const today = isToday(d);
          return (
            <TouchableOpacity
              key={d.toISOString()}
              activeOpacity={0.7}
              onPress={() => onSelectDay(d)}
              style={{
                width: columnWidth,
                paddingVertical: 8,
                alignItems: 'center',
                borderLeftWidth: 1,
                borderLeftColor: colors.border,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: '600',
                  letterSpacing: 0.5,
                  color: today ? '#60A5FA' : colors.tertiary,
                  textTransform: 'uppercase',
                }}
              >
                {fmtWeekday(d)}
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '700',
                  color: today ? '#60A5FA' : colors.primary,
                  marginTop: 2,
                }}
              >
                {d.getDate()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* All-day row — one column per day, only rendered when at least one
          day has an all-day event. Mirrors FullCalendar's allDay slot. */}
      {hasAnyAllDay && (
        <View
          style={{
            flexDirection: 'row',
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            paddingVertical: 4,
            backgroundColor: colors.background1,
          }}
        >
          <View
            style={{
              width: GUTTER_WIDTH,
              alignItems: 'flex-end',
              paddingRight: 6,
              paddingTop: 4,
            }}
          >
            <Text style={{ fontSize: 9, color: colors.tertiary, letterSpacing: 0.5 }}>
              ALL DAY
            </Text>
          </View>
          {days.map((d, i) => {
            const allDayHere = eventsByDay[i].filter((t) => !!t.all_day);
            return (
              <View
                key={`allday-${d.toISOString()}`}
                style={{
                  width: columnWidth,
                  paddingHorizontal: 2,
                  borderLeftWidth: 1,
                  borderLeftColor: colors.border,
                }}
              >
                {allDayHere.map((t) => (
                  <AllDayChip
                    key={t.id}
                    tile={t}
                    colors={resolveTileColors(t)}
                    onPress={() => onOpenTile(t.id)}
                  />
                ))}
              </View>
            );
          })}
        </View>
      )}

      {/* Timeline body — left gutter + 7 columns */}
      <View style={{ flexDirection: 'row', height: bodyHeight, position: 'relative' }}>
        {/* Hour labels gutter */}
        <View style={{ width: GUTTER_WIDTH, position: 'relative' }}>
          {Array.from({ length: SLOT_MAX_HOUR - SLOT_MIN_HOUR + 1 }).map((_, i) => {
            const h = SLOT_MIN_HOUR + i;
            return (
              <View
                key={h}
                style={{
                  position: 'absolute',
                  top: i * 60 * PX_PER_MINUTE - 7,
                  width: GUTTER_WIDTH,
                  alignItems: 'flex-end',
                  paddingRight: 6,
                }}
              >
                <Text style={{ fontSize: 10, color: colors.tertiary }}>
                  {String(h).padStart(2, '0')}:00
                </Text>
              </View>
            );
          })}
        </View>

        {/* Per-day columns */}
        {days.map((d, i) => {
          // Only timed events go in the time grid; all-day chips render in
          // the dedicated row above.
          const dayEvents = eventsByDay[i].filter((t) => !t.all_day);
          return (
            <View
              key={d.toISOString()}
              style={{
                width: columnWidth,
                height: bodyHeight,
                borderLeftWidth: 1,
                borderLeftColor: colors.border,
                position: 'relative',
              }}
            >
              {/* Grid lines */}
              {Array.from({
                length: (SLOT_MAX_HOUR - SLOT_MIN_HOUR) * 2 + 1,
              }).map((_, i) => {
                const isHour = i % 2 === 0;
                return (
                  <View
                    key={i}
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: i * SLOT_MINUTES * PX_PER_MINUTE,
                      height: 1,
                      backgroundColor: isHour ? colors.border : `${colors.border}99`,
                    }}
                  />
                );
              })}
              {/* Events */}
              {dayEvents.map((tile) => (
                <EventBlock
                  key={tile.id}
                  tile={tile}
                  colors={resolveTileColors(tile)}
                  day={d}
                  minHour={SLOT_MIN_HOUR}
                  maxHour={SLOT_MAX_HOUR}
                  pxPerMinute={PX_PER_MINUTE}
                  snapMinutes={15}
                  laneX={1}
                  laneWidth={columnWidth - 2}
                  columnWidth={columnWidth}
                  weekDays={days}
                  onTap={() => onOpenTile(tile.id)}
                  onReschedule={onReschedule}
                />
              ))}
            </View>
          );
        })}
      </View>
    </View>
  );

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
      {needsHScroll ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {Content}
        </ScrollView>
      ) : (
        Content
      )}
    </ScrollView>
  );
}
