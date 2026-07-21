/**
 * Gimmick · Obsidian — Mobile Capture screen.
 *
 * Capture home: AppHeader + "Invia a Gimmick" + the capture grid (see
 * CAPTURE_ROWS) + "Set options". Overlays: the tag Drawer (menu), the voice
 * recording sheet (tapping Voice) and the Set-options sheet. Reuses the
 * Obsidian mobile shell + tokens.
 */
import React from 'react';
import { View, Text, Pressable, ScrollView, Modal } from 'react-native';
import {
  IconCamera, IconVideo, IconPhoto, IconAlignLeft, IconMicrophone, IconPaperclip,
  IconSend, IconChevronDown,
  IconNote, IconCheckbox, IconAlertCircle, IconCalendarEvent, IconClock, IconTag,
} from '@tabler/icons-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useObsidian } from '@/lib/obsidian';
import { OB_BTN_H, type ObsidianColors } from '@/constants/obsidian';
import { ObsidianStatusBar } from '../StatusBar';
import { ObsidianNavPill } from '../NavPill';
import { ObsidianAppHeader } from '../AppHeader';
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
 * Disposizione della griglia di cattura, una riga per array.
 *
 * Non è un wrap automatico: la larghezza dei pulsanti esprime la gerarchia dei
 * canali. Text da solo in prima riga perché è la cattura più frequente e
 * l'unica che non dipende da permessi o hardware; poi i tre canali di
 * registrazione dal vivo; in fondo i due di importazione, che partono da
 * contenuto già esistente.
 */
const CAPTURE_ROWS: CapKey[][] = [
  ['text'],
  ['photo', 'video', 'voice'],
  ['gallery', 'file'],
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
      <Pressable onPress={() => setAction(id)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: OB_BTN_H, borderRadius: 10, backgroundColor: on ? c.accent : c.surface2, borderWidth: 1, borderColor: on ? 'transparent' : c.line2 }}>
        <Icon size={15} color={on ? c.accentInk : c.muted} strokeWidth={1.8} />
        <Text style={{ fontSize: 14, fontWeight: on ? '600' : '500', color: on ? c.accentInk : c.text }}>{label}</Text>
      </Pressable>
    );
  };
  const Chip = ({ id, label, Icon }: { id: 'due' | 'allday' | 'timed'; label: string; Icon: typeof IconNote }) => {
    const on = when === id;
    return (
      <Pressable onPress={() => setWhen(id)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: OB_BTN_H, borderRadius: 9, backgroundColor: on ? c.accentSoft : c.surface2, borderWidth: 1, borderColor: on ? 'transparent' : c.line }}>
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
  onSend?: () => void;
  onOpenBuffer?: () => void;
  onNavigateView?: (id: MobileViewId) => void;
  onSettings?: () => void;
}

export function ObsidianCaptureScreen({
  bufferCount, onCapture, onSend, onOpenBuffer, onNavigateView, onSettings,
}: ObsidianCaptureScreenProps = {}) {
  const c = useObsidian();
  const [drawer, setDrawer] = React.useState(false);
  const [voice, setVoice] = React.useState(false);
  const [options, setOptions] = React.useState(false);
  const count = bufferCount ?? 2;

  return (
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
      <ObsidianStatusBar />
      <ObsidianAppHeader bufferCount={count} onMenu={() => setDrawer(true)} onBuffer={onOpenBuffer} />

      {/* paddingTop 14 (era 6): senza il titolo "Cattura" il pulsante Invia
          finirebbe attaccato all'header. */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16 }}>
        {/* Send */}
        {/* Stessa struttura dei pulsanti di cattura: Pressable per il tocco,
            View interna con stile statico per la grafica. Con lo stile passato
            come funzione il fondo accent non veniva applicato e il pulsante
            appariva come solo testo. */}
        <Pressable
          onPress={onSend}
          disabled={!onSend || count === 0}
          style={{ marginBottom: 16, opacity: onSend && count === 0 ? 0.45 : 1 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: c.accent, borderRadius: 14, minHeight: OB_BTN_H }}>
            <IconSend size={18} color={c.accentInk} strokeWidth={1.8} />
            <Text style={{ fontSize: 15, fontWeight: '600', color: c.accentInk }}>Invia a Gimmick</Text>
            <Text style={{ fontSize: 12, fontWeight: '700', color: c.accentInk, backgroundColor: c.dark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.24)', borderRadius: 7, paddingHorizontal: 8, paddingVertical: 2, fontVariant: ['tabular-nums'] }}>{count}</Text>
          </View>
        </Pressable>

        {/* Capture grid — stesso linguaggio visivo del gruppo AZIONE nella
            sidebar web: contenitore unico a mo' di segmented control (surface +
            cornice leggera + padding 3), pulsanti su fondo accent tenue e icone
            neutre. Niente colore per canale: qui i pulsanti sono un unico
            gruppo di scelta, non sei entità cromaticamente distinte. */}
        {/* padding/gap 6 e non 3 come sul web: a 3px l'annidamento non si legge
            sulla densità di pixel di un telefono e i pulsanti sembrano toccare
            la cornice. Raggio esterno 14 / interno 8 per mantenere le curve
            concentriche a questa distanza. */}
        <View style={{ gap: 6, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line2, borderRadius: 14, padding: 6 }}>
          {CAPTURE_ROWS.map((row, rowIdx) => (
            <View key={rowIdx} style={{ flexDirection: 'row', gap: 6 }}>
              {row.map((key) => {
                const { label, Icon } = CAPS[key];
                return (
                  // Il Pressable porta SOLO `flex: 1` (stile statico) e la
                  // gestione del tocco; tutta la grafica sta sulla View interna
                  // con un oggetto di stile statico. Gli stili passati a
                  // Pressable come funzione `({pressed}) => …` non venivano
                  // applicati in questo ambiente — è la ragione per cui i
                  // pulsanti comparivano senza fondo né altezza.
                  <Pressable
                    key={key}
                    onPress={() => { if (onCapture) onCapture(key); else if (key === 'voice') setVoice(true); }}
                    android_ripple={{ color: c.accent + '33', borderless: false }}
                    style={{ flex: 1 }}
                  >
                    <View
                      style={{
                        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                        // 48 e non 32 come sul web: è il bersaglio di tocco
                        // minimo di Material/accessibilità Android. Qui il
                        // Pressable avvolge esattamente questa View senza
                        // padding, quindi l'altezza disegnata coincide con
                        // l'area toccabile e deve reggere da sola la soglia.
                        minHeight: OB_BTN_H,
                        borderRadius: 8,
                        backgroundColor: c.accent + '14',
                        borderWidth: 1,
                        borderColor: 'transparent',
                      }}
                    >
                      <Icon size={18} color={c.muted} strokeWidth={1.8} />
                      {/* numberOfLines={1}: su schermi stretti una riga da tre
                          non deve mandare l'etichetta a capo e sfalsare le
                          altezze dei pulsanti affiancati. */}
                      <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '600', color: c.text }}>
                        {label}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        {/* Set options */}
        <Pressable onPress={() => setOptions(true)} style={({ pressed }) => ({ marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: OB_BTN_H, borderRadius: 12, borderWidth: 1, borderColor: c.line2, backgroundColor: c.surface, opacity: pressed ? 0.8 : 1 })}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: c.muted }}>Set options</Text>
          <IconChevronDown size={13} color={c.muted} strokeWidth={1.8} style={{ transform: [{ rotate: '180deg' }] }} />
        </Pressable>
      </ScrollView>

      <ObsidianNavPill />

      {/* Overlays */}
      <ObsidianDrawer open={drawer} onClose={() => setDrawer(false)} onNavigateView={onNavigateView} onSettings={onSettings} />
      <VoiceSheet open={voice} onClose={() => setVoice(false)} />
      <SetOptionsSheet open={options} onClose={() => setOptions(false)} />
    </View>
  );
}
