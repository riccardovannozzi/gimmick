/**
 * Gimmick · Obsidian — Mobile Tile detail (Inspector).
 *
 * Tile editor: event chip + title, action/timing segmented, date & time, tag,
 * type & status, and the SPARKS strip (caps + voice card + text card), with a
 * Save bar. Reference: GimmickMobileTile.dc.html. Reuses the mobile shell.
 */
import React from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Modal } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as TablerIcons from '@tabler/icons-react-native';
import {
  IconArrowLeft, IconTrash, IconDots, IconClock, IconAlertCircle, IconCalendarEvent,
  IconNote, IconCheckbox, IconCalendar, IconTag, IconPhone, IconCircleCheck,
  IconPlayerPlay, IconChevronDown, IconCheck,
  IconCamera, IconVideo, IconPhoto, IconAlignLeft, IconMicrophone, IconPaperclip,
} from '@tabler/icons-react-native';
import { useObsidian } from '@/lib/obsidian';
import { OB_BTN_H, type ObsidianColors } from '@/constants/obsidian';
import type { Tile, Spark } from '@/types';
import { formatDuration } from '@/utils/formatters';
import { ObsidianStatusBar } from '../StatusBar';
import { ObsidianNavPill } from '../NavPill';
import { PreviewImage } from '../PreviewImage';
import { SparkViewer } from '../SparkViewer';

/**
 * Corpo del testo della schermata, in un punto solo.
 *
 * 15/20 è la misura del titolo del tile nella lista (ViewsScreen.TileCard),
 * verificata leggibile sul dispositivo. Il web usa 12.5 per quasi tutto, ma
 * quei numeri sono tarati per un monitor a 60cm: sul telefono risulterebbero
 * più piccoli del testo che nella lista si legge già bene.
 *
 * Gli eyebrow di sezione restano il SECONDO livello della scala e non seguono
 * questa costante: portarli a 15 li renderebbe indistinguibili dai valori.
 */
const TILE_TEXT = 15;
const TILE_LINE = 20;

// Risoluzione icone Tabler per nome, come ViewsScreen: i tipi e gli stati
// salvano il glifo come stringa (es. "IconBuilding").
type TablerGlyph = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
const TablerMap = TablerIcons as unknown as Record<string, TablerGlyph>;
const resolveGlyph = (name?: string | null): TablerGlyph | undefined => (name ? TablerMap[name] : undefined);

// ─── Atoms ────────────────────────────────────────────────────────────────────
function Eyebrow({ c, children }: { c: ObsidianColors; children: React.ReactNode }) {
  return <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1.3, color: c.subtle, marginBottom: 9 }}>{children}</Text>;
}
function Section({ c, eyebrow, children }: { c: ObsidianColors; eyebrow: string; children: React.ReactNode }) {
  return <View style={{ marginTop: 20 }}><Eyebrow c={c}>{eyebrow}</Eyebrow>{children}</View>;
}
function Field({ c, value, Icon, iconColor, chev, onPress, placeholder }: {
  // L'icona può arrivare come glifo importato (IconClock…) o risolta per nome
  // da `resolveGlyph`, che ha una firma più stretta: il campo accetta entrambi.
  c: ObsidianColors; value: string; Icon?: typeof IconClock | TablerGlyph; iconColor?: string;
  chev?: boolean; onPress?: () => void; placeholder?: boolean;
}) {
  // `Pressable` solo quando c'è qualcosa da aprire: senza `onPress` resta un
  // View, così non finge di essere toccabile.
  const Box = onPress ? Pressable : View;
  return (
    // Senza bordo, come il campo TITOLO: i controlli si staccano dal fondo per
    // la sola superficie `field`.
    // `minHeight` e non `height`: se il valore va a capo il campo cresce invece
    // di tagliarlo, e regge l'ingrandimento dei caratteri di sistema. Senza,
    // l'altezza era il risultato accidentale di padding + interlinea (≈44) e
    // non combaciava con i controlli che usano il token.
    <Box
      {...(onPress ? { onPress, android_ripple: { color: c.accent + '22' } } : {})}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: OB_BTN_H, backgroundColor: c.field, borderRadius: 11, paddingHorizontal: 13, paddingVertical: 12, overflow: 'hidden' }}
    >
      {Icon ? <Icon size={16} color={iconColor ?? c.subtle} strokeWidth={1.8} /> : null}
      <Text numberOfLines={1} style={{ flex: 1, fontSize: TILE_TEXT, color: placeholder ? c.subtle : c.text }}>{value}</Text>
      {chev ? <IconChevronDown size={14} color={c.subtle} strokeWidth={1.8} /> : null}
    </Box>
  );
}

/** Voce di un elenco a scelta singola (TIPO, STATUS). */
export interface PickOption { id: string; name: string; icon?: string; color?: string }

/**
 * Foglio di scelta singola, dal basso. Serve a TIPO e STATUS, che sul web sono
 * due dropdown: su mobile un menu a discesa ancorato al campo è scomodo da
 * centrare col pollice, mentre il foglio arriva da dove la mano già sta.
 * Include sempre la voce "nessuno": un tipo o uno stato devono poter essere
 * tolti, non solo cambiati.
 */
function PickerSheet({ c, open, title, options, selectedId, emptyLabel, onPick, onClose }: {
  c: ObsidianColors; open: boolean; title: string; options: PickOption[];
  selectedId?: string | null; emptyLabel: string;
  onPick: (id: string | null) => void; onClose: () => void;
}) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }} onPress={onClose} accessibilityLabel="Chiudi">
        <View style={{ maxHeight: '75%', backgroundColor: c.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16 }}>
          <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1.3, color: c.subtle, marginBottom: 10 }}>{title}</Text>
          <ScrollView>
            <Pressable
              onPress={() => { onPick(null); onClose(); }}
              android_ripple={{ color: c.accent + '22' }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: OB_BTN_H, paddingHorizontal: 6, borderRadius: 8 }}
            >
              <View style={{ width: 15, height: 15, borderRadius: 8, borderWidth: 1.5, borderColor: c.subtle }} />
              <Text style={{ flex: 1, fontSize: TILE_TEXT, color: c.text }}>{emptyLabel}</Text>
              {!selectedId && <IconCheck size={17} color={c.accent} strokeWidth={2} />}
            </Pressable>
            {options.map((o) => {
              const on = o.id === selectedId;
              const G = resolveGlyph(o.icon);
              return (
                <Pressable
                  key={o.id}
                  onPress={() => { onPick(on ? null : o.id); onClose(); }}
                  android_ripple={{ color: c.accent + '22' }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: OB_BTN_H, paddingHorizontal: 6, borderRadius: 8 }}
                >
                  {G
                    ? <G size={17} color={o.color ?? (on ? c.accent : c.subtle)} strokeWidth={1.8} />
                    : <View style={{ width: 15, height: 15, borderRadius: 8, backgroundColor: o.color ?? c.subtle }} />}
                  <Text numberOfLines={1} style={{ flex: 1, fontSize: TILE_TEXT, color: c.text }}>{o.name}</Text>
                  {on && <IconCheck size={17} color={c.accent} strokeWidth={2} />}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

/**
 * Le CINQUE azioni del tile, in un gruppo solo — come la sidebar web.
 *
 * Prima il mobile le spezzava in due controlli separati (un segmented
 * Scadenza/Giornata/A orario + una coppia Note/To-do), che raccontava una
 * gerarchia inesistente: sono cinque valori dello stesso campo, mutuamente
 * esclusivi. `Daily` e `Timing` sono entrambe `event` e si distinguono per
 * `all_day`, per questo la chiave non basta come identificatore.
 */
type ActionOpt = {
  key: string;
  label: string;
  Icon: typeof IconClock;
  patch: { action_type: string; is_event: boolean; all_day: boolean };
};
const ACTIONS: ActionOpt[] = [
  { key: 'none', label: 'Note', Icon: IconNote, patch: { action_type: 'none', is_event: false, all_day: false } },
  { key: 'anytime', label: 'To-do', Icon: IconCheckbox, patch: { action_type: 'anytime', is_event: false, all_day: false } },
  { key: 'deadline', label: 'Due', Icon: IconAlertCircle, patch: { action_type: 'deadline', is_event: false, all_day: false } },
  { key: 'allday', label: 'Daily', Icon: IconCalendarEvent, patch: { action_type: 'event', is_event: true, all_day: true } },
  { key: 'timed', label: 'Timing', Icon: IconClock, patch: { action_type: 'event', is_event: true, all_day: false } },
];

const pad2 = (n: number) => String(n).padStart(2, '0');
/** "gg/mm/aaaa" — stesso formato della sidebar web. */
const fmtDate = (d: Date) => `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
const fmtTime = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
/** Data valida o `null` — le stringhe dal server possono essere assenti o rotte. */
function parseIso(s?: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
/** Durata in ore fra inizio e fine, come la mostra il web ("1 h"). */
function durationLabel(start: Date | null, end: Date | null): string {
  if (!start || !end) return '—';
  const min = Math.round((end.getTime() - start.getTime()) / 60000);
  if (min <= 0) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h && m ? `${h}h ${m}m` : h ? `${h} h` : `${m} m`;
}
/** Riporta l'ora di `time` sul giorno di `day`, senza toccare il resto. */
function combine(day: Date, time: Date): Date {
  const out = new Date(day);
  out.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return out;
}

/** Chiave dell'azione attiva a partire dal tile. */
function activeActionKey(t?: Tile): string {
  if (!t) return 'none';
  if (t.action_type === 'event') return t.all_day ? 'allday' : 'timed';
  return t.action_type ?? 'none';
}

/**
 * Canali del composer, nell'ordine della sidebar web: foto · immagine · video ·
 * testo · voce · file. Le chiavi corrispondono alle rotte sotto `app/capture/`,
 * che accettano tutte `?tile=<id>` e agganciano lo spark al tile giusto.
 */
export type CaptureKey = 'photo' | 'gallery' | 'video' | 'text' | 'voice' | 'file';
const CAPS: Array<{ key: CaptureKey; label: string; Icon: typeof IconCamera }> = [
  { key: 'photo', label: 'Scatta una foto', Icon: IconCamera },
  { key: 'gallery', label: 'Scegli un\'immagine', Icon: IconPhoto },
  { key: 'video', label: 'Registra un video', Icon: IconVideo },
  { key: 'text', label: 'Scrivi un testo', Icon: IconAlignLeft },
  { key: 'voice', label: 'Registra un vocale', Icon: IconMicrophone },
  { key: 'file', label: 'Allega un file', Icon: IconPaperclip },
];

/**
 * Lato dei tondi di cattura. 48 e non 52 come la barra della home: su uno
 * schermo da 360 restano 328 di larghezza utile (16 di rientro per lato), e a
 * 52 i sei pulsanti lascerebbero appena 3 di spazio fra l'uno e l'altro — sotto
 * gli 8 minimi fra due bersagli, cioè tocchi presi dal pulsante sbagliato. A 48
 * i vuoti tornano esattamente a 8, e 48 è comunque il minimo Material.
 */
const COMPOSER_BTN = 48;
const VOICE_BARS = [8, 14, 20, 12, 24, 30, 18, 10, 22, 28, 16, 9, 15, 22, 13, 18, 10];

/**
 * Altezza dei media nell'elenco sparks. Il doppio dei 60 della lista Tiles: qui
 * lo spazio c'è e la foto è il contenuto, non un indizio di cosa contiene la
 * card. Come là, l'immagine si mostra intera e la larghezza segue le
 * proporzioni.
 */
const SPARK_MEDIA_H = 120;

/** Glifo per tipo di spark, per la riga di ripiego (file senza anteprima). */
const SPARK_GLYPH: Record<string, typeof IconCamera> = {
  photo: IconCamera,
  image: IconPhoto,
  video: IconVideo,
  text: IconAlignLeft,
  audio_recording: IconMicrophone,
  file: IconPaperclip,
};

/**
 * Percorso del file da mostrare per uno spark, `null` se non ne ha uno.
 *
 * Preferisce SEMPRE la miniatura: pesa una frazione dell'originale e a 128 di
 * altezza non si distingue. Sull'originale si ripiega solo per le immagini —
 * per un video `storage_path` è un mp4, che `Image` non sa disegnare, e per un
 * PDF è il documento: senza miniatura quegli spark prendono la riga con icona
 * e nome, che è informazione vera, non un riquadro rotto.
 *
 * Esportata perché il layer dati deve sapere quali percorsi firmare (il bucket
 * è privato) prima ancora di disegnare.
 */
export function sparkMediaPath(s: Spark): string | null {
  const isImage = s.type === 'photo' || s.type === 'image' || !!s.mime_type?.startsWith('image/');
  if (isImage) return s.thumbnail_path ?? s.storage_path ?? null;
  return s.thumbnail_path ?? null;
}

/**
 * Una scheda per spark, scelta dal tipo: testo, vocale, media con anteprima,
 * oppure riga con icona e nome quando l'anteprima non c'è.
 */
function SparkCard({ c, spark, uri, onOpen }: { c: ObsidianColors; spark: Spark; uri?: string; onOpen?: () => void }) {
  // Toccabile solo se c'è davvero un file da aprire: senza `onOpen` resta un
  // View, così non finge di reagire.
  const Box = onOpen ? Pressable : View;
  const box = onOpen ? { onPress: onOpen, android_ripple: { color: '#ffffff14' } } : {};

  if (spark.type === 'text') {
    return (
      <View style={{ backgroundColor: c.field, borderWidth: 1, borderColor: c.line, borderRadius: 12, overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: c.line }}>
          <IconAlignLeft size={14} color={c.cap.text} strokeWidth={1.8} />
          <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: c.subtle }}>TESTO</Text>
        </View>
        <Text numberOfLines={6} style={{ paddingHorizontal: 12, paddingVertical: 11, fontSize: TILE_TEXT, lineHeight: TILE_LINE, color: c.muted }}>
          {spark.content?.trim() || ''}
        </Text>
      </View>
    );
  }

  if (spark.type === 'audio_recording') {
    return (
      <Box {...box} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.field, borderWidth: 1, borderColor: c.line, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 12 }}>
        <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: c.cap.voice, alignItems: 'center', justifyContent: 'center' }}>
          <IconPlayerPlay size={19} color="#fff" fill="#fff" />
        </View>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2, height: 22 }}>
          {VOICE_BARS.map((v, i) => <View key={i} style={{ width: 2.5, height: v, borderRadius: 2, backgroundColor: i < 6 ? c.cap.voice : c.line2 }} />)}
        </View>
        <Text style={{ fontSize: 11, color: c.subtle, fontVariant: ['tabular-nums'] }}>
          {spark.duration ? formatDuration(spark.duration) : ''}
        </Text>
      </Box>
    );
  }

  if (uri) {
    return (
      // `alignSelf: flex-start` fa stringere il riquadro attorno all'immagine:
      // l'immagine si mostra INTERA, quindi la sua larghezza dipende dalle
      // proporzioni e non è più quella della schermata. Senza, la fascia col
      // nome resterebbe larga quanto la card, staccata dalla foto.
      <Box {...box} style={{ alignSelf: 'flex-start', borderRadius: 12, overflow: 'hidden' }}>
        <PreviewImage c={c} uri={uri} height={SPARK_MEDIA_H} radius={12} />
        {spark.type === 'video' ? (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}>
              <IconPlayerPlay size={20} color="#fff" fill="#fff" />
            </View>
          </View>
        ) : null}
        {/* Il nome sta su una fascia opaca in basso, non sopra l'immagine: su una
            foto chiara il testo bianco sparirebbe. */}
        {spark.file_name ? (
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 10, paddingVertical: 6 }}>
            <Text numberOfLines={1} style={{ fontSize: 12.5, color: '#fff' }}>{spark.file_name}</Text>
          </View>
        ) : null}
      </Box>
    );
  }

  const Glyph = SPARK_GLYPH[spark.type] ?? IconPaperclip;
  return (
    <Box {...box} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.field, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 }}>
      <View style={{ width: 36, height: 36, borderRadius: 9, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' }}>
        <Glyph size={18} color={c.muted} strokeWidth={1.8} />
      </View>
      <Text numberOfLines={1} style={{ flex: 1, fontSize: TILE_TEXT, color: c.text }}>
        {spark.file_name || spark.type}
      </Text>
    </Box>
  );
}

export interface ObsidianTileScreenProps {
  onBack?: () => void;
  /** API tile (with sparks). Omit for the static QA mockup. */
  tile?: Tile;
  loading?: boolean;
  /**
   * Salvataggio IMMEDIATO di un campo, come la sidebar web: ogni controllo
   * scrive appena cambia e non esiste una barra Salva. Assente nel mockup QA,
   * dove i controlli restano decorativi.
   */
  onPatch?: (updates: Record<string, unknown>) => void;
  /** Tipi disponibili e tipo assegnato al tile (vive in una tabella a parte). */
  types?: PickOption[];
  typeId?: string | null;
  onSelectType?: (id: string | null) => void;
  /** Stati disponibili; quello del tile sta in `tile.status_id`. */
  statuses?: PickOption[];
  /** Apre un canale di cattura agganciato a questo tile. */
  onCapture?: (key: CaptureKey) => void;
  /**
   * URL firmati dei media degli sparks, per percorso. Il bucket è privato: senza
   * firma non c'è immagine da mostrare. Li risolve il layer dati, in una
   * richiesta sola — vedi `sparkMediaPath`.
   */
  mediaUrls?: Map<string, string>;
}

export function ObsidianTileScreen({
  onBack, tile, loading, onPatch, types = [], typeId, onSelectType, statuses = [],
  onCapture, mediaUrls,
}: ObsidianTileScreenProps) {
  const c = useObsidian();
  const live = !!tile;
  const sparks: Spark[] = tile?.sparks ?? [];
  const tagName = tile?.tags?.find((tg) => !tg.is_root)?.name;
  const sparksCount = sparks.length;

  // Titolo: stato locale mentre si scrive, scritto sul server all'uscita dal
  // campo. Salvare a ogni battuta manderebbe una richiesta per carattere.
  const serverTitle = live ? (tile?.title ?? '') : 'OM/call con barbini';
  const [title, setTitle] = React.useState(serverTitle);
  React.useEffect(() => { setTitle(serverTitle); }, [serverTitle]);
  const commitTitle = () => {
    const next = title.trim();
    if (next !== (serverTitle ?? '').trim()) onPatch?.({ title: next });
  };

  // Commit anche allo SMONTAGGIO. Con il solo `onBlur` una modifica si perdeva
  // in silenzio: premendo Indietro con il campo ancora a fuoco la schermata si
  // smonta e l'evento di blur può non arrivare mai. Il ref tiene l'ultimo
  // valore perché la funzione di pulizia gira una volta sola, alla chiusura, e
  // catturerebbe altrimenti lo stato del primo render.
  const latest = React.useRef({ title, serverTitle, onPatch });
  latest.current = { title, serverTitle, onPatch };
  React.useEffect(() => () => {
    const { title: t, serverTitle: s, onPatch: p } = latest.current;
    const next = t.trim();
    if (next !== (s ?? '').trim()) p?.({ title: next });
  }, []);

  const activeAction = activeActionKey(tile);
  const isTimed = activeAction === 'timed';
  const hasWhen = activeAction !== 'none' && activeAction !== 'anytime';

  // Data e orari veri, presi dal tile. Prima erano tre stringhe scritte a mano.
  const start = parseIso(tile?.start_at);
  const end = parseIso(tile?.end_at);
  const day = start ?? end;

  // Un solo selettore nativo alla volta: `picking` dice quale campo sta
  // chiedendo un valore, così i tre campi condividono lo stesso componente.
  const [picking, setPicking] = React.useState<null | 'date' | 'start' | 'end'>(null);
  const [sheet, setSheet] = React.useState<null | 'type' | 'status'>(null);
  /** Spark aperto a schermo intero; `null` = visore chiuso. */
  const [viewing, setViewing] = React.useState<Spark | null>(null);

  /** Applica il valore scelto dal selettore nativo al campo che l'ha aperto. */
  const applyPicked = (picked: Date) => {
    const base = day ?? new Date();
    if (picking === 'date') {
      // Cambia il GIORNO conservando gli orari già impostati.
      const nextStart = start ? combine(picked, start) : picked;
      const nextEnd = end ? combine(picked, end) : null;
      onPatch?.({ start_at: nextStart.toISOString(), ...(nextEnd ? { end_at: nextEnd.toISOString() } : {}) });
    } else if (picking === 'start') {
      const nextStart = combine(base, picked);
      // La fine non può precedere l'inizio: la si trascina avanti mantenendo la
      // durata, altrimenti si otterrebbe un evento di durata negativa.
      const keep = start && end ? end.getTime() - start.getTime() : 0;
      const nextEnd = end ? new Date(nextStart.getTime() + Math.max(keep, 0)) : null;
      onPatch?.({ start_at: nextStart.toISOString(), ...(nextEnd ? { end_at: nextEnd.toISOString() } : {}) });
    } else if (picking === 'end') {
      const nextEnd = combine(base, picked);
      onPatch?.({ end_at: nextEnd.toISOString() });
    }
    setPicking(null);
  };

  const typeName = types.find((t) => t.id === typeId)?.name;
  const typeMeta = types.find((t) => t.id === typeId);
  const statusMeta = statuses.find((s) => s.id === tile?.status_id);

  return (
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
      <ObsidianStatusBar />

      {/* Top bar */}
      <View style={{ height: 52, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: c.line }}>
        <Pressable onPress={onBack} hitSlop={6} style={({ pressed }) => ({ width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
          <IconArrowLeft size={18} color={c.muted} strokeWidth={1.8} />
        </Pressable>
        <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: c.subtle }}>Dettaglio tile</Text>
        <View style={{ width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}><IconTrash size={16} color={c.muted} strokeWidth={1.8} /></View>
        <View style={{ width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}><IconDots size={16} color={c.muted} strokeWidth={1.8} /></View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 24 }}>
        {/* TITOLO — campo editabile, come il web. Prima qui c'erano un chip con
            la data e un titolo in sola lettura: il chip ripeteva un'informazione
            già presente in DATA E ORARIO, e il titolo non si poteva cambiare. */}
        <Section c={c} eyebrow="TITOLO">
          <TextInput
            value={loading ? '' : title}
            onChangeText={setTitle}
            onBlur={commitTitle}
            editable={!!onPatch}
            placeholder={loading ? 'Caricamento…' : 'Titolo…'}
            placeholderTextColor={c.subtle}
            multiline
            // Senza bordo: il campo si stacca dal fondo per la sola superficie
            // `field`, come nella sidebar web.
            style={{ fontSize: TILE_TEXT, lineHeight: TILE_LINE, color: c.text, backgroundColor: c.field, borderRadius: 11, paddingHorizontal: 13, paddingVertical: 12, minHeight: OB_BTN_H }}
          />
        </Section>

        {/* AZIONE — i cinque valori in un contenitore unico, 2 + 3 su due righe.
            Ogni bottone scrive subito: niente barra Salva, come il web. */}
        <Section c={c} eyebrow="AZIONE">
          <View style={{ gap: 6, backgroundColor: c.canvas, borderRadius: 10, padding: 6 }}>
            {[ACTIONS.slice(0, 2), ACTIONS.slice(2)].map((row, ri) => (
              <View key={ri} style={{ flexDirection: 'row', gap: 6 }}>
                {row.map((a) => {
                  const on = a.key === activeAction;
                  return (
                    <Pressable
                      key={a.key}
                      onPress={onPatch ? () => onPatch(a.patch) : undefined}
                      disabled={!onPatch}
                      android_ripple={{ color: c.accent + '22' }}
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: OB_BTN_H, borderRadius: 8, backgroundColor: on ? c.accent + '2E' : c.accent + '14' }}
                    >
                      <a.Icon size={14} color={on ? c.accent : c.muted} strokeWidth={1.8} />
                      <Text numberOfLines={1} style={{ fontSize: TILE_TEXT, fontWeight: '600', color: on ? c.accent : c.text }}>{a.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </Section>

        {/* DATA E ORARIO — valori veri dal tile, toccabili. La riga degli orari
            compare solo per gli eventi a orario: una scadenza o una giornata
            intera non hanno un'ora, e mostrarne una era parte del finto. */}
        {hasWhen && (
          <Section c={c} eyebrow="DATA E ORARIO">
            <View style={{ gap: 8 }}>
              <Field
                c={c}
                value={day ? fmtDate(day) : 'Scegli una data'}
                placeholder={!day}
                Icon={IconCalendar}
                onPress={onPatch ? () => setPicking('date') : undefined}
              />
              {isTimed && (
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Field c={c} value={start ? fmtTime(start) : '--:--'} placeholder={!start} Icon={IconClock} onPress={onPatch ? () => setPicking('start') : undefined} />
                  </View>
                  {/* Durata: sola lettura, come sul web — si cambia spostando gli
                      estremi, non digitandola. */}
                  <Text style={{ fontSize: TILE_TEXT, color: c.subtle, minWidth: 46, textAlign: 'center' }}>{durationLabel(start, end)}</Text>
                  <View style={{ flex: 1 }}>
                    <Field c={c} value={end ? fmtTime(end) : '--:--'} placeholder={!end} Icon={IconClock} onPress={onPatch ? () => setPicking('end') : undefined} />
                  </View>
                </View>
              )}
            </View>
          </Section>
        )}

        {/* Tag */}
        <Section c={c} eyebrow="TAG">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: OB_BTN_H, backgroundColor: c.accentSoft, borderRadius: 11, paddingHorizontal: 13, paddingVertical: 12 }}>
            <IconTag size={16} color={c.accent} strokeWidth={1.8} />
            <Text style={{ fontSize: TILE_TEXT, fontWeight: '500', color: c.accent }}>{live ? (tagName ?? 'Senza tag') : 'Golfo del Sole'}</Text>
          </View>
        </Section>

        {/* TIPO e STATUS — due sezioni separate a piena larghezza, come il web.
            Affiancate in una sola sezione i due valori si troncavano, e la
            gerarchia suggeriva un legame fra i campi che non esiste. */}
        <Section c={c} eyebrow="TIPO">
          <Field
            c={c}
            value={typeName ?? 'Nessun tipo'}
            placeholder={!typeName}
            Icon={resolveGlyph(typeMeta?.icon) ?? IconPhone}
            iconColor={typeMeta?.color ?? c.muted}
            chev
            onPress={onSelectType ? () => setSheet('type') : undefined}
          />
        </Section>

        <Section c={c} eyebrow="STATUS">
          <Field
            c={c}
            value={statusMeta?.name ?? 'Nessuno stato'}
            placeholder={!statusMeta}
            Icon={resolveGlyph(statusMeta?.icon) ?? IconCircleCheck}
            iconColor={statusMeta?.color ?? c.muted}
            chev
            onPress={onPatch ? () => setSheet('status') : undefined}
          />
        </Section>

        {/* Sparks */}
        <Section c={c} eyebrow={`SPARKS · ${sparksCount}`}>
          {/* CANALI DI CATTURA — solo i sei tondi, senza riquadro attorno.
              Il campo nota che stava sopra è stato tolto: il canale "testo" apre
              già l'editor completo, quindi il riquadro conteneva un secondo modo
              di fare la stessa cosa e disegnava un contenitore attorno a pulsanti
              che si leggono benissimo da soli. */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            {CAPS.map((cap) => (
              <Pressable
                key={cap.key}
                onPress={onCapture ? () => onCapture(cap.key) : undefined}
                disabled={!onCapture}
                accessibilityLabel={cap.label}
                android_ripple={{ color: '#ffffff22' }}
                style={{ width: COMPOSER_BTN, height: COMPOSER_BTN, borderRadius: COMPOSER_BTN / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: '#3a3a3a' }}
              >
                <cap.Icon size={22} color={c.dark ? '#FFFFFF' : c.text} strokeWidth={1.8} />
              </Pressable>
            ))}
          </View>

          {/* ELENCO SPARKS — prima c'erano DUE schede fisse, una vocale e una di
              testo, e nient'altro: un tile di sole foto mostrava "SPARKS · 2" e
              sotto il vuoto. Ora si disegna ogni spark, nell'ordine in cui è
              stato aggiunto, con la scheda che gli compete. */}
          {sparks.length > 0 && (
            <View style={{ marginTop: 12, gap: 10 }}>
              {sparks.map((s) => {
                const path = sparkMediaPath(s);
                return (
                  <SparkCard
                    key={s.id}
                    c={c}
                    spark={s}
                    uri={path ? mediaUrls?.get(path) : undefined}
                    // Solo chi ha un file si apre. Uno spark di testo non ha
                    // niente da mostrare a schermo pieno: il suo contenuto è già
                    // tutto lì nella scheda.
                    onOpen={s.storage_path ? () => setViewing(s) : undefined}
                  />
                );
              })}
            </View>
          )}
        </Section>
      </ScrollView>

      {/* Niente barra Annulla/Salva: il modello è quello del web, ogni controllo
          scrive appena cambia. La barra qui non salvava comunque nulla — il
          pulsante Salva non aveva `onPress`. */}

      {/* Selettore nativo di data/ora: uno solo, condiviso dai tre campi.
          `display: default` lascia ad Android il suo dialogo, che l'utente
          riconosce già. Su annullamento `type` è 'dismissed' e non si tocca nulla. */}
      {picking && (
        <DateTimePicker
          value={(picking === 'end' ? end : picking === 'start' ? start : day) ?? new Date()}
          mode={picking === 'date' ? 'date' : 'time'}
          is24Hour
          onChange={(ev, d) => {
            if (ev.type !== 'set' || !d) { setPicking(null); return; }
            applyPicked(d);
          }}
        />
      )}

      <PickerSheet
        c={c}
        open={sheet === 'type'}
        title="TIPO"
        options={types}
        selectedId={typeId ?? null}
        emptyLabel="Nessun tipo"
        onPick={(id) => onSelectType?.(id)}
        onClose={() => setSheet(null)}
      />
      <PickerSheet
        c={c}
        open={sheet === 'status'}
        title="STATUS"
        options={statuses}
        selectedId={tile?.status_id ?? null}
        emptyLabel="Nessuno stato"
        onPick={(id) => onPatch?.({ status_id: id })}
        onClose={() => setSheet(null)}
      />

      <SparkViewer spark={viewing} onClose={() => setViewing(null)} />

      <ObsidianNavPill />
    </View>
  );
}
