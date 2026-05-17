/**
 * Pan gesture that fires `onSwipeLeft` / `onSwipeRight` only on a clear
 * horizontal swipe — vertical scrolling inside the wrapped view continues to
 * work because the gesture fails as soon as the user moves vertically more
 * than `failOffsetY` pixels first.
 *
 * Used to navigate between sibling screens (e.g. TILE ↔ LIST).
 */
import { Gesture } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

interface Options {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  /** Minimum horizontal translation (px) to count as a swipe. Default 70. */
  distance?: number;
  /** Minimum horizontal velocity (px/s) to count as a swipe. Default 500. */
  velocity?: number;
}

export function useHorizontalSwipe({
  onSwipeLeft,
  onSwipeRight,
  distance = 70,
  velocity = 500,
}: Options) {
  return Gesture.Pan()
    // Only activate the gesture once the user has moved horizontally past the
    // threshold — keeps small touches and vertical pans from being captured.
    .activeOffsetX([-20, 20])
    // Bail out as soon as vertical motion dominates — lets ScrollView scroll.
    .failOffsetY([-25, 25])
    .onEnd((e) => {
      'worklet';
      const dx = e.translationX;
      const vx = e.velocityX;
      if ((dx <= -distance || vx <= -velocity) && onSwipeLeft) {
        runOnJS(onSwipeLeft)();
      } else if ((dx >= distance || vx >= velocity) && onSwipeRight) {
        runOnJS(onSwipeRight)();
      }
    });
}
