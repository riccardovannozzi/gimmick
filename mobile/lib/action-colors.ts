/**
 * Default action-type colors — port of frontend DEFAULT_ACTION_COLORS. Mobile
 * doesn't expose the per-user override UI yet, so this is a fixed palette.
 */
import type { ActionType } from '@/types';

export const ACTION_COLORS: Record<ActionType, string> = {
  none: '#52525B',     // Zinc-600 (Notes — neutral)
  anytime: '#666666',  // grayBright (To Do)
  deadline: '#F82B60', // redBright (Deadline)
  event: '#20C933',    // greenBright (Timed)
  // 'allday' isn't in ActionType but the web treats event+all_day separately.
};

/** Choose the right color for a tile event. event + all_day → blueBright. */
export function eventColor(actionType: ActionType | undefined, allDay: boolean | undefined): string {
  if (actionType === 'event' && allDay) return '#2D7FF9'; // blueBright
  return ACTION_COLORS[actionType ?? 'none'] ?? ACTION_COLORS.none;
}

/** Pick black/white foreground for a given background (luminance heuristic). */
export function readableOn(bg: string): string {
  const hex = bg.replace('#', '').slice(0, 6);
  if (hex.length < 6) return '#FFFFFF';
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.55 ? '#000000' : '#FFFFFF';
}
