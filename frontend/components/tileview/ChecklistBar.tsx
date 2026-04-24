import { useMemo } from 'react';

const DONE_COLOR = '#20C933';  // greenBright
const TODO_COLOR = '#F82B60';  // redBright

const HEIGHT = 4;
const GAP = 2;
const MAX_FIXED_COUNT = 10;
const FIXED_ITEM_WIDTH = 8;

interface ChecklistBarProps {
  items: { is_done: boolean }[] | undefined;
  /** Inner width available for the bar in pixels. */
  availableWidth: number;
}

/**
 * Thin 4px-tall bar showing checklist progress as colored rectangles.
 * ≤ 10 items: fixed-width rectangles (8px each, 2px gap), left-aligned.
 * > 10 items: rectangles adapt their width so the row spans availableWidth.
 */
export function ChecklistBar({ items, availableWidth }: ChecklistBarProps) {
  const itemWidth = useMemo(() => {
    if (!items || items.length === 0) return 0;
    const n = items.length;
    if (n <= MAX_FIXED_COUNT) return FIXED_ITEM_WIDTH;
    return Math.max(2, (availableWidth - (n - 1) * GAP) / n);
  }, [items, availableWidth]);

  if (!items || items.length === 0) return null;

  return (
    <div className="flex" style={{ gap: `${GAP}px`, height: HEIGHT }}>
      {items.map((item, i) => (
        <div
          key={i}
          style={{
            width: itemWidth,
            height: HEIGHT,
            backgroundColor: item.is_done ? DONE_COLOR : TODO_COLOR,
            borderRadius: 1,
            flexShrink: 0,
          }}
        />
      ))}
    </div>
  );
}
