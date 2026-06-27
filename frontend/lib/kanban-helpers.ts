/**
 * Helper puri per il Kanban: matching tile↔colonna e ordinamento.
 *
 * Estratti dalla pagina arcade `(dashboard)/kanban/page.tsx` per riuso dallo
 * shell Obsidian (`components/views/kanban-live.tsx`) senza duplicare la logica
 * di filtro. Semantica invariata: OR all'interno dello stesso tipo di filtro,
 * AND tra tipi diversi. (La pagina arcade mantiene per ora le sue copie locali.)
 */
import type { Tile, KanbanFilter, KanbanFilterType, KanbanSortBy, KanbanSortDir } from '@/types';

// ─── Date range helpers ───
export function parseDateRange(value: string): { from: string; to: string } {
  const [from = '', to = ''] = value.split('|');
  return { from, to };
}

export function tileDateForRange(tile: Tile): Date | null {
  const iso = tile.start_at || tile.end_at || tile.created_at;
  return iso ? new Date(iso) : null;
}

export function dateRangeKind(value: string): 'last' | 'next' | 'absolute' {
  if (value.startsWith('last:')) return 'last';
  if (value.startsWith('next:')) return 'next';
  return 'absolute';
}

export function parseRelativeDays(value: string): number | null {
  const n = parseInt(value.split(':')[1] || '', 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function matchRelativeLastDays(d: Date, n: number): boolean {
  const from = new Date(); from.setDate(from.getDate() - n); from.setHours(0, 0, 0, 0);
  const to = new Date(); to.setHours(23, 59, 59, 999);
  return d >= from && d <= to;
}

function matchRelativeNextDays(d: Date, n: number): boolean {
  const from = new Date(); from.setHours(0, 0, 0, 0);
  const to = new Date(); to.setDate(to.getDate() + n); to.setHours(23, 59, 59, 999);
  return d >= from && d <= to;
}

// ─── Filter matching: OR within same type, AND across types ───
export function tileMatchesFilters(
  tile: Tile,
  filters: KanbanFilter[],
  typeTileIcons: Record<string, string>,
  doneStatusId: string | undefined,
): boolean {
  if (filters.length === 0) return true;

  const byType = new Map<KanbanFilterType, KanbanFilter[]>();
  for (const f of filters) {
    const list = byType.get(f.type) || [];
    list.push(f);
    byType.set(f.type, list);
  }

  for (const [type, rules] of byType) {
    const anyMatch = rules.some((f) => {
      switch (type) {
        case 'action_type':
          if (f.value === 'allday') return tile.action_type === 'event' && !!tile.all_day;
          if (f.value === 'event') return tile.action_type === 'event' && !tile.all_day;
          return tile.action_type === f.value;
        case 'tag':
          return tile.tags?.some((t) => t.id === f.value) ?? false;
        case 'completion': {
          const done = !!doneStatusId && tile.status_id === doneStatusId;
          return f.value === 'completed' ? done : !done;
        }
        case 'status':
          return tile.status_id === f.value;
        case 'type_icon':
          return typeTileIcons[tile.id] === f.value;
        case 'date_range': {
          const d = tileDateForRange(tile);
          if (!d) return false;
          const kind = dateRangeKind(f.value);
          if (kind === 'last') {
            const n = parseRelativeDays(f.value);
            return n !== null && matchRelativeLastDays(d, n);
          }
          if (kind === 'next') {
            const n = parseRelativeDays(f.value);
            return n !== null && matchRelativeNextDays(d, n);
          }
          const { from, to } = parseDateRange(f.value);
          if (from && d < new Date(from + 'T00:00:00')) return false;
          if (to && d > new Date(to + 'T23:59:59')) return false;
          return true;
        }
        default:
          return true;
      }
    });
    if (!anyMatch) return false;
  }
  return true;
}

// ─── Sorting ───
export function sortTiles(tiles: Tile[], sortBy: KanbanSortBy, sortDir: KanbanSortDir): Tile[] {
  if (!sortBy) return tiles;
  const field = ({
    date_start: 'start_at',
    date_end: 'end_at',
    date_created: 'created_at',
    date_updated: 'updated_at',
  } as const)[sortBy];
  const dir = sortDir === 'desc' ? -1 : 1;
  return [...tiles].sort((a, b) => {
    const va = a[field as keyof Tile] as string | undefined;
    const vb = b[field as keyof Tile] as string | undefined;
    if (!va && !vb) return 0;
    if (!va) return 1;
    if (!vb) return -1;
    return (new Date(va).getTime() - new Date(vb).getTime()) * dir;
  });
}

/** Campo data per il raggruppamento per giorno in colonna (mirror dell'arcade). */
export function tileDateField(tile: Tile, sortBy: KanbanSortBy): string | null {
  switch (sortBy) {
    case 'date_start': return tile.start_at || null;
    case 'date_end': return tile.end_at || null;
    case 'date_created': return tile.created_at || null;
    case 'date_updated': return tile.updated_at || null;
    default:
      if (tile.action_type === 'deadline') return tile.end_at || tile.start_at || null;
      return tile.start_at || null;
  }
}
