/**
 * Gimmick · Obsidian — Mobile Auth (login / onboarding / first capture).
 *
 * Three onboarding screens, navigable in sequence. Reference:
 * GimmickMobileAuth.dc.html. Reuses the mobile shell + tokens.
 */
import React from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import {
  IconMail, IconLock, IconEye, IconBrandGoogle, IconBrandApple, IconArrowRight,
  IconMicrophone, IconCamera, IconVideo, IconPhoto, IconAlignLeft, IconPaperclip,
} from '@tabler/icons-react-native';
import { useObsidian } from '@/lib/obsidian';
import type { ObsidianColors } from '@/constants/obsidian';
import { ObsidianStatusBar } from '../StatusBar';
import { ObsidianNavPill } from '../NavPill';

function GimmickMark({ c, size }: { c: ObsidianColors; size: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: size * 0.3, height: size * 0.3, borderRadius: size * 0.1, backgroundColor: c.accentInk }} />
    </View>
  );
}

// ─── Login ────────────────────────────────────────────────────────────────────
function Login({ c, onNext }: { c: ObsidianColors; onNext: () => void }) {
  const Field = ({ Icon, placeholder, secure, eye }: { Icon: typeof IconMail; placeholder: string; secure?: boolean; eye?: boolean }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: c.field, borderWidth: 1, borderColor: c.line2, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14 }}>
      <Icon size={17} color={c.subtle} strokeWidth={1.8} />
      <TextInput placeholder={placeholder} placeholderTextColor={c.subtle} secureTextEntry={secure} style={{ flex: 1, fontSize: 14, color: c.text }} />
      {eye ? <IconEye size={16} color={c.subtle} strokeWidth={1.8} /> : null}
    </View>
  );
  const Social = ({ Icon, label }: { Icon: typeof IconBrandGoogle; label: string }) => (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, height: 46, borderRadius: 12, borderWidth: 1, borderColor: c.line2, backgroundColor: c.surface }}>
      <Icon size={18} color={c.text} strokeWidth={1.8} />
      <Text style={{ fontSize: 13.5, fontWeight: '600', color: c.text }}>{label}</Text>
    </View>
  );
  return (
    <View style={{ flex: 1, paddingHorizontal: 24, justifyContent: 'center' }}>
      <View style={{ alignItems: 'center', marginBottom: 30 }}>
        <GimmickMark c={c} size={56} />
        <Text style={{ fontSize: 24, fontWeight: '700', letterSpacing: -0.7, color: c.text, marginTop: 18 }}>Bentornato</Text>
        <Text style={{ fontSize: 14, color: c.muted, marginTop: 5 }}>Accedi per gestire i tuoi spark</Text>
      </View>
      <View style={{ gap: 11 }}>
        <Field Icon={IconMail} placeholder="ruslan@gimmick.app" />
        <Field Icon={IconLock} placeholder="••••••••••" secure eye />
      </View>
      <Text style={{ textAlign: 'right', fontSize: 12.5, fontWeight: '600', color: c.accent, marginVertical: 14, marginHorizontal: 2 }}>Password dimenticata?</Text>
      <Pressable onPress={onNext} style={({ pressed }) => ({ height: 50, borderRadius: 13, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.9 : 1 })}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: c.accentInk }}>Accedi</Text>
      </Pressable>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 20 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: c.line }} />
        <Text style={{ fontSize: 11, color: c.subtle }}>oppure</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: c.line }} />
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Social Icon={IconBrandGoogle} label="Google" />
        <Social Icon={IconBrandApple} label="Apple" />
      </View>
      <Pressable onPress={onNext} style={{ marginTop: 24 }}>
        <Text style={{ textAlign: 'center', fontSize: 13, color: c.muted }}>Non hai un account? <Text style={{ fontWeight: '600', color: c.accent }}>Registrati</Text></Text>
      </Pressable>
    </View>
  );
}

// ─── Onboarding ───────────────────────────────────────────────────────────────
const ONB_CAPS: Array<{ key: string; label: string; color: (c: ObsidianColors) => string; Icon: typeof IconCamera }> = [
  { key: 'photo', label: 'Photo', color: (c) => c.cap.photo, Icon: IconCamera },
  { key: 'video', label: 'Video', color: (c) => c.cap.video, Icon: IconVideo },
  { key: 'gallery', label: 'Gallery', color: (c) => c.cap.gallery, Icon: IconPhoto },
  { key: 'text', label: 'Text', color: (c) => c.cap.text, Icon: IconAlignLeft },
  { key: 'voice', label: 'Voice', color: (c) => c.cap.voice, Icon: IconMicrophone },
  { key: 'file', label: 'File', color: (c) => c.cap.file, Icon: IconPaperclip },
];
function Onboarding({ c, onNext }: { c: ObsidianColors; onNext: () => void }) {
  return (
    <View style={{ flex: 1, paddingHorizontal: 24 }}>
      <Pressable onPress={onNext} style={{ alignSelf: 'flex-end', paddingTop: 8 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: c.subtle }}>Salta</Text>
      </Pressable>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 40 }}>
          {ONB_CAPS.map((cap) => {
            const col = cap.color(c);
            return (
              <View key={cap.key} style={{ width: '30.5%', aspectRatio: 1, borderRadius: 18, backgroundColor: col + (c.dark ? '24' : '17'), borderWidth: 1, borderColor: col + (c.dark ? '3a' : '2e'), alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: col, alignItems: 'center', justifyContent: 'center' }}>
                  <cap.Icon size={20} color="#fff" strokeWidth={1.8} />
                </View>
                <Text style={{ fontSize: 11, fontWeight: '600', color: c.muted }}>{cap.label}</Text>
              </View>
            );
          })}
        </View>
        <Text style={{ fontSize: 28, fontWeight: '700', letterSpacing: -0.8, color: c.text, textAlign: 'center', lineHeight: 31, marginBottom: 12 }}>{'Cattura tutto,\nin sei modi'}</Text>
        <Text style={{ fontSize: 14.5, lineHeight: 22, color: c.muted, textAlign: 'center' }}>Foto, voce, testo, file: butta dentro qualsiasi cosa. Gimmick la legge e la organizza per te.</Text>
      </View>
      <View style={{ paddingBottom: 24 }}>
        <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center' }}>
          {[0, 1, 2].map((i) => <View key={i} style={{ width: i === 1 ? 22 : 7, height: 7, borderRadius: 4, backgroundColor: i === 1 ? c.accent : c.line2 }} />)}
        </View>
        <Pressable onPress={onNext} style={({ pressed }) => ({ height: 50, borderRadius: 13, backgroundColor: c.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 22, opacity: pressed ? 0.9 : 1 })}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: c.accentInk }}>Continua</Text>
          <IconArrowRight size={16} color={c.accentInk} strokeWidth={1.8} />
        </Pressable>
      </View>
    </View>
  );
}

// ─── First capture ────────────────────────────────────────────────────────────
function FirstCapture({ c, onNext }: { c: ObsidianColors; onNext: () => void }) {
  const col = c.cap.voice;
  return (
    <View style={{ flex: 1, paddingHorizontal: 24 }}>
      <View style={{ paddingTop: 20, flexDirection: 'row', alignItems: 'center', gap: 9 }}>
        <GimmickMark c={c} size={28} />
        <Text style={{ fontSize: 16, fontWeight: '600', color: c.text }}>Gimmick</Text>
      </View>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1.6, color: c.accent, marginBottom: 14 }}>PRIMA CATTURA</Text>
        <Text style={{ fontSize: 25, fontWeight: '700', letterSpacing: -0.7, color: c.text, marginBottom: 10 }}>Prova ora</Text>
        <Text style={{ fontSize: 14, color: c.muted, maxWidth: 260, lineHeight: 21, textAlign: 'center', marginBottom: 36 }}>Tieni premuto per registrare un memo vocale. Lo trasformiamo in un tile.</Text>
        <View style={{ width: 116, height: 116, borderRadius: 58, backgroundColor: col + (c.dark ? '22' : '14'), alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
          <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: col, alignItems: 'center', justifyContent: 'center' }}>
            <IconMicrophone size={36} color="#fff" strokeWidth={1.8} />
          </View>
        </View>
        <Text style={{ fontSize: 12.5, color: c.subtle }}>Tieni premuto</Text>
      </View>
      <Pressable onPress={onNext} style={{ paddingBottom: 24 }}>
        <Text style={{ textAlign: 'center', fontSize: 13, fontWeight: '600', color: c.muted }}>Esplora prima la app</Text>
      </Pressable>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export function ObsidianAuthScreen({ initial = 'login' }: { initial?: 'login' | 'onb' | 'first' }) {
  const c = useObsidian();
  const [screen, setScreen] = React.useState<'login' | 'onb' | 'first'>(initial);

  return (
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
      <ObsidianStatusBar />
      {screen === 'login' && <Login c={c} onNext={() => setScreen('onb')} />}
      {screen === 'onb' && <Onboarding c={c} onNext={() => setScreen('first')} />}
      {screen === 'first' && <FirstCapture c={c} onNext={() => setScreen('login')} />}
      <ObsidianNavPill />
    </View>
  );
}
