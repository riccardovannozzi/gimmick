/**
 * Gimmick · Obsidian — Mobile views (Tiles / Flows / Chrono / Settings).
 *
 * The primary mobile screens behind the TopNav switcher. Reference:
 * GimmickMobileViews.dc.html. Reuses the Obsidian mobile shell + tokens; tile /
 * flow / event colors come from the canonical scale.
 */
import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import {
  IconBolt, IconTag, IconCategory, IconCircleCheck, IconChevronDown, IconTrash,
  IconHourglass, IconArrowBackUp, IconCheck, IconX, IconUser,
  IconChevronLeft, IconChevronRight, IconClock, IconAlertCircle,
  IconDeviceMobileVibration, IconBell, IconWorld, IconSparkles,
} from '@tabler/icons-react-native';
import { useObsidian } from '@/lib/obsidian';
import type { ObsidianColors } from '@/constants/obsidian';
import type { ObTileVM, ObTileGroup, ObFlowVM, ObChronoEvent } from '@/lib/obsidian-adapters';
import type { FlowHubFilter } from '@/types';
import { ObsidianStatusBar } from '../StatusBar';
import { ObsidianNavPill } from '../NavPill';
import { ObsidianTopNav, type MobileViewId } from '../TopNav';

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
          <Pressable key={it.value} onPress={() => onChange?.(it.value)} style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 7, backgroundColor: on ? c.accentSoft : 'transparent' }}>
            <Text style={{ fontSize: 12.5, fontWeight: on ? '600' : '500', color: on ? c.accent : c.muted }}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── TILES ────────────────────────────────────────────────────────────────────
// View-model rendered here. Live data arrives pre-grouped via
// `lib/obsidian-adapters.tilesToGroups`; the mock below feeds the QA preview.
type Tile = ObTileVM;
const TILE_GROUPS: ObTileGroup[] = [
  { group: 'IERI', tiles: [{ id: 'm1', title: 'Contattare Giovanni domattina', meta: '27 Giu 2026 · 11:30 · 1h', kind: 'timed', spark: 1 }] },
  { group: '25 GIUGNO', tiles: [
    { id: 'm2', title: 'Marco al tramonto mediterraneo', kind: 'notes', spark: 2 },
    { id: 'm3', title: 'Audio e incontro con Marco', meta: '26 Giu 2026 · 17:00 · 1h', kind: 'timed', spark: 2 },
    { id: 'm4', title: 'Appuntamento con Marco Guerrieri', kind: 'notes', spark: 1 },
    { id: 'm5', title: 'GDS/bisdomini', meta: '26 Giu 2026 · 12:15 · 1h', kind: 'timed', spark: 1 },
  ] },
];

function FilterChip({ c, Icon, label }: { c: ObsidianColors; Icon: typeof IconTag; label: string }) {
  return (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 9, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line2 }}>
      <Icon size={13} color={c.subtle} strokeWidth={1.8} />
      <Text style={{ fontSize: 12.5, fontWeight: '600', color: c.muted }}>{label}</Text>
      <IconChevronDown size={11} color={c.subtle} strokeWidth={1.8} />
    </View>
  );
}
function TileCard({ c, t, onPress }: { c: ObsidianColors; t: Tile; onPress?: (id: string) => void }) {
  const tinted = t.kind === 'timed' || t.kind === 'deadline';
  const col = t.kind === 'deadline' ? c.deadline : c.timed;
  const bg = tinted ? col + (c.dark ? '2b' : '1c') : c.surface;
  const borderColor = tinted ? col + (c.dark ? '3a' : '30') : c.line;
  return (
    <Pressable
      onPress={onPress ? () => onPress(t.id) : undefined}
      disabled={!onPress}
      style={({ pressed }) => ({ borderRadius: 13, padding: 13, backgroundColor: bg, borderWidth: 1, borderColor, opacity: pressed ? 0.7 : 1 })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={2} style={{ fontSize: 14.5, fontWeight: '600', color: c.text, marginBottom: t.meta ? 3 : 0 }}>{t.title}</Text>
          {t.meta ? <Text style={{ fontSize: 11, color: c.subtle }}>{t.meta}</Text> : null}
        </View>
        <IconTrash size={15} color={c.faint} strokeWidth={1.8} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 11 }}>
        {t.kind === 'notes' ? (
          <View style={{ width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: c.line2 }} />
        ) : (
          <View style={{ width: 24, height: 24, borderRadius: 7, backgroundColor: col + (c.dark ? '33' : '22'), alignItems: 'center', justifyContent: 'center' }}>
            {t.kind === 'deadline' ? <IconAlertCircle size={13} color={col} strokeWidth={1.8} /> : <IconClock size={13} color={col} strokeWidth={1.8} />}
          </View>
        )}
        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: c.text, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3 }}>
          <IconBolt size={11} color={c.canvas} strokeWidth={2} />
          <Text style={{ fontSize: 10, fontWeight: '600', color: c.canvas }}>{t.spark} SPARK</Text>
        </View>
      </View>
    </Pressable>
  );
}
function TilesContent({ c, groups, loading, onOpenTile }: { c: ObsidianColors; groups?: ObTileGroup[]; loading?: boolean; onOpenTile?: (id: string) => void }) {
  const data = groups ?? TILE_GROUPS;
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', gap: 7, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
        <FilterChip c={c} Icon={IconBolt} label="Action" />
        <FilterChip c={c} Icon={IconTag} label="Tag" />
        <FilterChip c={c} Icon={IconCategory} label="Type" />
        <FilterChip c={c} Icon={IconCircleCheck} label="Status" />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16, gap: 10 }}>
        {loading ? (
          <Text style={{ fontSize: 13, color: c.subtle, textAlign: 'center', paddingVertical: 40 }}>Caricamento…</Text>
        ) : data.length === 0 ? (
          <Text style={{ fontSize: 13, color: c.subtle, textAlign: 'center', paddingVertical: 40 }}>Nessun tile.</Text>
        ) : data.map((g) => (
          <View key={g.group} style={{ gap: 10 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1.4, color: c.subtle, marginTop: 6, marginHorizontal: 2 }}>{g.group}</Text>
            {g.tiles.map((t) => <TileCard key={t.id} c={c} t={t} onPress={onOpenTile} />)}
          </View>
        ))}
      </ScrollView>
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
            style={({ pressed }) => ({ alignItems: 'center', paddingVertical: 13, borderRadius: 12, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, opacity: pressed ? 0.75 : 1 })}
          >
            <Text style={{ fontSize: 13.5, fontWeight: '600', color: c.deadline }}>Esci</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ gap: 9 }}>
          <Row Icon={IconAlertCircle} label="Non hai effettuato l'accesso" sub="Senza login le liste restano vuote" control={<View />} />
          <Pressable
            onPress={account.onSignIn}
            style={({ pressed }) => ({ alignItems: 'center', paddingVertical: 13, borderRadius: 12, backgroundColor: c.accent, opacity: pressed ? 0.85 : 1 })}
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
  /** Tiles tab — live groups (pre-mapped via tilesToGroups). Omit for the mock. */
  tileGroups?: ObTileGroup[];
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
  /** TopNav home button → the Capture screen. Falls back to the Tiles tab. */
  onHome?: () => void;
  onBack?: () => void;
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
  tileGroups, tilesLoading, onOpenTile,
  flows, flowsLoading, flowFilter, onFlowFilter, onOpenFlow,
  chronoEvents, chronoLoading, chronoDayLabel, chronoIsToday,
  onChronoPrev, onChronoNext, onChronoToday, onOpenEvent,
  haptic, onHaptic, confirmDelete, onConfirmDelete, themeMode, onThemeMode,
  errorText, account, onHome, onBack,
}: ObsidianViewsScreenProps = {}) {
  const c = useObsidian();
  const [activeState, setActiveState] = React.useState<MobileViewId>(initial);
  const active = activeProp ?? activeState;
  const setActive = (v: MobileViewId) => { onActiveChange?.(v); if (activeProp === undefined) setActiveState(v); };

  return (
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
      <ObsidianStatusBar />
      <ObsidianTopNav active={active} onNavigate={setActive} onBack={onBack} onHome={onHome ?? (() => setActive('tiles'))} />
      {errorText ? <ErrorBanner c={c} text={errorText} /> : null}
      {active === 'tiles' &&<TilesContent c={c} groups={tileGroups} loading={tilesLoading} onOpenTile={onOpenTile} />}
      {active === 'flows' && <FlowsContent c={c} flows={flows} loading={flowsLoading} active={flowFilter} onFilter={onFlowFilter} onOpenFlow={onOpenFlow} />}
      {active === 'chrono' && <ChronoContent c={c} events={chronoEvents} loading={chronoLoading} dayLabel={chronoDayLabel} isToday={chronoIsToday} onPrev={onChronoPrev} onNext={onChronoNext} onToday={onChronoToday} onOpenEvent={onOpenEvent} />}
      {active === 'settings' && <SettingsContent c={c} haptic={haptic} onHaptic={onHaptic} confirmDelete={confirmDelete} onConfirmDelete={onConfirmDelete} theme={themeMode} onTheme={onThemeMode} account={account} />}
      <ObsidianNavPill />
    </View>
  );
}
