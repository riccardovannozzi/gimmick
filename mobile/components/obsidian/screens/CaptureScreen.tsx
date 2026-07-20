/**
 * Gimmick · Obsidian — Mobile Capture screen.
 *
 * Capture home: AppHeader + "Cattura" intro + "Invia a Gimmick" + the six
 * capture bars + "Set options". Overlays: the tag Drawer (menu), the voice
 * recording sheet (tapping Voice) and the Set-options sheet. Reference:
 * GimmickMobileCapture.dc.html. Reuses the Obsidian mobile shell + tokens.
 */
import React from 'react';
import { View, Text, Pressable, ScrollView, Modal } from 'react-native';
import {
  IconCamera, IconVideo, IconPhoto, IconAlignLeft, IconMicrophone, IconPaperclip,
  IconSend, IconChevronRight, IconChevronDown,
  IconNote, IconCheckbox, IconAlertCircle, IconCalendarEvent, IconClock, IconTag,
} from '@tabler/icons-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useObsidian } from '@/lib/obsidian';
import type { ObsidianColors } from '@/constants/obsidian';
import { ObsidianStatusBar } from '../StatusBar';
import { ObsidianNavPill } from '../NavPill';
import { ObsidianAppHeader } from '../AppHeader';
import { ObsidianDrawer } from '../Drawer';

type CapKey = 'photo' | 'video' | 'gallery' | 'text' | 'voice' | 'file';
const CAPS: Array<{ key: CapKey; label: string; sub: string; Icon: typeof IconCamera }> = [
  { key: 'photo', label: 'Photo', sub: 'Scatta o carica una foto', Icon: IconCamera },
  { key: 'video', label: 'Video', sub: 'Registra un video', Icon: IconVideo },
  { key: 'gallery', label: 'Gallery', sub: 'Scegli più elementi', Icon: IconPhoto },
  { key: 'text', label: 'Text', sub: 'Scrivi una nota', Icon: IconAlignLeft },
  { key: 'voice', label: 'Voice', sub: 'Detta un memo vocale', Icon: IconMicrophone },
  { key: 'file', label: 'File', sub: 'Allega un documento', Icon: IconPaperclip },
];

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

// ─── Set-options sheet ────────────────────────────────────────────────────────
function SetOptionsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const c = useObsidian();
  const [action, setAction] = React.useState<'note' | 'todo'>('note');
  const [when, setWhen] = React.useState<'due' | 'allday' | 'timed'>('timed');

  const ActBtn = ({ id, label, Icon }: { id: 'note' | 'todo'; label: string; Icon: typeof IconNote }) => {
    const on = action === id;
    return (
      <Pressable onPress={() => setAction(id)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 11, borderRadius: 10, backgroundColor: on ? c.accent : c.surface2, borderWidth: 1, borderColor: on ? 'transparent' : c.line2 }}>
        <Icon size={15} color={on ? c.accentInk : c.muted} strokeWidth={1.8} />
        <Text style={{ fontSize: 14, fontWeight: on ? '600' : '500', color: on ? c.accentInk : c.text }}>{label}</Text>
      </Pressable>
    );
  };
  const Chip = ({ id, label, Icon }: { id: 'due' | 'allday' | 'timed'; label: string; Icon: typeof IconNote }) => {
    const on = when === id;
    return (
      <Pressable onPress={() => setWhen(id)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 9, backgroundColor: on ? c.accentSoft : c.surface2, borderWidth: 1, borderColor: on ? 'transparent' : c.line }}>
        <Icon size={13} color={on ? c.accent : c.subtle} strokeWidth={1.8} />
        <Text style={{ fontSize: 12.5, fontWeight: on ? '600' : '500', color: on ? c.accent : c.muted }}>{label}</Text>
      </Pressable>
    );
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 18 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: c.text }}>Set options</Text>
        <IconChevronDown size={13} color={c.subtle} strokeWidth={1.8} />
      </View>
      <Eyebrow c={c}>AZIONE</Eyebrow>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
        <ActBtn id="note" label="Notes" Icon={IconNote} />
        <ActBtn id="todo" label="To do" Icon={IconCheckbox} />
      </View>
      <View style={{ flexDirection: 'row', gap: 7, marginBottom: 18 }}>
        <Chip id="due" label="Scadenza" Icon={IconAlertCircle} />
        <Chip id="allday" label="Giornata" Icon={IconCalendarEvent} />
        <Chip id="timed" label="A orario" Icon={IconClock} />
      </View>
      <Eyebrow c={c}>TAG</Eyebrow>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: c.field, borderWidth: 1, borderColor: c.line2, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 11 }}>
        <IconTag size={15} color={c.subtle} strokeWidth={1.8} />
        <Text style={{ flex: 1, fontSize: 13, color: c.subtle }}>Seleziona tag…</Text>
        <IconChevronDown size={14} color={c.subtle} strokeWidth={1.8} />
      </View>
    </BottomSheet>
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
        <Pressable onPress={onClose} style={{ flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: c.line2, alignItems: 'center' }}>
          <Text style={{ fontSize: 14, fontWeight: '500', color: c.muted }}>Annulla</Text>
        </Pressable>
        <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: col, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 20, height: 20, borderRadius: 4, backgroundColor: '#fff' }} />
        </View>
        <Pressable onPress={onClose} style={{ flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: c.accent, alignItems: 'center' }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: c.accentInk }}>Salva spark</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export function ObsidianCaptureScreen() {
  const c = useObsidian();
  const [drawer, setDrawer] = React.useState(false);
  const [voice, setVoice] = React.useState(false);
  const [options, setOptions] = React.useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
      <ObsidianStatusBar />
      <ObsidianAppHeader bufferCount={8} onMenu={() => setDrawer(true)} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 16 }}>
        <Text style={{ fontSize: 26, fontWeight: '700', letterSpacing: -0.6, color: c.text, marginTop: 6, marginHorizontal: 2, marginBottom: 4 }}>Cattura</Text>
        <Text style={{ fontSize: 13, color: c.muted, marginHorizontal: 2, marginBottom: 16 }}>Butta dentro, poi invia tutto a Gimmick.</Text>

        {/* Send */}
        <Pressable style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: c.accent, borderRadius: 14, paddingVertical: 14, marginBottom: 16, opacity: pressed ? 0.92 : 1 })}>
          <IconSend size={18} color={c.accentInk} strokeWidth={1.8} />
          <Text style={{ fontSize: 15, fontWeight: '600', color: c.accentInk }}>Invia a Gimmick</Text>
          <Text style={{ fontSize: 12, fontWeight: '700', color: c.accentInk, backgroundColor: c.dark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.24)', borderRadius: 7, paddingHorizontal: 8, paddingVertical: 2, fontVariant: ['tabular-nums'] }}>2</Text>
        </Pressable>

        {/* Capture bars */}
        <View style={{ gap: 9 }}>
          {CAPS.map(({ key, label, sub, Icon }) => {
            const col = c.cap[key];
            return (
              <Pressable
                key={key}
                onPress={() => { if (key === 'voice') setVoice(true); }}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', gap: 14,
                  backgroundColor: pressed ? col + (c.dark ? '24' : '14') : c.surface,
                  borderWidth: 1, borderColor: pressed ? col + (c.dark ? '4d' : '40') : c.line,
                  borderRadius: 14, paddingVertical: 13, paddingHorizontal: 14,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                })}
              >
                {({ pressed }) => (
                  <>
                    <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: pressed ? col : col + (c.dark ? '2e' : '1c'), alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={22} color={pressed ? '#fff' : col} strokeWidth={1.8} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: c.text }}>{label}</Text>
                      <Text style={{ fontSize: 12, color: c.subtle, marginTop: 1 }}>{sub}</Text>
                    </View>
                    <IconChevronRight size={16} color={pressed ? col : c.faint} strokeWidth={1.8} />
                  </>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Set options */}
        <Pressable onPress={() => setOptions(true)} style={({ pressed }) => ({ marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: c.line2, backgroundColor: c.surface, opacity: pressed ? 0.8 : 1 })}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: c.muted }}>Set options</Text>
          <IconChevronDown size={13} color={c.muted} strokeWidth={1.8} style={{ transform: [{ rotate: '180deg' }] }} />
        </Pressable>
      </ScrollView>

      <ObsidianNavPill />

      {/* Overlays */}
      <ObsidianDrawer open={drawer} onClose={() => setDrawer(false)} />
      <VoiceSheet open={voice} onClose={() => setVoice(false)} />
      <SetOptionsSheet open={options} onClose={() => setOptions(false)} />
    </View>
  );
}
