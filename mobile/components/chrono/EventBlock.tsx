/**
 * Draggable event block for the Chrono Daily/Week views.
 *
 * Tap → onTap (open tile). Long-press starts a vertical drag; on release the
 * block snaps to the nearest `snapMinutes` slot and calls `onReschedule`. For
 * the week view, an optional `columnWidth` enables horizontal drag so the
 * event can move to a different day.
 */
import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import Svg, { Defs, Pattern, Line, Rect } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { startOfDay, snapMinutes as snapMins } from '@/lib/chrono-utils';
import type { TileColors } from '@/hooks/useTileColors';
import { usePixelTheme } from '@/components/pixel';
import type { Tile } from '@/types';

/** Diagonal-LTR hatching pattern overlay — mirror del web StatusPattern
 *  shape='diagonal_ltr'. Renderizzato come SVG fullsize sopra il bg del
 *  tile, sotto il testo. */
function HatchOverlay({ color }: { color: string }) {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <Pattern
          id="hatch"
          patternUnits="userSpaceOnUse"
          width={10}
          height={10}
          patternTransform="rotate(45)"
        >
          <Line x1={0} y1={0} x2={0} y2={10} stroke={color} strokeWidth={1.5} strokeOpacity={0.55} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#hatch)" />
    </Svg>
  );
}

interface Props {
  tile: Tile;
  /** Pre-resolved colors (type-icon-based bg + deadline-aware border).
   *  Computed once in the parent view to avoid re-querying type-icons per
   *  block. */
  colors: TileColors;
  /** The day this block is anchored to (used to convert Y offset → Date). */
  day: Date;
  minHour: number;
  maxHour: number;
  pxPerMinute: number;
  snapMinutes: number;
  /** Lateral X offset of this block within its column (0 by default). */
  laneX?: number;
  /** Width of the block in pixels. When omitted, falls back to right-anchored
   *  layout via `right: 2` so the block fills the column. */
  laneWidth?: number;
  /** Pixel width of one day column (week view only). When given, horizontal
   *  drag moves the event to neighbouring columns and the reschedule call
   *  shifts the date accordingly. */
  columnWidth?: number;
  /** Days available for horizontal drag (week view only). Index 0 is the
   *  leftmost column. */
  weekDays?: Date[];
  onTap: () => void;
  onReschedule: (id: string, start_at: string, end_at?: string) => void;
}

export function EventBlock({
  tile,
  colors,
  day,
  minHour,
  maxHour,
  pxPerMinute,
  snapMinutes,
  laneX = 2,
  laneWidth,
  columnWidth,
  weekDays,
  onTap,
  onReschedule,
}: Props) {
  const theme = usePixelTheme();
  if (!tile.start_at) return null;
  const start = new Date(tile.start_at);
  const end = tile.end_at ? new Date(tile.end_at) : null;

  // Vertical position: minutes from minHour × px/min. Clamp to [0, bodyEnd].
  const startMin = start.getHours() * 60 + start.getMinutes();
  const minDisplay = minHour * 60;
  const maxDisplay = maxHour * 60;
  const top = Math.max(0, (startMin - minDisplay) * pxPerMinute);

  // Duration: from end_at or default 60-min. All-day clamps to the visible range.
  const allDay = !!tile.all_day;
  const durationMin = allDay
    ? maxDisplay - minDisplay
    : end
    ? Math.max(15, (end.getTime() - start.getTime()) / 60000)
    : 60;
  const height = Math.max(20, durationMin * pxPerMinute);

  const { bg, border, deadlineBorder, fg, hatched, hatchColor } = colors;

  // ─── Drag state ────────────────────────────────────────────────────────
  // translationX/Y track the live drag offset relative to the block's resting
  // position. On release we convert the totals to a new start_at + end_at and
  // call onReschedule; the parent's optimistic mutation snaps the block to
  // the new spot before we reset the translation to 0.
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);

  const handleEnd = (totalDx: number, totalDy: number) => {
    const minutesDelta = snapMins(totalDy / pxPerMinute, snapMinutes);
    let dayDelta = 0;
    if (columnWidth && weekDays && weekDays.length > 0) {
      dayDelta = Math.round(totalDx / columnWidth);
      // Clamp so the block can't be dragged outside the visible week
      const startIdx = weekDays.findIndex((d) =>
        startOfDay(d).getTime() === startOfDay(day).getTime(),
      );
      if (startIdx >= 0) {
        const targetIdx = Math.max(0, Math.min(weekDays.length - 1, startIdx + dayDelta));
        dayDelta = targetIdx - startIdx;
      }
    }

    if (minutesDelta === 0 && dayDelta === 0) return;

    const newStart = new Date(start);
    newStart.setDate(newStart.getDate() + dayDelta);
    newStart.setMinutes(newStart.getMinutes() + minutesDelta);
    let newEndIso: string | undefined;
    if (end) {
      const newEnd = new Date(end);
      newEnd.setDate(newEnd.getDate() + dayDelta);
      newEnd.setMinutes(newEnd.getMinutes() + minutesDelta);
      newEndIso = newEnd.toISOString();
    }
    onReschedule(tile.id, newStart.toISOString(), newEndIso);
  };

  // Two gestures composed: a long-press to "arm" the drag (so a simple tap
  // doesn't move the block by accident), then a pan that updates tx/ty.
  // The actual mutation fires on pan end.
  const pan = Gesture.Pan()
    .activateAfterLongPress(180)
    .onStart(() => {
      'worklet';
      scale.value = withTiming(1.04, { duration: 120 });
    })
    .onUpdate((e) => {
      'worklet';
      ty.value = e.translationY;
      tx.value = columnWidth ? e.translationX : 0;
    })
    .onEnd((e) => {
      'worklet';
      scale.value = withTiming(1, { duration: 120 });
      runOnJS(handleEnd)(columnWidth ? e.translationX : 0, e.translationY);
      ty.value = withTiming(0, { duration: 120 });
      tx.value = withTiming(0, { duration: 120 });
    });

  const tap = Gesture.Tap()
    .maxDuration(200)
    .onEnd(() => {
      'worklet';
      runOnJS(onTap)();
    });

  const composed = Gesture.Exclusive(pan, tap);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
  }));

  // Either fixed-width (laneWidth given) or right-anchored (fills the column
  // with a 2px margin on each side). Two separate style shapes because the
  // typing for Animated.View doesn't allow a `width | right` union.
  const sizing = laneWidth != null
    ? { width: laneWidth }
    : { right: 2 };

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            top,
            left: laneX,
            height,
            backgroundColor: bg,
            // Pixel: bordi netti 2px, niente border-radius, niente blur shadow.
            borderRadius: 0,
            borderWidth: 2,
            borderColor: border,
            borderStyle: deadlineBorder ? 'dashed' : 'solid',
            paddingHorizontal: 6,
            paddingVertical: 4,
            overflow: 'hidden',
            zIndex: 4,
          },
          sizing,
          animatedStyle,
        ]}
      >
        {hatched && <HatchOverlay color={hatchColor} />}
        {/* Title — sans-serif system font (no fontFamily) per coerenza col
            frontend che usa Inter ereditato dal body. Su mobile Android/iOS
            il default è Roboto/San Francisco, anch'essi sans proporzionali. */}
        <Text
          numberOfLines={height < 40 ? 1 : 2}
          style={{
            fontSize: 13,
            fontWeight: '700',
            color: fg,
            lineHeight: 16,
          }}
        >
          {tile.title || '(senza titolo)'}
        </Text>
        {height >= 36 && !allDay && (
          <Text
            style={{
              fontSize: 12,
              fontWeight: '600',
              color: fg,
              marginTop: 2,
              opacity: 0.85,
            }}
          >
            {fmtTime(start)}
            {end ? ` – ${fmtTime(end)}` : ''}
          </Text>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

function fmtTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
