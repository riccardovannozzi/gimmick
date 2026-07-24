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
import { View, Text, Pressable, ScrollView, Modal, LayoutAnimation, TextInput, Image } from 'react-native';
import {
  IconCamera, IconVideo, IconPhoto, IconAlignLeft, IconMicrophone, IconPaperclip,
  IconSend, IconChevronDown, IconChevronUp, IconPlus,
  IconMenu2, IconSparkles, IconLayoutGrid, IconRoute, IconCalendarTime,
  IconNote, IconCheckbox, IconBolt, IconCalendar, IconClock, IconTag,
  IconSearch, IconWand, IconCheck, IconX,
} from '@tabler/icons-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useQuery } from '@tanstack/react-query';
import { useObsidian } from '@/lib/obsidian';
import { toast } from '@/store';
import { useDictation } from '@/hooks/useDictation';
import { OB_BTN_H, type ObsidianColors } from '@/constants/obsidian';
import { tagsApi, typeIconsApi, statusesApi, type StatusEntity } from '@/lib/api';
import type { ActionType, Tag, BufferItem, SparkType } from '@/types';
import { ObsidianStatusBar } from '../StatusBar';
import { ObsidianNavPill } from '../NavPill';
import { ObsidianDrawer } from '../Drawer';
import type { MobileViewId } from '../TopNav';

type CapKey = 'photo' | 'video' | 'gallery' | 'text' | 'voice' | 'file';
const CAPS: Record<CapKey, { label: string; Icon: typeof IconCamera }> = {
  photo: { label: 'Photo', Icon: IconCamera },
  video: { label: 'Video', Icon: IconVideo },
  gallery: { label: 'Image', Icon: IconPhoto },
  text: { label: 'Text', Icon: IconAlignLeft },
  voice: { label: 'Voice', Icon: IconMicrophone },
  file: { label: 'File', Icon: IconPaperclip },
};

/**
 * Canali della toolbar del composer, in ordine. Text non compare: è il campo di
 * scrittura stesso. Restano i cinque canali "media" (registrazione dal vivo +
 * import), scorciatoie per allegare uno spark diverso alla stessa cattura.
 */
const TOOLBAR: CapKey[] = ['photo', 'video', 'voice', 'gallery', 'file'];

// Stacco dell'header dall'alto (safe-area a parte).
const HEADER_GAP = 20;

const NAV_ITEMS: Array<{ id: MobileViewId; label: string; Icon: typeof IconLayoutGrid }> = [
  { id: 'tiles', label: 'Tiles', Icon: IconLayoutGrid },
  { id: 'flows', label: 'Flows', Icon: IconRoute },
  { id: 'chrono', label: 'Chrono', Icon: IconCalendarTime },
];

// ─── Header "VAULT / Gimmick" ──────────────────────────────────────────────────
// Titolo del vault a sinistra (con dropdown viste), menu + Ask a destra. Sostituisce
// l'AppHeader centrato: qui la home ha un'identità da "vault" alla Obsidian.
function CaptureHeader({ onMenu, onAsk, onNavigateView }: { onMenu?: () => void; onAsk?: () => void; onNavigateView?: (id: MobileViewId) => void }) {
  const c = useObsidian();
  const insets = useSafeAreaInsets();
  const [navOpen, setNavOpen] = React.useState(false);

  const sqBtn = {
    width: 42, height: 42, borderRadius: 12, alignItems: 'center' as const, justifyContent: 'center' as const,
    borderWidth: 1,
  };

  return (
    <View style={{ marginTop: HEADER_GAP, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: c.dark ? '#000000' : c.canvas, zIndex: 10 }}>
      {/* Sinistra — VAULT / Gimmick ⌄ (apre il dropdown viste) */}
      <Pressable onPress={() => setNavOpen(true)} accessibilityLabel="Cambia vista" hitSlop={6}>
        <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: c.subtle, marginBottom: 2 }}>VAULT</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Text style={{ fontSize: 22, fontWeight: '700', color: c.text }}>Gimmick</Text>
          <IconChevronDown size={17} color={c.muted} strokeWidth={2} />
        </View>
      </Pressable>

      {/* Destra — menu (Drawer) + Ask (chat) */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable
          onPress={onMenu}
          accessibilityLabel="Menu"
          hitSlop={6}
          android_ripple={{ color: c.line, borderless: true }}
          style={[sqBtn, { backgroundColor: c.surface2, borderColor: c.line }]}
        >
          <IconMenu2 size={19} color={c.text} strokeWidth={1.9} />
        </Pressable>
        <Pressable
          onPress={onAsk}
          accessibilityLabel="Ask Gimmick"
          hitSlop={6}
          android_ripple={{ color: c.accent + '40', borderless: true }}
          style={[sqBtn, { backgroundColor: c.accent + '2E', borderColor: c.accent + '55' }]}
        >
          <IconSparkles size={19} color={c.accent} strokeWidth={1.9} />
        </Pressable>
      </View>

      {/* Dropdown viste — Modal per stare sopra il contenuto; allineato a sinistra
          sotto il titolo. */}
      <Modal visible={navOpen} transparent animationType="fade" onRequestClose={() => setNavOpen(false)} statusBarTranslucent>
        <Pressable style={{ flex: 1 }} onPress={() => setNavOpen(false)} accessibilityLabel="Chiudi">
          <View style={{ position: 'absolute', top: insets.top + HEADER_GAP + 58, left: 16 }}>
            <View
              style={{
                minWidth: 200, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 14, padding: 6,
                shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 12,
              }}
            >
              {NAV_ITEMS.map((it) => (
                <Pressable
                  key={it.id}
                  onPress={() => { setNavOpen(false); onNavigateView?.(it.id); }}
                  android_ripple={{ color: c.accent + '22' }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: 46, paddingHorizontal: 12, borderRadius: 9 }}
                >
                  <it.Icon size={18} color={c.muted} strokeWidth={1.8} />
                  <Text style={{ fontSize: 15, fontWeight: '600', color: c.text }}>{it.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>
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

/** Pillola dropdown compatta (Tag / Tipo / Status) per la riga in fondo al
 *  pannello AZIONE. `active` → contorno/testo accent; `dotColor` → pallino al
 *  posto dell'icona (STATUS). */
function Pill({ c, label, Icon, active, dotColor, onPress }: { c: ObsidianColors; label: string; Icon?: typeof IconTag; active?: boolean; dotColor?: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, minHeight: 36, borderRadius: 9, borderWidth: 1, borderColor: active ? c.accent : c.line2, backgroundColor: active ? c.accent + '14' : 'transparent', paddingHorizontal: 8 }}>
      {dotColor ? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: dotColor }} /> : Icon ? <Icon size={13} color={active ? c.accent : c.muted} strokeWidth={1.8} /> : null}
      <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 12.5, fontWeight: '600', color: active ? c.accent : c.muted }}>{label}</Text>
      <IconChevronDown size={12} color={active ? c.accent : c.subtle} strokeWidth={2} />
    </Pressable>
  );
}

function SetOptionsBody({ options, onChange, onClose, suggestText = '' }: { options: CaptureOptions; onChange: (next: CaptureOptions) => void; onClose: () => void; suggestText?: string }) {
  const c = useObsidian();
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
  const tags: Tag[] = (tagsQuery.data?.data ?? []).filter((t) => !t.is_root);
  const types = typesQuery.data?.data ?? [];
  const statuses: StatusEntity[] = statusesQuery.data?.data ?? [];
  const curTag = tags.find((t) => t.id === options.tag_id) ?? null;
  const curType = types.find((t) => t.id === options.type_icon_id) ?? null;
  const curStatus = statuses.find((s) => s.id === options.status_id) ?? null;

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
    // Attivo: fondo accent tenue + bordo/testo accent. Inattivo: fondo surface2 +
    // bordo line2 (definito, come nel mockup), testo pieno e icona muted.
    return (
      <Pressable onPress={() => onChange(seedAction(id, options, new Date()))} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, borderRadius: 9, backgroundColor: on ? c.accent + '26' : c.surface2, borderWidth: 1, borderColor: on ? c.accent : c.line2 }}>
        <Icon size={15} color={on ? c.accent : c.muted} strokeWidth={1.8} />
        <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '600', color: on ? c.accent : c.text }}>{label}</Text>
      </Pressable>
    );
  };

  return (
    <View style={{ marginTop: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line2, borderRadius: 12, padding: 14 }}>
      {/* Intestazione AZIONE + Chiudi (chiude il pannello). */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1.3, color: c.subtle }}>AZIONE</Text>
        <Pressable onPress={onClose} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: c.muted }}>Chiudi</Text>
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

      {/* Tag / Tipo / Status — pillole dropdown compatte in un'unica riga. */}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
        <Pill c={c} label={curTag ? curTag.name : 'Tag'} Icon={IconTag} active={!!curTag} onPress={openTagSheet} />
        <Pill c={c} label={curType ? curType.name : 'Tipo'} active={!!curType} onPress={() => setSheet('type')} />
        <Pill c={c} label={curStatus ? statusLabel(curStatus.name) : 'Status'} active={!!curStatus} dotColor={curStatus ? statusColor(c, curStatus.name) : undefined} onPress={() => setSheet('status')} />
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

      {/* Picker TAG — search + bacchetta AI (euristica locale), come sul web */}
      <BottomSheet open={sheet === 'tag'} onClose={() => setSheet(null)}>
        <Eyebrow c={c}>SCEGLI UN TAG</Eyebrow>
        {/* Barra di ricerca con la bacchetta a destra. In modalità AI l'input è
            disabilitato e mostra "Suggeriti dal testo"; la X esce dalla modalità. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.field, borderWidth: 1, borderColor: c.line2, borderRadius: 10, paddingHorizontal: 11, minHeight: OB_BTN_H, marginBottom: 10 }}>
          <IconSearch size={15} color={c.subtle} strokeWidth={1.8} />
          {suggestActive ? (
            <Text style={{ flex: 1, fontSize: 13, color: c.accent, fontWeight: '600' }}>Suggeriti dal testo</Text>
          ) : (
            <TextInput
              value={tagQuery}
              onChangeText={setTagQuery}
              placeholder="Cerca tag…"
              placeholderTextColor={c.subtle}
              style={{ flex: 1, fontSize: 13, color: c.text, padding: 0 }}
            />
          )}
          {suggestActive ? (
            <Pressable onPress={() => setSuggestActive(false)} hitSlop={8}>
              <IconX size={16} color={c.subtle} strokeWidth={1.8} />
            </Pressable>
          ) : (
            // Bacchetta: attiva i suggerimenti dal testo del buffer. Disabilitata
            // se non c'è testo su cui ragionare (buffer senza contenuto testuale).
            <Pressable onPress={() => { setTagQuery(''); setSuggestActive(true); }} hitSlop={8} disabled={!hasSuggestText}>
              <IconWand size={16} color={hasSuggestText ? c.accent : c.subtle} strokeWidth={1.8} />
            </Pressable>
          )}
        </View>
        <ScrollView style={{ maxHeight: 300 }} keyboardShouldPersistTaps="handled">
          {visibleTags.length === 0 && (
            <Text style={{ fontSize: 13, color: c.subtle, paddingVertical: 12 }}>
              {tags.length === 0 ? 'Nessun tag disponibile.' : suggestActive ? 'Nessun tag pertinente al testo.' : 'Nessun risultato.'}
            </Text>
          )}
          {visibleTags.map((t) => {
            const on = t.id === options.tag_id;
            return (
              <Pressable key={t.id} onPress={() => { onChange({ ...options, tag_id: on ? null : t.id }); setSheet(null); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: OB_BTN_H, paddingHorizontal: 6, borderRadius: 8 }}>
                <IconTag size={15} color={on ? c.accent : c.subtle} strokeWidth={1.8} />
                <Text style={{ flex: 1, fontSize: 14, fontWeight: on ? '600' : '500', color: on ? c.accent : c.text }}>{t.name}</Text>
                {on && <IconCheck size={16} color={c.accent} strokeWidth={2} />}
              </Pressable>
            );
          })}
        </ScrollView>
      </BottomSheet>

      {/* Picker STATUS — pallino colore semantico + etichetta IT, come la sidebar */}
      <BottomSheet open={sheet === 'status'} onClose={() => setSheet(null)}>
        <Eyebrow c={c}>SCEGLI UNO STATUS</Eyebrow>
        <ScrollView style={{ maxHeight: 320 }}>
          {/* Nessuno */}
          <Pressable onPress={() => { onChange({ ...options, status_id: null }); setSheet(null); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: OB_BTN_H, paddingHorizontal: 6, borderRadius: 8 }}>
            <View style={{ width: 12, height: 12, borderRadius: 6, borderWidth: 1.5, borderColor: c.subtle }} />
            <Text style={{ flex: 1, fontSize: 14, fontWeight: !options.status_id ? '600' : '500', color: !options.status_id ? c.accent : c.text }}>Nessuno</Text>
            {!options.status_id && <IconCheck size={16} color={c.accent} strokeWidth={2} />}
          </Pressable>
          {statuses.length === 0 && <Text style={{ fontSize: 13, color: c.subtle, paddingVertical: 12 }}>Nessuno status disponibile.</Text>}
          {statuses.map((s) => {
            const on = s.id === options.status_id;
            return (
              <Pressable key={s.id} onPress={() => { onChange({ ...options, status_id: on ? null : s.id }); setSheet(null); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: OB_BTN_H, paddingHorizontal: 6, borderRadius: 8 }}>
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: statusColor(c, s.name) }} />
                <Text style={{ flex: 1, fontSize: 14, fontWeight: on ? '600' : '500', color: on ? c.accent : c.text }}>{statusLabel(s.name)}</Text>
                {on && <IconCheck size={16} color={c.accent} strokeWidth={2} />}
              </Pressable>
            );
          })}
        </ScrollView>
      </BottomSheet>

      {/* Picker TIPO */}
      <BottomSheet open={sheet === 'type'} onClose={() => setSheet(null)}>
        <Eyebrow c={c}>SCEGLI UN TIPO</Eyebrow>
        <ScrollView style={{ maxHeight: 320 }}>
          {types.length === 0 && <Text style={{ fontSize: 13, color: c.subtle, paddingVertical: 12 }}>Nessun tipo disponibile.</Text>}
          {types.map((t) => {
            const on = t.id === options.type_icon_id;
            return (
              <Pressable key={t.id} onPress={() => { onChange({ ...options, type_icon_id: on ? null : t.id }); setSheet(null); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: OB_BTN_H, paddingHorizontal: 6, borderRadius: 8 }}>
                <Text style={{ flex: 1, fontSize: 14, fontWeight: on ? '600' : '500', color: on ? c.accent : c.text }}>{t.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </BottomSheet>
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
  audio_recording: { label: 'Voice', Icon: IconMicrophone, color: (c) => c.cap.voice },
  file: { label: 'File', Icon: IconPaperclip, color: (c) => c.cap.file },
  photo: { label: 'Photo', Icon: IconCamera, color: (c) => c.cap.photo },
  video: { label: 'Video', Icon: IconVideo, color: (c) => c.cap.video },
  image: { label: 'Image', Icon: IconPhoto, color: (c) => c.cap.gallery },
};
const fmtBytes = (b: number) => (b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / (1024 * 1024)).toFixed(1)} MB`);
const fmtClock = (ms: number) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${pad(s % 60)}`; };

function SparkRow({ c, item, onRemove }: { c: ObsidianColors; item: BufferItem; onRemove?: () => void }) {
  const meta = SPARK_META[item.type] ?? { label: 'Item', Icon: IconAlignLeft, color: (cc: ObsidianColors) => cc.muted };
  const col = meta.color(c);
  const hasThumb = (item.type === 'photo' || item.type === 'image' || item.type === 'video') && !!(item.thumbnail || item.uri);
  // Sottotitolo per tipo: testo → anteprima; voce → durata; media/file → nome o dimensione.
  const sub =
    item.type === 'text' ? (item.preview?.trim() || 'Testo')
    : item.type === 'audio_recording' ? (item.duration ? fmtClock(item.duration) : 'Memo vocale')
    : (item.fileName?.trim() || (item.size ? fmtBytes(item.size) : meta.label));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: c.field, borderWidth: 1, borderColor: c.line2, borderRadius: 12, padding: 10 }}>
      {hasThumb ? (
        <Image source={{ uri: item.thumbnail ?? item.uri }} style={{ width: 42, height: 42, borderRadius: 9 }} resizeMode="cover" />
      ) : (
        <View style={{ width: 42, height: 42, borderRadius: 9, backgroundColor: col + (c.dark ? '2e' : '1c'), alignItems: 'center', justifyContent: 'center' }}>
          <meta.Icon size={19} color={col} strokeWidth={1.8} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: c.text }}>{meta.label}</Text>
        <Text numberOfLines={1} style={{ fontSize: 12, color: c.subtle, marginTop: 1 }}>{sub}</Text>
      </View>
      {onRemove ? (
        <Pressable onPress={onRemove} hitSlop={8} accessibilityLabel="Rimuovi spark" style={{ padding: 6 }}>
          <IconX size={16} color={c.subtle} strokeWidth={1.8} />
        </Pressable>
      ) : null}
    </View>
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
          <IconMicrophone size={20} color={col} strokeWidth={1.8} />
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
}

export function ObsidianCaptureScreen({
  bufferCount, onCapture, onSaveNote, onSend, onOpenBuffer, onNavigateView, onSettings,
  options, onOptionsChange, suggestText, items, onRemoveItem, onAsk,
}: ObsidianCaptureScreenProps = {}) {
  const c = useObsidian();
  const insets = useSafeAreaInsets();
  const [drawer, setDrawer] = React.useState(false);
  const [voice, setVoice] = React.useState(false);
  const [actionOpen, setActionOpen] = React.useState(false);
  // Testo della nota in composizione (spark testuale creato al tocco di Salva).
  const [note, setNote] = React.useState('');
  const hasNote = note.trim().length > 0;
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
    onSaveNote?.(t);
    setNote('');
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.dark ? '#000000' : c.canvas }}>
      <ObsidianStatusBar />
      <CaptureHeader onMenu={() => setDrawer(true)} onAsk={onAsk} onNavigateView={onNavigateView} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 18, paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
        {/* Composer nota — campo di scrittura + toolbar (canali media + Salva).
            Il testo digitato è lo spark "text"; i cinque pulsanti avviano gli
            altri canali di cattura, il Salva aggiunge la nota al buffer. */}
        <View style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line2, borderRadius: 16, padding: 14 }}>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Scrivi una nota…"
            placeholderTextColor={c.subtle}
            multiline
            textAlignVertical="top"
            // paddingRight: lascia spazio al mic in alto a destra così la prima
            // riga di testo non ci finisce sotto.
            style={{ minHeight: 96, fontSize: 16, lineHeight: 24, color: c.text, paddingTop: 0, paddingBottom: 0, paddingLeft: 0, paddingRight: 34 }}
          />

          {/* Mic in sovraimpressione (dettatura vocale). In ascolto → accent
              acceso; a riposo → subtle. Equivale al microfono della tastiera. */}
          <Pressable
            onPress={() => dictation.toggle(note)}
            accessibilityLabel={dictation.listening ? 'Ferma dettatura' : 'Detta la nota'}
            hitSlop={8}
            android_ripple={{ color: c.accent + '33', borderless: true }}
            style={{ position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: dictation.listening ? c.accent + '2E' : 'transparent' }}
          >
            <IconMicrophone size={17} color={dictation.listening ? c.accent : c.subtle} strokeWidth={1.9} />
          </Pressable>

          {/* Nota vuota → canali di cattura. Mentre scrivi → solo Salva (le
              icone spariscono): la barra ha una funzione sola alla volta. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 }}>
            {hasNote ? (
              <>
                <View style={{ flex: 1 }} />
                <Pressable
                  onPress={saveNote}
                  accessibilityLabel="Salva nota"
                  android_ripple={{ color: c.accent + '33' }}
                  style={{ paddingHorizontal: 18, minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accent + '1F', borderWidth: 1, borderColor: c.accent }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '600', color: c.accent }}>Salva</Text>
                </Pressable>
              </>
            ) : (
              TOOLBAR.map((key) => {
                const { Icon, label } = CAPS[key];
                return (
                  <Pressable
                    key={key}
                    onPress={() => { if (onCapture) onCapture(key); else if (key === 'voice') setVoice(true); }}
                    accessibilityLabel={label}
                    android_ripple={{ color: c.accent + '33', borderless: false }}
                    style={{ width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.line2 }}
                  >
                    <Icon size={23} color={c.muted} strokeWidth={1.8} />
                  </Pressable>
                );
              })
            )}
          </View>
        </View>

        {/* Azione — toggle: chiuso è la pillola "+ Azione", aperto è il pannello
            AZIONE (che porta il proprio "Chiudi"). */}
        {actionOpen ? (
          <SetOptionsBody
            options={opts}
            onChange={setOpts}
            onClose={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setActionOpen(false); }}
            suggestText={suggestText}
          />
        ) : (
          <Pressable
            onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setActionOpen(true); }}
            android_ripple={{ color: c.accent + '22' }}
            style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, minHeight: 36, borderRadius: 10, borderWidth: 1, borderColor: c.line2, marginTop: 14 }}
          >
            <IconPlus size={15} color={c.muted} strokeWidth={2} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: c.muted }}>Azione</Text>
          </Pressable>
        )}

        {/* Spark catturati — anteprima sotto le options, invariata. Ogni riga
            mostra tipo/anteprima e permette di rimuoverla dal buffer. */}
        {list.length > 0 && (
          <View style={{ marginTop: 14, gap: 8 }}>
            {list.map((it) => (
              <SparkRow key={it.id} c={c} item={it} onRemove={onRemoveItem ? () => onRemoveItem(it.id) : undefined} />
            ))}
          </View>
        )}
      </ScrollView>

      <ObsidianNavPill />

      {/* FAB Send — sovraimpressione in basso a destra, presente SOLO quando c'è
          almeno uno spark da inviare. */}
      {canSend && (
        <Pressable
          onPress={onSend}
          accessibilityLabel="Invia a Gimmick"
          android_ripple={{ color: c.accent + '40', borderless: true }}
          style={{ position: 'absolute', right: 20, bottom: insets.bottom + 24 }}
        >
          <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line2, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 8 }}>
            <IconSend size={24} color={c.text} strokeWidth={1.8} />
          </View>
        </Pressable>
      )}

      {/* Overlays */}
      <ObsidianDrawer open={drawer} onClose={() => setDrawer(false)} onNavigateView={onNavigateView} onSettings={onSettings} />
      <VoiceSheet open={voice} onClose={() => setVoice(false)} />
    </View>
  );
}
