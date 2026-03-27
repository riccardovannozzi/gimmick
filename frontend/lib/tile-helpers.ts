import type { Tile } from '@/types';

export const FALLBACK_COLOR = '#94A3B8';
export const TILE_FULL = 96;

export const BAND_COLORS = {
  events: '#D85A30',
  deadlines: '#BA7517',
  todos: '#94A3B8',
};

export function isLightColor(hex: string): boolean {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}

export function formatDay(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (target.getTime() - today.getTime()) / 86400000;
  if (diff === 0) return 'Oggi';
  if (diff === 1) return 'Domani';
  return d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric' });
}

export function isSunday(dateStr: string): boolean {
  return new Date(dateStr).getDay() === 0;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

export function getDayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

export function generateDays(pastDays: number, futureDays: number): string[] {
  const days: string[] = [];
  const now = new Date();
  for (let i = -pastDays; i <= futureDays; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    days.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  return days;
}

export function generateWeekDays(weekOffset: number): string[] {
  const now = new Date();
  const dayOfWeek = now.getDay();
  // Monday = start of week (ISO)
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7) + weekOffset * 7);
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  return days;
}

export function getMonthLabel(dayKey: string): string {
  const [y, m] = dayKey.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
}

export function getDayOfMonth(dayKey: string): number {
  return parseInt(dayKey.split('-')[2], 10);
}

export function groupByDay(tiles: Tile[], dateField: 'start_at' | 'end_at'): Record<string, Tile[]> {
  const groups: Record<string, Tile[]> = {};
  tiles.forEach((t) => {
    const val = dateField === 'start_at' ? t.start_at : t.end_at;
    if (!val) return;
    const day = getDayKey(val);
    if (!groups[day]) groups[day] = [];
    groups[day].push(t);
  });
  return groups;
}

export function getSparkCounts(tile: Tile): Record<string, number> {
  const counts: Record<string, number> = {};
  (tile.sparks || []).forEach((s) => {
    counts[s.type] = (counts[s.type] || 0) + 1;
  });
  return counts;
}

export function isTileDimmed(tile: Tile, selectedTagIds: Set<string>): boolean {
  if (!selectedTagIds || selectedTagIds.size === 0) return false;
  const tileTags = tile.tags || [];
  return !tileTags.some((t) => selectedTagIds.has(t.id));
}

export function deadlineSubtitle(tile: Tile): string {
  const dateField = tile.end_at || tile.start_at;
  if (!dateField) return '';
  if (isToday(dateField)) return 'Scade oggi';
  const d = new Date(dateField);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (d.toDateString() === tomorrow.toDateString()) return 'Scade domani';
  return `Scade ${d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric' })}`;
}

export function groupByHourBand(tiles: Tile[], bands: number[]): Record<number, Record<string, Tile[]>> {
  const result: Record<number, Record<string, Tile[]>> = {};
  bands.forEach((b) => { result[b] = {}; });
  tiles.forEach((tile) => {
    if (!tile.start_at) return;
    const hour = new Date(tile.start_at).getHours();
    const band = bands.reduce((prev, curr) => (Math.abs(curr - hour) < Math.abs(prev - hour) ? curr : prev));
    const day = getDayKey(tile.start_at);
    if (!result[band][day]) result[band][day] = [];
    result[band][day].push(tile);
  });
  return result;
}

export function formatWeekRange(days: string[]): string {
  if (days.length === 0) return '';
  const start = new Date(days[0]);
  const end = new Date(days[days.length - 1]);
  const sDay = start.getDate();
  const sMonth = start.toLocaleDateString('it-IT', { month: 'short' });
  const eDay = end.getDate();
  const eMonth = end.toLocaleDateString('it-IT', { month: 'short' });
  const year = end.getFullYear();
  if (sMonth === eMonth) return `${sDay} – ${eDay} ${sMonth} ${year}`;
  return `${sDay} ${sMonth} – ${eDay} ${eMonth} ${year}`;
}
