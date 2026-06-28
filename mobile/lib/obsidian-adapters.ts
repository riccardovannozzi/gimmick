/**
 * Gimmick · Obsidian — Mobile data adapters (strangler migration).
 *
 * Pure mappers from the API/domain types (types/index.ts) to the view-model
 * shapes the Obsidian RN screens render. Keeping the mapping here lets the
 * screens stay presentational (mock default for QA preview, live data when
 * fed by the *-live routes) and keeps the conversion testable in isolation.
 */
import { formatFileSize, formatDuration } from '@/utils/formatters';
import type { Spark, Tile, BufferItem, FlowHubItem } from '@/types';

// ─── Sparks ────────────────────────────────────────────────────────────────

/** Type bucket the SparksScreen knows how to render (collapses the 6 API
 *  spark types onto the 5 visual buckets: image→photo, audio_recording→audio). */
export type ObSparkType = 'audio' | 'text' | 'photo' | 'video' | 'file';

/** View-model consumed by ObsidianSparksScreen. */
export interface ObSparkVM {
  id: string;
  /** Parent tile id — used to open the tile detail when a row is tapped. */
  tileId?: string;
  name: string;
  type: ObSparkType;
  date: string;
  body?: string;
  dim?: string;
  ai?: boolean;
}

function obSparkType(t: Spark['type']): ObSparkType {
  switch (t) {
    case 'audio_recording': return 'audio';
    case 'image':
    case 'photo': return 'photo';
    case 'video': return 'video';
    case 'file': return 'file';
    case 'text':
    default: return 'text';
  }
}

/** Short DD/MM label from an ISO timestamp (matches the mockup's date chip). */
function dayMonth(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

/** Map an API Spark onto the SparksScreen view-model. */
export function sparkToVM(s: Spark): ObSparkVM {
  const type = obSparkType(s.type);
  const trimmed = (s.content ?? '').trim();
  const name =
    s.file_name?.trim() ||
    (type === 'text' && trimmed ? trimmed.split('\n')[0].slice(0, 48) : '') ||
    s.type;
  return {
    id: s.id,
    tileId: s.tile_id,
    name,
    type,
    date: dayMonth(s.created_at),
    body: type === 'text' && trimmed ? trimmed : undefined,
    dim: s.file_size ? formatFileSize(s.file_size) : undefined,
    ai: s.ai_status === 'completed',
  };
}

// ─── Tiles ───────────────────────────────────────────────────────────────────

/** Visual kind the Tiles view renders (collapses ActionType onto 3 buckets). */
export type ObTileKind = 'timed' | 'deadline' | 'notes';

/** View-model consumed by the Tiles tab of ObsidianViewsScreen. */
export interface ObTileVM {
  id: string;
  title: string;
  meta?: string;
  kind: ObTileKind;
  spark: number;
}

/** A day-bucketed group of tiles (header label + rows). */
export interface ObTileGroup {
  group: string;
  tiles: ObTileVM[];
}

const MONTHS_SHORT_IT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
const MONTHS_IT = ['GEN', 'FEB', 'MAR', 'APR', 'MAG', 'GIU', 'LUG', 'AGO', 'SET', 'OTT', 'NOV', 'DIC'];
const MONTHS_IT_LONG = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

/** YYYY-MM-DD key in local time (groups tiles by calendar day). */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Human group label: OGGI / IERI / "25 GIUGNO". */
function groupLabel(d: Date, now: Date): string {
  const today = dayKey(now);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const k = dayKey(d);
  if (k === today) return 'OGGI';
  if (k === dayKey(yesterday)) return 'IERI';
  return `${d.getDate()} ${MONTHS_IT_LONG[d.getMonth()].toUpperCase()}`;
}

function tileKind(t: Tile): ObTileKind {
  if (t.action_type === 'deadline') return 'deadline';
  if (t.action_type === 'event') return 'timed';
  return 'notes';
}

/** "27 Giu 2026 · 11:30 · 1h" style meta from a scheduled tile. */
function tileMeta(t: Tile): string | undefined {
  if (!t.start_at) return undefined;
  const s = new Date(t.start_at);
  if (Number.isNaN(s.getTime())) return undefined;
  const date = `${s.getDate()} ${MONTHS_IT[s.getMonth()][0] + MONTHS_IT[s.getMonth()].slice(1).toLowerCase()} ${s.getFullYear()}`;
  if (t.all_day) return `${date} · Giornata`;
  const time = `${String(s.getHours()).padStart(2, '0')}:${String(s.getMinutes()).padStart(2, '0')}`;
  let dur = '';
  if (t.end_at) {
    const e = new Date(t.end_at);
    const mins = Math.round((e.getTime() - s.getTime()) / 60000);
    if (mins > 0) dur = mins % 60 === 0 ? ` · ${mins / 60}h` : ` · ${mins}min`;
  }
  return `${date} · ${time}${dur}`;
}

/** Map an API Tile onto the Tiles view-model. */
export function tileToVM(t: Tile): ObTileVM {
  return {
    id: t.id,
    title: t.title?.trim() || 'Senza titolo',
    meta: tileMeta(t),
    kind: tileKind(t),
    spark: t.spark_count ?? 0,
  };
}

/** Group tiles by calendar day (newest first) for the Tiles view. `now` is
 *  injected so the mapping stays pure/testable. */
export function tilesToGroups(tiles: Tile[], now: Date): ObTileGroup[] {
  const buckets = new Map<string, { date: Date; tiles: ObTileVM[] }>();
  for (const t of tiles) {
    const d = new Date(t.start_at || t.created_at);
    if (Number.isNaN(d.getTime())) continue;
    const k = dayKey(d);
    if (!buckets.has(k)) buckets.set(k, { date: d, tiles: [] });
    buckets.get(k)!.tiles.push(tileToVM(t));
  }
  return Array.from(buckets.values())
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .map((b) => ({ group: groupLabel(b.date, now), tiles: b.tiles }));
}

// ─── Buffer ──────────────────────────────────────────────────────────────────

/** View-model rendered by the Buffer triage card. */
export interface ObBufferVM {
  id: string;
  kind: ObSparkType;
  title: string;
  time: string;
  duration?: string;
  preview?: string;
  dim?: string;
}

const BUF_LABELS: Record<ObSparkType, string> = {
  audio: 'Memo vocale', text: 'Nota', photo: 'Foto', video: 'Video', file: 'File',
};

/** Map a pre-send BufferItem onto the Buffer triage view-model. */
export function bufferItemToVM(b: BufferItem): ObBufferVM {
  const kind = obSparkType(b.type);
  const preview = b.preview?.trim();
  const title = b.fileName?.trim() || (kind === 'text' && preview ? preview.split('\n')[0].slice(0, 48) : BUF_LABELS[kind]);
  const created = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
  const time = Number.isNaN(created.getTime())
    ? ''
    : `oggi · ${String(created.getHours()).padStart(2, '0')}:${String(created.getMinutes()).padStart(2, '0')}`;
  return {
    id: b.id,
    kind,
    title,
    time,
    duration: b.duration ? formatDuration(b.duration) : undefined,
    preview: kind === 'text' ? preview : undefined,
    dim: b.size ? formatFileSize(b.size) : undefined,
  };
}

// ─── Flows (FlowHub) ──────────────────────────────────────────────────────────

/** View-model rendered by the Flows tab of ObsidianViewsScreen. */
export interface ObFlowVM {
  id: string;
  tileId: string;
  tag: string;
  title: string;
  state: string;
  who: string;
  ago: string;
  date: string;
}

/** "DD Mmm YYYY" short Italian date. */
function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MONTHS_SHORT_IT[d.getMonth()]} ${d.getFullYear()}`;
}

/** Relative "oggi / ieri / Ng fa" from a day count. */
function agoLabel(days: number): string {
  if (days <= 0) return 'oggi';
  if (days === 1) return 'ieri';
  return `${days}g fa`;
}

// ─── Chrono (calendar daily) ──────────────────────────────────────────────────

/** A timed calendar event rendered on the Chrono day grid. Hours are floats
 *  (11.5 = 11:30); the screen converts them to pixel offsets. */
export interface ObChronoEvent {
  id: string;
  tileId: string;
  title: string;
  startHour: number;
  endHour: number;
  timeLabel: string;
}

function hhmmLocal(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Map a scheduled (timed) tile onto a Chrono event. Returns null for tiles
 *  with no start time or marked all-day (the day grid only shows timed slots). */
export function tileToChronoEvent(t: Tile): ObChronoEvent | null {
  if (!t.start_at || t.all_day) return null;
  const s = new Date(t.start_at);
  if (Number.isNaN(s.getTime())) return null;
  const e = t.end_at ? new Date(t.end_at) : new Date(s.getTime() + 60 * 60 * 1000);
  const startHour = s.getHours() + s.getMinutes() / 60;
  const endHour = e.getHours() + e.getMinutes() / 60;
  return {
    id: t.id,
    tileId: t.id,
    title: t.title?.trim() || 'Senza titolo',
    startHour,
    endHour: Math.max(endHour, startHour + 0.25),
    timeLabel: `${hhmmLocal(s)} – ${hhmmLocal(e)}`,
  };
}

/** Map a FlowHub row onto the Flows view-model. */
export function flowHubItemToVM(it: FlowHubItem): ObFlowVM {
  const who = it.contact ? (it.contact.is_self ? 'IO' : it.contact.name) : 'IO';
  return {
    id: it.id,
    tileId: it.tile.id,
    tag: it.tile.tag?.name || '(senza etichetta)',
    title: it.tile.title || 'Senza titolo',
    state: it.label?.trim() || '(senza etichetta)',
    who,
    ago: agoLabel(it.days_since_activity),
    date: shortDate(it.last_activity_at || it.scheduled_at || it.occurred_at || it.created_at),
  };
}
