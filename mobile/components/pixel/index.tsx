/**
 * Gimmick · Pixel Arcade — Atoms for React Native (Expo)
 *
 * Drop into mobile/components/pixel/index.tsx. Re-export from
 * mobile/components/index.ts so the rest of the app can import from a single
 * entry point.
 */
import React, { createContext, useContext, useMemo, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ViewStyle, TextStyle, ColorValue,
} from 'react-native';
import Svg, {
  Defs, Pattern, Rect, Circle, Line, LinearGradient, Stop, Polygon,
} from 'react-native-svg';
import {
  PixelTheme, buildPixelTheme, BuildPixelThemeInput,
  PaletteId, PaletteMode, ShadowSize, BgColorId, BackgroundId, CaptureTreatment,
  hexWithAlpha,
} from '@/constants/pixel-theme';

// ─── Provider + hook ────────────────────────────────────────────────────────

// Settings sono fully-resolved (tutti i campi obbligatori) perché vengono
// persistiti nello store — il BuildPixelThemeInput originale ha opzionali
// solo per agevolare le call dirette a buildPixelTheme().
export type PixelSettings = Required<BuildPixelThemeInput>;

const DEFAULT_SETTINGS: PixelSettings = {
  paletteId: 'cmyk',
  mode: 'light',
  shadowSize: 'm',
  backgroundId: 'none',
  bgColorId: 'paletteDefault',
  captureTreatment: 'tinted',
  scanlines: false,
};

interface ThemeCtxValue {
  theme: PixelTheme;
  settings: PixelSettings;
  setSetting: <K extends keyof PixelSettings>(k: K, v: PixelSettings[K]) => void;
}

const PixelThemeCtx = createContext<ThemeCtxValue | null>(null);

export function PixelThemeProvider({
  initial = DEFAULT_SETTINGS,
  value,
  onChange,
  children,
}: {
  initial?: PixelSettings;
  value?: PixelSettings; // controlled mode — driven from outside (e.g. persistent store)
  onChange?: (s: PixelSettings) => void;
  children: React.ReactNode;
}) {
  const [internal, setInternal] = useState<PixelSettings>(initial);
  const settings = value ?? internal;
  const controlled = value !== undefined;
  const setSetting = <K extends keyof PixelSettings>(k: K, v: PixelSettings[K]) => {
    const next = { ...settings, [k]: v };
    if (!controlled) setInternal(next);
    onChange?.(next);
  };
  const theme = useMemo(() => buildPixelTheme(settings), [settings]);
  return (
    <PixelThemeCtx.Provider value={{ theme, settings, setSetting }}>
      {children}
    </PixelThemeCtx.Provider>
  );
}

export function usePixelTheme(): PixelTheme {
  const ctx = useContext(PixelThemeCtx);
  if (!ctx) throw new Error('usePixelTheme must be used inside PixelThemeProvider');
  return ctx.theme;
}

export function usePixelSettings() {
  const ctx = useContext(PixelThemeCtx);
  if (!ctx) throw new Error('usePixelSettings must be used inside PixelThemeProvider');
  return { settings: ctx.settings, setSetting: ctx.setSetting };
}

// ─── Shadow helper for RN (no blur shadow, only offset) ────────────────────
//
// In React Native we can't replicate `box-shadow: 4px 4px 0 #000` exactly —
// the platform shadow has a blur and is on a separate layer. The trick that
// looks closest to a pixel-art offset shadow is to render an absolutely-
// positioned filled rectangle behind the element. The PixelCard / PixelButton
// below do this via the `offsetShadow` style helper.
export function offsetShadow(theme: PixelTheme): ViewStyle | undefined {
  if (theme.shadowOffset === 0) return undefined;
  return {
    // Standard RN shadow (iOS) — kept tight + opaque so it reads as solid
    shadowColor: theme.shadowColor,
    shadowOffset: { width: theme.shadowOffset, height: theme.shadowOffset },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0, // Android — see <ShadowLayer /> below for the offset trick
  } as ViewStyle;
}

/**
 * Pixel-perfect offset shadow on Android requires drawing a colored layer
 * behind the element. Wrap any "shadowed" element with this:
 *   <ShadowLayer theme={theme}><PixelCard … /></ShadowLayer>
 */
export function ShadowLayer({
  theme, children, style,
}: { theme: PixelTheme; children: React.ReactNode; style?: ViewStyle }) {
  if (theme.shadowOffset === 0) return <View style={style}>{children}</View>;
  return (
    <View style={[{ position: 'relative' }, style]}>
      <View
        style={{
          position: 'absolute',
          left: theme.shadowOffset, top: theme.shadowOffset,
          right: -theme.shadowOffset, bottom: -theme.shadowOffset,
          backgroundColor: theme.shadowColor,
        }}
      />
      <View style={{ position: 'relative' }}>{children}</View>
    </View>
  );
}

// ─── Atom: PixelCard ────────────────────────────────────────────────────────
export function PixelCard({
  theme, bg, children, style,
}: {
  theme: PixelTheme;
  bg?: ColorValue;
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <ShadowLayer theme={theme}>
      <View
        style={[
          {
            backgroundColor: (bg as string) || theme.surface,
            borderWidth: 2, borderColor: theme.border,
            padding: 12,
          },
          style,
        ]}
      >
        {children}
      </View>
    </ShadowLayer>
  );
}

// ─── Atom: PixelButton ──────────────────────────────────────────────────────
export function PixelButton({
  theme, label, big = false, full = false, onPress,
  bg, color, leading, style,
}: {
  theme: PixelTheme;
  label: string;
  big?: boolean; full?: boolean;
  bg?: ColorValue; color?: ColorValue;
  leading?: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
}) {
  return (
    <ShadowLayer theme={theme} style={full ? { alignSelf: 'stretch' } : undefined}>
      <Pressable
        onPress={onPress}
        android_ripple={null}
        style={({ pressed }) => [
          {
            backgroundColor: (bg as string) || theme.surfaceVariant,
            borderWidth: 2, borderColor: theme.border,
            paddingHorizontal: big ? 16 : 14,
            paddingVertical: big ? 16 : 10,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
            opacity: pressed ? 0.85 : 1,
          },
          style,
        ]}
      >
        {leading}
        <Text style={{
          fontFamily: theme.fontHead,
          fontSize: big ? 12 : 10,
          letterSpacing: 1,
          color: (color as string) || theme.ink,
        }}>{label}</Text>
      </Pressable>
    </ShadowLayer>
  );
}

// ─── Atom: PixelIconButton ──────────────────────────────────────────────────
// Versione iconica di PixelButton: nessuna label, solo l'icona al centro.
// `size` controlla il quadrato esterno (default 44); l'icona dev'essere passata
// come children (di solito un Tabler icon — la dimensione l'imposti tu).
export function PixelIconButton({
  theme, onPress, bg, size = 44, children, style, disabled,
}: {
  theme: PixelTheme;
  onPress?: () => void;
  bg?: ColorValue;
  size?: number;
  children: React.ReactNode;
  style?: ViewStyle;
  disabled?: boolean;
}) {
  return (
    <ShadowLayer theme={theme}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        android_ripple={null}
        style={({ pressed }) => [
          {
            width: size, height: size,
            backgroundColor: (bg as string) || theme.surfaceVariant,
            borderWidth: 2, borderColor: theme.border,
            alignItems: 'center', justifyContent: 'center',
            opacity: disabled ? 0.5 : (pressed ? 0.85 : 1),
          },
          style,
        ]}
      >
        {children}
      </Pressable>
    </ShadowLayer>
  );
}

// ─── Atom: PixelBadge ───────────────────────────────────────────────────────
export function PixelBadge({
  theme, label, bg, color,
}: { theme: PixelTheme; label: string; bg?: ColorValue; color?: ColorValue }) {
  return (
    <View style={{
      paddingHorizontal: 6, paddingVertical: 3,
      backgroundColor: (bg as string) || theme.ink,
      borderWidth: 2, borderColor: theme.border,
      alignSelf: 'flex-start',
    }}>
      <Text style={{
        fontFamily: theme.fontHead, fontSize: 8,
        color: (color as string) || theme.bg1,
        letterSpacing: 1,
      }}>{label}</Text>
    </View>
  );
}

// ─── Atom: PixelToggle ──────────────────────────────────────────────────────
export function PixelToggle({
  theme, on, onChange,
}: { theme: PixelTheme; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable
      onPress={() => onChange(!on)}
      style={{
        width: 48, height: 24, padding: 2,
        backgroundColor: on ? theme.accent : theme.surfaceVariant,
        borderWidth: 2, borderColor: theme.border,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: on ? 'flex-end' : 'flex-start',
      }}
    >
      <View style={{
        width: 16, height: 16,
        backgroundColor: on ? theme.bg1 : theme.ink3,
        borderWidth: 2, borderColor: theme.border,
      }} />
    </Pressable>
  );
}

// ─── Atom: Segmented ────────────────────────────────────────────────────────
export function Segmented<T extends string>({
  theme, options, value, onChange, small,
}: {
  theme: PixelTheme;
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  small?: boolean;
}) {
  return (
    <View style={{
      flexDirection: 'row',
      padding: 2,
      backgroundColor: theme.bg1,
      borderWidth: 2, borderColor: theme.border,
    }}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <Pressable
            key={o.id}
            onPress={() => onChange(o.id)}
            style={{
              flex: 1,
              paddingHorizontal: small ? 4 : 8,
              paddingVertical: small ? 5 : 6,
              backgroundColor: active ? theme.accent : 'transparent',
            }}
          >
            <Text style={{
              fontFamily: theme.fontHead,
              fontSize: small ? 7 : 8,
              color: active ? theme.onAccent : theme.ink2,
              textAlign: 'center', letterSpacing: 1,
            }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Atom: ChipGrid (wraps chips on multi-line) ─────────────────────────────
export function ChipGrid<T extends string>({
  theme, options, value, onChange, swatched,
}: {
  theme: PixelTheme;
  options: { id: T; label: string; sw?: ColorValue }[];
  value: T;
  onChange: (v: T) => void;
  swatched?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <Pressable
            key={o.id}
            onPress={() => onChange(o.id)}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 5,
              paddingHorizontal: 7, paddingVertical: 5,
              backgroundColor: active ? theme.accent : theme.bg1,
              borderWidth: 2, borderColor: theme.border,
            }}
          >
            {swatched && o.sw && (
              <View style={{
                width: 9, height: 9,
                backgroundColor: o.sw as string,
                borderWidth: 1.5,
                borderColor: active ? theme.onAccent : theme.border,
              }} />
            )}
            <Text style={{
              fontFamily: theme.fontHead, fontSize: 7,
              color: active ? theme.onAccent : theme.ink2,
              letterSpacing: 0.5,
            }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Wordmark + sparkle sprite ──────────────────────────────────────────────
export function PixelWordmark({ theme, size = 18 }: { theme: PixelTheme; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <PixelSparkSprite color={theme.accent} size={size + 2} />
      <Text style={{ fontFamily: theme.fontHead, fontSize: size, color: theme.ink, letterSpacing: 1 }}>
        GIMMICK
      </Text>
    </View>
  );
}

// 8×8 sparkle drawn as a grid of <View> pixels
export function PixelSparkSprite({ color, size = 16 }: { color: ColorValue; size?: number }) {
  const cell = Math.max(2, Math.floor(size / 8));
  const pattern = [
    '...11...',
    '..1111..',
    '.111111.',
    '11111111',
    '11111111',
    '.111111.',
    '..1111..',
    '...11...',
  ];
  return (
    <View style={{ width: cell * 8, height: cell * 8, flexDirection: 'column' }}>
      {pattern.map((row, y) => (
        <View key={y} style={{ flexDirection: 'row' }}>
          {row.split('').map((c, x) => (
            <View
              key={x}
              style={{
                width: cell, height: cell,
                backgroundColor: c === '1' ? (color as string) : 'transparent',
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

// ─── Background overlay ────────────────────────────────────────────────────
// 12 pattern renderizzati con react-native-svg. Tutti i pattern ripetuti
// usano <Defs><Pattern> con patternUnits="userSpaceOnUse" così il driver
// nativo replica il tile in HW invece di emettere migliaia di elementi.
// `stars` e `noise` usano coordinate const pre-computate per evitare
// Math.random() in render path.

// Coordinate pre-computate (modulo-level, immutabili)
const STARS_TILE = 64;
const STARS_COORDS: Array<[number, number]> = [
  [6, 10], [50, 14], [22, 28], [40, 38], [12, 50], [56, 56],
];
const NOISE_TILE = 32;
const NOISE_COORDS: Array<[number, number]> = [
  [1,2],[5,4],[9,1],[14,3],[19,5],[23,2],[28,4],[31,6],
  [3,8],[7,10],[12,9],[17,11],[21,8],[26,10],[30,12],
  [2,14],[6,16],[11,13],[15,15],[20,14],[25,16],[29,15],
  [4,19],[8,21],[13,18],[18,20],[22,19],[27,21],[31,19],
  [1,24],[5,26],[10,23],[14,25],[19,24],[24,26],[28,24],
  [3,29],[8,31],[13,30],[18,29],[24,31],
];

function PatternDefs({ theme }: { theme: PixelTheme }) {
  const ink2 = theme.ink2;
  const accent = theme.accent;
  switch (theme.backgroundId) {
    case 'scanlines':
      return (
        <Pattern id="pat-bg" patternUnits="userSpaceOnUse" width={3} height={3}>
          <Line x1={0} y1={0} x2={3} y2={0} stroke={hexWithAlpha(ink2, 0.12)} strokeWidth={1} />
        </Pattern>
      );
    case 'dots':
      return (
        <Pattern id="pat-bg" patternUnits="userSpaceOnUse" width={20} height={20}>
          <Circle cx={10} cy={10} r={1.5} fill={hexWithAlpha(ink2, 0.16)} />
        </Pattern>
      );
    case 'grid':
      return (
        <Pattern id="pat-bg" patternUnits="userSpaceOnUse" width={24} height={24}>
          <Line x1={0} y1={0} x2={24} y2={0} stroke={hexWithAlpha(ink2, 0.10)} strokeWidth={1} />
          <Line x1={0} y1={0} x2={0} y2={24} stroke={hexWithAlpha(ink2, 0.10)} strokeWidth={1} />
        </Pattern>
      );
    case 'checker':
      return (
        <Pattern id="pat-bg" patternUnits="userSpaceOnUse" width={16} height={16}>
          <Rect x={0} y={0} width={8} height={8} fill={hexWithAlpha(ink2, 0.07)} />
          <Rect x={8} y={8} width={8} height={8} fill={hexWithAlpha(ink2, 0.07)} />
        </Pattern>
      );
    case 'diagonal':
      return (
        <Pattern
          id="pat-bg"
          patternUnits="userSpaceOnUse"
          width={8}
          height={8}
          patternTransform="rotate(45)"
        >
          <Line x1={0} y1={0} x2={0} y2={8} stroke={hexWithAlpha(ink2, 0.12)} strokeWidth={1} />
        </Pattern>
      );
    case 'dither':
      return (
        <Pattern id="pat-bg" patternUnits="userSpaceOnUse" width={8} height={8}>
          <Circle cx={2} cy={2} r={1} fill={hexWithAlpha(ink2, 0.13)} />
          <Circle cx={6} cy={6} r={1} fill={hexWithAlpha(ink2, 0.13)} />
        </Pattern>
      );
    case 'stars':
      return (
        <Pattern id="pat-bg" patternUnits="userSpaceOnUse" width={STARS_TILE} height={STARS_TILE}>
          {STARS_COORDS.map(([x, y], i) => (
            <Rect key={i} x={x} y={y} width={1} height={1} fill={hexWithAlpha(ink2, 0.4)} />
          ))}
        </Pattern>
      );
    case 'arcade':
      return (
        <Pattern id="pat-bg" patternUnits="userSpaceOnUse" width={32} height={32}>
          <Rect x={0} y={0} width={1} height={32} fill={hexWithAlpha(accent, 0.12)} />
          <Rect x={8} y={0} width={1} height={32} fill={hexWithAlpha(ink2, 0.10)} />
          <Rect x={16} y={0} width={1} height={32} fill={hexWithAlpha(accent, 0.12)} />
          <Rect x={24} y={0} width={1} height={32} fill={hexWithAlpha(ink2, 0.10)} />
          <Circle cx={4} cy={16} r={1} fill={hexWithAlpha(accent, 0.18)} />
          <Circle cx={20} cy={8} r={1} fill={hexWithAlpha(accent, 0.18)} />
        </Pattern>
      );
    case 'noise':
      return (
        <Pattern id="pat-bg" patternUnits="userSpaceOnUse" width={NOISE_TILE} height={NOISE_TILE}>
          {NOISE_COORDS.map(([x, y], i) => (
            <Rect key={i} x={x} y={y} width={1} height={1} fill={hexWithAlpha(ink2, 0.10)} />
          ))}
        </Pattern>
      );
    default:
      return null;
  }
}

function PixelBackgroundInner({
  theme, children,
}: { theme: PixelTheme; children: React.ReactNode }) {
  const id = theme.backgroundId;
  const isPattern =
    id === 'scanlines' || id === 'dots' || id === 'grid' || id === 'checker' ||
    id === 'diagonal' || id === 'dither' || id === 'stars' || id === 'arcade' ||
    id === 'noise';

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg1 }}>
      {isPattern && (
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <PatternDefs theme={theme} />
          </Defs>
          <Rect x={0} y={0} width="100%" height="100%" fill="url(#pat-bg)" />
        </Svg>
      )}

      {id === 'sunset' && (
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="grad-sunset" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={theme.bg1} stopOpacity={1} />
              <Stop offset="0.45" stopColor={theme.cap.video} stopOpacity={0.18} />
              <Stop offset="0.65" stopColor={theme.cap.file} stopOpacity={0.20} />
              <Stop offset="1" stopColor={theme.bg1} stopOpacity={1} />
            </LinearGradient>
            <Pattern id="pat-sunset-lines" patternUnits="userSpaceOnUse" width={3} height={3}>
              <Line x1={0} y1={0} x2={3} y2={0} stroke={hexWithAlpha(theme.ink2, 0.10)} strokeWidth={1} />
            </Pattern>
          </Defs>
          <Rect x={0} y={0} width="100%" height="100%" fill="url(#grad-sunset)" />
          <Rect x={0} y={0} width="100%" height="100%" fill="url(#pat-sunset-lines)" />
        </Svg>
      )}

      {id === 'landscape' && (
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none" preserveAspectRatio="none" viewBox="0 0 100 100">
          <Defs>
            <LinearGradient id="grad-sky" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={theme.bg1} stopOpacity={1} />
              <Stop offset="0.7" stopColor={theme.cap.video} stopOpacity={0.25} />
              <Stop offset="1" stopColor={theme.bg1} stopOpacity={0.7} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={100} height={100} fill="url(#grad-sky)" />
          <Polygon points="0,80 20,55 35,72 55,48 75,65 100,52 100,100 0,100" fill={hexWithAlpha(theme.cap.gallery, 0.30)} />
          <Rect x={0} y={70} width={100} height={30} fill={hexWithAlpha(theme.bg3, 0.40)} />
        </Svg>
      )}

      {theme.scanlines && (
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <Pattern id="pat-scan-overlay" patternUnits="userSpaceOnUse" width={3} height={3}>
              <Line x1={0} y1={0} x2={3} y2={0} stroke={hexWithAlpha(theme.ink2, 0.10)} strokeWidth={1} />
            </Pattern>
          </Defs>
          <Rect x={0} y={0} width="100%" height="100%" fill="url(#pat-scan-overlay)" />
        </Svg>
      )}

      {children}
    </View>
  );
}

export const PixelBackground = React.memo(
  PixelBackgroundInner,
  (a, b) =>
    a.theme.backgroundId === b.theme.backgroundId &&
    a.theme.bg1 === b.theme.bg1 &&
    a.theme.bg3 === b.theme.bg3 &&
    a.theme.ink2 === b.theme.ink2 &&
    a.theme.accent === b.theme.accent &&
    a.theme.cap.video === b.theme.cap.video &&
    a.theme.cap.file === b.theme.cap.file &&
    a.theme.cap.gallery === b.theme.cap.gallery &&
    a.theme.mode === b.theme.mode &&
    a.theme.scanlines === b.theme.scanlines &&
    a.children === b.children,
);
