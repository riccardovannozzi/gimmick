/**
 * Daily view — vertical timeline 06:00-22:00 with 30-minute slots.
 * Mirrors the FullCalendar `timeGridDay` from the web calendar:
 *   - left gutter with hour labels
 *   - right body with horizontal lines at every slot
 *   - "now indicator" red line when the displayed day is today
 *   - events as colored blocks positioned with absolute top/height
 *
 * Events can be:
 *   - tapped → open the tile detail
 *   - long-pressed and dragged → snap to a new 15-minute slot via
 *     `onReschedule(id, start_at, end_at)`.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { isSameDay, isToday, minutesFromMidnight } from '@/lib/chrono-utils';
import { useThemeColors } from '@/lib/theme';
import { useTileColors } from '@/hooks/useTileColors';
import { EventBlock } from './EventBlock';
import { AllDayChip } from './AllDayChip';
import type { Tile } from '@/types';

interface Props {
  day: Date;
  events: Tile[];
  isLoading: boolean;
  onOpenTile: (tileId: string) => void;
  onReschedule: (id: string, start_at: string, end_at?: string) => void;
}

export const SLOT_MIN_HOUR = 6;
export const SLOT_MAX_HOUR = 22;
export const SLOT_MINUTES = 30;
/** Vertical pixels per minute. 1.2 → 720 → 060 maps to ~36 px / 30-min slot,
 *  comfortable on touch. */
export const PX_PER_MINUTE = 1.2;
export const GUTTER_WIDTH = 48;

export function DayView({ day, events, isLoading, onOpenTile, onReschedule }: Props) {
  const colors = useThemeColors();
  const { resolve: resolveTileColors } = useTileColors();

  // Events whose start_at falls on the displayed day, split by all-day flag.
  // All-day events render as flat chips above the time grid (FullCalendar
  // parity); timed events go in the timeline.
  const dayEvents = events.filter((t) => {
    if (!t.start_at) return false;
    return isSameDay(new Date(t.start_at), day);
  });
  const allDayEvents = dayEvents.filter((t) => !!t.all_day);
  const timedEvents = dayEvents.filter((t) => !t.all_day);

  const hours = [];
  for (let h = SLOT_MIN_HOUR; h <= SLOT_MAX_HOUR; h++) hours.push(h);
  const totalMinutes = (SLOT_MAX_HOUR - SLOT_MIN_HOUR) * 60;
  const bodyHeight = totalMinutes * PX_PER_MINUTE;

  // Now indicator (ticks every minute so it stays accurate during use)
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const showNow = isToday(day);
  const nowOffset =
    (minutesFromMidnight(now) - SLOT_MIN_HOUR * 60) * PX_PER_MINUTE;

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="small" color={colors.tertiary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ minHeight: bodyHeight + 24 }}
    >
      {/* All-day row — only rendered when there's at least one all-day event,
          so timed days don't get a wasted band of empty space. */}
      {allDayEvents.length > 0 && (
        <View
          style={{
            flexDirection: 'row',
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            paddingVertical: 6,
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
          <View style={{ flex: 1, paddingRight: 6 }}>
            {allDayEvents.map((t) => (
              <AllDayChip
                key={t.id}
                tile={t}
                colors={resolveTileColors(t)}
                onPress={() => onOpenTile(t.id)}
              />
            ))}
          </View>
        </View>
      )}

      <View style={{ flexDirection: 'row', paddingVertical: 8 }}>
        {/* Left gutter — hour labels */}
        <View style={{ width: GUTTER_WIDTH }}>
          {hours.map((h) => (
            <View
              key={h}
              style={{
                position: 'absolute',
                top: (h - SLOT_MIN_HOUR) * 60 * PX_PER_MINUTE - 7,
                left: 0,
                width: GUTTER_WIDTH,
                alignItems: 'flex-end',
                paddingRight: 6,
              }}
            >
              <Text style={{ fontSize: 10, color: colors.tertiary }}>
                {String(h).padStart(2, '0')}:00
              </Text>
            </View>
          ))}
        </View>

        {/* Right body — horizontal lines + events */}
        <View
          style={{
            flex: 1,
            position: 'relative',
            height: bodyHeight,
            borderLeftWidth: 1,
            borderLeftColor: colors.border,
          }}
        >
          {/* Half-hour grid lines (slot duration). Major (hour) lines render
              with a darker stroke. */}
          {Array.from({ length: (SLOT_MAX_HOUR - SLOT_MIN_HOUR) * 2 + 1 }).map(
            (_, i) => {
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
            },
          )}

          {/* Now indicator */}
          {showNow &&
            nowOffset >= 0 &&
            nowOffset <= bodyHeight && (
              <View
                style={{
                  position: 'absolute',
                  left: -3,
                  right: 0,
                  top: nowOffset,
                  flexDirection: 'row',
                  alignItems: 'center',
                  zIndex: 5,
                }}
                pointerEvents="none"
              >
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: '#EF4444',
                  }}
                />
                <View
                  style={{
                    flex: 1,
                    height: 1,
                    backgroundColor: '#EF4444',
                  }}
                />
              </View>
            )}

          {/* Timed events only — all-day chips render in the row above. */}
          {timedEvents.map((tile) => (
            <EventBlock
              key={tile.id}
              tile={tile}
              colors={resolveTileColors(tile)}
              day={day}
              minHour={SLOT_MIN_HOUR}
              maxHour={SLOT_MAX_HOUR}
              pxPerMinute={PX_PER_MINUTE}
              snapMinutes={15}
              onTap={() => onOpenTile(tile.id)}
              onReschedule={onReschedule}
            />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
