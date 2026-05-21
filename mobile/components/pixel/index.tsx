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
import {
  PixelTheme, buildPixelTheme, BuildPixelThemeInput,
  PaletteId, PaletteMode, ShadowSize, BgColorId, BackgroundId, CaptureTreatment,
} from '@/constants/pixel-theme';

// ─── Provider + hook ────────────────────────────────────────────────────────

export interface PixelSettings extends BuildPixelThemeInput {}

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
  onChange,
  children,
}: {
  initial?: PixelSettings;
  onChange?: (s: PixelSettings) => void; // for persistence
  children: React.ReactNode;
}) {
  const [settings, setSettings] = useState<PixelSettings>(initial);
  const setSetting = <K extends keyof PixelSettings>(k: K, v: PixelSettings[K]) => {
    setSettings((s) => {
      const next = { ...s, [k]: v };
      onChange?.(next);
      return next;
    });
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

// ─── Background overlay (web pattern → SVG/gradient on RN) ──────────────────
//
// Stub: implement once `expo-linear-gradient` and `react-native-svg` are
// installed. For now this is a no-op fallback that just paints theme.bg1.
export function PixelBackground({
  theme, children,
}: { theme: PixelTheme; children: React.ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg1 }}>
      {/* TODO: render theme.backgroundId pattern via expo-linear-gradient + react-native-svg */}
      {children}
    </View>
  );
}
