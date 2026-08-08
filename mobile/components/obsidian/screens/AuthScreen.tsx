/**
 * Gimmick · Obsidian — Mobile Auth (login / onboarding / first capture).
 *
 * Three onboarding screens, navigable in sequence. Reference:
 * GimmickMobileAuth.dc.html. Reuses the mobile shell + tokens.
 */
import React from 'react';
import {
  View, Text, Pressable, TextInput, Image,
  KeyboardAvoidingView, ScrollView, Platform,
} from 'react-native';
import {
  IconMail, IconLock, IconEye, IconEyeOff, IconBrandGoogle, IconBrandApple, IconArrowRight,
  IconMicrophone, IconCamera, IconVideo, IconPhoto, IconAlignLeft, IconPaperclip,
} from '@tabler/icons-react-native';
import { useObsidian } from '@/lib/obsidian';
import { OB_BTN_H, type ObsidianColors } from '@/constants/obsidian';
import { ObsidianStatusBar } from '../StatusBar';
import { ObsidianNavPill } from '../NavPill';

/**
 * Il marchio è il robot, non un quadrato d'accento col buco in mezzo: quello era
 * il segnaposto del mockup, e questa è la prima schermata che si vede dell'app.
 *
 * `adaptive-icon` e non `icon`, come in AppHeader e Drawer: sono lo stesso
 * robot, ma `icon.png` porta lo sfondo bianco opaco (è la piastrella del
 * launcher) e su fondo scuro diventerebbe un quadrato bianco.
 *
 * `size` è il peso VISIVO voluto, non il riquadro: l'asset ha un margine interno
 * generoso e il robot disegnato ne occupa circa tre quarti, quindi il riquadro
 * si dichiara più grande perché il robot appaia grande `size`.
 */
const MARK_INK = 0.73;
function GimmickMark({ size }: { size: number }) {
  const box = Math.round(size / MARK_INK);
  return (
    <Image
      source={require('../../../assets/adaptive-icon.png')}
      style={{ width: box, height: box }}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
    />
  );
}

// NB: Field e Social vivono a livello di modulo, NON dentro Login. Se fossero
// definiti nel corpo di Login, ad ogni keystroke Login si ri-renderizza, la loro
// identità cambia e React rimonta il TextInput → il focus si perde e la tastiera
// si chiude ad ogni lettera. Tenendoli fuori, l'identità resta stabile.
function LoginField({ c, Icon, placeholder, secure, eye, eyeOpen, onToggleEye, value, onChangeText, keyboardType, autoCapitalize, loading, textContentType, onSubmitEditing, returnKeyType, inputRef }: {
  c: ObsidianColors; Icon: typeof IconMail; placeholder: string; secure?: boolean; eye?: boolean;
  eyeOpen?: boolean; onToggleEye?: () => void;
  value?: string; onChangeText?: (t: string) => void;
  keyboardType?: 'email-address' | 'default'; autoCapitalize?: 'none' | 'sentences'; loading?: boolean;
  textContentType?: 'emailAddress' | 'password'; onSubmitEditing?: () => void;
  returnKeyType?: 'next' | 'go'; inputRef?: React.Ref<TextInput>;
}) {
  return (
    // Senza bordo: il campo si stacca dal fondo per la sola superficie `field`,
    // come ogni altro input dell'app (TileScreen, SubtaskList, composer di Ask).
    // I bordi qui dentro stanno sui contenitori, non sui campi.
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.field, borderRadius: 11, paddingHorizontal: 13, paddingVertical: 12, minHeight: OB_BTN_H }}>
      <Icon size={16} color={c.subtle} strokeWidth={1.8} />
      <TextInput
        ref={inputRef}
        placeholder={placeholder}
        placeholderTextColor={c.subtle}
        secureTextEntry={secure}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        editable={!loading}
        textContentType={textContentType}
        onSubmitEditing={onSubmitEditing}
        returnKeyType={returnKeyType}
        blurOnSubmit={false}
        style={{ flex: 1, fontSize: 14, color: c.text }}
      />
      {/* L'occhio era un'icona e basta: nessun modo di rileggere la password
          appena digitata, che su tastiera mobile è il primo motivo per cui un
          login «non funziona». */}
      {eye ? (
        <Pressable
          onPress={onToggleEye}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={eyeOpen ? 'Nascondi password' : 'Mostra password'}
        >
          {eyeOpen
            ? <IconEyeOff size={16} color={c.text} strokeWidth={1.8} />
            : <IconEye size={16} color={c.subtle} strokeWidth={1.8} />}
        </Pressable>
      ) : null}
    </View>
  );
}

function LoginSocial({ c, Icon, label, onPress }: { c: ObsidianColors; Icon: typeof IconBrandGoogle; label: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, minHeight: OB_BTN_H, borderRadius: 12, borderWidth: 1, borderColor: c.line2, backgroundColor: c.surface }}>
        <Icon size={18} color={c.text} strokeWidth={1.8} />
        <Text style={{ fontSize: 13.5, fontWeight: '600', color: c.text }}>{label}</Text>
      </View>
    </Pressable>
  );
}

// ─── Login ────────────────────────────────────────────────────────────────────
interface LoginProps {
  c: ObsidianColors;
  onNext: () => void;
  /** Live auth wiring (omit → static demo that just advances onboarding). */
  email?: string;
  password?: string;
  onEmail?: (t: string) => void;
  onPassword?: (t: string) => void;
  onSubmit?: () => void;
  onRegister?: () => void;
  onForgot?: () => void;
  onSocial?: () => void;
  loading?: boolean;
  error?: string | null;
  info?: string | null;
}
function Login({ c, onNext, email, password, onEmail, onPassword, onSubmit, onRegister, onForgot, onSocial, loading, error, info }: LoginProps) {
  const live = onSubmit !== undefined;
  const primary = live ? onSubmit : onNext;
  const [showPassword, setShowPassword] = React.useState(false);
  const passwordRef = React.useRef<TextInput>(null);

  return (
    // La form stava in un View centrato, senza scroll né gestione tastiera: ad
    // aprire la tastiera il campo password finiva sotto, e sembrava che la
    // schermata non lasciasse inserire i dati. `keyboardShouldPersistTaps` è
    // l'altra metà del problema — senza, il primo tocco su «Accedi» veniva
    // consumato per chiudere la tastiera e il bottone non rispondeva.
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 24 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ alignItems: 'center', marginBottom: 30 }}>
          <GimmickMark size={56} />
          <Text style={{ fontSize: 24, fontWeight: '700', letterSpacing: -0.7, color: c.text, marginTop: 18 }}>Bentornato</Text>
          <Text style={{ fontSize: 14, color: c.muted, marginTop: 5 }}>Accedi per gestire i tuoi tiles</Text>
        </View>
        <View style={{ gap: 11 }}>
          <LoginField
            c={c} loading={loading} Icon={IconMail} placeholder="Indirizzo email"
            value={email} onChangeText={onEmail}
            keyboardType="email-address" autoCapitalize="none" textContentType="emailAddress"
            returnKeyType="next" onSubmitEditing={() => passwordRef.current?.focus()}
          />
          <LoginField
            c={c} loading={loading} Icon={IconLock} placeholder="Password" inputRef={passwordRef}
            secure={!showPassword} eye eyeOpen={showPassword} onToggleEye={() => setShowPassword((v) => !v)}
            value={password} onChangeText={onPassword}
            autoCapitalize="none" textContentType="password"
            returnKeyType="go" onSubmitEditing={loading ? undefined : primary}
          />
        </View>
        {error ? <Text style={{ fontSize: 12.5, color: c.deadline, marginTop: 12, marginHorizontal: 2 }}>{error}</Text> : null}
        {info ? <Text style={{ fontSize: 12.5, color: c.muted, marginTop: 12, marginHorizontal: 2 }}>{info}</Text> : null}
        <Pressable onPress={onForgot} disabled={loading || !onForgot} hitSlop={8} style={{ marginVertical: 14 }}>
          <Text style={{ textAlign: 'right', fontSize: 12.5, fontWeight: '600', color: c.accent, marginHorizontal: 2 }}>Password dimenticata?</Text>
        </Pressable>
        {/* Touch = Pressable, chrome = View interno con stile STATICO. In questo
            ambiente lo `style` in forma-funzione su Pressable non viene applicato,
            quindi il rettangolo (sfondo/altezza/raggio) sparirebbe: lo spostiamo
            sulla View, che lo rende sempre. */}
        <Pressable onPress={primary} disabled={loading} android_ripple={{ color: 'rgba(0,0,0,0.18)' }}>
          <View style={{ minHeight: OB_BTN_H, borderRadius: 13, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', opacity: loading ? 0.6 : 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: c.accentInk }}>{loading ? 'Accesso…' : 'Accedi'}</Text>
          </View>
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 20 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: c.line }} />
          <Text style={{ fontSize: 11, color: c.subtle }}>oppure</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: c.line }} />
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <LoginSocial c={c} Icon={IconBrandGoogle} label="Google" onPress={onSocial} />
          <LoginSocial c={c} Icon={IconBrandApple} label="Apple" onPress={onSocial} />
        </View>
        <Pressable onPress={live ? onRegister : onNext} disabled={loading} style={{ marginTop: 24 }}>
          <Text style={{ textAlign: 'center', fontSize: 13, color: c.muted }}>Non hai un account? <Text style={{ fontWeight: '600', color: c.accent }}>Registrati</Text></Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Onboarding ───────────────────────────────────────────────────────────────
const ONB_CAPS: Array<{ key: string; label: string; color: (c: ObsidianColors) => string; Icon: typeof IconCamera }> = [
  { key: 'photo', label: 'Photo', color: (c) => c.cap.photo, Icon: IconCamera },
  { key: 'video', label: 'Video', color: (c) => c.cap.video, Icon: IconVideo },
  { key: 'gallery', label: 'Image', color: (c) => c.cap.gallery, Icon: IconPhoto },
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
        <Pressable onPress={onNext} style={({ pressed }) => ({ minHeight: OB_BTN_H, borderRadius: 13, backgroundColor: c.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 22, opacity: pressed ? 0.9 : 1 })}>
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
        <GimmickMark size={28} />
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
export interface ObsidianAuthScreenProps {
  initial?: 'login' | 'onb' | 'first';
  /** Live login wiring (authStore). Omit → static demo walkthrough. */
  email?: string;
  password?: string;
  onEmail?: (t: string) => void;
  onPassword?: (t: string) => void;
  onLogin?: () => void;
  onRegister?: () => void;
  onForgot?: () => void;
  onSocial?: () => void;
  loading?: boolean;
  error?: string | null;
  info?: string | null;
}

export function ObsidianAuthScreen({
  initial = 'login', email, password, onEmail, onPassword, onLogin, onRegister,
  onForgot, onSocial, loading, error, info,
}: ObsidianAuthScreenProps = {}) {
  const c = useObsidian();
  const [screen, setScreen] = React.useState<'login' | 'onb' | 'first'>(initial);

  return (
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
      <ObsidianStatusBar />
      {screen === 'login' && (
        <Login
          c={c}
          onNext={() => setScreen('onb')}
          email={email}
          password={password}
          onEmail={onEmail}
          onPassword={onPassword}
          onSubmit={onLogin}
          onRegister={onRegister}
          onForgot={onForgot}
          onSocial={onSocial}
          loading={loading}
          error={error}
          info={info}
        />
      )}
      {screen === 'onb' && <Onboarding c={c} onNext={() => setScreen('first')} />}
      {screen === 'first' && <FirstCapture c={c} onNext={() => setScreen('login')} />}
      <ObsidianNavPill />
    </View>
  );
}
