/**
 * Gimmick · Obsidian — Mobile capture flows.
 *
 * The internal capture flows reached from the six capture bars: Camera, Video,
 * Voice recorder, Text editor, Gallery picker, File picker, plus the "Save
 * spark" sheet. Reference: GimmickCaptureFlows.dc.html. Camera/Video are dark
 * camera UIs; the others follow the active theme. Decorative CSS gradients are
 * approximated with flat fills (no extra dependency).
 */
import React from 'react';
import { View, Text, Pressable, ScrollView, TextInput } from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  IconX, IconBolt, IconCameraRotate, IconFlag, IconPlayerPause,
  IconBold, IconItalic, IconList, IconCheckbox, IconTag, IconPlus,
  IconChevronDown, IconFile, IconCheck, IconNote, IconAlertCircle,
  IconCalendarEvent, IconClock, IconSend, IconMicrophone,
} from '@tabler/icons-react-native';
import { useObsidian } from '@/lib/obsidian';
import { OB_BTN_H, type ObsidianColors } from '@/constants/obsidian';
import { ObsidianNavPill } from '../NavPill';

// ─── Shared chrome ────────────────────────────────────────────────────────────
function TopBar({ c, left, title, right }: { c: ObsidianColors; left?: React.ReactNode; title: string; right?: React.ReactNode }) {
  return (
    <View style={{ height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 }}>
      <View style={{ minWidth: 62, alignItems: 'flex-start' }}>{left}</View>
      <Text style={{ fontSize: 16, fontWeight: '600', color: c.text }}>{title}</Text>
      <View style={{ minWidth: 62, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}
function TextBtn({ c, label, accent, onPress }: { c: ObsidianColors; label: string; accent?: boolean; onPress?: () => void }) {
  return (
    // Sta in una TopBar da 52dp, quindi non può diventare alto 48 senza
    // sfondarla: qui lo standard si raggiunge con hitSlop verticale, che
    // allarga l'area toccabile lasciando intatto il layout. Il testo è ~18dp,
    // +15 sopra e sotto ⇒ 48dp effettivi.
    <Pressable onPress={onPress} hitSlop={{ top: 15, bottom: 15, left: 10, right: 10 }}>
      <Text style={{ fontSize: 15, fontWeight: accent ? '600' : '500', color: accent ? c.accent : c.muted }}>{label}</Text>
    </Pressable>
  );
}
function RoundBtn({ children, onPress, bg, size = 34 }: { children: React.ReactNode; onPress?: () => void; bg?: string; size?: number }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} style={({ pressed }) => ({ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: bg, opacity: pressed ? 0.7 : 1 })}>
      {children}
    </Pressable>
  );
}
function TopInset({ background }: { background: string }) {
  const insets = useSafeAreaInsets();
  return <View style={{ height: insets.top, backgroundColor: background }} />;
}

/** Soft blob mascot (the DC's `mascot()` placeholder). */
function SoftMascot({ color, size = 32 }: { color: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.34, backgroundColor: color, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: size * 0.16 }}>
      <View style={{ width: size * 0.14, height: size * 0.14, borderRadius: size * 0.07, backgroundColor: 'rgba(0,0,0,0.55)' }} />
      <View style={{ width: size * 0.14, height: size * 0.14, borderRadius: size * 0.07, backgroundColor: 'rgba(0,0,0,0.55)' }} />
    </View>
  );
}

// ─── 1. Camera ────────────────────────────────────────────────────────────────
function Corner({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const m = 22, col = 'rgba(255,255,255,0.85)';
  const s: any = { position: 'absolute', width: 26, height: 26, borderColor: col };
  if (pos === 'tl') Object.assign(s, { top: m, left: m, borderTopWidth: 2.5, borderLeftWidth: 2.5, borderTopLeftRadius: 6 });
  if (pos === 'tr') Object.assign(s, { top: m, right: m, borderTopWidth: 2.5, borderRightWidth: 2.5, borderTopRightRadius: 6 });
  if (pos === 'bl') Object.assign(s, { bottom: m, left: m, borderBottomWidth: 2.5, borderLeftWidth: 2.5, borderBottomLeftRadius: 6 });
  if (pos === 'br') Object.assign(s, { bottom: m, right: m, borderBottomWidth: 2.5, borderRightWidth: 2.5, borderBottomRightRadius: 6 });
  return <View style={s} />;
}
function ModeStrip({ active, activeColor }: { active: 'Voce' | 'Foto' | 'Video'; activeColor: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 26, marginBottom: 18 }}>
      {(['Voce', 'Foto', 'Video'] as const).map((m) => (
        <Text key={m} style={{ fontSize: 13, fontWeight: m === active ? '700' : '500', letterSpacing: 0.5, color: m === active ? activeColor : 'rgba(255,255,255,0.6)' }}>{m.toUpperCase()}</Text>
      ))}
    </View>
  );
}

export function CameraFlow({ onClose }: { onClose: () => void }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#0b0c0d' }}>
      <ExpoStatusBar style="light" />
      <TopInset background="#0b0c0d" />
      <View style={{ flex: 1, backgroundColor: '#1c1d20' }}>
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, zIndex: 4 }}>
          <RoundBtn bg="rgba(0,0,0,0.35)" size={38} onPress={onClose}><IconX size={18} color="#fff" /></RoundBtn>
          <RoundBtn bg="rgba(0,0,0,0.35)" size={38}><IconBolt size={17} color="#FACC4A" /></RoundBtn>
        </View>
        <Corner pos="tl" /><Corner pos="tr" /><Corner pos="bl" /><Corner pos="br" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 120, height: 120, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', borderStyle: 'dashed' }} />
        </View>
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: 16 }}>
          <ModeStrip active="Foto" activeColor="#FACC4A" />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 30 }}>
            <View style={{ width: 46, height: 46, borderRadius: 11, backgroundColor: '#8273d6', borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)' }} />
            <View style={{ width: 74, height: 74, borderRadius: 37, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: '#fff' }} />
            </View>
            <RoundBtn bg="rgba(255,255,255,0.14)" size={46}><IconCameraRotate size={20} color="#fff" /></RoundBtn>
          </View>
        </View>
      </View>
      <View style={{ backgroundColor: '#1c1d20' }}><ObsidianNavPill /></View>
    </View>
  );
}

// ─── 2. Video ─────────────────────────────────────────────────────────────────
export function VideoFlow({ onClose }: { onClose: () => void }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#0c0a0a' }}>
      <ExpoStatusBar style="light" />
      <TopInset background="#0c0a0a" />
      <View style={{ flex: 1, backgroundColor: '#201a1b' }}>
        <View style={{ position: 'absolute', top: 14, left: 0, right: 0, alignItems: 'center', zIndex: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, paddingVertical: 6, paddingLeft: 11, paddingRight: 14 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#F0463E' }} />
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff', fontVariant: ['tabular-nums'] }}>00:12</Text>
          </View>
        </View>
        <View style={{ position: 'absolute', top: 0, right: 18, height: 52, justifyContent: 'center', zIndex: 4 }}>
          <RoundBtn bg="rgba(0,0,0,0.35)" size={38} onPress={onClose}><IconX size={18} color="#fff" /></RoundBtn>
        </View>
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: 16 }}>
          <ModeStrip active="Video" activeColor="#F0746E" />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 30 }}>
            <View style={{ width: 46, height: 46, borderRadius: 11, backgroundColor: '#d6748b', borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)' }} />
            <View style={{ width: 74, height: 74, borderRadius: 37, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: '#F0463E' }} />
            </View>
            <RoundBtn bg="rgba(255,255,255,0.14)" size={46}><IconCameraRotate size={20} color="#fff" /></RoundBtn>
          </View>
        </View>
      </View>
      <View style={{ backgroundColor: '#201a1b' }}><ObsidianNavPill /></View>
    </View>
  );
}

// ─── 3. Voice recorder ────────────────────────────────────────────────────────
const VOICE_SEED = [5, 9, 16, 24, 32, 22, 14, 28, 38, 30, 18, 10, 22, 34, 40, 32, 20, 12, 8, 16, 26, 36, 28, 18, 10, 6, 14, 24, 30, 20, 12, 8, 18, 28, 22, 14, 9, 16, 22, 14, 8];
export function VoiceFlow({ onClose, onSave }: { onClose: () => void; onSave?: () => void }) {
  const c = useObsidian();
  const red = c.cap.voice;
  return (
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
      <ExpoStatusBar style={c.dark ? 'light' : 'dark'} />
      <TopInset background={c.canvas} />
      <TopBar c={c} left={<RoundBtn onPress={onClose}><IconX size={18} color={c.muted} /></RoundBtn>} title="Memo vocale" right={<TextBtn c={c} label="Salva" accent onPress={onSave} />} />
      <View style={{ flex: 1, paddingHorizontal: 22 }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 30 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: red }} />
            <Text style={{ fontSize: 13, fontWeight: '600', letterSpacing: 0.5, color: red }}>REGISTRAZIONE</Text>
          </View>
          <Text style={{ fontSize: 52, fontWeight: '600', color: c.text, fontVariant: ['tabular-nums'] }}>00:14</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 48, justifyContent: 'center' }}>
            {VOICE_SEED.map((hgt, i) => <View key={i} style={{ width: 4, height: hgt, borderRadius: 2, backgroundColor: i < 26 ? red : c.faint }} />)}
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 30 }}>
          <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' }}>
            <IconFlag size={20} color={c.muted} strokeWidth={1.8} />
          </View>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: red, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 26, height: 26, borderRadius: 7, backgroundColor: '#fff' }} />
          </View>
          <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' }}>
            <IconPlayerPause size={20} color={c.text} strokeWidth={1.8} />
          </View>
        </View>
      </View>
      <ObsidianNavPill />
    </View>
  );
}

// ─── 4. Text editor ───────────────────────────────────────────────────────────
export function TextFlow({ onClose, onSave }: { onClose: () => void; onSave?: () => void }) {
  const c = useObsidian();
  const toolIcons = [IconBold, IconItalic, IconList, IconCheckbox, IconTag];
  return (
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
      <ExpoStatusBar style={c.dark ? 'light' : 'dark'} />
      <TopInset background={c.canvas} />
      <TopBar c={c} left={<TextBtn c={c} label="Annulla" onPress={onClose} />} title="Nota" right={<TextBtn c={c} label="Salva" accent onPress={onSave} />} />
      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 8 }}>
        <TextInput defaultValue="Preventivo bagno · Marco" style={{ fontSize: 21, fontWeight: '700', color: c.text, paddingVertical: 6 }} placeholderTextColor={c.subtle} />
        <Text style={{ fontSize: 12, color: c.subtle, marginBottom: 14 }}>Oggi · 9:30</Text>
        <Text style={{ fontSize: 15.5, lineHeight: 24, color: c.text }}>
          Chiamare Marco per il preventivo del rifacimento bagno. Mandargli le misure prese ieri (1,80 × 2,40) e le foto delle piastrelle.
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: c.line, backgroundColor: c.surface }}>
        {toolIcons.map((Icon, i) => (
          <View key={i} style={{ width: 40, height: 38, borderRadius: 9, alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={18} color={c.muted} strokeWidth={1.8} />
          </View>
        ))}
        <View style={{ flex: 1 }} />
        <View style={{ width: 40, height: 38, borderRadius: 9, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <IconPlus size={18} color={c.accent} strokeWidth={1.8} />
        </View>
      </View>
      <ObsidianNavPill />
    </View>
  );
}

// ─── 5. Gallery ───────────────────────────────────────────────────────────────
const GALLERY_TINTS = ['#7f9fe0', '#e0a07f', '#7fcfa0', '#d07fc0', '#e0cf7f', '#7fcdd8', '#9f8fe0', '#e08f8f', '#8f9fe0'];
const GALLERY_SEL: Record<number, number> = { 0: 1, 4: 2 };
export function GalleryFlow({ onClose, onAdd }: { onClose: () => void; onAdd?: () => void }) {
  const c = useObsidian();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
      <ExpoStatusBar style={c.dark ? 'light' : 'dark'} />
      <TopInset background={c.canvas} />
      <TopBar
        c={c}
        left={<TextBtn c={c} label="Annulla" onPress={onClose} />}
        title="Image"
        right={<View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Text style={{ fontSize: 14, fontWeight: '500', color: c.muted }}>Recenti</Text><IconChevronDown size={13} color={c.muted} /></View>}
      />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {GALLERY_TINTS.map((tint, i) => {
            const n = GALLERY_SEL[i];
            return (
              <View key={i} style={{ width: '31.7%', aspectRatio: 1, borderRadius: 10, backgroundColor: tint, overflow: 'hidden', borderWidth: n ? 3 : 0, borderColor: c.accent }}>
                <View style={{ position: 'absolute', top: 7, right: 7, width: 20, height: 20, borderRadius: 10, backgroundColor: n ? c.accent : 'rgba(0,0,0,0.25)', borderWidth: n ? 0 : 1.5, borderColor: 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center' }}>
                  {n ? <Text style={{ fontSize: 11, fontWeight: '700', color: '#fff' }}>{n}</Text> : null}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
      <View style={{ paddingHorizontal: 18, paddingTop: 12, paddingBottom: 16 + insets.bottom, borderTopWidth: 1, borderTopColor: c.line }}>
        <Pressable onPress={onAdd} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: c.accent, borderRadius: 13, minHeight: OB_BTN_H }}>
          <IconPlus size={17} color={c.accentInk} strokeWidth={1.8} />
          <Text style={{ fontSize: 15, fontWeight: '600', color: c.accentInk }}>Aggiungi</Text>
          <Text style={{ fontSize: 12, fontWeight: '700', color: c.accentInk, backgroundColor: 'rgba(255,255,255,0.24)', borderRadius: 7, paddingHorizontal: 8, paddingVertical: 2, fontVariant: ['tabular-nums'] }}>2</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── 6. File picker ───────────────────────────────────────────────────────────
export function FileFlow({ onClose, onAttach }: { onClose: () => void; onAttach?: () => void }) {
  const c = useObsidian();
  const insets = useSafeAreaInsets();
  const FILES: Array<[string, string, string, boolean]> = [
    ['Preventivo_bagno.pdf', 'PDF · 248 KB · oggi', c.cap.voice, true],
    ['Misure_stanza.xlsx', 'XLSX · 36 KB · oggi', c.cap.text, false],
    ['Piastrelle_ref.jpg', 'JPG · 1,2 MB · ieri', c.cap.photo, false],
    ['Contratto_2026.docx', 'DOCX · 89 KB · 24 giu', c.cap.gallery, false],
    ['Note_vocali.m4a', 'M4A · 3,4 MB · 24 giu', c.cap.file, false],
  ];
  return (
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
      <ExpoStatusBar style={c.dark ? 'light' : 'dark'} />
      <TopInset background={c.canvas} />
      <TopBar c={c} left={<TextBtn c={c} label="Annulla" onPress={onClose} />} title="File" />
      <View style={{ flexDirection: 'row', gap: 4, padding: 4, marginHorizontal: 16, marginTop: 4, marginBottom: 8, backgroundColor: c.surface2, borderRadius: 11 }}>
        {['Recenti', 'Sfoglia'].map((s, i) => (
          <View key={s} style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8, backgroundColor: i === 0 ? c.surface : 'transparent' }}>
            <Text style={{ fontSize: 13.5, fontWeight: i === 0 ? '600' : '500', color: i === 0 ? c.text : c.muted }}>{s}</Text>
          </View>
        ))}
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 18 }}>
        {FILES.map((f, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 12, borderBottomWidth: i < FILES.length - 1 ? 1 : 0, borderBottomColor: c.line }}>
            <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: f[2] + (c.dark ? '2e' : '1c'), alignItems: 'center', justifyContent: 'center' }}>
              <IconFile size={20} color={f[2]} strokeWidth={1.8} />
            </View>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ fontSize: 14.5, fontWeight: '600', color: c.text }}>{f[0]}</Text>
              <Text style={{ fontSize: 11, color: c.subtle, marginTop: 2 }}>{f[1]}</Text>
            </View>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: f[3] ? c.accent : 'transparent', borderWidth: f[3] ? 0 : 1.5, borderColor: c.line2, alignItems: 'center', justifyContent: 'center' }}>
              {f[3] ? <IconCheck size={13} color="#fff" strokeWidth={2.4} /> : null}
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={{ paddingHorizontal: 18, paddingTop: 12, paddingBottom: 16 + insets.bottom, borderTopWidth: 1, borderTopColor: c.line }}>
        <Pressable onPress={onAttach} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: c.accent, borderRadius: 13, minHeight: OB_BTN_H }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: c.accentInk }}>Allega</Text>
          <Text style={{ fontSize: 12, fontWeight: '700', color: c.accentInk, backgroundColor: 'rgba(255,255,255,0.24)', borderRadius: 7, paddingHorizontal: 8, paddingVertical: 2, fontVariant: ['tabular-nums'] }}>1</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── 7. Save spark sheet ──────────────────────────────────────────────────────
function Eyebrow({ c, children }: { c: ObsidianColors; children: React.ReactNode }) {
  return <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1.3, color: c.subtle, marginBottom: 9 }}>{children}</Text>;
}
export function SaveSparkScreen({ onClose, onSend }: { onClose: () => void; onSend?: () => void }) {
  const c = useObsidian();
  const insets = useSafeAreaInsets();
  const col = c.cap.voice;
  const [action, setAction] = React.useState<'note' | 'todo'>('note');
  const [when, setWhen] = React.useState<'due' | 'allday' | 'timed' | null>(null);

  const Seg = ({ id, label, Icon }: { id: 'note' | 'todo'; label: string; Icon: typeof IconNote }) => {
    const on = action === id;
    return (
      <Pressable onPress={() => setAction(id)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: OB_BTN_H, borderRadius: 10, backgroundColor: on ? c.accent : c.surface2, borderWidth: 1, borderColor: on ? 'transparent' : c.line2 }}>
        <Icon size={15} color={on ? c.accentInk : c.muted} strokeWidth={1.8} />
        <Text style={{ fontSize: 14, fontWeight: on ? '600' : '500', color: on ? c.accentInk : c.text }}>{label}</Text>
      </Pressable>
    );
  };
  const Chip = ({ id, label, Icon }: { id: 'due' | 'allday' | 'timed'; label: string; Icon: typeof IconNote }) => {
    const on = when === id;
    return (
      <Pressable onPress={() => setWhen(on ? null : id)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: OB_BTN_H, borderRadius: 9, backgroundColor: on ? c.accentSoft : c.surface2, borderWidth: 1, borderColor: on ? 'transparent' : c.line }}>
        <Icon size={13} color={on ? c.accent : c.subtle} strokeWidth={1.8} />
        <Text style={{ fontSize: 12.5, fontWeight: on ? '600' : '500', color: on ? c.accent : c.muted }}>{label}</Text>
      </Pressable>
    );
  };
  const SuggChip = ({ Icon, label }: { Icon: typeof IconNote; label: string }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.surface, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Icon size={11} color={c.accent} strokeWidth={1.8} />
      <Text style={{ fontSize: 11, fontWeight: '600', color: c.accent }}>{label}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
      <ExpoStatusBar style={c.dark ? 'light' : 'dark'} />
      <TopInset background={c.canvas} />
      <TopBar c={c} left={<TextBtn c={c} label="Annulla" onPress={onClose} />} title="Nuovo spark" right={<RoundBtn onPress={onClose}><IconX size={18} color={c.muted} /></RoundBtn>} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 14, gap: 18 }}>
        {/* Preview */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.line, borderRadius: 14, padding: 12 }}>
          <View style={{ width: 52, height: 52, borderRadius: 12, backgroundColor: col + (c.dark ? '2e' : '1c'), alignItems: 'center', justifyContent: 'center' }}>
            <IconMicrophone size={24} color={col} strokeWidth={1.8} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: c.text }}>Memo · preventivo bagno</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 0.6, color: col, backgroundColor: col + (c.dark ? '2e' : '1c'), borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2 }}>VOICE</Text>
              <Text style={{ fontSize: 11, color: c.subtle, fontVariant: ['tabular-nums'] }}>00:14</Text>
            </View>
          </View>
        </View>

        <View>
          <Eyebrow c={c}>AZIONE</Eyebrow>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Seg id="note" label="Nota" Icon={IconNote} />
            <Seg id="todo" label="To-do" Icon={IconCheckbox} />
          </View>
        </View>

        <View>
          <Eyebrow c={c}>QUANDO</Eyebrow>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Chip id="due" label="Scadenza" Icon={IconAlertCircle} />
            <Chip id="allday" label="Giornata" Icon={IconCalendarEvent} />
            <Chip id="timed" label="A orario" Icon={IconClock} />
          </View>
        </View>

        <View>
          <Eyebrow c={c}>TAG</Eyebrow>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: c.surface2, borderWidth: 1, borderColor: c.line2, borderRadius: 11, paddingHorizontal: 14, paddingVertical: 12 }}>
            <Text style={{ fontSize: 14, color: c.subtle }}>Seleziona tag…</Text>
            <IconChevronDown size={15} color={c.faint} />
          </View>
        </View>

        {/* Mascot suggestion */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: c.accentSoft, borderWidth: 1, borderColor: c.dark ? 'rgba(171,159,242,0.22)' : 'rgba(124,92,203,0.18)', borderRadius: 13, padding: 12 }}>
          <SoftMascot color={c.cap.gallery} size={32} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12.5, fontWeight: '600', color: c.dark ? '#cbbef5' : '#5b3aa8' }}>Bito suggerisce</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
              <SuggChip Icon={IconTag} label="Casa" />
              <SuggChip Icon={IconCheckbox} label="To-do" />
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 16 + insets.bottom, borderTopWidth: 1, borderTopColor: c.line }}>
        <Pressable onPress={onClose} style={{ flex: 1, alignItems: 'center', minHeight: OB_BTN_H, justifyContent: 'center', borderRadius: 13, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.line2 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: c.text }}>Salva</Text>
        </Pressable>
        <Pressable onPress={onSend} style={{ flex: 1.4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: OB_BTN_H, borderRadius: 13, backgroundColor: c.accent }}>
          <IconSend size={16} color={c.accentInk} strokeWidth={1.8} />
          <Text style={{ fontSize: 15, fontWeight: '600', color: c.accentInk }}>Invia a Gimmick</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Hub (preview) ────────────────────────────────────────────────────────────
type FlowId = 'camera' | 'video' | 'voice' | 'text' | 'gallery' | 'file' | 'save';
const HUB: Array<{ id: FlowId; label: string }> = [
  { id: 'camera', label: 'Foto · fotocamera' },
  { id: 'video', label: 'Video · registrazione' },
  { id: 'voice', label: 'Voice · registratore' },
  { id: 'text', label: 'Text · editor nota' },
  { id: 'gallery', label: 'Image · selezione' },
  { id: 'file', label: 'File · documenti' },
  { id: 'save', label: 'Salva spark' },
];

export function ObsidianCaptureFlowsHub() {
  const c = useObsidian();
  const insets = useSafeAreaInsets();
  const [active, setActive] = React.useState<FlowId | null>(null);
  const close = () => setActive(null);

  if (active === 'camera') return <CameraFlow onClose={close} />;
  if (active === 'video') return <VideoFlow onClose={close} />;
  if (active === 'voice') return <VoiceFlow onClose={close} onSave={() => setActive('save')} />;
  if (active === 'text') return <TextFlow onClose={close} onSave={() => setActive('save')} />;
  if (active === 'gallery') return <GalleryFlow onClose={close} onAdd={() => setActive('save')} />;
  if (active === 'file') return <FileFlow onClose={close} onAttach={() => setActive('save')} />;
  if (active === 'save') return <SaveSparkScreen onClose={close} onSend={close} />;

  return (
    <View style={{ flex: 1, backgroundColor: c.canvas, paddingTop: insets.top }}>
      <ExpoStatusBar style={c.dark ? 'light' : 'dark'} />
      <Text style={{ fontSize: 26, fontWeight: '700', color: c.text, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 4 }}>Capture flows</Text>
      <Text style={{ fontSize: 13, color: c.muted, paddingHorizontal: 18, paddingBottom: 12 }}>Apri un flusso di cattura.</Text>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 24, gap: 9 }}>
        {HUB.map((f) => (
          <Pressable key={f.id} onPress={() => setActive(f.id)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 14, paddingVertical: 15, paddingHorizontal: 16, opacity: pressed ? 0.7 : 1 })}>
            <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: c.text }}>{f.label}</Text>
            <IconChevronDown size={16} color={c.faint} style={{ transform: [{ rotate: '-90deg' }] }} />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
