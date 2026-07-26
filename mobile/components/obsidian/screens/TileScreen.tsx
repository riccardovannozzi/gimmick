/**
 * Gimmick · Obsidian — Mobile Tile detail (Inspector).
 *
 * Tile editor: event chip + title, action/timing segmented, date & time, tag,
 * type & status, and the SPARKS strip (caps + voice card + text card), with a
 * Save bar. Reference: GimmickMobileTile.dc.html. Reuses the mobile shell.
 */
import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import {
  IconArrowLeft, IconTrash, IconDots, IconClock, IconAlertCircle, IconCalendarEvent,
  IconNote, IconCheckbox, IconCalendar, IconTag, IconPhone, IconCircleCheck,
  IconPlayerPlay, IconChevronDown,
  IconCamera, IconVideo, IconPhoto, IconAlignLeft, IconMicrophone, IconPaperclip,
} from '@tabler/icons-react-native';
import { useObsidian } from '@/lib/obsidian';
import { OB_BTN_H, type ObsidianColors } from '@/constants/obsidian';
import type { Tile, Spark } from '@/types';
import { formatDuration } from '@/utils/formatters';
import { ObsidianStatusBar } from '../StatusBar';
import { ObsidianNavPill } from '../NavPill';

// ─── Atoms ────────────────────────────────────────────────────────────────────
function Eyebrow({ c, children }: { c: ObsidianColors; children: React.ReactNode }) {
  return <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1.3, color: c.subtle, marginBottom: 9 }}>{children}</Text>;
}
function Section({ c, eyebrow, children }: { c: ObsidianColors; eyebrow: string; children: React.ReactNode }) {
  return <View style={{ marginTop: 20 }}><Eyebrow c={c}>{eyebrow}</Eyebrow>{children}</View>;
}
function Field({ c, value, Icon, iconColor, chev }: { c: ObsidianColors; value: string; Icon?: typeof IconClock; iconColor?: string; chev?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.field, borderWidth: 1, borderColor: c.line2, borderRadius: 11, paddingHorizontal: 13, paddingVertical: 12 }}>
      {Icon ? <Icon size={16} color={iconColor ?? c.subtle} strokeWidth={1.8} /> : null}
      <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, color: c.text }}>{value}</Text>
      {chev ? <IconChevronDown size={14} color={c.subtle} strokeWidth={1.8} /> : null}
    </View>
  );
}

const WHEN = [
  { id: 'due', label: 'Scadenza', Icon: IconAlertCircle },
  { id: 'allday', label: 'Giornata', Icon: IconCalendarEvent },
  { id: 'timed', label: 'A orario', Icon: IconClock },
] as const;

const CAPS: Array<{ key: string; label: string; color: (c: ObsidianColors) => string; Icon: typeof IconCamera }> = [
  { key: 'photo', label: 'Photo', color: (c) => c.cap.photo, Icon: IconCamera },
  { key: 'video', label: 'Video', color: (c) => c.cap.video, Icon: IconVideo },
  { key: 'gallery', label: 'Image', color: (c) => c.cap.gallery, Icon: IconPhoto },
  { key: 'text', label: 'Text', color: (c) => c.cap.text, Icon: IconAlignLeft },
  { key: 'voice', label: 'Voice', color: (c) => c.cap.voice, Icon: IconMicrophone },
  { key: 'file', label: 'File', color: (c) => c.cap.file, Icon: IconPaperclip },
];
const VOICE_BARS = [8, 14, 20, 12, 24, 30, 18, 10, 22, 28, 16, 9, 15, 22, 13, 18, 10];

const MONTHS_LONG = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const DAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Header chip text for a scheduled tile, e.g. "Oggi · 11:00–12:00". */
function chipText(t: Tile): string | null {
  if (!t.start_at) return null;
  const s = new Date(t.start_at);
  if (Number.isNaN(s.getTime())) return null;
  const now = new Date();
  const sameDay = s.toDateString() === now.toDateString();
  const datePart = sameDay
    ? 'Oggi'
    : `${DAYS_SHORT[s.getDay()]} ${s.getDate()} ${MONTHS_LONG[s.getMonth()].slice(0, 3)}`;
  if (t.all_day) return `${datePart} · Giornata`;
  const range = t.end_at ? `${hhmm(s)}–${hhmm(new Date(t.end_at))}` : hhmm(s);
  return `${datePart} · ${range}`;
}

export interface ObsidianTileScreenProps {
  onBack?: () => void;
  /** API tile (with sparks). Omit for the static QA mockup. */
  tile?: Tile;
  loading?: boolean;
}

export function ObsidianTileScreen({ onBack, tile, loading }: ObsidianTileScreenProps) {
  const c = useObsidian();
  const live = !!tile;
  const sparks: Spark[] = tile?.sparks ?? [];
  const voiceSpark = sparks.find((s) => s.type === 'audio_recording');
  const textSpark = sparks.find((s) => s.type === 'text');
  const tagName = tile?.tags?.find((tg) => !tg.is_root)?.name;
  const chip = tile ? chipText(tile) : 'Oggi · 11:00–12:00';
  const title = live ? (tile?.title?.trim() || 'Senza titolo') : 'OM/call con barbini';
  const sparksCount = live ? sparks.length : 3;

  const initialWhen: 'due' | 'allday' | 'timed' =
    tile?.action_type === 'deadline' ? 'due' : tile?.all_day ? 'allday' : 'timed';
  const [when, setWhen] = React.useState<'due' | 'allday' | 'timed'>(initialWhen);
  const [action, setAction] = React.useState<'note' | 'todo'>(
    tile?.action_type === 'anytime' ? 'todo' : 'note',
  );

  const ActionBtn = ({ id, label, Icon }: { id: 'note' | 'todo'; label: string; Icon: typeof IconNote }) => {
    const on = action === id;
    return (
      <Pressable onPress={() => setAction(id)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: OB_BTN_H, borderRadius: 10, backgroundColor: on ? c.accentSoft : c.field, borderWidth: 1, borderColor: on ? 'transparent' : c.line2 }}>
        <Icon size={15} color={on ? c.accent : c.muted} strokeWidth={1.8} />
        <Text style={{ fontSize: 13.5, fontWeight: '500', color: on ? c.accent : c.text }}>{label}</Text>
      </Pressable>
    );
  };

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
        {/* Title */}
        <View style={{ marginTop: 6 }}>
          {chip ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: c.accentSoft, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 10 }}>
              <IconClock size={13} color={c.accent} strokeWidth={1.8} />
              <Text style={{ fontSize: 11, fontWeight: '600', color: c.accent }}>{chip}</Text>
            </View>
          ) : null}
          <Text style={{ fontSize: 23, fontWeight: '700', letterSpacing: -0.4, color: c.text, lineHeight: 27 }}>
            {loading ? 'Caricamento…' : title}
          </Text>
        </View>

        {/* Timing segmented */}
        <View style={{ marginTop: 16, flexDirection: 'row', gap: 3, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.line, borderRadius: 11, padding: 3 }}>
          {WHEN.map((w) => {
            const on = when === w.id;
            return (
              <Pressable key={w.id} onPress={() => setWhen(w.id)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: OB_BTN_H, borderRadius: 8, backgroundColor: on ? c.accentSoft : 'transparent' }}>
                <w.Icon size={13} color={on ? c.accent : c.muted} strokeWidth={1.8} />
                <Text style={{ fontSize: 12.5, fontWeight: on ? '600' : '500', color: on ? c.accent : c.muted }}>{w.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Action */}
        <Section c={c} eyebrow="AZIONE">
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <ActionBtn id="note" label="Note" Icon={IconNote} />
            <ActionBtn id="todo" label="To-do" Icon={IconCheckbox} />
          </View>
        </Section>

        {/* Date & time */}
        <Section c={c} eyebrow="DATA E ORARIO">
          <View style={{ gap: 8 }}>
            <Field c={c} value="Sab 22 giugno 2026" Icon={IconCalendar} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}><Field c={c} value="11:00" Icon={IconClock} /></View>
              <View style={{ flex: 1 }}><Field c={c} value="12:00" Icon={IconClock} /></View>
            </View>
          </View>
        </Section>

        {/* Tag */}
        <Section c={c} eyebrow="TAG">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: c.accentSoft, borderWidth: 1, borderColor: c.line, borderRadius: 11, paddingHorizontal: 13, paddingVertical: 12 }}>
            <IconTag size={16} color={c.accent} strokeWidth={1.8} />
            <Text style={{ fontSize: 14, fontWeight: '500', color: c.accent }}>{live ? (tagName ?? 'Senza tag') : 'Golfo del Sole'}</Text>
          </View>
        </Section>

        {/* Type & status */}
        <Section c={c} eyebrow="TIPO E STATO">
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Field c={c} value="Call" Icon={IconPhone} iconColor={c.muted} chev /></View>
            <View style={{ flex: 1 }}><Field c={c} value="Done" Icon={IconCircleCheck} iconColor={c.timed} chev /></View>
          </View>
        </Section>

        {/* Sparks */}
        <Section c={c} eyebrow={`SPARKS · ${sparksCount}`}>
          <View style={{ flexDirection: 'row', backgroundColor: c.field, borderWidth: 1, borderColor: c.line2, borderRadius: 10, overflow: 'hidden' }}>
            {CAPS.map((cap, i) => (
              <View key={cap.key} style={{ flex: 1, paddingVertical: 10, alignItems: 'center', gap: 3, borderLeftWidth: i === 0 ? 0 : 1, borderLeftColor: c.line }}>
                <cap.Icon size={17} color={cap.color(c)} strokeWidth={1.8} />
                <Text style={{ fontSize: 8.5, fontWeight: '600', color: c.subtle }}>{cap.label}</Text>
              </View>
            ))}
          </View>

          {/* voice card — shown when an audio spark exists (or in the QA mock) */}
          {(!live || voiceSpark) && (
            <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.field, borderWidth: 1, borderColor: c.line, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 12 }}>
              <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: c.cap.voice, alignItems: 'center', justifyContent: 'center' }}>
                <IconPlayerPlay size={19} color="#fff" fill="#fff" />
              </View>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2, height: 22 }}>
                {VOICE_BARS.map((v, i) => <View key={i} style={{ width: 2.5, height: v, borderRadius: 2, backgroundColor: i < 6 ? c.cap.voice : c.line2 }} />)}
              </View>
              <Text style={{ fontSize: 11, color: c.subtle, fontVariant: ['tabular-nums'] }}>
                {voiceSpark?.duration ? formatDuration(voiceSpark.duration) : '02:14'}
              </Text>
            </View>
          )}

          {/* text card — shown when a text spark exists (or in the QA mock) */}
          {(!live || textSpark) && (
            <View style={{ marginTop: 10, backgroundColor: c.field, borderWidth: 1, borderColor: c.line, borderRadius: 12, overflow: 'hidden' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: c.line }}>
                <IconAlignLeft size={14} color={c.cap.text} strokeWidth={1.8} />
                <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: c.subtle }}>TESTO</Text>
              </View>
              <Text style={{ paddingHorizontal: 12, paddingVertical: 11, fontSize: 13, lineHeight: 19.5, color: c.muted }}>
                {live
                  ? (textSpark?.content?.trim() || '')
                  : 'Abbiamo n°3 D-matrix (per ricevere segnale satellitare) ed una centrale Galaxia (già installata sul tetto…)'}
              </Text>
            </View>
          )}
        </Section>
      </ScrollView>

      {/* Save bar */}
      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, borderTopWidth: 1, borderTopColor: c.line }}>
        <Pressable onPress={onBack} style={{ flex: 1, minHeight: OB_BTN_H, borderRadius: 12, borderWidth: 1, borderColor: c.line2, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: c.muted }}>Annulla</Text>
        </Pressable>
        <Pressable style={{ flex: 2, minHeight: OB_BTN_H, borderRadius: 12, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: c.accentInk }}>Salva</Text>
        </Pressable>
      </View>

      <ObsidianNavPill />
    </View>
  );
}
