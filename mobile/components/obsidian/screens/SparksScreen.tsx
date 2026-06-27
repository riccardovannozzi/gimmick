/**
 * Gimmick · Obsidian — Mobile Sparks list.
 *
 * Filterable spark list: per-type filter chips + sort + cards (type icon, mono
 * name, TYPE · date · preview, AI flag). Reference: GimmickMobileSparks.dc.html.
 * Type colors come from the canonical scale.
 */
import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import {
  IconArrowLeft, IconHome, IconSparkles, IconSearch, IconSettings,
  IconMicrophone, IconAlignLeft, IconCamera, IconVideo, IconPaperclip,
  IconCheck, IconChevronRight, IconChevronDown, IconArrowsSort,
} from '@tabler/icons-react-native';
import { useObsidian } from '@/lib/obsidian';
import type { ObsidianColors } from '@/constants/obsidian';
import { ObsidianStatusBar } from '../StatusBar';
import { ObsidianNavPill } from '../NavPill';

type SparkType = 'audio' | 'text' | 'photo' | 'video' | 'file';
interface Spark { id: number; name: string; type: SparkType; date: string; body?: string; dim?: string; ai?: boolean }

const SPARKS: Spark[] = [
  { id: 1, name: 'audio_recording', type: 'audio', date: '26/06', ai: true },
  { id: 2, name: 'p 16.12.25', type: 'text', date: '26/06', body: 'Promemoria pagamento', ai: true },
  { id: 3, name: 'pagata 20.03.26', type: 'text', date: '26/06', body: 'Fattura saldata', ai: true },
  { id: 4, name: 'Questo è marco guerrieri', type: 'text', date: '25/06', body: 'Contatto nuovo', ai: true },
  { id: 5, name: 'photo', type: 'photo', date: '25/06', dim: '1,4 MB', ai: true },
  { id: 6, name: 'audio_recording', type: 'audio', date: '25/06', ai: true },
  { id: 7, name: 'preventivo_om.pdf', type: 'file', date: '25/06', dim: '240 KB', ai: false },
  { id: 8, name: 'clip_demo', type: 'video', date: '24/06', dim: '8,2 MB', ai: false },
  { id: 9, name: 'audio_recording', type: 'audio', date: '24/06', ai: true },
];

function typeMeta(type: SparkType, c: ObsidianColors): { color: string; Icon: typeof IconCamera; label: string } {
  switch (type) {
    case 'audio': return { color: c.cap.voice, Icon: IconMicrophone, label: 'Audio' };
    case 'text': return { color: c.cap.text, Icon: IconAlignLeft, label: 'Text' };
    case 'photo': return { color: c.cap.photo, Icon: IconCamera, label: 'Photo' };
    case 'video': return { color: c.cap.video, Icon: IconVideo, label: 'Video' };
    case 'file': return { color: c.cap.file, Icon: IconPaperclip, label: 'File' };
  }
}

function Dot({ c }: { c: ObsidianColors }) {
  return <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: c.faint }} />;
}

function Preview({ c, s }: { c: ObsidianColors; s: Spark }) {
  const col = typeMeta(s.type, c).color;
  if (s.type === 'audio') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, height: 16 }}>
        {[6, 11, 8, 13, 9, 7, 12, 8].map((v, i) => <View key={i} style={{ width: 2, height: v, borderRadius: 1, backgroundColor: col, opacity: 0.8 }} />)}
      </View>
    );
  }
  if (s.type === 'text' && s.body) return <Text numberOfLines={1} style={{ flex: 1, fontSize: 11.5, color: c.subtle, fontStyle: 'italic' }}>{s.body}</Text>;
  if (s.dim) return <Text style={{ fontSize: 11, color: c.subtle }}>{s.dim}</Text>;
  return null;
}

function SparkCard({ c, s, last }: { c: ObsidianColors; s: Spark; last: boolean }) {
  const { color, Icon, label } = typeMeta(s.type, c);
  const preview = <Preview c={c} s={s} />;
  const hasPreview = (s.type === 'audio') || (s.type === 'text' && !!s.body) || !!s.dim;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 4, borderBottomWidth: last ? 0 : 1, borderBottomColor: c.line }}>
      <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: color + (c.dark ? '2e' : '1c'), alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={20} color={color} strokeWidth={1.8} />
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontSize: 13.5, fontWeight: '500', color: c.text, marginBottom: 4 }}>{s.name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 0.4, color }}>{label.toUpperCase()}</Text>
          <Dot c={c} />
          <Text style={{ fontSize: 11, color: c.subtle }}>{s.date}</Text>
          {hasPreview ? <Dot c={c} /> : null}
          {preview}
        </View>
      </View>
      {s.ai ? (
        <View style={{ width: 22, height: 22, borderRadius: 7, backgroundColor: c.cap.text, alignItems: 'center', justifyContent: 'center' }}>
          <IconCheck size={13} color="#fff" strokeWidth={2.4} />
        </View>
      ) : (
        <View style={{ width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: c.line2 }} />
      )}
      <IconChevronRight size={15} color={c.faint} strokeWidth={1.8} />
    </View>
  );
}

function Header({ c, onBack, onHome, onSearch, onSettings }: { c: ObsidianColors; onBack?: () => void; onHome?: () => void; onSearch?: () => void; onSettings?: () => void }) {
  const Ib = ({ Icon, onPress, label }: { Icon: typeof IconHome; onPress?: () => void; label: string }) => (
    <Pressable onPress={onPress} accessibilityLabel={label} hitSlop={6} style={({ pressed }) => ({ width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
      <Icon size={19} color={c.muted} strokeWidth={1.8} />
    </Pressable>
  );
  return (
    <View style={{ height: 54, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: c.line }}>
      <Ib Icon={IconArrowLeft} onPress={onBack} label="Indietro" />
      <Ib Icon={IconHome} onPress={onHome} label="Home" />
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 4 }}>
        <IconSparkles size={20} color={c.accent} strokeWidth={1.8} />
        <Text style={{ fontSize: 17, fontWeight: '600', color: c.text }}>Sparks</Text>
        <Text style={{ fontSize: 12, color: c.subtle }}>14</Text>
      </View>
      <Ib Icon={IconSearch} onPress={onSearch} label="Cerca" />
      <Ib Icon={IconSettings} onPress={onSettings} label="Impostazioni" />
    </View>
  );
}

export function ObsidianSparksScreen() {
  const c = useObsidian();
  const [filter, setFilter] = React.useState<'all' | SparkType>('all');

  const counts = React.useMemo(() => {
    const m: Record<string, number> = {};
    SPARKS.forEach((s) => { m[s.type] = (m[s.type] ?? 0) + 1; });
    return m;
  }, []);
  const rows = filter === 'all' ? SPARKS : SPARKS.filter((s) => s.type === filter);

  const chips: Array<{ id: 'all' | SparkType; label: string; type?: SparkType; count: number }> = [
    { id: 'all', label: 'Tutti', count: SPARKS.length },
    { id: 'audio', label: 'Audio', type: 'audio', count: counts.audio ?? 0 },
    { id: 'text', label: 'Text', type: 'text', count: counts.text ?? 0 },
    { id: 'photo', label: 'Photo', type: 'photo', count: counts.photo ?? 0 },
    { id: 'video', label: 'Video', type: 'video', count: counts.video ?? 0 },
    { id: 'file', label: 'File', type: 'file', count: counts.file ?? 0 },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
      <ObsidianStatusBar />
      <Header c={c} />

      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 7, paddingHorizontal: 16, paddingVertical: 12 }}>
        {chips.map((ch) => {
          const on = filter === ch.id;
          const col = ch.type ? typeMeta(ch.type, c).color : c.accent;
          const Icon = ch.type ? typeMeta(ch.type, c).Icon : IconSparkles;
          const bg = on ? (ch.type ? col + (c.dark ? '24' : '16') : c.accentSoft) : c.surface;
          const border = on ? (ch.type ? col + (c.dark ? '4d' : '40') : 'transparent') : c.line;
          const fg = on ? (ch.type ? (c.dark ? c.text : col) : c.accent) : c.muted;
          return (
            <Pressable key={ch.id} onPress={() => setFilter(ch.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 12, borderRadius: 9, backgroundColor: bg, borderWidth: 1, borderColor: border }}>
              <Icon size={ch.type ? 13 : 12} color={on ? (ch.type ? col : c.accent) : c.subtle} strokeWidth={1.8} />
              <Text style={{ fontSize: 12.5, fontWeight: '600', color: fg }}>{ch.label}</Text>
              <Text style={{ fontSize: 11, color: fg, opacity: 0.75 }}>{ch.count}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Sort */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 }}>
        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <IconArrowsSort size={13} color={c.subtle} strokeWidth={1.8} />
          <Text style={{ fontSize: 12, fontWeight: '600', color: c.muted }}>Data</Text>
          <IconChevronDown size={11} color={c.subtle} strokeWidth={1.8} />
        </View>
      </View>

      {/* List */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}>
        {rows.length ? rows.map((s, i) => <SparkCard key={s.id} c={c} s={s} last={i === rows.length - 1} />)
          : <Text style={{ fontSize: 13, color: c.subtle, textAlign: 'center', paddingVertical: 40 }}>Nessuno spark di questo tipo.</Text>}
      </ScrollView>

      <ObsidianNavPill />
    </View>
  );
}
