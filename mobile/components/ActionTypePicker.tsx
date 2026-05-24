/**
 * Full-screen picker for scheduling a tile as DEADLINE or EVENT.
 *
 * Pure-JS, no native date module — works in the existing dev-client binary.
 * Three tabs split the form so the active picker always sits high on the
 * screen:
 *   - DATA:    mini-calendar 6×7 grid with month nav
 *   - INIZIO:  analog clock dial + duration chips
 *   - FINE:    analog clock dial (no duration chips; the duration is derived
 *              from start/end at confirm time)
 *
 * The `initialTab` prop lets the caller route directly to the right pane
 * based on which field was tapped in the EDIT screen (Date / Start / End).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  type GestureResponderEvent,
} from 'react-native';
import { BottomSheetBackdrop, BottomSheetModal } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, G, Text as SvgText } from 'react-native-svg';
import {
  IconChevronLeft,
  IconChevronRight,
  IconX,
} from '@tabler/icons-react-native';
import { usePixelTheme } from '@/components/pixel';
import {
  fmtMonthYear,
  isSameDay,
  isToday as isTodayDate,
  monthGridDays,
  startOfDay,
} from '@/lib/chrono-utils';
import type { ActionType } from '@/types';

export type PickerTab = 'date' | 'start' | 'end';

interface ActionTypePickerProps {
  visible: boolean;
  mode: 'deadline' | 'event';
  initialDate?: Date;
  initialEndDate?: Date;
  initialAllDay?: boolean;
  /** Which tab to open on. Defaults to 'date'. */
  initialTab?: PickerTab;
  onConfirm: (data: {
    action_type: ActionType;
    start_at: string;
    end_at?: string;
    all_day?: boolean;
  }) => void;
  onCancel: () => void;
}

const DURATION_OPTIONS = [
  { label: '30 min', minutes: 30 },
  { label: '1h', minutes: 60 },
  { label: '1h 30m', minutes: 90 },
  { label: '2h', minutes: 120 },
  { label: '3h', minutes: 180 },
  { label: '4h', minutes: 240 },
];

const WEEKDAY_LABELS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];

export function ActionTypePicker({
  visible,
  mode,
  initialDate,
  initialEndDate,
  initialAllDay,
  initialTab,
  onConfirm,
  onCancel,
}: ActionTypePickerProps) {
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
    surfaceVariant: theme.surface,
  } as const;
  const insets = useSafeAreaInsets();
  const bottomSheetRef = useRef<BottomSheetModal>(null);

  // BottomSheetModal is controlled via present()/dismiss() rather than the
  // declarative `visible` prop the parent passes — bridge the two.
  useEffect(() => {
    if (visible) {
      bottomSheetRef.current?.present();
    } else {
      bottomSheetRef.current?.dismiss();
    }
  }, [visible]);

  const [tab, setTab] = useState<PickerTab>(initialTab ?? 'date');

  // Two independent dates: startDate covers the day-of and start-time, and
  // endDate the day-of (same as startDate by convention) + end-time. Multi-
  // day events aren't supported here on purpose (matches the web behaviour).
  const [startDate, setStartDate] = useState<Date>(() => initialDate ?? new Date());
  const [endDate, setEndDate] = useState<Date>(() => {
    if (initialEndDate) return initialEndDate;
    if (initialDate) return new Date(initialDate.getTime() + 60 * 60_000);
    return new Date(Date.now() + 60 * 60_000);
  });

  // `allDay` is set by the action-type buttons in the tile edit screen
  // (NOTES / TO DO / DUE / ALL DAY / TIMED), not in this picker. We treat
  // `initialAllDay` as the source of truth and pass it back unchanged on
  // confirm.
  const allDay = initialAllDay ?? false;

  // Reseed when the picker is re-opened — the BottomSheet instance is reused
  // between opens, so initial state would otherwise stay stale.
  useEffect(() => {
    if (!visible) return;
    setTab(initialTab ?? 'date');
    setStartDate(initialDate ?? new Date());
    setEndDate(
      initialEndDate ??
        (initialDate
          ? new Date(initialDate.getTime() + 60 * 60_000)
          : new Date(Date.now() + 60 * 60_000)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Reserve the TopNav row at the top of the screen — the sheet's parent
  // (SafeAreaWrapper in tile/[id].tsx) spans the whole screen including
  // status bar + TopNav, so we push the sheet down past both. TopNav math:
  // status bar inset + paddingTop(16) + icon(30) + paddingBottom(8).
  const TOP_NAV_CONTENT = 16 + 30 + 8;
  const topInset = insets.top + TOP_NAV_CONTENT;
  const snapPoints = useMemo(() => ['100%'], []);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
    ),
    [],
  );

  const handleConfirm = () => {
    const start = new Date(startDate);
    if (mode === 'deadline') {
      start.setHours(23, 59, 59, 0);
      onConfirm({ action_type: 'deadline', start_at: start.toISOString(), all_day: true });
      return;
    }
    if (allDay) {
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setHours(23, 59, 59, 0);
      onConfirm({
        action_type: 'event',
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        all_day: true,
      });
      return;
    }
    onConfirm({
      action_type: 'event',
      start_at: start.toISOString(),
      end_at: endDate.toISOString(),
      all_day: false,
    });
  };

  // BottomSheetModal stays mounted (controlled by present/dismiss above), so
  // we don't early-return here. The sheet itself is hidden when not visible.

  // Calendar tap → keep both start and end on the new day, preserving their
  // existing times of day.
  const onSelectDay = (d: Date) => {
    const newStart = new Date(d);
    newStart.setHours(startDate.getHours(), startDate.getMinutes(), 0, 0);
    const newEnd = new Date(d);
    newEnd.setHours(endDate.getHours(), endDate.getMinutes(), 0, 0);
    setStartDate(newStart);
    setEndDate(newEnd);
  };
  const onClickToday = () => onSelectDay(startOfDay(new Date()));

  // Start-hour/min changes: keep the existing duration (so end moves with start).
  // Guard: early-return se il valore non è cambiato — durante un pan il
  // responder system chiama N volte al secondo, e setState con stesso ref
  // crea un loop infinito di re-render (Maximum update depth exceeded).
  const onPickStartHour = (h: number) => {
    if (h === startDate.getHours()) return;
    const durationMin = (endDate.getTime() - startDate.getTime()) / 60000;
    const next = new Date(startDate);
    next.setHours(h);
    setStartDate(next);
    if (durationMin > 0) setEndDate(new Date(next.getTime() + durationMin * 60_000));
  };
  const onPickStartMinute = (m: number) => {
    if (m === startDate.getMinutes()) return;
    const durationMin = (endDate.getTime() - startDate.getTime()) / 60000;
    const next = new Date(startDate);
    next.setMinutes(m);
    setStartDate(next);
    if (durationMin > 0) setEndDate(new Date(next.getTime() + durationMin * 60_000));
  };

  // End-hour/min changes set the end independently (duration auto-derives).
  const onPickEndHour = (h: number) => {
    if (h === endDate.getHours()) return;
    const next = new Date(endDate);
    next.setHours(h);
    setEndDate(next);
  };
  const onPickEndMinute = (m: number) => {
    if (m === endDate.getMinutes()) return;
    const next = new Date(endDate);
    next.setMinutes(m);
    setEndDate(next);
  };

  // Duration chip → snap end to start + N min.
  const onSelectDuration = (min: number) => {
    setEndDate(new Date(startDate.getTime() + min * 60_000));
  };
  const currentDuration = Math.round((endDate.getTime() - startDate.getTime()) / 60_000);

  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = startDate.toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const startStr = `${pad(startDate.getHours())}:${pad(startDate.getMinutes())}`;
  const endStr = `${pad(endDate.getHours())}:${pad(endDate.getMinutes())}`;

  const showTimeTabs = mode === 'event' && !allDay;

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      topInset={topInset}
      // v5 of @gorhom/bottom-sheet defaults to dynamic sizing (sheet height
      // = content height), which ignores the snap points entirely. We need
      // an explicit fixed snap so the sheet always reaches 100% — i.e. the
      // sheet top sits at `topInset` and bottom at the screen edge.
      enableDynamicSizing={false}
      // Lock the sheet at 100% — disable every pan gesture so dragging on
      // the clock dial can't accidentally resize/close the picker. The X
      // button (handleClose / onCancel) is the only way out.
      enablePanDownToClose={false}
      enableContentPanningGesture={false}
      enableHandlePanningGesture={false}
      handleComponent={null}
      onDismiss={onCancel}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.background2 }}
      handleIndicatorStyle={{ backgroundColor: colors.tertiary }}
    >
      {/* Plain RN View instead of BottomSheetView — the v5 BottomSheetView
          fights flex:1 due to its internal layout reporting. flex:1 + column
          + space-between distributes the three children (top group, dial
          area, Conferma) along the sheet's full height. */}
      <View
        style={{
          flex: 1,
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 8),
          justifyContent: 'space-between',
        }}
      >
        {/* TOP GROUP — Oggi/X row + Tabs. Wrapped so the outer space-between
            sees a single "top" child, leaving the in-between gap between
            this group and the tab body. */}
        <View>
        {/* Top row: "Oggi" shortcut on the left, close X on the right. */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <TouchableOpacity
            onPress={onClickToday}
            activeOpacity={0.7}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 0,
              backgroundColor: colors.surfaceVariant,
            }}
          >
            <Text style={{ fontSize: 12, color: colors.secondary, fontWeight: '500' }}>
              Oggi
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onCancel} hitSlop={12}>
            <IconX size={22} color={colors.tertiary} />
          </TouchableOpacity>
        </View>

        {/* Tab switcher: DATA | INIZIO | FINE. INIZIO + FINE only when timed. */}
        <View
          style={{
            flexDirection: 'row',
            gap: 6,
            backgroundColor: colors.background1,
            padding: 4,
            borderRadius: 0,
          }}
        >
          <TabButton
            label="DATA"
            value={dateStr}
            active={tab === 'date'}
            onPress={() => setTab('date')}
            colors={colors}
          />
          {showTimeTabs && (
            <>
              <TabButton
                label="INIZIO"
                value={startStr}
                active={tab === 'start'}
                onPress={() => setTab('start')}
                colors={colors}
              />
              <TabButton
                label="FINE"
                value={endStr}
                active={tab === 'end'}
                onPress={() => setTab('end')}
                colors={colors}
              />
            </>
          )}
        </View>
        </View>
        {/* /TOP GROUP */}

        {/* Tab body — content-sized. The outer absolute container uses
            space-between so this middle child floats midway between the
            top group and the Conferma button. */}
        <View>
          {tab === 'date' && (
            <MiniCalendar selected={startDate} onSelect={onSelectDay} colors={colors} />
          )}
          {tab === 'start' && showTimeTabs && (
            <TimePane
              hour={startDate.getHours()}
              minute={startDate.getMinutes()}
              onPickHour={onPickStartHour}
              onPickMinute={onPickStartMinute}
              durationMinutes={currentDuration}
              onSelectDuration={onSelectDuration}
              showDuration
              colors={colors}
            />
          )}
          {tab === 'end' && showTimeTabs && (
            <TimePane
              hour={endDate.getHours()}
              minute={endDate.getMinutes()}
              onPickHour={onPickEndHour}
              onPickMinute={onPickEndMinute}
              colors={colors}
            />
          )}
        </View>

        {/* Confirm — natural last child of the flex column. The tab body's
            flex:1 above takes all remaining vertical space, so Conferma
            ends up flush against the bottom paddingBottom (= insets.bottom). */}
        <TouchableOpacity
          onPress={handleConfirm}
          style={{
            backgroundColor: mode === 'deadline' ? theme.semantic.warning : colors.accent,
            borderWidth: 2,
            borderColor: theme.border,
            paddingVertical: 16,
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              fontFamily: 'PressStart2P-Regular',
              fontSize: 12,
              color: mode === 'deadline' ? theme.ink : (colors.onAccent as string),
              letterSpacing: 1.2,
            }}
          >
            CONFERMA
          </Text>
        </TouchableOpacity>
      </View>
    </BottomSheetModal>
  );
}

// ─── Subcomponents ─────────────────────────────────────────────────────────

function TabButton({
  label,
  value,
  active,
  onPress,
  colors,
}: {
  label: string;
  value: string;
  active: boolean;
  onPress: () => void;
  colors: any;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flex: 1,
        alignItems: 'center',
        paddingVertical: 8,
        borderRadius: 0,
        backgroundColor: active ? colors.accent : 'transparent',
      }}
    >
      <Text
        style={{
          fontFamily: 'PressStart2P-Regular',
          fontSize: 9,
          letterSpacing: 1,
          color: active ? colors.onAccent : colors.tertiary,
        }}
      >
        {label}
      </Text>
      <Text style={{ fontSize: 13, fontWeight: '700', color: active ? colors.onAccent : colors.primary, marginTop: 4 }}>
        {value}
      </Text>
    </TouchableOpacity>
  );
}

function MiniCalendar({
  selected,
  onSelect,
  colors,
}: {
  selected: Date;
  onSelect: (d: Date) => void;
  colors: any;
}) {
  const [anchor, setAnchor] = useState<Date>(selected);

  useEffect(() => {
    if (
      selected.getMonth() !== anchor.getMonth() ||
      selected.getFullYear() !== anchor.getFullYear()
    ) {
      setAnchor(selected);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const days = useMemo(() => monthGridDays(anchor), [anchor]);
  const stepMonth = (delta: number) => {
    const x = new Date(anchor);
    x.setMonth(x.getMonth() + delta);
    setAnchor(x);
  };

  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <TouchableOpacity
          onPress={() => stepMonth(-1)}
          style={{
            width: 32,
            height: 32,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 0,
            backgroundColor: colors.surfaceVariant,
          }}
        >
          <IconChevronLeft size={16} color={colors.primary} />
        </TouchableOpacity>
        <Text
          style={{
            fontSize: 15,
            fontWeight: '600',
            color: colors.primary,
            textTransform: 'capitalize',
          }}
        >
          {fmtMonthYear(anchor)}
        </Text>
        <TouchableOpacity
          onPress={() => stepMonth(1)}
          style={{
            width: 32,
            height: 32,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 0,
            backgroundColor: colors.surfaceVariant,
          }}
        >
          <IconChevronRight size={16} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', marginBottom: 4 }}>
        {WEEKDAY_LABELS.map((w, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 10, color: colors.tertiary, letterSpacing: 0.5 }}>
              {w}
            </Text>
          </View>
        ))}
      </View>

      {[0, 1, 2, 3, 4, 5].map((r) => (
        <View key={r} style={{ flexDirection: 'row' }}>
          {days.slice(r * 7, r * 7 + 7).map((d) => {
            const isSel = isSameDay(d, selected);
            const inMonth = d.getMonth() === anchor.getMonth();
            const today = isTodayDate(d);
            return (
              <TouchableOpacity
                key={d.toISOString()}
                onPress={() => onSelect(d)}
                style={{
                  flex: 1,
                  height: 40,
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: 1,
                  borderRadius: 0,
                  backgroundColor: isSel ? colors.accent : 'transparent',
                  borderWidth: today && !isSel ? 1 : 0,
                  borderColor: colors.accent,
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: isSel ? '700' : '500',
                    color: isSel ? colors.onAccent : inMonth ? colors.primary : colors.tertiary,
                  }}
                >
                  {d.getDate()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/**
 * Analog clock time picker — drag a finger around the dial to set hour/minute.
 *
 *   - Hour mode: two concentric rings of 12 marks each. Outer ring covers
 *     hours 00-11, inner ring 12-23 (Material-style 24h dial).
 *   - Minute mode: single ring of 12 marks, each = 5 minutes (00, 05, … 55).
 *
 * The big HH:MM header above the dial is the mode toggle — tap HH to edit
 * hour, tap MM to edit minute. (No auto-advance from hour to minute: it
 * confused the drag gesture by flipping mode mid-drag.)
 *
 * `showDuration` appends the duration chips below the dial — used only on
 * the INIZIO tab; FINE picks an independent end time.
 */
function TimePane({
  hour,
  minute,
  onPickHour,
  onPickMinute,
  durationMinutes,
  onSelectDuration,
  showDuration = false,
  colors,
}: {
  hour: number;
  minute: number;
  onPickHour: (h: number) => void;
  onPickMinute: (m: number) => void;
  durationMinutes?: number;
  onSelectDuration?: (m: number) => void;
  showDuration?: boolean;
  colors: any;
}) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const [clockMode, setClockMode] = useState<'hour' | 'minute'>('hour');

  return (
    // Content-sized container — the outer picker uses justifyContent:
    // space-between on its 3 children, so TimePane itself floats midway
    // between the tab buttons and the Conferma button.
    <View>
      {/* Big HH:MM — tap each part to switch the dial mode. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          marginBottom: 16,
        }}
      >
        <TouchableOpacity onPress={() => setClockMode('hour')} hitSlop={8}>
          <Text
            style={{
              fontSize: 44,
              fontWeight: '700',
              letterSpacing: 1,
              color: clockMode === 'hour' ? colors.accent : colors.primary,
            }}
          >
            {pad(hour)}
          </Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 44, fontWeight: '700', color: colors.primary }}>
          :
        </Text>
        <TouchableOpacity onPress={() => setClockMode('minute')} hitSlop={8}>
          <Text
            style={{
              fontSize: 44,
              fontWeight: '700',
              letterSpacing: 1,
              color: clockMode === 'minute' ? colors.accent : colors.primary,
            }}
          >
            {pad(minute)}
          </Text>
        </TouchableOpacity>
      </View>

      <ClockDial
        mode={clockMode}
        hour={hour}
        minute={minute}
        // No auto-advance: during a drag, switching modes mid-gesture would
        // make subsequent onResponderMove events update the wrong value
        // (e.g. dragging on the hour ring starts editing minutes). User
        // toggles HH/MM by tapping the header above.
        onPickHour={onPickHour}
        onPickMinute={onPickMinute}
        colors={colors}
      />

      {showDuration && onSelectDuration && (
        <View style={{ marginTop: 16 }}>
          <Text
            style={{
              fontFamily: 'PressStart2P-Regular',
              fontSize: 9,
              color: colors.tertiary,
              letterSpacing: 1,
              marginBottom: 8,
            }}
          >
            DURATA
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {DURATION_OPTIONS.map((opt) => {
              const isActive = durationMinutes === opt.minutes;
              return (
                <TouchableOpacity
                  key={opt.minutes}
                  onPress={() => onSelectDuration(opt.minutes)}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 0,
                    backgroundColor: isActive ? colors.accent : colors.surfaceVariant,
                    borderWidth: 2,
                    borderColor: colors.border,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: 'PressStart2P-Regular',
                      fontSize: 9,
                      letterSpacing: 1,
                      color: isActive ? (colors.onAccent as string) : colors.primary,
                    }}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Analog clock dial ─────────────────────────────────────────────────────

// All radii scale together — bumped from 280 → 340 to fill more of the
// (post-padding) sheet width on a typical phone.
const DIAL_SIZE = 340;
// Hours sit on a single outer ring of 24 ticks. Minutes use the inner ring
// (12 ticks, 5-minute step) so the two modes look visually distinct.
const DIAL_LABEL_R_OUTER = 150;
const DIAL_MINUTE_R = 104;

/**
 * SVG clock face wrapped in a Pan gesture. Computes the touch angle relative
 * to the dial centre, snaps to the nearest tick, and calls the appropriate
 * callback. The selection hand + selected-tick highlight are drawn on top
 * of the labels.
 */
function ClockDial({
  mode,
  hour,
  minute,
  onPickHour,
  onPickMinute,
  colors,
}: {
  mode: 'hour' | 'minute';
  hour: number;
  minute: number;
  onPickHour: (h: number) => void;
  onPickMinute: (m: number) => void;
  colors: any;
}) {
  const cx = DIAL_SIZE / 2;
  const cy = DIAL_SIZE / 2;

  // Read current mode + callbacks via a ref so the responder handlers always
  // see the latest values (avoid the stale-closure trap when state changes
  // mid-drag, e.g. after the auto-advance hour → minute).
  const stateRef = useRef({ mode, onPickHour, onPickMinute });
  stateRef.current = { mode, onPickHour, onPickMinute };

  // NOTE: we use the legacy React Native responder system instead of
  // `react-native-gesture-handler`'s Pan. Inside `@gorhom/bottom-sheet` the
  // sheet's internal pan handler competes with RNGH Pans on the children
  // and frequently swallows the touch — the native responder doesn't go
  // through RNGH at all, so it's immune to that.
  const handleTouch = useCallback(
    (tx: number, ty: number) => {
      const { mode: curMode, onPickHour: pickH, onPickMinute: pickM } = stateRef.current;
      const dx = tx - cx;
      const dy = ty - cy;
      // Angle: atan2 returns -π..π with 0 at the 3-o'clock side. Shift so 0
      // is at the top (12 o'clock) and clockwise increases the angle.
      let theta = Math.atan2(dy, dx) + Math.PI / 2;
      if (theta < 0) theta += 2 * Math.PI;

      if (curMode === 'hour') {
        // Single 24-slot ring — angle maps directly to hour 0-23.
        const slot = Math.round((theta / (2 * Math.PI)) * 24) % 24;
        pickH(slot);
      } else {
        // 12 slots × 5 min each.
        const slot = Math.round((theta / (2 * Math.PI)) * 12) % 12;
        pickM(slot * 5);
      }
    },
    [cx, cy],
  );

  const onResponderUpdate = useCallback(
    (e: GestureResponderEvent) => {
      handleTouch(e.nativeEvent.locationX, e.nativeEvent.locationY);
    },
    [handleTouch],
  );

  // Slot index of the current selection on its ring.
  //   hour mode   → 24 slots, slot == hour
  //   minute mode → 12 slots, slot == minute/5
  const totalSlots = mode === 'hour' ? 24 : 12;
  const slotIndex = mode === 'hour' ? hour : Math.round(minute / 5) % 12;
  const handR = mode === 'minute' ? DIAL_MINUTE_R : DIAL_LABEL_R_OUTER;

  // Cartesian coord for the tick of the given slot (0=top, clockwise).
  const slotCoord = (slot: number, total: number, r: number) => {
    const angle = (slot / total) * 2 * Math.PI - Math.PI / 2;
    return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
  };
  const handEnd = slotCoord(slotIndex, totalSlots, handR);

  // 24 hour labels on a single ring; 12 minute labels at 5-min steps.
  const hourLabels = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const minuteLabels = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

  return (
    <View style={{ alignItems: 'center' }}>
      <View
        style={{ width: DIAL_SIZE, height: DIAL_SIZE }}
        // Native RN responder system — onStartShouldSetResponder claims the
        // touch on first contact, onMoveShouldSetResponder keeps it during
        // drag. locationX/Y are view-relative (top-left = 0,0).
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={onResponderUpdate}
        onResponderMove={onResponderUpdate}
        onResponderTerminationRequest={() => false}
      >
        <Svg width={DIAL_SIZE} height={DIAL_SIZE}>
            {/* Background plate */}
            <Circle
              cx={cx}
              cy={cy}
              r={DIAL_SIZE / 2 - 4}
              fill={colors.surfaceVariant}
            />

            {/* Selection hand: line + filled tick at the end. Drawn before
                the labels so text sits on top. */}
            <Line
              x1={cx}
              y1={cy}
              x2={handEnd.x}
              y2={handEnd.y}
              stroke={colors.accent}
              strokeWidth={2}
            />
            <Circle cx={cx} cy={cy} r={4} fill={colors.accent} />
            <Circle cx={handEnd.x} cy={handEnd.y} r={20} fill={colors.accent} />

            {/* Labels — a single ring of either 24 hours or 12 five-minute
                marks (no more concentric inner ring). */}
            <G>
              {(mode === 'hour' ? hourLabels : minuteLabels).map((label, i) => {
                const r = mode === 'hour' ? DIAL_LABEL_R_OUTER : DIAL_MINUTE_R;
                const { x, y } = slotCoord(i, totalSlots, r);
                const selected = i === slotIndex;
                return (
                  <DialLabel
                    key={`hour-${i}`}
                    x={x}
                    y={y}
                    label={label}
                    selected={selected}
                    color={colors.primary}
                    // 24 hour labels packed tighter than 12 minutes — shrink
                    // the type in hour mode so they don't overlap.
                    small={mode === 'hour'}
                  />
                );
              })}
            </G>

            {/* Centre dot on top to keep the hand origin tidy. */}
            <Circle cx={cx} cy={cy} r={3} fill="#fff" />
          </Svg>
      </View>
    </View>
  );
}

/** SVG numeric label on a dial slot, centred at (x, y). When selected the
 *  fill flips to black so it reads on top of the blue hand tick. */
function DialLabel({
  x,
  y,
  label,
  selected,
  color,
  small,
}: {
  x: number;
  y: number;
  label: string;
  selected: boolean;
  color: string;
  small?: boolean;
}) {
  return (
    <SvgText
      x={x}
      y={y + (small ? 4 : 5)}
      fill={selected ? '#000' : color}
      fontSize={small ? 12 : 15}
      fontWeight={selected ? '700' : '500'}
      textAnchor="middle"
    >
      {label}
    </SvgText>
  );
}
