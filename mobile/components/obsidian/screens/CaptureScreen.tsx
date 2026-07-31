/**
 * Gimmick · Obsidian — Mobile Capture screen.
 *
 * Home a "composer": in alto l'header VAULT/Gimmick (menu + Ask), poi la card di
 * scrittura nota con la toolbar dei canali di cattura (photo/video/voice/
 * gallery/file) e il pulsante Salva; sotto, il toggle "Azione" che apre il
 * pannello AZIONE (tipo d'azione + data/ora + Tag/Tipo/Status). In fondo la lista
 * degli spark già in buffer (invariata) e il FAB Invia. Reusa il buffer + la
 * pipeline di upload esistenti.
 */
import React from 'react';
import { View, Text, Pressable, ScrollView, Modal, LayoutAnimation, TextInput, Image, KeyboardAvoidingView, Platform } from 'react-native';
import {
  IconCamera, IconVideo, IconPhoto, IconAlignLeft, IconMicrophone, IconWaveSine, IconPaperclip,
  IconSend, IconChevronDown, IconChevronUp, IconDotsVertical,
  IconMenu2, IconSparkles,
  IconNote, IconCheckbox, IconBolt, IconCalendar, IconClock, IconTag,
  IconSearch, IconWand, IconCheck, IconX, IconCornerDownLeft, IconCategory, IconCircleDot, IconEraser,
} from '@tabler/icons-react-native';
import * as TablerIcons from '@tabler/icons-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useQuery } from '@tanstack/react-query';
import { useObsidian } from '@/lib/obsidian';
import { toast } from '@/store';
import { useDictation } from '@/hooks/useDictation';
import { OB_BTN_H, type ObsidianColors } from '@/constants/obsidian';
import { tagsApi, typeIconsApi, statusesApi, tagTypesApi, type StatusEntity, type TypeIconEntity } from '@/lib/api';
import type { ActionType, Tag, BufferItem, SparkType } from '@/types';
import { ObsidianStatusBar } from '../StatusBar';
import { ObsidianNavPill } from '../NavPill';
import { ObsidianDrawer } from '../Drawer';
import type { MobileViewId } from '../TopNav';

// Risoluzione icone Tabler per nome (come il web): i tipi salvano il glifo in
// `icon`, i tag-type in `emoji` (es. "IconBuilding").
type TablerGlyph = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
const TablerMap = TablerIcons as unknown as Record<string, TablerGlyph>;
const resolveGlyph = (name?: string | null): TablerGlyph | undefined => (name ? TablerMap[name] : undefined);

type CapKey = 'photo' | 'video' | 'gallery' | 'text' | 'voice' | 'file';
// Il canale audio usa l'ONDA, non il microfono: il microfono è riservato alla
// dettatura del campo nota (scrive testo), che è un'azione diversa dal
// registrare uno spark audio. Due glifi distinti = nessuna ambiguità.
const CAPS: Record<CapKey, { label: string; Icon: typeof IconCamera }> = {
  photo: { label: 'Photo', Icon: IconCamera },
  video: { label: 'Video', Icon: IconVideo },
  gallery: { label: 'Image', Icon: IconPhoto },
  text: { label: 'Text', Icon: IconAlignLeft },
  voice: { label: 'Voice', Icon: IconWaveSine },
  file: { label: 'File', Icon: IconPaperclip },
};

/**
 * Canali della toolbar del composer, in ordine. Text non compare: è il campo di
 * scrittura stesso. Restano i cinque canali "media" (registrazione dal vivo +
 * import), scorciatoie per allegare uno spark diverso alla stessa cattura.
 */
const TOOLBAR: CapKey[] = ['photo', 'video', 'voice', 'gallery', 'file'];

/**
 * Pulsanti tondi della barra di cattura: i 5 canali e il kebab Options.
 *
 * 48 è il bersaglio di tocco minimo di Material; da qui in su è scelta
 * espressiva. Il glifo segue la proporzione originale 23/48 ≈ 0.48.
 *
 * ATTENZIONE alla larghezza: la riga occupa `6 × CAP_BTN + 6 × gap` in orizzontale
 * dentro `paddingHorizontal: 12`. In RN `flexShrink` vale 0, quindi se non ci
 * sta i pulsanti NON si comprimono — il kebab esce dal bordo destro e diventa
 * irraggiungibile. A 52 con gap 6 servono 348dp utili, cioè uno schermo da
 * almeno 372dp.
 */
const CAP_BTN = 52;
const CAP_GLYPH = 25;

/**
 * Kebab Options: senza fondo, solo il glifo. È un menu secondario, non un
 * canale di cattura, e togliergli la pastiglia lo separa dai cinque tondi molto
 * più di quanto facesse una forma diversa.
 *
 * Larghezza e raggio restano perché definiscono l'area del ripple e quella
 * toccabile, non più una forma visibile. A 36 il bersaglio starebbe sotto i 48
 * di Material, quindi si compensa con `hitSlop` orizzontale.
 *
 * Lo stato aperto non ha più il fondo accent: lo segnala il glifo, che passa da
 * `text` ad `accent`.
 */
const KEBAB_W = 36;

// Stacco dell'header dall'alto (safe-area a parte).
const HEADER_GAP = 20;

// ─── Header "VAULT / Gimmick" ──────────────────────────────────────────────────
// Titolo del vault a sinistra (statico), menu + Ask a destra. Sostituisce
// l'AppHeader centrato: qui la home ha un'identità da "vault" alla Obsidian.
// Il cambio vista vive solo nel Drawer (hamburger), non sul titolo.
function CaptureHeader({ onMenu, onAsk, connection, pendingCount }: { onMenu?: () => void; onAsk?: () => void; connection?: ConnectionStatus; pendingCount?: number }) {
  const c = useObsidian();

  // 48×48 come la barra di cattura: soglia di tocco Material raggiunta dal
  // riquadro stesso, senza `hitSlop`. Con 42 + hitSlop 6 il bersaglio arrivava
  // a 54 ma sconfinava nei 10dp di gap fra i due pulsanti, quindi le due aree
  // sensibili si sovrapponevano di 2dp e il confine era ambiguo.
  const sqBtn = {
    width: 48, height: 48, borderRadius: 12, alignItems: 'center' as const, justifyContent: 'center' as const,
  };

  // Pallino di stato: verde = online + account ok, arancio = offline + account
  // ok, rosso = account non valido (non autenticato).
  const dot = connection === 'signed-out'
    ? { color: c.error, label: 'Non connesso · account non valido' }
    : connection === 'offline'
    ? { color: c.warning, label: 'Offline · account ok' }
    : connection === 'online'
    ? { color: c.success, label: 'Online · account ok' }
    : null;

  return (
    <View style={{ marginTop: HEADER_GAP, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: c.dark ? '#000000' : c.canvas, zIndex: 10 }}>
      {/* Sinistra — VAULT / Gimmick (solo identità, nessuna azione) */}
      <View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: c.subtle }}>VAULT</Text>
          {dot && (
            <View
              accessibilityLabel={dot.label}
              style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot.color }}
            />
          )}
          {/* Contatore elementi in coda (outbox) ancora da sincronizzare col
              server. Tinto col colore dello stato; assente se 0. */}
          {typeof pendingCount === 'number' && pendingCount > 0 && (
            <View
              accessibilityLabel={`${pendingCount} in attesa di sincronizzazione`}
              style={{ minWidth: 17, height: 17, borderRadius: 8.5, paddingHorizontal: 5, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontSize: 10.5, fontWeight: '700', color: dot ? dot.color : c.muted }}>{pendingCount}</Text>
            </View>
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {/* Marchio: si usa `adaptive-icon`, non `icon`. Sono lo stesso robot,
              ma `icon.png` ha lo sfondo BIANCO OPACO (è la piastrella completa
              per il launcher) e sull'header scuro diventerebbe un quadrato
              bianco; l'adattiva è il solo primo piano, su fondo trasparente.
              30px per un glifo che pesa quanto il titolo a 22: l'asset ha un
              margine interno generoso, quindi il robot ne occupa meno. */}
          <Image
            source={require('../../../assets/adaptive-icon.png')}
            style={{ width: 30, height: 30 }}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
          <Text style={{ fontSize: 22, fontWeight: '700', color: c.text }}>Gimmick</Text>
        </View>
      </View>

      {/* Destra — menu (Drawer) + Ask (chat) */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable
          onPress={onMenu}
          accessibilityLabel="Menu"
          android_ripple={{ color: c.line, borderless: true }}
          style={[sqBtn, { backgroundColor: c.surface2 }]}
        >
          <IconMenu2 size={19} color={c.text} strokeWidth={1.9} />
        </Pressable>
        <Pressable
          onPress={onAsk}
          accessibilityLabel="Ask Gimmick"
          android_ripple={{ color: c.accent + '40', borderless: true }}
          style={[sqBtn, { backgroundColor: c.accent + '2E' }]}
        >
          <IconSparkles size={19} color={c.accent} strokeWidth={1.9} />
        </Pressable>
      </View>
    </View>
  );
}

// ─── Bottom sheet shell ───────────────────────────────────────────────────────
function BottomSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  const c = useObsidian();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1 }}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.42)' }} onPress={onClose} accessibilityLabel="Chiudi" />
        <View style={{ backgroundColor: c.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderTopWidth: 1, borderColor: c.line, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 20 + insets.bottom }}>
          {children}
        </View>
      </View>
    </Modal>
  );
}

function Eyebrow({ c, children }: { c: ObsidianColors; children: React.ReactNode }) {
  return <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1.3, color: c.subtle, marginBottom: 9 }}>{children}</Text>;
}

// ─── AZIONE (pannello a toggle) ─────────────────────────────────────────────────
// AZIONE è un'unica scelta esclusiva di 5 (come il selettore action_type nella
// sidebar web): Note/To-do e Due/Daily/Timing NON sono gruppi indipendenti, un
// tile ha un solo tipo d'azione. Il pannello è CONTROLLED: lo stato reale vive nel
// parent (…Live) e viene persistito da uploadBufferItems all'invio.

/** Metadati che il pannello pre-imposta sul tile. Superset accettato da
 *  `uploadBufferItems` (action_type/date/all_day + tag + type-icon). */
export type CaptureOptions = {
  action_type: ActionType;
  all_day: boolean;
  start_at: string | null;
  end_at: string | null;
  tag_id: string | null;
  type_icon_id: string | null;
  status_id: string | null;
};
export const EMPTY_CAPTURE_OPTIONS: CaptureOptions = {
  action_type: 'none', all_day: false, start_at: null, end_at: null, tag_id: null, type_icon_id: null, status_id: null,
};

// Presentazione degli status (etichetta IT + colore semantico), allineata alla
// sidebar web (lib/status-meta.ts): stessi nomi di sistema, colori sui token
// Obsidian mobile invece dei --ob-*.
const STATUS_LABEL: Record<string, string> = {
  active: 'Attivo', done: 'Completato', paused: 'In pausa', blocked: 'Bloccato', cancelled: 'Annullato',
};
const statusLabel = (name: string) => STATUS_LABEL[name] ?? name;
function statusColor(c: ObsidianColors, name: string): string {
  switch (name) {
    case 'active': return c.info;
    case 'done': return c.success;
    case 'paused': return c.warning;
    case 'blocked': return c.error;
    case 'cancelled': return c.muted;
    default: return c.muted;
  }
}

type ActionOpt = 'note' | 'todo' | 'due' | 'allday' | 'timed';

/** Chiave-pulsante attiva a partire dai metadati (inverso di seedAction). */
function actionKeyOf(o: CaptureOptions): ActionOpt {
  if (o.action_type === 'event') return o.all_day ? 'allday' : 'timed';
  if (o.action_type === 'deadline') return 'due';
  if (o.action_type === 'anytime') return 'todo';
  return 'note';
}

/** Applica la scelta d'azione seedando le date coerenti (come il web). */
function seedAction(key: ActionOpt, o: CaptureOptions, now: Date): CaptureOptions {
  switch (key) {
    case 'note': return { ...o, action_type: 'none', start_at: null, end_at: null, all_day: false };
    case 'todo': return { ...o, action_type: 'anytime', start_at: null, end_at: null, all_day: false };
    case 'due': {
      // La data della scadenza vive in end_at (convenzione del web/calendario:
      // vedi eventRefIso e l'endpoint /calendar/events, che cerca le deadline
      // per end_at). start_at resta null.
      const e = o.end_at ? new Date(o.end_at) : now;
      return { ...o, action_type: 'deadline', start_at: null, end_at: e.toISOString(), all_day: false };
    }
    case 'allday': {
      const base = o.start_at ? new Date(o.start_at) : now;
      const s = new Date(base); s.setHours(0, 0, 0, 0);
      const e = new Date(base); e.setHours(23, 59, 59, 0);
      return { ...o, action_type: 'event', all_day: true, start_at: s.toISOString(), end_at: e.toISOString() };
    }
    case 'timed': {
      const s = o.start_at ? new Date(o.start_at) : now;
      const e = o.end_at ? new Date(o.end_at) : new Date(s.getTime() + 3600000);
      return { ...o, action_type: 'event', all_day: false, start_at: s.toISOString(), end_at: e.toISOString() };
    }
  }
}

// ── Ricerca + "bacchetta magica" tag (identici al web, 100% locali) ──
const COMBINING_MARKS = /[̀-ͯ]/g;
/** Normalizza per il match: minuscolo, senza accenti. */
function normText(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(COMBINING_MARKS, '');
}
/**
 * Match euristico locale: punteggia i tag in base a quanto nome/alias compaiono
 * nel testo (qui: il contenuto degli spark in buffer). Nome intero presente →
 * punteggio alto; altrimenti overlap di parole ≥3 caratteri. Nessuna chiamata
 * di rete — è la stessa euristica della bacchetta del web. Root esclusi a monte.
 */
function suggestTagsFromText(text: string, tags: Tag[]): Tag[] {
  const t = normText(text);
  if (!t.trim()) return [];
  const textTokens = new Set(t.split(/[^a-z0-9]+/).filter((w) => w.length >= 3));
  const scored: { tag: Tag; score: number }[] = [];
  for (const tag of tags) {
    const names = [tag.name, ...(tag.aliases ?? [])].map(normText).filter(Boolean);
    let score = 0;
    for (const n of names) {
      if (t.includes(n)) {
        score += Math.max(2, n.length / 3);
      } else {
        for (const tok of n.split(/[^a-z0-9]+/)) {
          if (tok.length >= 3 && textTokens.has(tok)) score += 1;
        }
      }
    }
    if (score > 0) scored.push({ tag, score });
  }
  return scored.sort((a, b) => b.score - a.score).map((s) => s.tag);
}

const pad = (n: number) => String(n).padStart(2, '0');
const fmtDate = (iso: string) => { const d = new Date(iso); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; };
const fmtTime = (iso: string) => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const fmtDur = (a: string, b: string) => {
  const h = (new Date(b).getTime() - new Date(a).getTime()) / 3600000;
  return h > 0 ? `${(Math.round(h * 100) / 100).toString().replace('.', ',')} h` : '—';
};

type DtField = 'date' | 'start' | 'end' | 'due' | null;

function SetOptionsBody({ options, onChange, onClose, suggestText = '' }: { options: CaptureOptions; onChange: (next: CaptureOptions) => void; onClose: () => void; suggestText?: string }) {
  const c = useObsidian();
  const insets = useSafeAreaInsets();
  const action = actionKeyOf(options);
  const [sheet, setSheet] = React.useState<'tag' | 'type' | 'status' | null>(null);
  const [dt, setDt] = React.useState<DtField>(null);
  const [tagQuery, setTagQuery] = React.useState('');
  const [suggestActive, setSuggestActive] = React.useState(false);

  // Liste sempre abilitate (cache 5 min): servono anche a risolvere il NOME
  // dell'elemento selezionato quando il rispettivo picker è chiuso.
  const tagsQuery = useQuery({ queryKey: ['tags'], queryFn: () => tagsApi.list(), staleTime: 300_000 });
  const typesQuery = useQuery({ queryKey: ['type-icons'], queryFn: () => typeIconsApi.list(), staleTime: 300_000 });
  const statusesQuery = useQuery({ queryKey: ['statuses'], queryFn: () => statusesApi.list(), staleTime: 300_000 });
  // Tag-type: dà icona (`emoji` = glifo Tabler) e colore ai tag, come sul web.
  const tagTypesQuery = useQuery({ queryKey: ['tag-types'], queryFn: () => tagTypesApi.list(), staleTime: 300_000 });
  const tags: Tag[] = (tagsQuery.data?.data ?? []).filter((t) => !t.is_root);
  const types = typesQuery.data?.data ?? [];
  const statuses: StatusEntity[] = statusesQuery.data?.data ?? [];
  const tagTypes = tagTypesQuery.data?.data ?? [];
  const curTag = tags.find((t) => t.id === options.tag_id) ?? null;
  const curType = types.find((t) => t.id === options.type_icon_id) ?? null;
  const curStatus = statuses.find((s) => s.id === options.status_id) ?? null;

  // Icona + colore di un tag (dal suo tag-type) e di un tipo — stesse icone del web.
  const tagVisual = (t: Tag) => {
    const tt = tagTypes.find((x) => x.slug === t.tag_type || x.id === t.tag_type);
    return { Glyph: resolveGlyph(tt?.emoji), color: tt?.color ?? undefined };
  };
  const typeVisual = (ty: TypeIconEntity) => ({ Glyph: resolveGlyph(ty.icon), color: ty.color ?? undefined });
  const curTagVisual = curTag ? tagVisual(curTag) : null;
  const curTypeVisual = curType ? typeVisual(curType) : null;

  // Tag visibili: modalità AI → suggeriti dal testo del buffer; altrimenti
  // filtro per nome+alias (case/accent-insensitive), lista piena se vuoto.
  const suggested = React.useMemo(() => suggestTagsFromText(suggestText, tags), [suggestText, tags]);
  const hasSuggestText = !!suggestText.trim();
  const visibleTags = React.useMemo(() => {
    if (suggestActive) return suggested;
    const q = normText(tagQuery.trim());
    if (!q) return tags;
    return tags.filter((t) => [t.name, ...(t.aliases ?? [])].some((n) => normText(n).includes(q)));
  }, [suggestActive, suggested, tagQuery, tags]);

  const openTagSheet = () => { setTagQuery(''); setSuggestActive(false); setSheet('tag'); };

  // ── Editing di data/ora (picker nativo) ──
  const onPickDateTime = (picked?: Date) => {
    const field = dt;
    setDt(null);
    if (!picked) return; // annullato
    if (field === 'date') {
      // Cambia il giorno mantenendo l'ora corrente di start/end.
      if (action === 'allday') {
        const s = new Date(picked); s.setHours(0, 0, 0, 0);
        const e = new Date(picked); e.setHours(23, 59, 59, 0);
        onChange({ ...options, start_at: s.toISOString(), end_at: e.toISOString() });
      } else if (action === 'due') {
        // Deadline: la data sta in end_at.
        const t = options.end_at ? new Date(options.end_at) : new Date();
        const e = new Date(picked); e.setHours(t.getHours(), t.getMinutes(), 0, 0);
        onChange({ ...options, end_at: e.toISOString() });
      } else {
        const st = options.start_at ? new Date(options.start_at) : new Date();
        const et = options.end_at ? new Date(options.end_at) : new Date(st.getTime() + 3600000);
        const s = new Date(picked); s.setHours(st.getHours(), st.getMinutes(), 0, 0);
        const e = new Date(picked); e.setHours(et.getHours(), et.getMinutes(), 0, 0);
        onChange({ ...options, start_at: s.toISOString(), end_at: e.toISOString() });
      }
    } else if (field === 'due') {
      const e = options.end_at ? new Date(options.end_at) : new Date();
      e.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
      onChange({ ...options, end_at: e.toISOString() });
    } else if (field === 'start') {
      const s = options.start_at ? new Date(options.start_at) : new Date();
      s.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
      // Cambio inizio: preserva la durata spostando la fine.
      const dur = (options.start_at && options.end_at)
        ? new Date(options.end_at).getTime() - new Date(options.start_at).getTime() : 3600000;
      onChange({ ...options, start_at: s.toISOString(), end_at: new Date(s.getTime() + dur).toISOString() });
    } else if (field === 'end') {
      const e = options.end_at ? new Date(options.end_at) : new Date();
      e.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
      onChange({ ...options, end_at: e.toISOString() });
    }
  };
  // Valore iniziale del picker per il campo aperto. Le deadline vivono in
  // end_at, gli eventi in start_at (fine per il campo 'end').
  const dtValue = (): Date => {
    if ((dt === 'end' || dt === 'due') && options.end_at) return new Date(options.end_at);
    if (action === 'due' && options.end_at) return new Date(options.end_at);
    if (options.start_at) return new Date(options.start_at);
    return new Date();
  };

  const OptBtn = ({ id, label, Icon }: { id: ActionOpt; label: string; Icon: typeof IconNote }) => {
    const on = action === id;
    // Niente bordo: l'attivo si distingue per fondo accent tenue + testo/icona
    // accent; l'inattivo ha fondo surface2 e testo pieno.
    return (
      <Pressable onPress={() => onChange(seedAction(id, options, new Date()))} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 48, borderRadius: 9, backgroundColor: on ? c.accent + '33' : c.surface2 }}>
        <Icon size={16} color={on ? c.accent : c.muted} strokeWidth={1.8} />
        <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '600', color: on ? c.accent : c.text }}>{label}</Text>
      </Pressable>
    );
  };

  // Select a tutta larghezza (Tag/Tipo/Status): etichetta a sinistra, chevron a
  // destra; apre il selettore a tutto schermo. `open` ruota il chevron.
  // Selezionato → il pulsante si "colora" col colore PROPRIO dell'elemento
  // (fondo tinto + icona + chevron), come nella sidebar; testo bianco.
  const SelectBtn = ({ label, Icon, dotColor, color, active, open, onPress }: { label: string; Icon?: TablerGlyph; dotColor?: string; color?: string; active?: boolean; open?: boolean; onPress?: () => void }) => {
    const col = color ?? c.accent;
    return (
      <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, borderRadius: 10, backgroundColor: active ? col + '26' : c.surface, paddingHorizontal: 14 }}>
        {dotColor ? <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: dotColor }} /> : Icon ? <Icon size={18} color={active ? col : c.muted} strokeWidth={1.8} /> : null}
        <Text numberOfLines={1} style={{ flex: 1, fontSize: 16, fontWeight: '600', color: c.text }}>{label}</Text>
        <IconChevronDown size={16} color={active || open ? col : c.subtle} strokeWidth={2} style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
      </Pressable>
    );
  };

  return (
    <View style={{ flexGrow: 1, marginTop: 24, marginBottom: 24, backgroundColor: c.accentSoft, borderRadius: 12, padding: 14 }}>
      {/* Intestazione AZIONE + Chiudi (chiude il pannello). */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1.3, color: c.subtle }}>ACTIONS</Text>
        {/* Riga di ~16dp: serve hitSlop 16 per arrivare al bersaglio da 48. */}
        <Pressable onPress={onClose} hitSlop={16} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: c.muted }}>Close</Text>
          <IconChevronUp size={13} color={c.muted} strokeWidth={2} />
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
        <OptBtn id="note" label="Note" Icon={IconNote} />
        <OptBtn id="todo" label="To-do" Icon={IconCheckbox} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <OptBtn id="due" label="Due" Icon={IconBolt} />
        <OptBtn id="allday" label="Daily" Icon={IconCalendar} />
        <OptBtn id="timed" label="Timing" Icon={IconClock} />
      </View>

      {/* DATA E ORARIO — solo per le azioni con tempo (come sul web). */}
      {(action === 'due' || action === 'allday' || action === 'timed') && (
        <View style={{ marginTop: 16 }}>
          <Eyebrow c={c}>DATA E ORARIO</Eyebrow>
          {(() => {
            // Data di riferimento: end_at per le deadline, start_at per gli eventi.
            const dateIso = action === 'due' ? options.end_at : options.start_at;
            return (
              <View style={{ gap: 8 }}>
                <Field c={c} value={dateIso ? fmtDate(dateIso) : 'Seleziona data'} placeholder={!dateIso} Icon={IconCalendar} chev onPress={() => setDt('date')} />
                {action === 'timed' && (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={{ flex: 1 }}><Field c={c} value={options.start_at ? fmtTime(options.start_at) : '--:--'} placeholder={!options.start_at} Icon={IconClock} onPress={() => setDt('start')} /></View>
                    {/* Durata: sola lettura, deriva da inizio/fine (si cambia con la fine). */}
                    <View style={{ flex: 1 }}><Field c={c} value={options.start_at && options.end_at ? fmtDur(options.start_at, options.end_at) : '—'} placeholder /></View>
                    <View style={{ flex: 1 }}><Field c={c} value={options.end_at ? fmtTime(options.end_at) : '--:--'} placeholder={!options.end_at} Icon={IconClock} onPress={() => setDt('end')} /></View>
                  </View>
                )}
                {action === 'due' && (
                  <Field c={c} value={options.end_at ? fmtTime(options.end_at) : 'Scadenza'} placeholder={!options.end_at} Icon={IconClock} onPress={() => setDt('due')} />
                )}
              </View>
            );
          })()}
        </View>
      )}

      {/* Divider orizzontale tra le azioni e le opzioni. */}
      <View style={{ height: 1, backgroundColor: c.line2, marginTop: 16, marginBottom: 14 }} />

      {/* OPTIONS — Tag/Tipo/Status: select a tutta larghezza, in colonna. Il tap
          apre il selettore a tutto schermo (sotto). */}
      <Eyebrow c={c}>OPTIONS</Eyebrow>
      <View style={{ gap: 8 }}>
        <SelectBtn label={curTag ? curTag.name : 'Tag'} Icon={curTagVisual?.Glyph ?? IconTag} color={curTagVisual?.color} active={!!curTag} open={sheet === 'tag'} onPress={openTagSheet} />
        <SelectBtn label={curType ? curType.name : 'Tipo'} Icon={curTypeVisual?.Glyph ?? IconCategory} color={curTypeVisual?.color} active={!!curType} open={sheet === 'type'} onPress={() => setSheet('type')} />
        <SelectBtn label={curStatus ? statusLabel(curStatus.name) : 'Status'} Icon={IconCircleDot} dotColor={curStatus ? statusColor(c, curStatus.name) : undefined} color={curStatus ? statusColor(c, curStatus.name) : undefined} active={!!curStatus} open={sheet === 'status'} onPress={() => setSheet('status')} />
      </View>

      {/* Picker data/ora nativo: si monta solo mentre `dt` è attivo. */}
      {dt && (
        <DateTimePicker
          value={dtValue()}
          mode={dt === 'date' ? 'date' : 'time'}
          is24Hour
          onChange={(e, d) => onPickDateTime(e.type === 'set' ? d : undefined)}
        />
      )}

      {/* Selettore a tutto schermo (Tag/Tipo/Status). Header con titolo + X,
          lista scrollabile che riempie lo schermo. */}
      <Modal visible={sheet !== null} animationType="slide" onRequestClose={() => setSheet(null)} statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: c.canvas, paddingTop: insets.top }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.line }}>
            <Text style={{ flex: 1, fontSize: 18, fontWeight: '700', color: c.text }}>
              {sheet === 'tag' ? 'Scegli un tag' : sheet === 'type' ? 'Scegli un tipo' : 'Scegli uno status'}
            </Text>
            <Pressable onPress={() => setSheet(null)} hitSlop={8} accessibilityLabel="Chiudi" style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface2 }}>
              <IconX size={19} color={c.text} strokeWidth={1.9} />
            </Pressable>
          </View>

          {/* TAG — ricerca + bacchetta AI + lista */}
          {sheet === 'tag' && (
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.field, borderWidth: 1, borderColor: c.line2, borderRadius: 10, paddingHorizontal: 12, minHeight: OB_BTN_H, marginHorizontal: 16, marginTop: 12 }}>
                <IconSearch size={15} color={c.subtle} strokeWidth={1.8} />
                {suggestActive ? (
                  <Text style={{ flex: 1, fontSize: 14, color: c.accent, fontWeight: '600' }}>Suggeriti dal testo</Text>
                ) : (
                  <TextInput value={tagQuery} onChangeText={setTagQuery} placeholder="Cerca tag…" placeholderTextColor={c.subtle} style={{ flex: 1, fontSize: 14, color: c.text, padding: 0 }} />
                )}
                {/* Glifo 16 + hitSlop 16 su ogni lato = bersaglio 48. */}
                {suggestActive ? (
                  <Pressable onPress={() => setSuggestActive(false)} hitSlop={16}><IconX size={16} color={c.subtle} strokeWidth={1.8} /></Pressable>
                ) : (
                  <Pressable onPress={() => { setTagQuery(''); setSuggestActive(true); }} hitSlop={16} disabled={!hasSuggestText}><IconWand size={16} color={hasSuggestText ? c.accent : c.subtle} strokeWidth={1.8} /></Pressable>
                )}
              </View>
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: insets.bottom + 16 }} keyboardShouldPersistTaps="handled">
                {visibleTags.length === 0 && (
                  <Text style={{ fontSize: 14, color: c.subtle, paddingVertical: 14 }}>{tags.length === 0 ? 'Nessun tag disponibile.' : suggestActive ? 'Nessun tag pertinente al testo.' : 'Nessun risultato.'}</Text>
                )}
                {visibleTags.map((t) => {
                  const on = t.id === options.tag_id;
                  const v = tagVisual(t);
                  const G = v.Glyph ?? IconTag;
                  return (
                    <Pressable key={t.id} onPress={() => { onChange({ ...options, tag_id: on ? null : t.id }); setSheet(null); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: OB_BTN_H, paddingHorizontal: 6, borderRadius: 8 }}>
                      <G size={17} color={v.color ?? (on ? c.accent : c.subtle)} strokeWidth={1.8} />
                      <Text style={{ flex: 1, fontSize: 15, fontWeight: on ? '600' : '500', color: on ? c.accent : c.text }}>{t.name}</Text>
                      {on && <IconCheck size={17} color={c.accent} strokeWidth={2} />}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* TIPO */}
          {sheet === 'type' && (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: insets.bottom + 16 }}>
              {types.length === 0 && <Text style={{ fontSize: 14, color: c.subtle, paddingVertical: 14 }}>Nessun tipo disponibile.</Text>}
              {types.map((t) => {
                const on = t.id === options.type_icon_id;
                const v = typeVisual(t);
                const G = v.Glyph;
                return (
                  <Pressable key={t.id} onPress={() => { onChange({ ...options, type_icon_id: on ? null : t.id }); setSheet(null); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: OB_BTN_H, paddingHorizontal: 6, borderRadius: 8 }}>
                    {G ? <G size={17} color={v.color ?? (on ? c.accent : c.subtle)} strokeWidth={1.8} /> : null}
                    <Text style={{ flex: 1, fontSize: 15, fontWeight: on ? '600' : '500', color: on ? c.accent : c.text }}>{t.name}</Text>
                    {on && <IconCheck size={17} color={c.accent} strokeWidth={2} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {/* STATUS */}
          {sheet === 'status' && (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: insets.bottom + 16 }}>
              <Pressable onPress={() => { onChange({ ...options, status_id: null }); setSheet(null); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: OB_BTN_H, paddingHorizontal: 6, borderRadius: 8 }}>
                <View style={{ width: 13, height: 13, borderRadius: 7, borderWidth: 1.5, borderColor: c.subtle }} />
                <Text style={{ flex: 1, fontSize: 15, fontWeight: !options.status_id ? '600' : '500', color: !options.status_id ? c.accent : c.text }}>Nessuno</Text>
                {!options.status_id && <IconCheck size={17} color={c.accent} strokeWidth={2} />}
              </Pressable>
              {statuses.length === 0 && <Text style={{ fontSize: 14, color: c.subtle, paddingVertical: 14 }}>Nessuno status disponibile.</Text>}
              {statuses.map((s) => {
                const on = s.id === options.status_id;
                return (
                  <Pressable key={s.id} onPress={() => { onChange({ ...options, status_id: on ? null : s.id }); setSheet(null); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: OB_BTN_H, paddingHorizontal: 6, borderRadius: 8 }}>
                    <View style={{ width: 13, height: 13, borderRadius: 7, backgroundColor: statusColor(c, s.name) }} />
                    <Text style={{ flex: 1, fontSize: 15, fontWeight: on ? '600' : '500', color: on ? c.accent : c.text }}>{statusLabel(s.name)}</Text>
                    {on && <IconCheck size={17} color={c.accent} strokeWidth={2} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

/** Campo tappabile (data/ora). Stesso stile del Field di TileScreen. */
function Field({ c, value, Icon, chev, placeholder, onPress, dotColor }: { c: ObsidianColors; value: string; Icon?: typeof IconClock; chev?: boolean; placeholder?: boolean; onPress?: () => void; dotColor?: string }) {
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: c.field, borderWidth: 1, borderColor: c.line2, borderRadius: 10, paddingHorizontal: 13, minHeight: OB_BTN_H }}>
      {dotColor ? <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: dotColor }} /> : Icon ? <Icon size={15} color={placeholder ? c.subtle : c.muted} strokeWidth={1.8} /> : null}
      {/* Valore selezionato in colore testo, placeholder in subtle: distingue a
          colpo d'occhio i campi già impostati da quelli vuoti. */}
      <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, color: placeholder ? c.subtle : c.text }}>{value}</Text>
      {chev ? <IconChevronDown size={14} color={c.subtle} strokeWidth={1.8} /> : null}
    </Pressable>
  );
}

// ─── Spark list (buffer preview sotto le options) ──────────────────────────────
// Anteprima degli spark già catturati e in attesa d'invio. Ogni tipo ha icona e
// colore del proprio canale (c.cap.*), coerenti con la griglia di cattura.
const SPARK_META: Partial<Record<SparkType, { label: string; Icon: typeof IconCamera; color: (c: ObsidianColors) => string }>> = {
  text: { label: 'Text', Icon: IconAlignLeft, color: (c) => c.cap.text },
  audio_recording: { label: 'Voice', Icon: IconWaveSine, color: (c) => c.cap.voice },
  file: { label: 'File', Icon: IconPaperclip, color: (c) => c.cap.file },
  photo: { label: 'Photo', Icon: IconCamera, color: (c) => c.cap.photo },
  video: { label: 'Video', Icon: IconVideo, color: (c) => c.cap.video },
  image: { label: 'Image', Icon: IconPhoto, color: (c) => c.cap.gallery },
};
const fmtBytes = (b: number) => (b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / (1024 * 1024)).toFixed(1)} MB`);
const fmtClock = (ms: number) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${pad(s % 60)}`; };

function SparkRow({ c, item, onRemove, onPress, editing }: { c: ObsidianColors; item: BufferItem; onRemove?: () => void; onPress?: () => void; editing?: boolean }) {
  const meta = SPARK_META[item.type] ?? { label: 'Item', Icon: IconAlignLeft, color: (cc: ObsidianColors) => cc.muted };
  const col = meta.color(c);
  // URI d'anteprima: media (foto/video/image) e allegati che SONO immagini
  // (mime image/*). Per PDF/altri documenti non esiste thumbnail nel buffer
  // (servirebbe un renderer nativo del contenuto).
  const previewUri =
    (item.type === 'photo' || item.type === 'image' || item.type === 'video')
      ? (item.thumbnail ?? item.uri ?? null)
      : (item.type === 'file' && (item.mimeType?.startsWith('image/') ?? false))
        ? (item.thumbnail ?? item.uri ?? null)
        : null;
  const hasThumb = !!previewUri;
  // Sottotitolo per tipo: testo → anteprima; voce → durata · peso; file → nome ·
  // peso; media (foto/video/image) → nome file di sistema, altrimenti peso.
  const sub =
    item.type === 'text' ? (item.preview?.trim() || 'Testo')
    : item.type === 'audio_recording'
      ? ([item.duration ? fmtClock(item.duration) : null, item.size ? fmtBytes(item.size) : null].filter(Boolean).join(' · ') || 'Memo vocale')
    : item.type === 'file'
      ? ([item.fileName?.trim() || null, item.size ? fmtBytes(item.size) : null].filter(Boolean).join(' · ') || meta.label)
    : (item.fileName?.trim() || (item.size ? fmtBytes(item.size) : meta.label));
  // Layout a due colonne, uguale per tutti gli spark:
  //  · Colonna 1 → icona (o thumbnail), separata da un bordo verticale del
  //    colore del bordo dello spark.
  //  · Colonna 2 → contenuto (label + testo).
  //  · X in sovraimpressione, in alto a destra.
  // overflow hidden: arrotonda anche il bordo verticale ai corner del box.
  // Con onPress (spark testuali) la riga è toccabile: riapre il testo nel
  // composer. `editing` la marca con un anello accent mentre è in modifica.
  const Row = onPress ? Pressable : View;
  return (
    // Niente bordo esterno; le colonne sono separate da un divider scuro.
    <Row
      {...(onPress ? { onPress, accessibilityLabel: 'Modifica nota', android_ripple: { color: c.accent + '18' } } : {})}
      style={{ flexDirection: 'row', backgroundColor: c.field, borderRadius: 12, overflow: 'hidden', borderWidth: editing ? 1 : 0, borderColor: editing ? c.accent : 'transparent' }}
    >
      {/* Colonna 1 — icona (sempre, anche per i media); divider destro più scuro
          del box. padding 6 su ogni lato; la tile è ancorata in ALTO nella
          colonna (flex-start) invece che centrata. */}
      <View style={{ padding: 6, alignItems: 'center', justifyContent: 'flex-start', borderRightWidth: 1, borderRightColor: c.dark ? '#000000' : c.line2 }}>
        {/* Tile 42 = dimensione dei pulsanti header; glifo 23 come gli altri
            pulsanti icona (toolbar canali). */}
        <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: col + (c.dark ? '2e' : '1c'), alignItems: 'center', justifyContent: 'center' }}>
          <meta.Icon size={23} color={col} strokeWidth={1.8} />
        </View>
      </View>

      {/* Colonna 2 — contenuto: anteprima media (foto/video/image) e testo.
          Niente label del tipo: è già data dall'icona in colonna 1.
          paddingRight lascia spazio alla X sovrapposta. */}
      <View style={{ flex: 1, paddingVertical: 11, paddingLeft: 12, paddingRight: 30 }}>
        {hasThumb && previewUri && (
          <Image source={{ uri: previewUri }} style={{ width: '100%', height: 72, borderRadius: 8 }} resizeMode="cover" />
        )}
        <Text style={{ fontSize: 14.5, lineHeight: 20, color: c.text, marginTop: hasThumb ? 8 : 0 }}>{sub}</Text>
      </View>

      {/* X in sovraimpressione, in alto a destra. */}
      {onRemove ? (
        <Pressable onPress={onRemove} hitSlop={14} accessibilityLabel="Rimuovi spark" style={{ position: 'absolute', top: 8, right: 8, padding: 2 }}>
          <IconX size={16} color={c.subtle} strokeWidth={1.9} />
        </Pressable>
      ) : null}
    </Row>
  );
}

// ─── Voice recording sheet ────────────────────────────────────────────────────
const VOICE_BARS = [8, 16, 28, 20, 34, 44, 30, 22, 38, 48, 36, 24, 18, 30, 42, 26, 14, 22, 34, 20, 28, 16, 10];

function VoiceSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const c = useObsidian();
  const col = c.cap.voice;
  return (
    <BottomSheet open={open} onClose={onClose}>
      <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: c.line2, alignSelf: 'center', marginBottom: 16 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <View style={{ width: 40, height: 40, borderRadius: 11, backgroundColor: col + (c.dark ? '2e' : '1c'), alignItems: 'center', justifyContent: 'center' }}>
          <IconWaveSine size={20} color={col} strokeWidth={1.8} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: c.text }}>Memo vocale</Text>
          <Text style={{ fontSize: 12, color: c.subtle }}>In registrazione…</Text>
        </View>
        <Text style={{ fontSize: 16, fontWeight: '600', color: c.text, fontVariant: ['tabular-nums'] }}>00:12</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, height: 54, marginBottom: 18 }}>
        {VOICE_BARS.map((v, i) => (
          <View key={i} style={{ width: 4, height: v, borderRadius: 2, backgroundColor: i < 14 ? col : c.line2 }} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable onPress={onClose} style={{ flex: 1, minHeight: OB_BTN_H, justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: c.line2, alignItems: 'center' }}>
          <Text style={{ fontSize: 14, fontWeight: '500', color: c.muted }}>Annulla</Text>
        </Pressable>
        <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: col, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 20, height: 20, borderRadius: 4, backgroundColor: '#fff' }} />
        </View>
        <Pressable onPress={onClose} style={{ flex: 1, minHeight: OB_BTN_H, justifyContent: 'center', borderRadius: 12, backgroundColor: c.accent, alignItems: 'center' }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: c.accentInk }}>Salva spark</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export interface ObsidianCaptureScreenProps {
  /** Items waiting in the buffer. */
  bufferCount?: number;
  /** Start a capture flow. Omitted → the static QA mock (voice sheet only). */
  onCapture?: (key: CapKey) => void;
  /** Salva la nota scritta inline come spark testuale nel buffer. */
  onSaveNote?: (text: string) => void;
  /** Aggiorna il testo di uno spark testuale già in buffer (riaperto dalla lista). */
  onUpdateNote?: (id: string, text: string) => void;
  onSend?: () => void;
  onOpenBuffer?: () => void;
  onNavigateView?: (id: MobileViewId) => void;
  onSettings?: () => void;
  /** Metadati pre-impostati per il tile in creazione (controlled). Omessi →
   *  il pannello usa uno stato interno effimero (uso come mock QA). */
  options?: CaptureOptions;
  onOptionsChange?: (next: CaptureOptions) => void;
  /** Testo del buffer (contenuti catturati) su cui la bacchetta AI suggerisce i tag. */
  suggestText?: string;
  /** Spark già catturati in attesa d'invio: mostrati in anteprima sotto le options. */
  items?: BufferItem[];
  /** Rimuove uno spark dal buffer (X sulla riga). */
  onRemoveItem?: (id: string) => void;
  /** Apre la chat "Ask Gimmick" (pulsante sparkles nell'header). */
  onAsk?: () => void;
  /** Stato account/rete per il pallino accanto a VAULT. Omesso → nessun pallino. */
  connection?: ConnectionStatus;
  /** Tile in coda (outbox) ancora da sincronizzare: contatore accanto al pallino. */
  pendingCount?: number;
  /** Flash del FAB in arancione dopo un invio offline (tile messo in coda). */
  queuedFlash?: boolean;
}

/** Stato mostrato dal pallino header: verde=online·ok, arancio=offline·ok, rosso=non autenticato. */
export type ConnectionStatus = 'online' | 'offline' | 'signed-out';

export function ObsidianCaptureScreen({
  bufferCount, onCapture, onSaveNote, onUpdateNote, onSend, onOpenBuffer, onNavigateView, onSettings,
  options, onOptionsChange, suggestText, items, onRemoveItem, onAsk, connection, pendingCount, queuedFlash,
}: ObsidianCaptureScreenProps = {}) {
  const c = useObsidian();
  const insets = useSafeAreaInsets();
  const [drawer, setDrawer] = React.useState(false);
  const [voice, setVoice] = React.useState(false);
  const [actionOpen, setActionOpen] = React.useState(false);
  // Testo della nota in composizione (spark testuale creato al tocco di Salva).
  const [note, setNote] = React.useState('');
  const hasNote = note.trim().length > 0;
  // Spark testuale riaperto dalla lista: finché è valorizzato il Salva aggiorna
  // quello spark invece di crearne uno nuovo.
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const noteRef = React.useRef<TextInput>(null);
  // Composizione in corso (testo digitato o spark riaperto): il campo prende
  // tutta l'altezza e in fondo restano solo gomma e invio.
  const composing = hasNote || !!editingId;
  // Fondo della shell: nero pieno in tema scuro, status bar e nav pill inclusi.
  const shellBg = c.dark ? '#000000' : c.canvas;
  // Dettatura vocale live: il mic in sovraimpressione scrive nel campo, come il
  // microfono della tastiera (motore on-device, richiede la build nativa).
  const dictation = useDictation({ onText: setNote, onError: (m) => toast.warning(m) });
  // Fallback effimero quando il parent non controlla le opzioni (mock).
  const [localOpts, setLocalOpts] = React.useState<CaptureOptions>(EMPTY_CAPTURE_OPTIONS);
  const opts = options ?? localOpts;
  const setOpts = onOptionsChange ?? setLocalOpts;
  const list = items ?? [];
  // Conteggio reale dal buffer quando disponibile; il 2 resta solo per il mock QA.
  const count = bufferCount ?? (items ? list.length : 2);
  // Invio possibile solo con handler collegato e almeno uno spark in buffer:
  // guida la comparsa del FAB "Send" in sovraimpressione.
  const canSend = !!onSend && count > 0;

  const saveNote = () => {
    const t = note.trim();
    if (!t) return;
    // Anima la transizione al Salva: l'input si svuota e il box dello spark
    // compare/si estende in modo fluido invece che di scatto.
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    // Spegne il mic e azzera gli accumulatori della dettatura: così un risultato
    // vocale in ritardo non ripopola l'input dopo lo svuotamento.
    dictation.reset();
    if (editingId) {
      onUpdateNote?.(editingId, t);
      setEditingId(null);
    } else {
      onSaveNote?.(t);
    }
    setNote('');
  };

  /** Riapre uno spark testuale nel composer per modificarlo. Il testo eventualmente
   *  in composizione viene prima committato, così un tocco sulla riga non lo perde. */
  const editNote = (it: BufferItem) => {
    if (it.type !== 'text') return;
    if (it.id === editingId) { noteRef.current?.focus(); return; }
    const t = note.trim();
    if (t) {
      dictation.reset();
      if (editingId) onUpdateNote?.(editingId, t);
      else onSaveNote?.(t);
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setEditingId(it.id);
    setNote(it.preview ?? '');
    noteRef.current?.focus();
  };

  /** Svuota il campo (gomma accanto al Salva). In modifica esce anche dalla
   *  modifica, lasciando lo spark in lista com'era. */
  const clearNote = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    dictation.reset();
    setEditingId(null);
    setNote('');
  };

  /** Rimozione dalla lista: se lo spark è quello aperto, chiude anche la modifica. */
  const removeItem = (id: string) => {
    if (id === editingId) { setEditingId(null); setNote(''); }
    onRemoveItem?.(id);
  };

  // Campo nota. `fill` → riempie tutta l'altezza disponibile (stato neutro/
  // digitazione, così tocchi ovunque per scrivere); altrimenti altezza minima
  // (quando sotto ci sono gli spark che scorrono).
  const renderNote = (fill: boolean) => (
    <View style={fill ? { flex: 1 } : undefined}>
      <TextInput
        ref={noteRef}
        value={note}
        onChangeText={setNote}
        placeholder={editingId ? 'Modifica la nota…' : 'Scrivi una nota…'}
        placeholderTextColor={c.subtle}
        multiline
        textAlignVertical="top"
        // paddingRight: spazio per il mic in alto a destra. Deve coprire
        // `right` + larghezza del mic (14 + 36 = 50), altrimenti il testo ci
        // scorre sotto.
        style={[
          { fontSize: 18, lineHeight: 26, color: c.text, paddingTop: 2, paddingBottom: 0, paddingLeft: 0, paddingRight: 54 },
          fill ? { flex: 1 } : { minHeight: 120 },
        ]}
      />
      {/* Mic in sovraimpressione (dettatura vocale). In ascolto → accent acceso. */}
      <Pressable
        onPress={() => dictation.toggle(note)}
        accessibilityLabel={dictation.listening ? 'Ferma dettatura' : 'Detta la nota'}
        hitSlop={8}
        android_ripple={{ color: c.accent + '33', borderless: true }}
        // `right: 14` allinea il GLIFO a quello dei pulsanti dell'header, non i
        // bordi: il mic è largo 36 e non ha fondo, l'header ne ha 48 con la
        // pastiglia, quindi allineare i bordi lascerebbe i glifi fuori asse.
        // Centro del glifo = 12 (padding del contenitore) + 14 + 18 = 44 dal
        // bordo schermo, uguale a 20 (padding header) + 24 dei pulsanti.
        style={{ position: 'absolute', top: 6, right: 14, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: dictation.listening ? c.accent + '2E' : 'transparent' }}
      >
        {/* Bianco sul fondo scuro del composer; in tema chiaro segue il testo,
            altrimenti sparirebbe. In ascolto passa ad accent. */}
        <IconMicrophone size={23} color={dictation.listening ? c.accent : (c.dark ? '#FFFFFF' : c.text)} strokeWidth={1.9} />
      </Pressable>
    </View>
  );

  // Barra dei canali, ancorata in fondo (stile Keep). Nota vuota → i 5 canali +
  // kebab Options; mentre scrivi (o modifichi uno spark) → gomma (svuota il
  // campo) + Salva.
  const toolbar = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 12, paddingBottom: 8 }}>
      {(hasNote || editingId) ? (
        <>
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={clearNote}
            accessibilityLabel={editingId ? 'Annulla modifica e svuota il campo' : 'Svuota il campo'}
            android_ripple={{ color: '#ffffff22', borderless: false }}
            style={{ width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#3a3a3a' }}
          >
            <IconEraser size={22} color={c.text} strokeWidth={1.9} />
          </Pressable>
          <Pressable
            onPress={saveNote}
            disabled={!hasNote}
            accessibilityLabel={editingId ? 'Conferma modifica' : 'Salva nota'}
            android_ripple={{ color: '#ffffff22', borderless: false }}
            style={{ width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: hasNote ? '#3a3a3a' : c.field, opacity: hasNote ? 1 : 0.6 }}
          >
            {editingId ? (
              <IconCheck size={22} color={hasNote ? c.text : c.subtle} strokeWidth={2} />
            ) : (
              <IconCornerDownLeft size={22} color={c.text} strokeWidth={1.9} />
            )}
          </Pressable>
        </>
      ) : (
        <>
          {TOOLBAR.map((key) => {
            const { Icon, label } = CAPS[key];
            return (
              <Pressable
                key={key}
                onPress={() => { if (onCapture) onCapture(key); else if (key === 'voice') setVoice(true); }}
                accessibilityLabel={label}
                android_ripple={{ color: '#ffffff22', borderless: false }}
                style={{ width: CAP_BTN, height: CAP_BTN, borderRadius: CAP_BTN / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: '#3a3a3a' }}
              >
                <Icon size={CAP_GLYPH} color={c.text} strokeWidth={1.8} />
              </Pressable>
            );
          })}
          {/* Spinge il kebab Options a destra, in riga coi canali. */}
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setActionOpen((v) => !v); }}
            accessibilityLabel="Opzioni"
            android_ripple={{ color: '#ffffff22', borderless: false }}
            hitSlop={{ left: 6, right: 6 }}
            style={{ width: KEBAB_W, height: CAP_BTN, borderRadius: '50%', alignItems: 'center', justifyContent: 'center' }}
          >
            <IconDotsVertical size={CAP_GLYPH} color={actionOpen ? c.accent : c.text} strokeWidth={1.8} />
          </Pressable>
        </>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: shellBg }}>
      <ObsidianStatusBar background={shellBg} />
      <CaptureHeader onMenu={() => setDrawer(true)} onAsk={onAsk} connection={connection} pendingCount={pendingCount} />

      {/* Colonna contenuti: il campo nota riempie tutta l'altezza, la barra dei
          canali resta ancorata in fondo (stile Keep). Il contenuto scorre solo a
          riposo con spark in lista o col pannello Options aperto: MENTRE SCRIVI
          il campo torna sempre a tutta altezza, con la sola gomma+invio in
          fondo. KeyboardAvoidingView tiene la barra sopra la tastiera (su
          Android provvede il resize). */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flex: 1, paddingHorizontal: 12, paddingTop: 18 }}>
          {(!actionOpen && (composing || list.length === 0)) ? (
            // Stato neutro / digitazione: il campo nota riempie tutto lo spazio e
            // spinge le icone in fondo (con margine). Testo + icone = blocco unico.
            <View style={{ flex: 1, paddingBottom: 56 }}>
              {renderNote(true)}
              {toolbar}
            </View>
          ) : (
            // Con Options aperte o spark presenti: ordine fisso, tutto scorre.
            // 1) Testo + icone, 2) ACTIONS/OPTIONS, 3) Spark.
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
              {renderNote(false)}
              {toolbar}
              {actionOpen && (
                <SetOptionsBody
                  options={opts}
                  onChange={setOpts}
                  onClose={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setActionOpen(false); }}
                  suggestText={suggestText}
                />
              )}
              {list.length > 0 && (
                <View style={{ marginTop: 24, gap: 8 }}>
                  {list.map((it) => (
                    <SparkRow
                      key={it.id}
                      c={c}
                      item={it}
                      onRemove={onRemoveItem ? () => removeItem(it.id) : undefined}
                      // Solo il testo è riapribile: gli altri spark non hanno un
                      // editor inline nel composer.
                      onPress={it.type === 'text' && onUpdateNote ? () => editNote(it) : undefined}
                      editing={it.id === editingId}
                    />
                  ))}
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>

      <ObsidianNavPill background={shellBg} />

      {/* FAB Send — sovraimpressione in basso a destra, presente quando c'è
          almeno uno spark da inviare. Nascosto mentre scrivi: lì la barra
          gomma+invio è ancorata in fondo e i due controlli si sovrapporrebbero;
          torna appena salvi o svuoti il campo. Dopo un invio offline lampeggia
          ARANCIONE (queuedFlash) per confermare che il tile è stato messo in
          coda, poi sparisce col reset del composer. */}
      {((canSend && !composing) || queuedFlash) && (
        <Pressable
          onPress={onSend}
          disabled={queuedFlash}
          accessibilityLabel={queuedFlash ? 'Tile messo in coda' : 'Invia a Gimmick'}
          android_ripple={{ color: c.accent + '40', borderless: true }}
          style={{ position: 'absolute', right: 20, bottom: insets.bottom + 24 }}
        >
          <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: queuedFlash ? c.warning : c.surface, borderWidth: queuedFlash ? 0 : 1, borderColor: c.line2, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 8 }}>
            <IconSend size={24} color={queuedFlash ? '#0C0C0E' : c.text} strokeWidth={1.8} />
          </View>
        </Pressable>
      )}

      {/* Overlays */}
      <ObsidianDrawer open={drawer} onClose={() => setDrawer(false)} onNavigateView={onNavigateView} onSettings={onSettings} />
      <VoiceSheet open={voice} onClose={() => setVoice(false)} />
    </View>
  );
}
