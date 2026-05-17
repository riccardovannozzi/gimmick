/**
 * Date helpers used across the Chrono screen — Monday-first weeks, range
 * generators, day-bucket extraction, and slot snapping.
 */

/** Strip time so two dates with different hours compare equal. */
export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** Monday of the week that contains `d` (locale-IT convention). */
export function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  // getDay: Sun=0, Mon=1 … Sat=6. We want Monday as the first day.
  const dow = x.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  x.setDate(x.getDate() + diff);
  return x;
}

export function endOfWeek(d: Date): Date {
  const s = startOfWeek(d);
  const e = new Date(s);
  e.setDate(s.getDate() + 6);
  return endOfDay(e);
}

export function startOfMonth(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}

export function endOfMonth(d: Date): Date {
  const x = startOfMonth(d);
  x.setMonth(x.getMonth() + 1);
  x.setDate(0);
  return endOfDay(x);
}

/** Add `n` days (can be negative). */
export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Same calendar day (year + month + date), ignoring time. */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isToday(d: Date): boolean {
  return isSameDay(d, new Date());
}

/** Snap minutes to a slot (default 15-minute). */
export function snapMinutes(mins: number, slot = 15): number {
  return Math.round(mins / slot) * slot;
}

/** Build a `Date` at a given day + minutes-from-midnight. Useful when a drag
 *  yields a Y-offset that maps to "minutes since 00:00". */
export function dateAtMinutes(day: Date, minsFromMidnight: number): Date {
  const x = startOfDay(day);
  x.setMinutes(minsFromMidnight);
  return x;
}

/** Minutes since midnight (local). */
export function minutesFromMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/** Format a date as Italian "dd MMM" (e.g. "12 mag"). */
export function fmtDayShort(d: Date): string {
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
}

/** Italian "MMMM yyyy" (e.g. "maggio 2026"). */
export function fmtMonthYear(d: Date): string {
  return d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
}

/** Italian weekday short name (e.g. "lun"). */
export function fmtWeekday(d: Date): string {
  return d.toLocaleDateString('it-IT', { weekday: 'short' });
}

/** Build a calendar grid for a month: 6 rows × 7 cols starting on Monday.
 *  Each cell is a Date; leading/trailing cells are from prev/next month. */
export function monthGridDays(monthAnchor: Date): Date[] {
  const start = startOfWeek(startOfMonth(monthAnchor));
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) days.push(addDays(start, i));
  return days;
}
