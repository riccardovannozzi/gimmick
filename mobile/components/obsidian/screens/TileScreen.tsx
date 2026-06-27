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
import type { ObsidianColors } from '@/constants/obsidian';
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
  { key: 'gallery', label: 'Gallery', color: (c) => c.cap.gallery, Icon: IconPhoto },
  { key: 'text', label: 'Text', color: (c) => c.cap.text, Icon: IconAlignLeft },
  { key: 'voice', label: 'Voice', color: (c) => c.cap.voice, Icon: IconMicrophone },
  { key: 'file', label: 'File', color: (c) => c.cap.file, Icon: IconPaperclip },
];
const VOICE_BARS = [8, 14, 20, 12, 24, 30, 18, 10, 22, 28, 16, 9, 15, 22, 13, 18, 10];

export function ObsidianTileScreen({ onBack }: { onBack?: () => void }) {
  const c = useObsidian();
  const [when, setWhen] = React.useState<'due' | 'allday' | 'timed'>('timed');
  const [action, setAction] = React.useState<'note' | 'todo'>('note');

  const ActionBtn = ({ id, label, Icon }: { id: 'note' | 'todo'; label: string; Icon: typeof IconNote }) => {
    const on = action === id;
    return (
      <Pressable onPress={() => setAction(id)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 11, borderRadius: 10, backgroundColor: on ? c.accentSoft : c.field, borderWidth: 1, borderColor: on ? 'transparent' : c.line2 }}>
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: c.accentSoft, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 10 }}>
            <IconClock size={13} color={c.accent} strokeWidth={1.8} />
            <Text style={{ fontSize: 11, fontWeight: '600', color: c.accent }}>Oggi · 11:00–12:00</Text>
          </View>
          <Text style={{ fontSize: 23, fontWeight: '700', letterSpacing: -0.4, color: c.text, lineHeight: 27 }}>OM/call con barbini</Text>
        </View>

        {/* Timing segmented */}
        <View style={{ marginTop: 16, flexDirection: 'row', gap: 3, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.line, borderRadius: 11, padding: 3 }}>
          {WHEN.map((w) => {
            const on = when === w.id;
            return (
              <Pressable key={w.id} onPress={() => setWhen(w.id)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 8, backgroundColor: on ? c.accentSoft : 'transparent' }}>
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
            <Text style={{ fontSize: 14, fontWeight: '500', color: c.accent }}>Golfo del Sole</Text>
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
        <Section c={c} eyebrow="SPARKS · 3">
          <View style={{ flexDirection: 'row', backgroundColor: c.field, borderWidth: 1, borderColor: c.line2, borderRadius: 10, overflow: 'hidden' }}>
            {CAPS.map((cap, i) => (
              <View key={cap.key} style={{ flex: 1, paddingVertical: 10, alignItems: 'center', gap: 3, borderLeftWidth: i === 0 ? 0 : 1, borderLeftColor: c.line }}>
                <cap.Icon size={17} color={cap.color(c)} strokeWidth={1.8} />
                <Text style={{ fontSize: 8.5, fontWeight: '600', color: c.subtle }}>{cap.label}</Text>
              </View>
            ))}
          </View>

          {/* voice card */}
          <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.field, borderWidth: 1, borderColor: c.line, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 12 }}>
            <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: c.cap.voice, alignItems: 'center', justifyContent: 'center' }}>
              <IconPlayerPlay size={19} color="#fff" fill="#fff" />
            </View>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2, height: 22 }}>
              {VOICE_BARS.map((v, i) => <View key={i} style={{ width: 2.5, height: v, borderRadius: 2, backgroundColor: i < 6 ? c.cap.voice : c.line2 }} />)}
            </View>
            <Text style={{ fontSize: 11, color: c.subtle, fontVariant: ['tabular-nums'] }}>02:14</Text>
          </View>

          {/* text card */}
          <View style={{ marginTop: 10, backgroundColor: c.field, borderWidth: 1, borderColor: c.line, borderRadius: 12, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: c.line }}>
              <IconAlignLeft size={14} color={c.cap.text} strokeWidth={1.8} />
              <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: c.subtle }}>TESTO</Text>
            </View>
            <Text style={{ paddingHorizontal: 12, paddingVertical: 11, fontSize: 13, lineHeight: 19.5, color: c.muted }}>
              Abbiamo n°3 D-matrix (per ricevere segnale satellitare) ed una centrale Galaxia (già installata sul tetto…)
            </Text>
          </View>
        </Section>
      </ScrollView>

      {/* Save bar */}
      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, borderTopWidth: 1, borderTopColor: c.line }}>
        <Pressable onPress={onBack} style={{ flex: 1, height: 46, borderRadius: 12, borderWidth: 1, borderColor: c.line2, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: c.muted }}>Annulla</Text>
        </Pressable>
        <Pressable style={{ flex: 2, height: 46, borderRadius: 12, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: c.accentInk }}>Salva</Text>
        </Pressable>
      </View>

      <ObsidianNavPill />
    </View>
  );
}
