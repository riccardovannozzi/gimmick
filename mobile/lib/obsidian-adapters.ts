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

/**
 * View-model del tile della lista Tiles.
 *
 * Porta le STESSE informazioni della tile del Canvas web (CanvasBoard): titolo,
 * azione, data/ora, status e tipo. Il conteggio degli spark non c'è, come sul
 * canvas: non descrive il tile, dice solo quanto materiale contiene.
 */
export interface ObTileVM {
  id: string;
  title: string;
  /** Azione GTD del tile; 'event' + allDay = giornata intera. */
  actionType: NonNullable<Tile['action_type']>;
  allDay: boolean;
  /** Riga data del footer, formato canvas "gg/mm/aa". Assente = tile senza data. */
  date?: string;
  /** Riga orario del footer, "10:15" o "10:15 - 11:15". Solo eventi con ora. */
  time?: string;
  /** Titolo barrato + attenuato, come sul canvas. */
  completed: boolean;
  /** Nome dello status di sistema (active/done/paused/blocked/cancelled). */
  statusName?: string;
  /** Glifo Tabler del tipo assegnato (es. "IconBuilding") e suo colore. */
  typeIcon?: string;
  typeColor?: string;
  /** Tipo assegnato — id e nome servono al filtro. */
  typeId?: string;
  typeName?: string;
  /** Tag del tile (dalla lista API), per il filtro per tag. */
  tags: { id: string; name: string }[];
  /** Data di riferimento in epoch (start_at o end_at) per l'ordinamento. */
  whenTs?: number;
  /**
   * Percorso storage dell'immagine da mostrare in anteprima nella card.
   * NON è un URL: il bucket è privato, va firmato prima dell'uso (vedi
   * `getSignedUrls` e come lo risolve ViewsScreenLive).
   */
  previewPath?: string;
  /** URL firmato corrispondente a `previewPath`, risolto dal layer dati. */
  previewUri?: string;
  /** Allegato non-immagine: non ha miniatura, si mostra come chip col nome. */
  previewFile?: { name: string };
}

/**
 * Sceglie l'anteprima della card fra gli spark del tile.
 *
 * Una sola per card, la prima disponibile: in una lista compatta una fila di
 * miniature diventa rumore, e il dettaglio del tile le mostra già tutte.
 * Previewabili sono i media (foto/immagine/video) e gli allegati il cui mime è
 * `image/*` — stessa regola dello spark della homepage. Si preferisce la
 * miniatura al file pieno: in lista conta il peso.
 */
function tilePreview(t: Tile): Pick<ObTileVM, 'previewPath' | 'previewFile'> {
  const sparks = t.sparks ?? [];
  for (const s of sparks) {
    const isMedia = s.type === 'photo' || s.type === 'image' || s.type === 'video';
    const isImageFile = s.type === 'file' && !!s.mime_type?.startsWith('image/');
    if (!isMedia && !isImageFile) continue;
    // SOLO `thumbnail_path`, mai `storage_path`: in una lista scaricare
    // l'immagine originale costa troppo, e per un video non sarebbe nemmeno
    // disegnabile da <Image>. Uno spark senza miniatura resta senza anteprima
    // finché non gliela genera la pipeline di indicizzazione.
    if (!s.thumbnail_path) continue;
    return { previewPath: s.thumbnail_path };
  }
  // Nessuna immagine: se c'è un allegato lo si annuncia come chip.
  const file = sparks.find((s) => s.type === 'file');
  if (file) return { previewFile: { name: file.file_name?.trim() || 'Allegato' } };
  return {};
}

/** Tabelle di lookup risolte una volta sola dal chiamante (statuses e tipi
 *  arrivano da endpoint separati, non dentro il tile). */
export interface TileVMContext {
  /** status_id → nome di sistema dello status. */
  statusNameById?: Map<string, string>;
  /** tile id → tipo assegnato (id, nome, glifo, colore). */
  typeByTile?: Map<string, { id: string; name?: string; icon?: string; color?: string }>;
}

const MONTHS_SHORT_IT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

const pad2 = (n: number) => String(n).padStart(2, '0');
/** "gg/mm/aa" — stesso formato del footer della tile canvas. */
function canvasDate(iso: string): string | undefined {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)}`;
}
function canvasTime(iso: string): string | undefined {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/**
 * Data/ora del footer con le stesse regole del canvas:
 *   · deadline → la data sta in end_at, nessun orario;
 *   · giornata intera → solo la data di start_at;
 *   · evento con ora → data + "inizio - fine".
 * I tile senza azione temporale (note / to-do) non hanno riga data.
 */
function tileWhen(t: Tile): { date?: string; time?: string } {
  const hasDate = t.action_type === 'deadline' || t.action_type === 'event';
  if (!hasDate) return {};
  if (t.action_type === 'deadline') {
    return t.end_at ? { date: canvasDate(t.end_at) } : {};
  }
  if (!t.start_at) return {};
  if (t.all_day) return { date: canvasDate(t.start_at) };
  const start = canvasTime(t.start_at);
  const end = t.end_at ? canvasTime(t.end_at) : undefined;
  return { date: canvasDate(t.start_at), time: start ? (end ? `${start} - ${end}` : start) : undefined };
}

/** Map an API Tile onto the Tiles view-model. */
export function tileToVM(t: Tile, ctx: TileVMContext = {}): ObTileVM {
  const type = ctx.typeByTile?.get(t.id);
  const whenIso = t.action_type === 'deadline' ? t.end_at : t.start_at;
  const whenTs = whenIso ? new Date(whenIso).getTime() : undefined;
  return {
    id: t.id,
    title: t.title?.trim() || 'Senza titolo',
    actionType: t.action_type ?? 'none',
    allDay: !!t.all_day,
    ...tileWhen(t),
    completed: !!t.is_completed,
    statusName: t.status_id ? ctx.statusNameById?.get(t.status_id) : undefined,
    typeIcon: type?.icon,
    typeColor: type?.color,
    typeId: type?.id,
    typeName: type?.name,
    tags: (t.tags ?? []).filter((tag) => !tag.is_root).map((tag) => ({ id: tag.id, name: tag.name })),
    whenTs: whenTs !== undefined && !Number.isNaN(whenTs) ? whenTs : undefined,
    ...tilePreview(t),
  };
}

/**
 * Tiles in ordine di INSERIMENTO, il più recente in cima (created_at desc).
 * Niente raggruppamento per giorno: la data del tile vive nella card, come sul
 * canvas, e l'ordine racconta quando è stato creato — non quando è schedulato.
 */
export function tilesByInsertion(tiles: Tile[], ctx: TileVMContext = {}): ObTileVM[] {
  return [...tiles]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map((t) => tileToVM(t, ctx));
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
