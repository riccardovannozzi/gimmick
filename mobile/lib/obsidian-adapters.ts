/**
 * Gimmick · Obsidian — Mobile data adapters (strangler migration).
 *
 * Pure mappers from the API/domain types (types/index.ts) to the view-model
 * shapes the Obsidian RN screens render. Keeping the mapping here lets the
 * screens stay presentational (mock default for QA preview, live data when
 * fed by the *-live routes) and keeps the conversion testable in isolation.
 */
import { formatFileSize, formatDuration } from '@/utils/formatters';
import { TILE_VISUAL, subtaskToStep, tileVisualKey, type StepState, type TileVisualKey } from '@/lib/tile-visual';
import type { Spark, Tile, BufferItem } from '@/types';
import type { ChatTile } from '@/lib/api';

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
  /**
   * Chiave del canale visivo, GIÀ RISOLTA con `tileVisualKey()`: la card non
   * ridecide che cosa sia un tile, disegna quello che la chiave dice. È qui che
   * `event + all_day` è già diventato `allday`, quindi il VM non porta più
   * l'azione grezza né il flag — non servivano a nessun altro.
   */
  visualKey: TileVisualKey;
  /** Riga data del footer, formato canvas "gg/mm/aa". Assente = tile senza data. */
  date?: string;
  /** Riga orario del footer, "10:15" o "10:15 - 11:15". Solo eventi con ora. */
  time?: string;
  /**
   * Passi della checklist, in ordine, già tradotti in stati di segmento.
   * Vuoto o assente = nessuna scaletta, e la corsia non si disegna per questo.
   */
  steps?: StepState[];
  /** Avanzamento già formattato ("2 di 4"). Solo sui tipi che lo prevedono. */
  progress?: string;
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
   * Percorsi storage delle immagini da mostrare in anteprima nella card, al
   * massimo `PREVIEW_MAX`. NON sono URL: il bucket è privato, vanno firmati
   * prima dell'uso (vedi `getSignedUrls` e come li risolve ViewsScreenLive).
   */
  previewPaths?: string[];
  /** URL firmati corrispondenti a `previewPaths`, risolti dal layer dati. */
  previewUris?: string[];
  /** Quante immagini restano oltre quelle mostrate: diventa il contatore "+N". */
  previewMore?: number;
  /** Allegato non-immagine: non ha miniatura, si mostra come chip col nome. */
  previewFile?: { name: string };
}

/** Quante anteprime stanno in una card prima del contatore. */
export const PREVIEW_MAX = 3;

/**
 * Sceglie le anteprime della card fra gli spark del tile.
 *
 * Fino a `PREVIEW_MAX`, poi un contatore: una fila intera di miniature in una
 * lista diventa rumore, ma una sola nascondeva che il tile ne avesse altre.
 * Previewabili sono i media (foto/immagine/video) e gli allegati il cui mime è
 * `image/*` — stessa regola dello spark della homepage. Si preferisce la
 * miniatura al file pieno: in lista conta il peso.
 *
 * Il contatore parte dal TOTALE delle immagini, non da quelle disegnabili: uno
 * spark ancora privo di miniatura non si può mostrare, ma nel tile c'è, e
 * lasciarlo fuori dal conto darebbe un "+2" dove le foto sono cinque.
 */
function tilePreview(t: Tile): Pick<ObTileVM, 'previewPaths' | 'previewMore' | 'previewFile'> {
  const sparks = t.sparks ?? [];
  const images = sparks.filter((s) => {
    const isMedia = s.type === 'photo' || s.type === 'image' || s.type === 'video';
    const isImageFile = s.type === 'file' && !!s.mime_type?.startsWith('image/');
    return isMedia || isImageFile;
  });
  // SOLO `thumbnail_path`, mai `storage_path`: in una lista scaricare
  // l'immagine originale costa troppo, e per un video non sarebbe nemmeno
  // disegnabile da <Image>. Uno spark senza miniatura resta senza anteprima
  // finché non gliela genera la pipeline di indicizzazione.
  const paths = images
    .map((s) => s.thumbnail_path)
    .filter((p): p is string => !!p)
    .slice(0, PREVIEW_MAX);

  if (paths.length > 0) {
    return { previewPaths: paths, previewMore: Math.max(0, images.length - paths.length) };
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

/**
 * Passi e avanzamento del tile.
 *
 * L'avanzamento si scrive SOLO sui tipi che lo prevedono (`meta: 'progress'`,
 * oggi il solo flow): su un evento il footer ha già una data da mostrare in
 * quello slot, e due metadati nello stesso posto non ci stanno. I passi invece
 * si producono sempre — la corsia li disegna su qualunque tipo, se ci sono.
 */
function tileSteps(t: Tile, key: TileVisualKey): Pick<ObTileVM, 'steps' | 'progress'> {
  const rows = t.subtasks ?? [];
  if (!rows.length) return {};
  const steps = rows.map(subtaskToStep);
  if (TILE_VISUAL[key].meta !== 'progress') return { steps };
  const done = steps.filter((s) => s === 'done').length;
  return { steps, progress: `${done} di ${steps.length}` };
}

/** Map an API Tile onto the Tiles view-model. */
export function tileToVM(t: Tile, ctx: TileVMContext = {}): ObTileVM {
  const type = ctx.typeByTile?.get(t.id);
  const whenIso = t.action_type === 'deadline' ? t.end_at : t.start_at;
  const whenTs = whenIso ? new Date(whenIso).getTime() : undefined;
  const visualKey = tileVisualKey(t);
  return {
    id: t.id,
    title: t.title?.trim() || 'Senza titolo',
    visualKey,
    ...tileWhen(t),
    ...tileSteps(t, visualKey),
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
 * Tile trovata dalla chat AI → view-model della card.
 *
 * Passa da `tileToVM` invece di comporre il VM a mano: le regole visive
 * (`event + all_day = allday`, il formato della data, il titolo di ripiego) sono
 * scritte lì, e duplicarle qui vorrebbe dire vedere la stessa tile resa in due
 * modi a seconda che arrivi dalla lista o dalla chat.
 *
 * Il cast è necessario e sicuro: `ChatTile` è un sottoinsieme di `Tile` e
 * `tileToVM` legge il resto solo in forma difensiva (`t.sparks ?? []`,
 * `t.tags ?? []`, `t.status_id ?` …). Ne esce una card senza anteprime, passi,
 * tag e status — che è la verità: la chat quei dati non li ha.
 */
export function chatTileToVM(t: ChatTile): ObTileVM {
  return tileToVM(t as unknown as Tile);
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

// ─── Chrono (calendar daily) ──────────────────────────────────────────────────

/**
 * Che cosa è, per il calendario, il tile schedulato:
 *   · `timed`    — ha un orario, sta sulla griglia oraria;
 *   · `allDay`   — occupa la giornata, sta nella corsia in cima;
 *   · `deadline` — scade in un momento, non dura (`action_type: 'deadline'`).
 *
 * Il backend restituisce tutti e tre da `/calendar/events` (li cerca con due
 * query: gli eventi per `start_at`, le scadenze per `end_at`), quindi la
 * distinzione va fatta qui e non a valle.
 */
export type ObChronoKind = 'timed' | 'allDay' | 'deadline';

/** A calendar tile rendered by the Chrono screen. Hours are floats
 *  (11.5 = 11:30); the screen converts them to pixel offsets. */
export interface ObChronoEvent {
  id: string;
  tileId: string;
  title: string;
  kind: ObChronoKind;
  /**
   * Giorno a cui l'evento appartiene, a mezzanotte locale: è la chiave con cui
   * settimana e mese lo mettono nella casella giusta. Per le scadenze è il
   * giorno di `end_at`, per tutto il resto quello di `start_at`.
   */
  day: Date;
  /** Significative solo per `timed`; per gli altri sono l'ora di riferimento. */
  startHour: number;
  endHour: number;
  timeLabel: string;
}

function hhmmLocal(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Map a scheduled tile onto a Chrono event.
 *
 * Restituisce ANCHE gli all-day e le scadenze, non più i soli slot orari: le
 * viste settimana e mese li mostrano, e una vista mese che nasconde le scadenze
 * mente. È la griglia giornaliera a filtrare per `kind === 'timed'`, perché lì
 * non c'è una corsia dove metterli.
 *
 * LIMITE NOTO: un evento che scavalca la mezzanotte finisce in un giorno solo,
 * quello d'inizio. Spalmarlo su più caselle vuole il calcolo delle campate su
 * riga, che è un'altra feature.
 */
export function tileToChronoEvent(t: Tile): ObChronoEvent | null {
  const isDeadline = t.action_type === 'deadline';
  // Le scadenze vivono su `end_at` (convenzione del backend e del web), tutto
  // il resto su `start_at`. Il fallback incrociato copre i dati storici, dove
  // un tile poteva avere solo l'altro estremo.
  const ref = isDeadline ? (t.end_at || t.start_at) : (t.start_at || t.end_at);
  if (!ref) return null;
  const s = new Date(ref);
  if (Number.isNaN(s.getTime())) return null;

  const kind: ObChronoKind = isDeadline ? 'deadline' : t.all_day ? 'allDay' : 'timed';
  const day = new Date(s);
  day.setHours(0, 0, 0, 0);

  const e = !isDeadline && t.end_at ? new Date(t.end_at) : new Date(s.getTime() + 60 * 60 * 1000);
  const startHour = s.getHours() + s.getMinutes() / 60;
  const endHour = e.getHours() + e.getMinutes() / 60;

  return {
    id: t.id,
    tileId: t.id,
    title: t.title?.trim() || 'Senza titolo',
    kind,
    day,
    startHour,
    endHour: Math.max(endHour, startHour + 0.25),
    timeLabel:
      kind === 'allDay' ? 'Tutto il giorno'
      : kind === 'deadline' ? `Scadenza ${hhmmLocal(s)}`
      : `${hhmmLocal(s)} – ${hhmmLocal(e)}`,
  };
}

// I flow non hanno più un adattatore proprio: sono tile, e passano da
// `tileToVM` / `tilesByInsertion` come tutti gli altri.
