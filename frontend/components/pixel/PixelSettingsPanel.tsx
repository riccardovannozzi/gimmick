'use client';

import { useMemo } from 'react';
import {
  PIXEL_PALETTES,
  PIXEL_BG_COLORS,
  PIXEL_SHADOW_OFFSETS,
  PIXEL_BACKGROUND_LABELS,
  backgroundCSS,
  buildPixelTheme,
  bgColorsForMode,
  resolveCaptureStyle,
  type PaletteId,
  type PaletteMode,
  type ShadowSize,
  type BgColorId,
  type BackgroundId,
  type CaptureTreatment,
} from '@/lib/pixel-theme';
import { usePixelTheme, usePixelSettings, PixelToggle } from '@/components/pixel';
import { IconCamera, IconVideo, IconPhoto, IconEdit, IconMicrophone, IconPaperclip } from '@tabler/icons-react';

/**
 * Live "Pixel Arcade" theme tweaker. Renders mode/palette/shadow/background
 * /bgColor controls plus a small live-preview tile. State is owned by
 * <PixelThemeProvider>, which auto-persists to localStorage and (via
 * <PixelSettingsServerSync>) to user_settings on the backend.
 */
export function PixelSettingsPanel() {
  const theme = usePixelTheme();
  const { settings, setSetting, reset } = usePixelSettings();

  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-pixel-head)',
    fontSize: 9,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: theme.ink3,
    display: 'block',
    marginBottom: 6,
  };

  // ─── Mode (light/dark) ──────────────────────────────────────────────────
  const modeOptions: { id: PaletteMode; label: string }[] = [
    { id: 'light', label: 'Light' },
    { id: 'dark', label: 'Dark' },
  ];

  // ─── Palettes ───────────────────────────────────────────────────────────
  const paletteOptions = useMemo(
    () => (Object.keys(PIXEL_PALETTES) as PaletteId[]).map((id) => {
      const p = PIXEL_PALETTES[id][settings.mode];
      return { id, label: PIXEL_PALETTES[id].label, accent: p.accent, bg: p.bg2, ink: p.ink };
    }),
    [settings.mode],
  );

  // ─── Shadow size ────────────────────────────────────────────────────────
  const shadowOptions: { id: ShadowSize; label: string }[] = [
    { id: 'none', label: 'None' },
    { id: 's', label: 'S' },
    { id: 'm', label: 'M' },
    { id: 'l', label: 'L' },
  ];

  // ─── Background pattern ─────────────────────────────────────────────────
  const backgroundOptions = useMemo(
    () => (Object.keys(PIXEL_BACKGROUND_LABELS) as BackgroundId[])
      .map((id) => ({ id, label: PIXEL_BACKGROUND_LABELS[id] })),
    [],
  );

  // ─── Bg color (per mode) ────────────────────────────────────────────────
  const bgColorOptions = useMemo(() => {
    const ids = bgColorsForMode(settings.mode);
    return ids.map((id) => {
      const def = PIXEL_BG_COLORS[id];
      const sw = settings.mode === 'light' ? def.light : def.dark;
      return { id, label: def.label, sw };
    });
  }, [settings.mode]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* MODE */}
      <Section label="Mode">
        <SegmentedRow
          options={modeOptions}
          value={settings.mode}
          onChange={(v) => setSetting('mode', v)}
        />
      </Section>

      {/* PALETTE */}
      <Section label="Palette">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {paletteOptions.map((opt) => {
            const active = settings.paletteId === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setSetting('paletteId', opt.id)}
                className="px-press"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 10px',
                  background: active ? theme.accent : theme.surfaceVariant,
                  color: active ? theme.onAccent : theme.ink,
                  border: `2px solid ${theme.border}`,
                  fontFamily: 'var(--font-pixel-head)',
                  fontSize: 9,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  textAlign: 'left',
                  boxShadow: active ? `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}` : 'none',
                }}
              >
                <span
                  style={{
                    width: 28,
                    height: 16,
                    background: opt.bg,
                    border: `2px solid ${active ? theme.onAccent : theme.border}`,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 8,
                      background: opt.accent,
                    }}
                  />
                </span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {opt.label}
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      {/* SHADOW */}
      <Section label="Shadow size">
        <SegmentedRow
          options={shadowOptions}
          value={settings.shadowSize}
          onChange={(v) => setSetting('shadowSize', v)}
        />
      </Section>

      {/* BACKGROUND PATTERN */}
      <Section label="Background pattern">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
          {backgroundOptions.map((opt) => {
            const active = settings.backgroundId === opt.id;
            const previewTheme = buildPixelTheme({ ...settings, backgroundId: opt.id });
            const previewBg = backgroundCSS(opt.id, previewTheme);
            return (
              <button
                key={opt.id}
                onClick={() => setSetting('backgroundId', opt.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: 0,
                  background: 'transparent',
                  border: `2px solid ${active ? theme.accent : theme.border}`,
                  cursor: 'pointer',
                  overflow: 'hidden',
                }}
              >
                <span
                  style={{
                    width: 36,
                    height: 28,
                    // Use backgroundColor (longhand) so it can coexist with the
                    // backgroundImage / backgroundPosition / backgroundSize
                    // values returned by backgroundCSS — mixing the `background`
                    // shorthand with those longhands trips React's
                    // "conflicting property" warning and reorders them on
                    // re-render, breaking the preview tile pattern.
                    backgroundColor: previewTheme.bg1,
                    borderRight: `2px solid ${active ? theme.accent : theme.border}`,
                    flexShrink: 0,
                    ...previewBg,
                  }}
                />
                <span
                  style={{
                    flex: 1,
                    fontFamily: 'var(--font-pixel-head)',
                    fontSize: 8,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: active ? theme.accent : theme.ink2,
                    padding: '4px 6px 4px 0',
                    textAlign: 'left',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {opt.label}
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      {/* BG COLOR */}
      <Section label={`Background color · ${settings.mode}`}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {bgColorOptions.map((opt) => {
            const active = settings.bgColorId === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setSetting('bgColorId', opt.id as BgColorId)}
                title={opt.label}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 8px',
                  background: active ? theme.accent : theme.surfaceVariant,
                  color: active ? theme.onAccent : theme.ink2,
                  border: `2px solid ${theme.border}`,
                  fontFamily: 'var(--font-pixel-head)',
                  fontSize: 8,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  boxShadow: active ? `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}` : 'none',
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 12,
                    height: 12,
                    background: opt.sw ?? theme.bg1,
                    border: `2px solid ${active ? theme.onAccent : theme.border}`,
                    flexShrink: 0,
                  }}
                />
                {opt.label}
              </button>
            );
          })}
        </div>
        <p
          style={{
            fontFamily: 'var(--font-pixel-body)',
            fontSize: 11,
            color: theme.ink3,
            margin: '8px 0 0',
          }}
        >
          Cambia automaticamente quando passi tra Light e Dark.
        </p>
      </Section>

      {/* CAPTURE TREATMENT */}
      <Section label="Capture treatment">
        <SegmentedRow
          options={[
            { id: 'tinted', label: 'Tinted' },
            { id: 'dot', label: 'Dot' },
            { id: 'outline', label: 'Outline' },
            { id: 'mono', label: 'Mono' },
          ] satisfies { id: CaptureTreatment; label: string }[]}
          value={settings.captureTreatment ?? 'tinted'}
          onChange={(v) => setSetting('captureTreatment', v)}
        />
        <CaptureTreatmentPreview treatment={settings.captureTreatment ?? 'tinted'} />
      </Section>

      {/* SCANLINES */}
      <Section label="Scanlines">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <p
            style={{
              fontFamily: 'var(--font-pixel-body)',
              fontSize: 11,
              color: theme.ink3,
              margin: 0,
              flex: 1,
            }}
          >
            Overlay CRT su tutta l&apos;app. Indipendente dal pattern di sfondo.
          </p>
          <PixelToggle
            on={!!settings.scanlines}
            onChange={(v) => setSetting('scanlines', v)}
          />
        </div>
      </Section>

      {/* PREVIEW + RESET */}
      <Section label="Preview">
        <PreviewCard />
      </Section>

      {/* Reset button */}
      <button
        onClick={() => reset()}
        className="px-press"
        style={{
          alignSelf: 'flex-start',
          display: 'inline-flex',
          alignItems: 'center',
          padding: '0 12px',
          height: 28,
          background: theme.surfaceVariant,
          color: theme.ink2,
          border: `2px solid ${theme.border}`,
          fontFamily: 'var(--font-pixel-head)',
          fontSize: 9,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          cursor: 'pointer',
        }}
      >
        Reset defaults
      </button>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  const theme = usePixelTheme();
  return (
    <div>
      <label
        style={{
          fontFamily: 'var(--font-pixel-head)',
          fontSize: 9,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: theme.ink3,
          display: 'block',
          marginBottom: 6,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function SegmentedRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const theme = usePixelTheme();
  return (
    <div
      style={{
        display: 'flex',
        background: theme.surfaceVariant,
        border: `2px solid ${theme.border}`,
        padding: 2,
      }}
    >
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            style={{
              flex: 1,
              padding: '6px 8px',
              background: active ? theme.accent : 'transparent',
              color: active ? theme.onAccent : theme.ink2,
              border: 'none',
              fontFamily: 'var(--font-pixel-head)',
              fontSize: 9,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/** Self-contained preview that puts every theme primitive on screen: card,
 *  surfaces, accent button, inks, capture-color chips. The view inherits the
 *  current theme directly — no fork — so changes in the controls above show
 *  up here instantly. */
function PreviewCard() {
  const theme = usePixelTheme();
  return (
    <div
      style={{
        background: theme.surface,
        border: `2px solid ${theme.border}`,
        boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            fontFamily: 'var(--font-pixel-head)',
            fontSize: 12,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: theme.ink,
          }}
        >
          Gimmick
        </span>
        <span
          style={{
            padding: '2px 6px',
            background: theme.accent,
            color: theme.onAccent,
            border: `2px solid ${theme.border}`,
            fontFamily: 'var(--font-pixel-head)',
            fontSize: 8,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          Pixel
        </span>
      </div>
      <p
        style={{
          fontFamily: 'var(--font-pixel-body)',
          fontSize: 12,
          color: theme.ink2,
          margin: 0,
          lineHeight: 1.5,
        }}
      >
        Body text in <span style={{ color: theme.ink }}>ink</span> · secondary in <span style={{ color: theme.ink3 }}>ink3</span>.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {(['photo', 'video', 'gallery', 'text', 'voice', 'file'] as const).map((k) => (
          <span
            key={k}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 6px',
              background: theme.tint[k],
              color: theme.cap[k],
              border: `2px solid ${theme.cap[k]}`,
              fontFamily: 'var(--font-pixel-head)',
              fontSize: 8,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            {k}
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          className="px-press"
          style={{
            padding: '6px 10px',
            background: theme.accent,
            color: theme.onAccent,
            border: `2px solid ${theme.border}`,
            fontFamily: 'var(--font-pixel-head)',
            fontSize: 9,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
          }}
        >
          Primary
        </button>
        <button
          style={{
            padding: '6px 10px',
            background: theme.surfaceVariant,
            color: theme.ink2,
            border: `2px solid ${theme.border}`,
            fontFamily: 'var(--font-pixel-head)',
            fontSize: 9,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          Secondary
        </button>
      </div>
      <div
        style={{
          padding: '6px 8px',
          background: theme.bg2,
          border: `2px solid ${theme.border}`,
          fontFamily: 'var(--font-pixel-body)',
          fontSize: 11,
          color: theme.ink3,
        }}
      >
        bg2 surface · pattern: <span style={{ color: theme.ink }}>{PIXEL_BACKGROUND_LABELS[theme.backgroundId]}</span>
        {' · '}
        shadow: <span style={{ color: theme.ink }}>{PIXEL_SHADOW_OFFSETS_LABEL(theme.shadowOffset)}</span>
      </div>
    </div>
  );
}

function PIXEL_SHADOW_OFFSETS_LABEL(off: number): string {
  const found = (Object.entries(PIXEL_SHADOW_OFFSETS) as [ShadowSize, number][]).find(([, v]) => v === off);
  return found ? found[0] : `${off}px`;
}

/** Mini preview of the 6 capture-type buttons under the selected treatment.
 *  Mirrors exactly the styling produced by `resolveCaptureStyle` so the user
 *  can see how the TileSidebar capture row will render before saving. */
function CaptureTreatmentPreview({ treatment }: { treatment: CaptureTreatment }) {
  const theme = usePixelTheme();
  const items = [
    { id: 'photo' as const, icon: IconCamera },
    { id: 'video' as const, icon: IconVideo },
    { id: 'gallery' as const, icon: IconPhoto },
    { id: 'text' as const, icon: IconEdit },
    { id: 'voice' as const, icon: IconMicrophone },
    { id: 'file' as const, icon: IconPaperclip },
  ];
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, padding: 8, background: theme.surfaceVariant, border: `2px solid ${theme.border}` }}>
      {items.map(({ id, icon: Icon }) => {
        const cap = theme.cap[id];
        const tint = theme.tint[id];
        const cstyle = resolveCaptureStyle(treatment, cap, tint, theme.surface, theme.border, theme.ink2);
        return (
          <div
            key={id}
            style={{
              position: 'relative',
              width: 32,
              height: 32,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: cstyle.background,
              border: `2px solid ${cstyle.border}`,
            }}
          >
            <Icon size={14} style={{ color: cstyle.iconColor }} />
            {cstyle.dot && (
              <span style={{ position: 'absolute', top: 2, right: 2, width: 4, height: 4, background: cstyle.dot }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
