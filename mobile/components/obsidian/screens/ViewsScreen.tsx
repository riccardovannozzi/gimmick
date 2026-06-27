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
type TileKind = 'timed' | 'deadline' | 'notes';
interface Tile { title: string; meta?: string; kind: TileKind; spark: number }
const TILE_GROUPS: Array<{ group: string; tiles: Tile[] }> = [
  { group: 'IERI', tiles: [{ title: 'Contattare Giovanni domattina', meta: '27 Giu 2026 · 11:30 · 1h', kind: 'timed', spark: 1 }] },
  { group: '25 GIUGNO', tiles: [
    { title: 'Marco al tramonto mediterraneo', kind: 'notes', spark: 2 },
    { title: 'Audio e incontro con Marco', meta: '26 Giu 2026 · 17:00 · 1h', kind: 'timed', spark: 2 },
    { title: 'Appuntamento con Marco Guerrieri', kind: 'notes', spark: 1 },
    { title: 'GDS/bisdomini', meta: '26 Giu 2026 · 12:15 · 1h', kind: 'timed', spark: 1 },
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
function TileCard({ c, t }: { c: ObsidianColors; t: Tile }) {
  const tinted = t.kind === 'timed' || t.kind === 'deadline';
  const col = t.kind === 'deadline' ? c.deadline : c.timed;
  const bg = tinted ? col + (c.dark ? '2b' : '1c') : c.surface;
  const borderColor = tinted ? col + (c.dark ? '3a' : '30') : c.line;
  return (
    <View style={{ borderRadius: 13, padding: 13, backgroundColor: bg, borderWidth: 1, borderColor }}>
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
    </View>
  );
}
function TilesContent({ c }: { c: ObsidianColors }) {
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', gap: 7, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
        <FilterChip c={c} Icon={IconBolt} label="Action" />
        <FilterChip c={c} Icon={IconTag} label="Tag" />
        <FilterChip c={c} Icon={IconCategory} label="Type" />
        <FilterChip c={c} Icon={IconCircleCheck} label="Status" />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16, gap: 10 }}>
        {TILE_GROUPS.map((g) => (
          <View key={g.group} style={{ gap: 10 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1.4, color: c.subtle, marginTop: 6, marginHorizontal: 2 }}>{g.group}</Text>
            {g.tiles.map((t, i) => <TileCard key={i} c={c} t={t} />)}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── FLOWS ────────────────────────────────────────────────────────────────────
interface Flow { tag: string; title: string; state: string; who: string; ago: string; date: string }
const FLOWS: Flow[] = [
  { tag: 'RUSLAN_VIA SARDEGNA', title: 'Ruslan/inviare messaggio', state: 'Aggiornare docume…', who: 'IO', ago: '5g fa', date: '22 Giu 2026' },
  { tag: 'OM_PADEL', title: 'OM/Richiesta preventivo', state: 'Attesa preventivo', who: 'L. Anichini', ago: '5g fa', date: '22 Giu 2026' },
  { tag: 'GDS_VARIE', title: 'GDS/Area matrimoni', state: 'Attesa firme', who: 'N. Mainetti', ago: '5g fa', date: '22 Giu 2026' },
  { tag: 'CONSORZIO BONIFICA', title: 'Richiesta informazioni', state: '(senza etichetta)', who: 'Consorzio', ago: '12g fa', date: '15 Giu 2026' },
  { tag: 'GDS_PULIZIA', title: 'GDS/Pulizia pannelli', state: 'Attendo feed', who: 'L. Alessi', ago: '23g fa', date: '04 Giu 2026' },
];
function FlowsContent({ c }: { c: ObsidianColors }) {
  const filters: Array<{ id: string; label: string; color: string; Icon: typeof IconCheck; on: boolean }> = [
    { id: 'done', label: 'Done', color: c.timed, Icon: IconCheck, on: false },
    { id: 'wait', label: 'Wait', color: c.amber, Icon: IconHourglass, on: true },
    { id: 'undo', label: 'Undo', color: c.accent, Icon: IconArrowBackUp, on: false },
    { id: 'stop', label: 'Stop', color: c.deadline, Icon: IconX, on: false },
  ];
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', gap: 7, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
        {filters.map((f) => (
          <View key={f.id} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8, borderRadius: 9, backgroundColor: f.on ? f.color : f.color + (c.dark ? '22' : '16'), borderWidth: 1, borderColor: f.on ? 'transparent' : f.color + (c.dark ? '40' : '33') }}>
            <f.Icon size={13} color={f.on ? '#fff' : f.color} strokeWidth={1.8} />
            <Text style={{ fontSize: 12, fontWeight: '600', color: f.on ? '#fff' : f.color }}>{f.label}</Text>
          </View>
        ))}
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16, gap: 10 }}>
        {FLOWS.map((fl, i) => (
          <View key={i} style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 13, padding: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, fontWeight: '600', color: c.accent, marginBottom: 5, letterSpacing: 0.4 }}>{fl.tag}</Text>
                <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '600', color: c.text }}>{fl.title}</Text>
              </View>
              <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: c.amber + (c.dark ? '2e' : '1c'), alignItems: 'center', justifyContent: 'center' }}>
                <IconHourglass size={14} color={c.amber} strokeWidth={1.8} />
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
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── CHRONO ───────────────────────────────────────────────────────────────────
const CH_H = 56, CH_START = 8, CH_END = 16;
const CH_HOURS = Array.from({ length: CH_END - CH_START + 1 }, (_, i) => CH_START + i);
function ChronoContent({ c }: { c: ObsidianColors }) {
  const [seg, setSeg] = React.useState('daily');
  const evTop = (11.5 - CH_START) * CH_H + 5;
  const nowTop = (11.9 - CH_START) * CH_H + 5;
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 }}>
        <View style={{ width: 30, height: 30, borderRadius: 8, borderWidth: 1, borderColor: c.line2, alignItems: 'center', justifyContent: 'center' }}><IconChevronLeft size={14} color={c.muted} /></View>
        <View style={{ paddingHorizontal: 13, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: c.line2 }}><Text style={{ fontSize: 12, fontWeight: '600', color: c.text }}>Oggi</Text></View>
        <View style={{ width: 30, height: 30, borderRadius: 8, borderWidth: 1, borderColor: c.line2, alignItems: 'center', justifyContent: 'center' }}><IconChevronRight size={14} color={c.muted} /></View>
        <View style={{ flex: 1 }} />
        <Text style={{ fontSize: 14, fontWeight: '600', color: c.text }}>Sab 27 giu</Text>
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
          <View style={{ position: 'absolute', top: evTop, left: 52, right: 12, height: CH_H - 6, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, gap: 2, backgroundColor: c.timed + (c.dark ? '2b' : '1c'), borderWidth: 1, borderColor: c.timed + (c.dark ? '3a' : '30') }}>
            <Text style={{ fontSize: 12.5, fontWeight: '600', color: c.text }}>Contattare Giovanni</Text>
            <Text style={{ fontSize: 10, color: c.dark ? c.muted : c.timed }}>11:30 – 12:30</Text>
          </View>
          <View style={{ position: 'absolute', top: nowTop, left: 46, right: 0, borderTopWidth: 1.5, borderTopColor: c.accent }}>
            <View style={{ position: 'absolute', left: 0, top: -3.5, width: 7, height: 7, borderRadius: 3.5, backgroundColor: c.accent }} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
function SettingsContent({ c }: { c: ObsidianColors }) {
  const [haptic, setHaptic] = React.useState(true);
  const [confirmDelete, setConfirmDelete] = React.useState(true);
  const [notif, setNotif] = React.useState(false);
  const [theme, setTheme] = React.useState('light');
  const [tileColor, setTileColor] = React.useState('tint');

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

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 }}>
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
export function ObsidianViewsScreen({ initial = 'tiles' }: { initial?: MobileViewId }) {
  const c = useObsidian();
  const [active, setActive] = React.useState<MobileViewId>(initial);

  return (
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
      <ObsidianStatusBar />
      <ObsidianTopNav active={active} onNavigate={setActive} onHome={() => setActive('tiles')} />
      {active === 'tiles' && <TilesContent c={c} />}
      {active === 'flows' && <FlowsContent c={c} />}
      {active === 'chrono' && <ChronoContent c={c} />}
      {active === 'settings' && <SettingsContent c={c} />}
      <ObsidianNavPill />
    </View>
  );
}
