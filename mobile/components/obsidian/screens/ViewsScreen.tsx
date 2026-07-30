/**
 * Gimmick · Obsidian — Mobile views (Tiles / Flows / Chrono / Settings).
 *
 * The primary mobile screens behind the TopNav switcher. Reference:
 * GimmickMobileViews.dc.html. Reuses the Obsidian mobile shell + tokens; tile /
 * flow / event colors come from the canonical scale.
 */
import React from 'react';
import { View, Text, Pressable, ScrollView, Modal, TextInput } from 'react-native';
import {
  IconBolt, IconTag, IconCategory, IconCircleCheck, IconChevronDown, IconTrash,
  IconHourglass, IconArrowBackUp, IconCheck, IconX, IconUser,
  IconChevronLeft, IconChevronRight, IconClock, IconAlertCircle,
  IconDeviceMobileVibration, IconBell, IconWorld, IconSparkles,
  IconArrowUp, IconCalendar, IconPlayerPause, IconLock,
  IconFilter, IconArrowsSort, IconSearch,
} from '@tabler/icons-react-native';
import * as TablerIcons from '@tabler/icons-react-native';
import { useObsidian } from '@/lib/obsidian';
import { OB_BTN_H, type ObsidianColors } from '@/constants/obsidian';
import {
  DEADLINE_BORDER, DEFAULT_ACTION_COLORS, STATUS_HEX, STATUS_HEX_FALLBACK,
  readableOn, type TileActionKey,
} from '@/constants/tile-colors';
import type { ObTileVM, ObFlowVM, ObChronoEvent } from '@/lib/obsidian-adapters';
import type { FlowHubFilter } from '@/types';
import { ObsidianStatusBar } from '../StatusBar';
import { ObsidianNavPill } from '../NavPill';
import { ObsidianAppHeader } from '../AppHeader';
import { ObsidianDrawer } from '../Drawer';
import type { MobileViewId } from '../TopNav';

/** Etichetta mostrata nell'header per la vista attiva. */
const VIEW_LABEL: Record<MobileViewId, string> = {
  tiles: 'Tiles', flows: 'Flows', chrono: 'Chrono', settings: 'Settings',
};

// Risoluzione icone Tabler per nome (come il web e il composer): i tipi salvano
// il glifo in `icon` (es. "IconBuilding").
type TablerGlyph = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
const TablerMap = TablerIcons as unknown as Record<string, TablerGlyph>;
const resolveGlyph = (name?: string | null): TablerGlyph | undefined => (name ? TablerMap[name] : undefined);

// ─── Shared atoms ─────────────────────────────────────────────────────────────
function Toggle({ c, value, onValueChange }: { c: ObsidianColors; value: boolean; onValueChange?: (v: boolean) => void }) {
  return (
    <Pressable onPress={() => onValueChange?.(!value)} accessibilityRole="switch" accessibilityState={{ checked: value }} style={{ width: 44, height: 26, borderRadius: 13, backgroundColor: value ? c.accent : c.line2, justifyContent: 'center' }}>
      <View style={{ position: 'absolute', left: value ? 21 : 3, width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' }} />
    </Pressable>
  );
}
function Segmented<T extends string>({ c, value, onChange, items }: { c: ObsidianColors; value: T; onChange?: (v: T) => void; items: Array<{ value: T; label: string }> }) {
  return (
    <View style={{ flexDirection: 'row', gap: 3, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.line, borderRadius: 10, padding: 3 }}>
      {items.map((it) => {
        const on = it.value === value;
        return (
          <Pressable key={it.value} onPress={() => onChange?.(it.value)} style={{ flex: 1, alignItems: 'center', minHeight: OB_BTN_H, justifyContent: 'center', borderRadius: 7, backgroundColor: on ? c.accentSoft : 'transparent' }}>
            <Text style={{ fontSize: 12.5, fontWeight: on ? '600' : '500', color: on ? c.accent : c.muted }}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── TILES ────────────────────────────────────────────────────────────────────
// La card è la TILE DEL CANVAS web (CanvasBoard) stesa a tutta larghezza: stessa
// velatura del colore del tipo, stessa colonna status a sinistra, stesso footer
// (badge azione · data/ora · badge tipo). Niente conteggio spark, come sul
// canvas. Live data via `lib/obsidian-adapters.tilesByInsertion`; il mock qui
// sotto alimenta la preview QA.
type Tile = ObTileVM;
const TILES_MOCK: Tile[] = [
  { id: 'm1', title: 'Contattare Giovanni domattina', actionType: 'event', allDay: false, date: '27/06/26', time: '11:30 - 12:30', completed: false, statusName: 'active', tags: [] },
  { id: 'm2', title: 'Marco al tramonto mediterraneo', actionType: 'none', allDay: false, completed: false, tags: [] },
  { id: 'm3', title: 'Audio e incontro con Marco', actionType: 'event', allDay: false, date: '26/06/26', time: '17:00 - 18:00', completed: false, statusName: 'paused', tags: [] },
  { id: 'm4', title: 'Appuntamento con Marco Guerrieri', actionType: 'anytime', allDay: false, completed: true, statusName: 'done', tags: [] },
  { id: 'm5', title: 'GDS/bisdomini', actionType: 'deadline', allDay: false, date: '26/06/26', completed: false, statusName: 'blocked', tags: [] },
];

/** Glifo del badge azione — stessi ruoli del canvas. La chiave 'none' (nota)
 *  non ha badge. Il COLORE arriva dai colori azione dell'utente, non dai token. */
const ACTION_ICON: Partial<Record<TileActionKey, typeof IconClock>> = {
  anytime: IconArrowUp,
  deadline: IconBolt,
  allday: IconCalendar,
  event: IconClock,
};
/** Chiave d'azione del canvas: allday è event + all_day. */
function actionKey(t: Tile): TileActionKey {
  if (t.actionType === 'event') return t.allDay ? 'allday' : 'event';
  return t.actionType;
}

/** Rappresentazione dello status nella colonna sinistra — mirror di
 *  `frontend/lib/status-meta.statusGlyph`. 'active' non si mostra: è il default. */
type StatusGlyph = { kind: 'none' } | { kind: 'dot' } | { kind: 'icon'; Icon: typeof IconClock } | { kind: 'text'; text: string };
function statusGlyph(name?: string): StatusGlyph {
  switch (name) {
    case 'done': return { kind: 'dot' };
    case 'paused': return { kind: 'icon', Icon: IconPlayerPause };
    case 'blocked': return { kind: 'icon', Icon: IconLock };
    case 'cancelled': return { kind: 'text', text: 'DELETE' };
    default: return { kind: 'none' };
  }
}

// ── Barra strumenti della lista: Filtra · Ordina · Ricerca ────────────────────
/** Criteri d'ordinamento della lista. Il default è l'ordine d'inserimento. */
type TileSort = 'recent' | 'oldest' | 'when' | 'title';
const SORT_LABEL: Record<TileSort, string> = {
  recent: 'Inserimento — più recenti',
  oldest: 'Inserimento — più vecchi',
  when: 'Data del tile',
  title: 'Titolo A-Z',
};
const SORT_ORDER: TileSort[] = ['recent', 'oldest', 'when', 'title'];

/** Dimensioni filtrabili; i valori disponibili si ricavano dai tile in lista. */
interface TileFilters {
  action: string[];
  tag: string[];
  type: string[];
  status: string[];
}
const EMPTY_FILTERS: TileFilters = { action: [], tag: [], type: [], status: [] };
const ACTION_FILTER_LABEL: Record<TileActionKey, string> = {
  none: 'Nota', anytime: 'To-do', deadline: 'Scadenza', event: 'Timing', allday: 'Giornata',
};
const STATUS_FILTER_LABEL: Record<string, string> = {
  active: 'Attivo', done: 'Completato', paused: 'In pausa', blocked: 'Bloccato', cancelled: 'Annullato',
};

/** Pulsante icona della barra (Filtra / Ordina). `on` = criterio attivo. */
function ToolBtn({ c, Icon, label, on, count, onPress }: {
  c: ObsidianColors; Icon: typeof IconTag; label: string; on?: boolean; count?: number; onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      android_ripple={{ color: c.accent + '22' }}
      style={{ width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.accent + '2E' : c.surface2 }}
    >
      <Icon size={19} color={on ? c.accent : c.text} strokeWidth={1.8} />
      {count ? (
        <View style={{ position: 'absolute', top: 4, right: 4, minWidth: 15, height: 15, borderRadius: 7.5, paddingHorizontal: 4, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 9.5, fontWeight: '700', color: c.accentInk }}>{count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** Chip a due stati usato dentro il pannello dei filtri. */
function ToggleChip({ c, label, on, color, onPress }: { c: ObsidianColors; label: string; on: boolean; color?: string; onPress: () => void }) {
  const col = color ?? c.accent;
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: col + '22' }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 34, paddingHorizontal: 11, borderRadius: 9, backgroundColor: on ? col + '2E' : c.surface2 }}
    >
      {color ? <View style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: col }} /> : null}
      <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '600', color: on ? col : c.text }}>{label}</Text>
    </Pressable>
  );
}

// Hairline neutra del perimetro, un filo sopra `line2`: la shell mobile è nero
// pieno e non `canvas` come la pagina del canvas web, quindi il bordo riceve
// meno aiuto dal contesto attorno.
const TILE_BORDER_DARK = 'rgba(255,255,255,0.22)';

function TileCard({ c, t, actionColors, onPress }: { c: ObsidianColors; t: Tile; actionColors: Record<TileActionKey, string>; onPress?: (id: string) => void }) {
  const action = actionKey(t);
  const isDeadline = action === 'deadline';
  // Bordo: rosso (tratteggiato) per le scadenze, altrimenti la tinta del tipo;
  // hairline neutra se il tile non ha un tipo assegnato.
  const neutralBorder = c.dark ? TILE_BORDER_DARK : c.line2;
  const borderColor = isDeadline ? DEADLINE_BORDER : (t.typeColor ? t.typeColor + '3A' : neutralBorder);
  // Fondo della card: il token standard della scala Obsidian — `surface`,
  // #1e1e1e in scuro e #ffffff in chiaro. Come la tile del canvas web.
  const cardBg = c.surface;
  const glyph = statusGlyph(t.statusName);
  const stCol = (t.statusName ? STATUS_HEX[t.statusName] : undefined) ?? STATUS_HEX_FALLBACK;
  const ActionIcon = ACTION_ICON[action];
  const actionColor = actionColors[action] ?? DEFAULT_ACTION_COLORS[action];
  const TypeIcon = resolveGlyph(t.typeIcon);
  // Lo stile della card è un OGGETTO, non una funzione. Con la forma funzione
  // `style={({ pressed }) => (...)}` restava senza fondo e senza bordo: si
  // vedeva la pagina attraverso, e l'unica cosa visibile era il velo del tipo
  // (un View sovrapposto, con stile a oggetto). Il feedback di pressione passa
  // da `android_ripple`, come già fanno ToolBtn e ToggleChip qui sopra.
  return (
    <Pressable
      onPress={onPress ? () => onPress(t.id) : undefined}
      disabled={!onPress}
      android_ripple={{ color: c.accent + '22' }}
      style={{
        borderRadius: 13, overflow: 'hidden', backgroundColor: cardBg,
        borderWidth: 1, borderColor,
        // `borderStyle` SOLO per le scadenze. Impostarlo anche quando vale
        // 'solid' (il default) è superfluo e su Android, insieme a
        // `borderRadius`, manda il fondo su un percorso di disegno diverso in
        // cui può sparire.
        ...(isDeadline ? { borderStyle: 'dashed' as const } : null),
      }}
    >
      {/* Velatura del colore del tipo sopra la surface (canvas: colore + '24'). */}
      {t.typeColor ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.typeColor + '24' }} />
      ) : null}

      <View style={{ flexDirection: 'row' }}>
        {/* Colonna STATUS a sinistra — sempre presente: dà al tile la sua
            "striscia" riconoscibile. Con status 'active' (o assente) resta la
            sola traccia, senza glifo.
            NON è il colore della pagina. Sul canvas web la traccia è `bg1`, cioè
            proprio la pagina, e lì funziona perché pagina (#161616) e card
            (#1e1e1e) distano un passo: si legge come una scanalatura. Sul mobile
            la pagina è nero pieno, quindi lo stesso valore ritaglia una feritoia
            nel fianco sinistro e la card perde il perimetro dove dovrebbe
            chiudersi. Qui è una velatura CHIARA sopra il corpo della card: resta
            una corsia distinta e la card resta un blocco unico. */}
        <View style={{ width: 22, backgroundColor: c.dark ? 'rgba(255,255,255,0.05)' : c.canvas, alignItems: 'center', justifyContent: 'center' }}>
          {glyph.kind === 'dot' ? (
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: stCol }} />
          ) : glyph.kind === 'icon' ? (
            <glyph.Icon size={13} color={stCol} strokeWidth={1.9} />
          ) : glyph.kind === 'text' ? (
            <Text style={{ fontSize: 9, fontWeight: '700', letterSpacing: 1.5, color: stCol, transform: [{ rotate: '-90deg' }], width: 60, textAlign: 'center' }}>
              {glyph.text}
            </Text>
          ) : null}
        </View>

        <View style={{ flex: 1, paddingHorizontal: 13, paddingVertical: 12 }}>
          {/* Titolo — due righe, barrato e attenuato quando completato. */}
          <Text
            numberOfLines={2}
            style={{
              fontSize: 15, lineHeight: 20, fontWeight: '500', color: c.text,
              textDecorationLine: t.completed ? 'line-through' : 'none',
              opacity: t.completed ? 0.65 : 1,
            }}
          >
            {t.title}
          </Text>

          {/* Footer — badge azione · data/ora · badge tipo. Assente se il tile
              non ha nessuno dei tre (nota senza tipo). */}
          {(ActionIcon || t.date || TypeIcon) ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 10 }}>
              {ActionIcon ? (
                <View style={{ width: 20, height: 20, borderRadius: 6, backgroundColor: actionColor, alignItems: 'center', justifyContent: 'center' }}>
                  <ActionIcon size={12} color={readableOn(actionColor)} strokeWidth={2} />
                </View>
              ) : null}
              {t.date ? (
                <View>
                  <Text style={{ fontSize: 11.5, color: c.text }}>{t.date}</Text>
                  {t.time ? <Text style={{ fontSize: 10.5, color: c.muted }}>{t.time}</Text> : null}
                </View>
              ) : null}
              <View style={{ flex: 1 }} />
              {TypeIcon ? (
                <View style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: (t.typeColor ?? c.muted) + (c.dark ? '33' : '22'), alignItems: 'center', justifyContent: 'center' }}>
                  <TypeIcon size={13} color={t.typeColor ?? c.muted} strokeWidth={1.8} />
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

/** Normalizza per la ricerca testuale: minuscolo, senza accenti. */
function normSearch(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function TilesContent({ c, tiles, actionColors, loading, onOpenTile, onAiSearch, onClearAiSearch, aiQuery, aiSearching, aiTileIds }: {
  c: ObsidianColors; tiles?: Tile[]; actionColors?: Record<TileActionKey, string>;
  loading?: boolean; onOpenTile?: (id: string) => void;
  /** Lancia la ricerca semantica (embedding) sul testo digitato. */
  onAiSearch?: (q: string) => void;
  onClearAiSearch?: () => void;
  /** Query AI in corso/attiva e id dei tile che i suoi risultati toccano. */
  aiQuery?: string | null;
  aiSearching?: boolean;
  aiTileIds?: string[] | null;
}) {
  const data = tiles ?? TILES_MOCK;
  const colors = actionColors ?? DEFAULT_ACTION_COLORS;
  const [query, setQuery] = React.useState('');
  const [sort, setSort] = React.useState<TileSort>('recent');
  const [filters, setFilters] = React.useState<TileFilters>(EMPTY_FILTERS);
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [sortOpen, setSortOpen] = React.useState(false);

  const activeFilters = filters.action.length + filters.tag.length + filters.type.length + filters.status.length;
  const toggle = (dim: keyof TileFilters, value: string) =>
    setFilters((f) => ({ ...f, [dim]: f[dim].includes(value) ? f[dim].filter((v) => v !== value) : [...f[dim], value] }));

  // Valori filtrabili: ricavati dai tile in lista, così non si offrono filtri
  // che non selezionerebbero nulla.
  const options = React.useMemo(() => {
    const actions = new Set<string>();
    const tags = new Map<string, string>();
    const types = new Map<string, string>();
    const statuses = new Set<string>();
    for (const t of data) {
      actions.add(actionKey(t));
      t.tags.forEach((tg) => tags.set(tg.id, tg.name));
      if (t.typeId) types.set(t.typeId, t.typeName ?? 'Tipo');
      if (t.statusName) statuses.add(t.statusName);
    }
    return {
      actions: [...actions] as TileActionKey[],
      tags: [...tags].map(([id, name]) => ({ id, name })),
      types: [...types].map(([id, name]) => ({ id, name })),
      statuses: [...statuses],
    };
  }, [data]);

  const visible = React.useMemo(() => {
    const q = normSearch(query.trim());
    const aiSet = aiTileIds ? new Set(aiTileIds) : null;
    const out = data.filter((t) => {
      if (aiSet && !aiSet.has(t.id)) return false;
      if (q && !normSearch(t.title).includes(q) && !t.tags.some((tg) => normSearch(tg.name).includes(q))) return false;
      if (filters.action.length && !filters.action.includes(actionKey(t))) return false;
      if (filters.status.length && !(t.statusName && filters.status.includes(t.statusName))) return false;
      if (filters.type.length && !(t.typeId && filters.type.includes(t.typeId))) return false;
      if (filters.tag.length && !t.tags.some((tg) => filters.tag.includes(tg.id))) return false;
      return true;
    });
    // `data` arriva già in ordine d'inserimento (più recenti prima).
    switch (sort) {
      case 'oldest': return [...out].reverse();
      case 'when': return [...out].sort((a, b) => (b.whenTs ?? -Infinity) - (a.whenTs ?? -Infinity));
      case 'title': return [...out].sort((a, b) => a.title.localeCompare(b.title, 'it'));
      default: return out;
    }
  }, [data, query, filters, sort, aiTileIds]);

  const runAi = () => {
    const q = query.trim();
    if (q) onAiSearch?.(q);
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Barra strumenti: Filtra · Ordina · ricerca testuale (con AI). */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
        <ToolBtn c={c} Icon={IconFilter} label="Filtra" on={activeFilters > 0} count={activeFilters} onPress={() => setFilterOpen(true)} />
        <ToolBtn c={c} Icon={IconArrowsSort} label="Ordina" on={sort !== 'recent'} onPress={() => setSortOpen(true)} />
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, height: 42, borderRadius: 12, paddingLeft: 11, paddingRight: 5, backgroundColor: c.surface2 }}>
          <IconSearch size={16} color={c.subtle} strokeWidth={1.9} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={runAi}
            returnKeyType="search"
            placeholder="Cerca…"
            placeholderTextColor={c.subtle}
            style={{ flex: 1, fontSize: 14, color: c.text, padding: 0 }}
          />
          {query.length > 0 ? (
            <Pressable onPress={() => { setQuery(''); onClearAiSearch?.(); }} accessibilityLabel="Pulisci ricerca" hitSlop={8} style={{ padding: 4 }}>
              <IconX size={15} color={c.subtle} strokeWidth={1.9} />
            </Pressable>
          ) : null}
          {/* Bacchetta AI: ricerca semantica sul contenuto degli spark, non solo
              sul titolo del tile. */}
          <Pressable
            onPress={runAi}
            disabled={!query.trim() || aiSearching}
            accessibilityLabel="Cerca con AI"
            android_ripple={{ color: c.accent + '33', borderless: true }}
            style={{ width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: aiQuery ? c.accent : c.accent + '2E', opacity: query.trim() && !aiSearching ? 1 : 0.5 }}
          >
            <IconSparkles size={16} color={aiQuery ? c.accentInk : c.accent} strokeWidth={1.9} />
          </Pressable>
        </View>
      </View>

      {/* Stato della ricerca AI: cosa è stato cercato e come toglierlo. */}
      {aiSearching || aiQuery ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 11, height: 32, borderRadius: 10, backgroundColor: c.accent + '1E' }}>
          <IconSparkles size={13} color={c.accent} strokeWidth={1.9} />
          <Text numberOfLines={1} style={{ flex: 1, fontSize: 12, color: c.accent }}>
            {aiSearching ? 'Ricerca AI in corso…' : `Ricerca AI: "${aiQuery}"`}
          </Text>
          {!aiSearching ? (
            <Pressable onPress={onClearAiSearch} hitSlop={8} accessibilityLabel="Rimuovi ricerca AI">
              <IconX size={14} color={c.accent} strokeWidth={2} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16, gap: 10 }}>
        {loading ? (
          <Text style={{ fontSize: 13, color: c.subtle, textAlign: 'center', paddingVertical: 40 }}>Caricamento…</Text>
        ) : visible.length === 0 ? (
          <Text style={{ fontSize: 13, color: c.subtle, textAlign: 'center', paddingVertical: 40 }}>
            {data.length === 0 ? 'Nessun tile.' : 'Nessun tile per questi criteri.'}
          </Text>
        ) : visible.map((t) => <TileCard key={t.id} c={c} t={t} actionColors={colors} onPress={onOpenTile} />)}
      </ScrollView>

      {/* Pannello ORDINA */}
      <Modal visible={sortOpen} transparent animationType="fade" onRequestClose={() => setSortOpen(false)} statusBarTranslucent>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }} onPress={() => setSortOpen(false)} accessibilityLabel="Chiudi">
          <View style={{ backgroundColor: c.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, gap: 6 }}>
            <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1.3, color: c.subtle, marginBottom: 6 }}>ORDINA</Text>
            {SORT_ORDER.map((s) => (
              <Pressable
                key={s}
                onPress={() => { setSort(s); setSortOpen(false); }}
                android_ripple={{ color: c.accent + '22' }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 46, paddingHorizontal: 12, borderRadius: 10, backgroundColor: s === sort ? c.accent + '2E' : 'transparent' }}
              >
                <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: s === sort ? c.accent : c.text }}>{SORT_LABEL[s]}</Text>
                {s === sort ? <IconCheck size={17} color={c.accent} strokeWidth={2} /> : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Pannello FILTRA — le quattro dimensioni dei vecchi chip. */}
      <Modal visible={filterOpen} transparent animationType="slide" onRequestClose={() => setFilterOpen(false)} statusBarTranslucent>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} onPress={() => setFilterOpen(false)} accessibilityLabel="Chiudi" />
          <View style={{ maxHeight: '75%', backgroundColor: c.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ flex: 1, fontSize: 10, fontWeight: '700', letterSpacing: 1.3, color: c.subtle }}>FILTRA</Text>
              {activeFilters > 0 ? (
                <Pressable onPress={() => setFilters(EMPTY_FILTERS)} hitSlop={8}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: c.accent }}>Azzera</Text>
                </Pressable>
              ) : null}
            </View>
            <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 8 }}>
              <View style={{ gap: 8 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: c.muted }}>Azione</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                  {options.actions.map((a) => (
                    <ToggleChip key={a} c={c} label={ACTION_FILTER_LABEL[a]} color={colors[a]} on={filters.action.includes(a)} onPress={() => toggle('action', a)} />
                  ))}
                </View>
              </View>
              {options.tags.length > 0 ? (
                <View style={{ gap: 8 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: c.muted }}>Tag</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                    {options.tags.map((tg) => (
                      <ToggleChip key={tg.id} c={c} label={tg.name} on={filters.tag.includes(tg.id)} onPress={() => toggle('tag', tg.id)} />
                    ))}
                  </View>
                </View>
              ) : null}
              {options.types.length > 0 ? (
                <View style={{ gap: 8 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: c.muted }}>Tipo</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                    {options.types.map((ty) => (
                      <ToggleChip key={ty.id} c={c} label={ty.name} on={filters.type.includes(ty.id)} onPress={() => toggle('type', ty.id)} />
                    ))}
                  </View>
                </View>
              ) : null}
              {options.statuses.length > 0 ? (
                <View style={{ gap: 8 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: c.muted }}>Status</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                    {options.statuses.map((s) => (
                      <ToggleChip key={s} c={c} label={STATUS_FILTER_LABEL[s] ?? s} color={STATUS_HEX[s] ?? STATUS_HEX_FALLBACK} on={filters.status.includes(s)} onPress={() => toggle('status', s)} />
                    ))}
                  </View>
                </View>
              ) : null}
            </ScrollView>
            <Pressable
              onPress={() => setFilterOpen(false)}
              android_ripple={{ color: c.accent + '55' }}
              style={{ marginTop: 12, minHeight: 48, borderRadius: 12, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontSize: 15, fontWeight: '600', color: c.accentInk }}>Mostra {visible.length} tile</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── FLOWS ────────────────────────────────────────────────────────────────────
// View-model rendered here; live data arrives via `flowHubItemToVM`.
type Flow = ObFlowVM;
const FLOWS: Flow[] = [
  { id: 'f1', tileId: 't1', tag: 'RUSLAN_VIA SARDEGNA', title: 'Ruslan/inviare messaggio', state: 'Aggiornare docume…', who: 'IO', ago: '5g fa', date: '22 Giu 2026' },
  { id: 'f2', tileId: 't2', tag: 'OM_PADEL', title: 'OM/Richiesta preventivo', state: 'Attesa preventivo', who: 'L. Anichini', ago: '5g fa', date: '22 Giu 2026' },
  { id: 'f3', tileId: 't3', tag: 'GDS_VARIE', title: 'GDS/Area matrimoni', state: 'Attesa firme', who: 'N. Mainetti', ago: '5g fa', date: '22 Giu 2026' },
  { id: 'f4', tileId: 't4', tag: 'CONSORZIO BONIFICA', title: 'Richiesta informazioni', state: '(senza etichetta)', who: 'Consorzio', ago: '12g fa', date: '15 Giu 2026' },
  { id: 'f5', tileId: 't5', tag: 'GDS_PULIZIA', title: 'GDS/Pulizia pannelli', state: 'Attendo feed', who: 'L. Alessi', ago: '23g fa', date: '04 Giu 2026' },
];

const FLOW_FILTER_META: Record<FlowHubFilter, { label: string; color: (c: ObsidianColors) => string; Icon: typeof IconCheck }> = {
  done: { label: 'Done', color: (c) => c.timed, Icon: IconCheck },
  wait: { label: 'Wait', color: (c) => c.amber, Icon: IconHourglass },
  undo: { label: 'Undo', color: (c) => c.accent, Icon: IconArrowBackUp },
  stop: { label: 'Stop', color: (c) => c.deadline, Icon: IconX },
};
const FLOW_FILTER_ORDER: FlowHubFilter[] = ['done', 'wait', 'undo', 'stop'];

function FlowsContent({ c, flows, loading, active = 'wait', onFilter, onOpenFlow }: {
  c: ObsidianColors; flows?: Flow[]; loading?: boolean; active?: FlowHubFilter;
  onFilter?: (f: FlowHubFilter) => void; onOpenFlow?: (tileId: string) => void;
}) {
  const data = flows ?? FLOWS;
  const activeMeta = FLOW_FILTER_META[active];
  const ActiveIcon = activeMeta.Icon;
  const activeColor = activeMeta.color(c);
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', gap: 7, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
        {FLOW_FILTER_ORDER.map((id) => {
          const m = FLOW_FILTER_META[id];
          const col = m.color(c);
          const on = id === active;
          const Icon = m.Icon;
          return (
            <Pressable key={id} onPress={onFilter ? () => onFilter(id) : undefined} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8, borderRadius: 9, backgroundColor: on ? col : col + (c.dark ? '22' : '16'), borderWidth: 1, borderColor: on ? 'transparent' : col + (c.dark ? '40' : '33') }}>
              <Icon size={13} color={on ? '#fff' : col} strokeWidth={1.8} />
              <Text style={{ fontSize: 12, fontWeight: '600', color: on ? '#fff' : col }}>{m.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16, gap: 10 }}>
        {loading ? (
          <Text style={{ fontSize: 13, color: c.subtle, textAlign: 'center', paddingVertical: 40 }}>Caricamento…</Text>
        ) : data.length === 0 ? (
          <Text style={{ fontSize: 13, color: c.subtle, textAlign: 'center', paddingVertical: 40 }}>Nessun flow in questo stato.</Text>
        ) : data.map((fl) => (
          <Pressable key={fl.id} onPress={onOpenFlow ? () => onOpenFlow(fl.tileId) : undefined} disabled={!onOpenFlow} style={({ pressed }) => ({ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 13, padding: 12, opacity: pressed ? 0.7 : 1 })}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, fontWeight: '600', color: c.accent, marginBottom: 5, letterSpacing: 0.4 }}>{fl.tag}</Text>
                <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '600', color: c.text }}>{fl.title}</Text>
              </View>
              <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: activeColor + (c.dark ? '2e' : '1c'), alignItems: 'center', justifyContent: 'center' }}>
                <ActiveIcon size={14} color={activeColor} strokeWidth={1.8} />
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 10 }}>
              <Text style={{ fontSize: 12, color: c.muted }}>{fl.state}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.line, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3 }}>
                <IconUser size={11} color={c.subtle} strokeWidth={1.8} />
                <Text style={{ fontSize: 11, fontWeight: '600', color: c.muted }}>{fl.who}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: c.line, paddingTop: 9 }}>
              <Text style={{ fontSize: 11, color: c.subtle, flex: 1 }}>{fl.ago}</Text>
              <Text style={{ fontSize: 11, color: c.subtle }}>{fl.date}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── CHRONO ───────────────────────────────────────────────────────────────────
const CH_H = 56, CH_START = 8, CH_END = 16;
const CH_HOURS = Array.from({ length: CH_END - CH_START + 1 }, (_, i) => CH_START + i);
const DEMO_CHRONO: ObChronoEvent[] = [
  { id: 'd1', tileId: 'd1', title: 'Contattare Giovanni', startHour: 11.5, endHour: 12.5, timeLabel: '11:30 – 12:30' },
];
function ChronoContent({ c, events, loading, dayLabel, isToday, onPrev, onNext, onToday, onOpenEvent }: {
  c: ObsidianColors; events?: ObChronoEvent[]; loading?: boolean; dayLabel?: string; isToday?: boolean;
  onPrev?: () => void; onNext?: () => void; onToday?: () => void; onOpenEvent?: (tileId: string) => void;
}) {
  const [seg, setSeg] = React.useState('daily');
  const live = events !== undefined;
  const rows = events ?? DEMO_CHRONO;
  // "Now" line — only meaningful on today's column and within the grid window.
  const now = new Date();
  const nowHour = now.getHours() + now.getMinutes() / 60;
  const showNow = (live ? !!isToday : true) && nowHour >= CH_START && nowHour <= CH_END;
  const nowTop = (nowHour - CH_START) * CH_H + 5;

  const clampTop = (h: number) => (Math.min(Math.max(h, CH_START), CH_END) - CH_START) * CH_H + 5;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 }}>
        <Pressable onPress={onPrev} style={{ width: 30, height: 30, borderRadius: 8, borderWidth: 1, borderColor: c.line2, alignItems: 'center', justifyContent: 'center' }}><IconChevronLeft size={14} color={c.muted} /></Pressable>
        <Pressable onPress={onToday} style={{ paddingHorizontal: 13, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: c.line2 }}><Text style={{ fontSize: 12, fontWeight: '600', color: c.text }}>Oggi</Text></Pressable>
        <Pressable onPress={onNext} style={{ width: 30, height: 30, borderRadius: 8, borderWidth: 1, borderColor: c.line2, alignItems: 'center', justifyContent: 'center' }}><IconChevronRight size={14} color={c.muted} /></Pressable>
        <View style={{ flex: 1 }} />
        <Text style={{ fontSize: 14, fontWeight: '600', color: c.text }}>{dayLabel ?? 'Sab 27 giu'}</Text>
      </View>
      <View style={{ marginHorizontal: 16, marginTop: 4, marginBottom: 10 }}>
        <Segmented c={c} value={seg} onChange={setSeg} items={[{ value: 'daily', label: 'Daily' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }]} />
      </View>
      <ScrollView style={{ flex: 1 }}>
        <View style={{ height: CH_HOURS.length * CH_H, paddingVertical: 4 }}>
          {CH_HOURS.map((x, i) => (
            <View key={x} style={{ position: 'absolute', top: i * CH_H + 4, left: 0, right: 0, borderTopWidth: 1, borderTopColor: c.gridLine }}>
              <Text style={{ position: 'absolute', top: -7, left: 12, fontSize: 10, color: c.subtle, backgroundColor: c.canvas, paddingHorizontal: 4 }}>{(x < 10 ? '0' + x : x) + ':00'}</Text>
            </View>
          ))}
          {loading ? (
            <Text style={{ position: 'absolute', top: 8, left: 52, fontSize: 12, color: c.subtle }}>Caricamento…</Text>
          ) : rows.length === 0 ? (
            <Text style={{ position: 'absolute', top: 8, left: 52, fontSize: 12, color: c.subtle }}>Nessun evento.</Text>
          ) : rows.map((ev) => {
            const top = clampTop(ev.startHour);
            const bottom = clampTop(ev.endHour);
            const height = Math.max(bottom - top, CH_H - 6);
            return (
              <Pressable
                key={ev.id}
                onPress={onOpenEvent ? () => onOpenEvent(ev.tileId) : undefined}
                disabled={!onOpenEvent}
                style={{ position: 'absolute', top, left: 52, right: 12, height, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, gap: 2, backgroundColor: c.timed + (c.dark ? '2b' : '1c'), borderWidth: 1, borderColor: c.timed + (c.dark ? '3a' : '30') }}
              >
                <Text numberOfLines={1} style={{ fontSize: 12.5, fontWeight: '600', color: c.text }}>{ev.title}</Text>
                <Text style={{ fontSize: 10, color: c.dark ? c.muted : c.timed }}>{ev.timeLabel}</Text>
              </Pressable>
            );
          })}
          {showNow && (
            <View style={{ position: 'absolute', top: nowTop, left: 46, right: 0, borderTopWidth: 1.5, borderTopColor: c.accent }}>
              <View style={{ position: 'absolute', left: 0, top: -3.5, width: 7, height: 7, borderRadius: 3.5, backgroundColor: c.accent }} />
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
type ThemeMode = 'light' | 'dark' | 'system';
function SettingsContent({ c, haptic: hapticProp, onHaptic, confirmDelete: confirmProp, onConfirmDelete, theme: themeProp, onTheme, account }: {
  c: ObsidianColors;
  haptic?: boolean; onHaptic?: (v: boolean) => void;
  confirmDelete?: boolean; onConfirmDelete?: (v: boolean) => void;
  theme?: ThemeMode; onTheme?: (v: ThemeMode) => void;
  account?: { email?: string | null; onSignIn?: () => void; onSignOut?: () => void };
}) {
  // Controlled when a setter is provided (live), otherwise local state (mock).
  const [hapticState, setHapticState] = React.useState(true);
  const [confirmState, setConfirmState] = React.useState(true);
  const [themeState, setThemeState] = React.useState<ThemeMode>('light');
  const [notif, setNotif] = React.useState(false);
  const [tileColor, setTileColor] = React.useState('tint');

  const haptic = hapticProp ?? hapticState;
  const setHaptic = (v: boolean) => { onHaptic?.(v); if (hapticProp === undefined) setHapticState(v); };
  const confirmDelete = confirmProp ?? confirmState;
  const setConfirmDelete = (v: boolean) => { onConfirmDelete?.(v); if (confirmProp === undefined) setConfirmState(v); };
  const theme = themeProp ?? themeState;
  const setTheme = (v: string) => { const m = v as ThemeMode; onTheme?.(m); if (themeProp === undefined) setThemeState(m); };

  const Row = ({ Icon, label, sub, control }: { Icon: typeof IconBell; label: string; sub?: string; control: React.ReactNode }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 12, padding: 13 }}>
      <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={16} color={c.muted} strokeWidth={1.8} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: c.text }}>{label}</Text>
        {sub ? <Text style={{ fontSize: 11.5, color: c.subtle, marginTop: 1 }}>{sub}</Text> : null}
      </View>
      {control}
    </View>
  );
  const SectionHead = ({ children }: { children: string }) => (
    <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1.3, color: c.subtle, marginTop: 20, marginBottom: 12, marginHorizontal: 2 }}>{children}</Text>
  );
  const SegRow = ({ label, control }: { label: string; control: React.ReactNode }) => (
    <View style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 12, padding: 13, marginBottom: 9 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: c.text, marginBottom: 10 }}>{label}</Text>
      {control}
    </View>
  );

  // Account section. The app has no auth guard on the root layout, so an
  // unauthenticated session lands straight on the tabs with every list silently
  // empty — this is the only way back to the login screen.
  const AccountSection = !account ? null : (
    <>
      <SectionHead>ACCOUNT</SectionHead>
      {account.email ? (
        <View style={{ gap: 9 }}>
          <Row Icon={IconUser} label={account.email} sub="Connesso" control={<View />} />
          <Pressable
            onPress={account.onSignOut}
            style={({ pressed }) => ({ alignItems: 'center', minHeight: OB_BTN_H, justifyContent: 'center', borderRadius: 12, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, opacity: pressed ? 0.75 : 1 })}
          >
            <Text style={{ fontSize: 13.5, fontWeight: '600', color: c.deadline }}>Esci</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ gap: 9 }}>
          <Row Icon={IconAlertCircle} label="Non hai effettuato l'accesso" sub="Senza login le liste restano vuote" control={<View />} />
          <Pressable
            onPress={account.onSignIn}
            style={({ pressed }) => ({ alignItems: 'center', minHeight: OB_BTN_H, justifyContent: 'center', borderRadius: 12, backgroundColor: c.accent, opacity: pressed ? 0.85 : 1 })}
          >
            <Text style={{ fontSize: 13.5, fontWeight: '700', color: '#fff' }}>Accedi</Text>
          </Pressable>
        </View>
      )}
    </>
  );

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 }}>
      {AccountSection}
      <View style={{ gap: 9 }}>
        <Row Icon={IconDeviceMobileVibration} label="Feedback aptico" sub="Vibrazione su cattura e invio" control={<Toggle c={c} value={haptic} onValueChange={setHaptic} />} />
        <Row Icon={IconTrash} label="Conferma eliminazione" control={<Toggle c={c} value={confirmDelete} onValueChange={setConfirmDelete} />} />
        <Row Icon={IconBell} label="Notifiche" sub="Promemoria e scadenze" control={<Toggle c={c} value={notif} onValueChange={setNotif} />} />
      </View>

      <SectionHead>ASPETTO</SectionHead>
      <SegRow label="Tema" control={<Segmented c={c} value={theme} onChange={setTheme} items={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }, { value: 'system', label: 'Sistema' }]} />} />
      <SegRow label="Colore tile" control={<Segmented c={c} value={tileColor} onChange={setTileColor} items={[{ value: 'tint', label: 'Tinta' }, { value: 'solid', label: 'Pieno' }]} />} />

      <SectionHead>GENERALE</SectionHead>
      <View style={{ gap: 9 }}>
        <Row Icon={IconWorld} label="Lingua" sub="Italiano" control={<IconChevronRight size={15} color={c.faint} />} />
        <Row Icon={IconSparkles} label="Beniamino assistente" sub="Bito" control={<IconChevronRight size={15} color={c.faint} />} />
      </View>
    </ScrollView>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export interface ObsidianViewsScreenProps {
  initial?: MobileViewId;
  /** Controlled active tab (so a Live wrapper can gate per-tab queries).
   *  Uncontrolled (internal state) when omitted. */
  active?: MobileViewId;
  onActiveChange?: (v: MobileViewId) => void;
  /** Tiles tab — tile già mappati e ordinati (tilesByInsertion). Omesso → mock. */
  tiles?: ObTileVM[];
  /** Colori azione dell'utente (settings `action_colors`); omessi → default. */
  actionColors?: Record<TileActionKey, string>;
  /** Ricerca AI (semantica) dalla barra della lista Tiles. */
  onAiSearch?: (q: string) => void;
  onClearAiSearch?: () => void;
  aiQuery?: string | null;
  aiSearching?: boolean;
  /** Id dei tile toccati dai risultati AI; null = nessuna ricerca attiva. */
  aiTileIds?: string[] | null;
  tilesLoading?: boolean;
  onOpenTile?: (id: string) => void;
  /** Flows tab — live rows (pre-mapped via flowHubItemToVM). Omit for the mock. */
  flows?: ObFlowVM[];
  flowsLoading?: boolean;
  flowFilter?: FlowHubFilter;
  onFlowFilter?: (f: FlowHubFilter) => void;
  onOpenFlow?: (tileId: string) => void;
  /** Chrono tab — live day events (pre-mapped via tileToChronoEvent). */
  chronoEvents?: ObChronoEvent[];
  chronoLoading?: boolean;
  chronoDayLabel?: string;
  chronoIsToday?: boolean;
  onChronoPrev?: () => void;
  onChronoNext?: () => void;
  onChronoToday?: () => void;
  onOpenEvent?: (tileId: string) => void;
  /** Settings tab — live controls (settingsStore). Omit for the mock. */
  haptic?: boolean;
  onHaptic?: (v: boolean) => void;
  confirmDelete?: boolean;
  onConfirmDelete?: (v: boolean) => void;
  themeMode?: ThemeMode;
  onThemeMode?: (v: ThemeMode) => void;
  /** Message from a failed query for the active tab. Rendered as a banner so a
   *  broken fetch can't masquerade as an empty list. */
  errorText?: string | null;
  /** Settings tab — account row + sign in/out. Omit for the mock. */
  account?: { email?: string | null; onSignIn?: () => void; onSignOut?: () => void };
  /** Home button (nel Drawer) → the Capture screen. Falls back to the Tiles tab. */
  onHome?: () => void;
  onBack?: () => void;
  /** Cerchio "Ask Gimmick" a destra nell'header → apre la chat. */
  onAsk?: () => void;
}

function ErrorBanner({ c, text }: { c: ObsidianColors; text: string }) {
  return (
    <View style={{ marginHorizontal: 16, marginTop: 10, padding: 11, borderRadius: 11, backgroundColor: c.deadline + (c.dark ? '22' : '14'), borderWidth: 1, borderColor: c.deadline + (c.dark ? '3a' : '30'), flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
      <IconAlertCircle size={15} color={c.deadline} strokeWidth={1.9} style={{ marginTop: 1 }} />
      <Text style={{ flex: 1, fontSize: 12.5, lineHeight: 17, color: c.text }}>{text}</Text>
    </View>
  );
}

export function ObsidianViewsScreen({
  initial = 'tiles', active: activeProp, onActiveChange,
  tiles, actionColors, tilesLoading, onOpenTile,
  onAiSearch, onClearAiSearch, aiQuery, aiSearching, aiTileIds,
  flows, flowsLoading, flowFilter, onFlowFilter, onOpenFlow,
  chronoEvents, chronoLoading, chronoDayLabel, chronoIsToday,
  onChronoPrev, onChronoNext, onChronoToday, onOpenEvent,
  haptic, onHaptic, confirmDelete, onConfirmDelete, themeMode, onThemeMode,
  errorText, account, onHome, onAsk,
}: ObsidianViewsScreenProps = {}) {
  const c = useObsidian();
  const [activeState, setActiveState] = React.useState<MobileViewId>(initial);
  const [drawer, setDrawer] = React.useState(false);
  const active = activeProp ?? activeState;
  const setActive = (v: MobileViewId) => { onActiveChange?.(v); if (activeProp === undefined) setActiveState(v); };
  // Fondo della shell: nero pieno in tema scuro, come la home. Passato anche a
  // status bar e nav pill, altrimenti restano due bande più chiare sopra e sotto.
  const shellBg = c.dark ? '#000000' : c.canvas;

  return (
    <View style={{ flex: 1, backgroundColor: shellBg }}>
      <ObsidianStatusBar background={shellBg} />
      {/* Stessa navbar della Capture: titolo a sinistra, menu (Drawer) + Ask a
          destra. Il cambio vista vive solo nel Drawer. */}
      <ObsidianAppHeader
        title={VIEW_LABEL[active]}
        onMenu={() => setDrawer(true)}
        onAsk={onAsk}
      />
      {errorText ? <ErrorBanner c={c} text={errorText} /> : null}
      {active === 'tiles' && (
        <TilesContent
          c={c}
          tiles={tiles}
          actionColors={actionColors}
          loading={tilesLoading}
          onOpenTile={onOpenTile}
          onAiSearch={onAiSearch}
          onClearAiSearch={onClearAiSearch}
          aiQuery={aiQuery}
          aiSearching={aiSearching}
          aiTileIds={aiTileIds}
        />
      )}
      {active === 'flows' && <FlowsContent c={c} flows={flows} loading={flowsLoading} active={flowFilter} onFilter={onFlowFilter} onOpenFlow={onOpenFlow} />}
      {active === 'chrono' && <ChronoContent c={c} events={chronoEvents} loading={chronoLoading} dayLabel={chronoDayLabel} isToday={chronoIsToday} onPrev={onChronoPrev} onNext={onChronoNext} onToday={onChronoToday} onOpenEvent={onOpenEvent} />}
      {active === 'settings' && <SettingsContent c={c} haptic={haptic} onHaptic={onHaptic} confirmDelete={confirmDelete} onConfirmDelete={onConfirmDelete} theme={themeMode} onTheme={onThemeMode} account={account} />}
      <ObsidianNavPill background={shellBg} />

      {/* Drawer: viste + Cattura (Home) + Impostazioni. */}
      <ObsidianDrawer
        open={drawer}
        onClose={() => setDrawer(false)}
        onNavigateView={setActive}
        onSettings={() => setActive('settings')}
        onHome={onHome}
      />
    </View>
  );
}
