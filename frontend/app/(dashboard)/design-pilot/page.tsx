'use client';

/**
 * Gimmick · Pixel Arcade — Settings page UI.
 *
 * Drop into frontend/app/(dashboard)/settings/page.tsx (or wherever your
 * settings live). Renders the same control surface as the in-app mobile
 * Settings: 16-bit mood, shadows, background, bg color, capture treatment,
 * scanlines.
 */
import {
  usePixelSettings, usePixelTheme,
  PixelCard, PixelButton, PixelToggle, Segmented, ChipGrid, PixelWordmark,
} from '@/components/pixel';
import {
  PIXEL_PALETTES, PIXEL_BG_COLORS, PIXEL_BACKGROUND_LABELS,
  bgColorsForMode,
  PaletteId, ShadowSize, BgColorId, BackgroundId, CaptureTreatment, PaletteMode,
} from '@/lib/pixel-theme';

export default function SettingsPage() {
  const theme = usePixelTheme();
  const { settings, setSetting } = usePixelSettings();

  const paletteOptions = (Object.keys(PIXEL_PALETTES) as PaletteId[]).map((id) => ({
    id,
    label: PIXEL_PALETTES[id].label.split('·')[0].trim().toUpperCase(),
    sw: PIXEL_PALETTES[id][theme.mode].accent,
  }));
  const shadowOptions: { id: ShadowSize; label: string }[] = [
    { id:'none', label:'0' },{ id:'s', label:'2' },{ id:'m', label:'4' },{ id:'l', label:'6' },
  ];
  const treatments: { id: CaptureTreatment; label: string }[] = [
    { id:'tinted', label:'TINTED' }, { id:'dot', label:'DOT' },
    { id:'outline', label:'OUTLINE' }, { id:'mono', label:'MONO' },
  ];
  const bgOptions = (Object.keys(PIXEL_BACKGROUND_LABELS) as BackgroundId[]).map((id) => ({
    id, label: PIXEL_BACKGROUND_LABELS[id].split('·')[0].trim().toUpperCase(),
  }));
  const bgColorOptions = bgColorsForMode(theme.mode).map((id) => {
    const p = PIXEL_BG_COLORS[id];
    const hex = theme.mode === 'light' ? p.light : p.dark;
    return { id, label: p.label.toUpperCase(), sw: hex || theme.bg1 };
  });

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 720 }}>
      <header>
        <PixelWordmark size={22} />
        <h1 style={{
          fontFamily: 'var(--font-pixel-head)', fontSize: 28, color: theme.ink,
          marginTop: 14, letterSpacing: '0.02em',
        }}>SETTINGS</h1>
        <p style={{ fontSize: 13, color: theme.ink2, marginTop: 6 }}>
          Personalizza l'aspetto e i comportamenti
        </p>
      </header>

      <Section title="16-BIT MOOD">
        <Row label="MODE">
          <Segmented<PaletteMode>
            options={[{id:'light',label:'LIGHT'},{id:'dark',label:'DARK'}]}
            value={settings.mode}
            onChange={(v) => setSetting('mode', v)}
          />
        </Row>
        <Row label="PALETTE" stack>
          <ChipGrid<PaletteId> options={paletteOptions} swatched
            value={settings.paletteId} onChange={(v) => setSetting('paletteId', v)} />
        </Row>
      </Section>

      <Section title="APPEARANCE">
        <Row label="SHADOWS">
          <Segmented<ShadowSize> options={shadowOptions}
            value={settings.shadowSize} onChange={(v) => setSetting('shadowSize', v)} />
        </Row>
        <Row label="BACKGROUND" stack>
          <ChipGrid<BackgroundId> options={bgOptions}
            value={settings.backgroundId ?? 'none'} onChange={(v) => setSetting('backgroundId', v)} />
        </Row>
        <Row label="BG COLOR" stack>
          <ChipGrid<BgColorId> options={bgColorOptions} swatched
            value={settings.bgColorId ?? 'paletteDefault'} onChange={(v) => setSetting('bgColorId', v)} />
        </Row>
        <Row label="CAPTURE">
          <Segmented<CaptureTreatment> options={treatments} small
            value={settings.captureTreatment ?? 'tinted'} onChange={(v) => setSetting('captureTreatment', v)} />
        </Row>
        <Row label="SCANLINES">
          <PixelToggle on={!!settings.scanlines} onChange={(v) => setSetting('scanlines', v)} />
        </Row>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = usePixelTheme();
  return (
    <div>
      <h2 style={{
        fontFamily: 'var(--font-pixel-head)', fontSize: 10, color: theme.ink2,
        letterSpacing: '0.12em', marginBottom: 8,
      }}>{title}</h2>
      <PixelCard style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {children}
      </PixelCard>
    </div>
  );
}

function Row({ label, stack, children }: { label: string; stack?: boolean; children: React.ReactNode }) {
  const theme = usePixelTheme();
  if (stack) {
    return (
      <div>
        <div style={{
          fontFamily: 'var(--font-pixel-head)', fontSize: 9, color: theme.ink2,
          letterSpacing: '0.1em', marginBottom: 8,
        }}>{label}</div>
        {children}
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{
        fontFamily: 'var(--font-pixel-head)', fontSize: 9, color: theme.ink2,
        letterSpacing: '0.1em', width: 100, flexShrink: 0,
      }}>{label}</div>
      <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>{children}</div>
    </div>
  );
}
