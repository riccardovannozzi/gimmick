import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import {
  IconChevronRight,
  IconLogout,
  IconCheck,
  IconSun,
  IconMoon,
  IconDeviceMobile,
  IconUser,
} from '@tabler/icons-react-native';
import { useSettingsStore, useAuthStore } from '@/store';
import {
  usePixelTheme,
  usePixelSettings,
  PixelCard,
  PixelButton,
  PixelModal,
  PixelSwitch,
  Segmented,
  ChipGrid,
  PixelToggle,
  PixelBackground,
  PixelWordmark,
} from '@/components/pixel';
import {
  PIXEL_PALETTES,
  PIXEL_BG_COLORS,
  PIXEL_BACKGROUND_LABELS,
  bgColorsForMode,
  type PaletteId,
  type PaletteMode,
  type ShadowSize,
  type BgColorId,
  type BackgroundId,
  type CaptureTreatment,
} from '@/constants/pixel-theme';

// ─── Pixel building blocks ──────────────────────────────────────────────────

/** Section header — small PressStart2P caps label sopra una PixelCard. */
function PixelSection({
  title,
  children,
  noCard,
}: {
  title?: string;
  children: React.ReactNode;
  noCard?: boolean;
}) {
  const theme = usePixelTheme();
  return (
    <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
      {title && (
        <Text
          style={{
            fontFamily: theme.fontHead,
            fontSize: 10,
            color: theme.ink2,
            letterSpacing: 1.2,
            marginBottom: 8,
            paddingHorizontal: 4,
          }}
        >
          {title}
        </Text>
      )}
      {noCard ? children : <PixelCard theme={theme} style={{ gap: 0 }}>{children}</PixelCard>}
    </View>
  );
}

/** Single row inside a PixelCard. Optional toggle switch or chevron. */
function PixelRow({
  label,
  description,
  value,
  onValueChange,
  onPress,
  showArrow,
  divider,
}: {
  label: string;
  description?: string;
  value?: boolean;
  onValueChange?: (v: boolean) => void;
  onPress?: () => void;
  showArrow?: boolean;
  divider?: boolean;
}) {
  const theme = usePixelTheme();
  const content = (
    <View>
      {divider && (
        <View style={{ height: 2, backgroundColor: theme.border, marginHorizontal: -12 }} />
      )}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 14,
          gap: 12,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: theme.fontBody,
              fontSize: 14,
              fontWeight: '700',
              color: theme.ink,
            }}
          >
            {label}
          </Text>
          {description && (
            <Text
              style={{
                fontFamily: theme.fontBody,
                fontSize: 12,
                color: theme.ink2,
                marginTop: 2,
              }}
            >
              {description}
            </Text>
          )}
        </View>
        {onValueChange !== undefined && (
          <PixelSwitch theme={theme} value={!!value} onValueChange={onValueChange} />
        )}
        {showArrow && <IconChevronRight size={18} color={theme.ink2} strokeWidth={2.2} />}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
        {content}
      </Pressable>
    );
  }
  return content;
}

// ─── Pixel Arcade settings block ────────────────────────────────────────────
function PixelSubSection({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = usePixelTheme();
  return (
    <View style={{ marginBottom: 14 }}>
      <Text
        style={{
          fontFamily: theme.fontHead,
          fontSize: 10,
          color: theme.ink2,
          letterSpacing: 1.2,
          marginBottom: 8,
          paddingHorizontal: 4,
        }}
      >
        {title}
      </Text>
      <PixelCard theme={theme} style={{ gap: 14 }}>
        {children}
      </PixelCard>
    </View>
  );
}

function PixelMoodRow({
  label,
  stack,
  children,
}: {
  label: string;
  stack?: boolean;
  children: React.ReactNode;
}) {
  const theme = usePixelTheme();
  if (stack) {
    return (
      <View>
        <Text
          style={{
            fontFamily: theme.fontHead,
            fontSize: 9,
            color: theme.ink2,
            letterSpacing: 1,
            marginBottom: 8,
          }}
        >
          {label}
        </Text>
        {children}
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Text
        style={{
          fontFamily: theme.fontHead,
          fontSize: 9,
          color: theme.ink2,
          letterSpacing: 1,
          width: 96,
        }}
      >
        {label}
      </Text>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>{children}</View>
    </View>
  );
}

function PixelSettingsBlock() {
  const theme = usePixelTheme();
  const { settings, setSetting } = usePixelSettings();

  const paletteOptions = (Object.keys(PIXEL_PALETTES) as PaletteId[]).map((id) => ({
    id,
    label: PIXEL_PALETTES[id].label.split('·')[0].trim().toUpperCase(),
    sw: PIXEL_PALETTES[id][theme.mode].accent,
  }));

  const shadowOptions: { id: ShadowSize; label: string }[] = [
    { id: 'none', label: '0' },
    { id: 's', label: '2' },
    { id: 'm', label: '4' },
    { id: 'l', label: '6' },
  ];

  const treatments: { id: CaptureTreatment; label: string }[] = [
    { id: 'tinted', label: 'TINTED' },
    { id: 'dot', label: 'DOT' },
    { id: 'outline', label: 'OUTLINE' },
    { id: 'mono', label: 'MONO' },
  ];

  const bgOptions = (Object.keys(PIXEL_BACKGROUND_LABELS) as BackgroundId[]).map((id) => ({
    id,
    label: PIXEL_BACKGROUND_LABELS[id].split('·')[0].trim().toUpperCase(),
  }));

  const bgColorOptions = bgColorsForMode(theme.mode).map((id) => {
    const p = PIXEL_BG_COLORS[id];
    const hex = theme.mode === 'light' ? p.light : p.dark;
    return { id, label: p.label.toUpperCase(), sw: (hex || theme.bg1) as string };
  });

  return (
    <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
      <PixelSubSection title="16-BIT MOOD">
        <PixelMoodRow label="MODE">
          <Segmented<PaletteMode>
            theme={theme}
            options={[
              { id: 'light', label: 'LIGHT' },
              { id: 'dark', label: 'DARK' },
            ]}
            value={settings.mode}
            onChange={(v) => setSetting('mode', v)}
          />
        </PixelMoodRow>
        <PixelMoodRow label="PALETTE" stack>
          <ChipGrid<PaletteId>
            theme={theme}
            options={paletteOptions}
            swatched
            value={settings.paletteId}
            onChange={(v) => setSetting('paletteId', v)}
          />
        </PixelMoodRow>
      </PixelSubSection>

      <PixelSubSection title="APPEARANCE">
        <PixelMoodRow label="SHADOWS">
          <Segmented<ShadowSize>
            theme={theme}
            options={shadowOptions}
            value={settings.shadowSize}
            onChange={(v) => setSetting('shadowSize', v)}
          />
        </PixelMoodRow>
        <PixelMoodRow label="BACKGROUND" stack>
          <ChipGrid<BackgroundId>
            theme={theme}
            options={bgOptions}
            value={settings.backgroundId ?? 'none'}
            onChange={(v) => setSetting('backgroundId', v)}
          />
        </PixelMoodRow>
        <PixelMoodRow label="BG COLOR" stack>
          <ChipGrid<BgColorId>
            theme={theme}
            options={bgColorOptions}
            swatched
            value={settings.bgColorId ?? 'paletteDefault'}
            onChange={(v) => setSetting('bgColorId', v)}
          />
        </PixelMoodRow>
        <PixelMoodRow label="CAPTURE">
          <Segmented<CaptureTreatment>
            theme={theme}
            options={treatments}
            small
            value={settings.captureTreatment ?? 'tinted'}
            onChange={(v) => setSetting('captureTreatment', v)}
          />
        </PixelMoodRow>
        <PixelMoodRow label="SCANLINES">
          <PixelToggle
            theme={theme}
            on={!!settings.scanlines}
            onChange={(v) => setSetting('scanlines', v)}
          />
        </PixelMoodRow>
        <View>
          <Text
            style={{
              fontFamily: theme.fontHead,
              fontSize: 9,
              color: theme.ink2,
              letterSpacing: 1,
              marginBottom: 8,
            }}
          >
            PREVIEW
          </Text>
          <View
            style={{
              height: 96,
              borderWidth: 2,
              borderColor: theme.border,
              overflow: 'hidden',
            }}
          >
            <PixelBackground theme={theme}>
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <PixelWordmark theme={theme} size={14} />
              </View>
            </PixelBackground>
          </View>
        </View>
      </PixelSubSection>
    </View>
  );
}

// ─── Main screen ────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const theme = usePixelTheme();
  const {
    hapticFeedback,
    setHapticFeedback,
    confirmDelete,
    setConfirmDelete,
    autoUpload,
    setAutoUpload,
    uploadOnWifiOnly,
    setUploadOnWifiOnly,
    aiModel,
    setAiModel,
    theme: themeMode,
    setTheme,
  } = useSettingsStore();

  const { user, signOut } = useAuthStore();
  const router = useRouter();
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [themePickerOpen, setThemePickerOpen] = useState(false);

  const themeOptions = [
    { id: 'light' as const, label: 'LIGHT', description: 'Light theme', icon: IconSun },
    { id: 'dark' as const, label: 'DARK', description: 'Dark theme', icon: IconMoon },
    { id: 'system' as const, label: 'SYSTEM', description: 'Match device setting', icon: IconDeviceMobile },
  ];
  const currentTheme = themeOptions.find((t) => t.id === themeMode) || themeOptions[1];

  const aiModels = [
    { id: 'claude-haiku-4-5-20251001', label: 'CLAUDE HAIKU', description: 'Fast & economical' },
    { id: 'claude-sonnet-4-6', label: 'CLAUDE SONNET', description: 'Balanced' },
    { id: 'claude-opus-4-6', label: 'CLAUDE OPUS', description: 'Most capable' },
  ];
  const currentModel = aiModels.find((m) => m.id === aiModel) || aiModels[0];

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg1 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 16, paddingBottom: 32 }}>
        {/* Account card */}
        <PixelSection noCard>
          <PixelCard theme={theme} style={{ padding: 0 }}>
            {user ? (
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 14 }}>
                  <View
                    style={{
                      width: 44, height: 44,
                      borderWidth: 2, borderColor: theme.border,
                      backgroundColor: theme.accent,
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <IconUser size={22} color={theme.onAccent as string} strokeWidth={2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      numberOfLines={1}
                      style={{
                        fontFamily: theme.fontBody,
                        fontSize: 14,
                        fontWeight: '700',
                        color: theme.ink,
                      }}
                    >
                      {user.email ?? 'User'}
                    </Text>
                    <Text
                      style={{
                        fontFamily: theme.fontHead,
                        fontSize: 8,
                        color: theme.ink2,
                        letterSpacing: 1,
                        marginTop: 4,
                      }}
                    >
                      CONNECTED
                    </Text>
                  </View>
                </View>
                <View style={{ height: 2, backgroundColor: theme.border }} />
                <Pressable
                  onPress={signOut}
                  style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: 14,
                      gap: 12,
                    }}
                  >
                    <IconLogout size={18} color={theme.semantic.danger} strokeWidth={2.2} />
                    <Text
                      style={{
                        fontFamily: theme.fontHead,
                        fontSize: 10,
                        color: theme.semantic.danger,
                        letterSpacing: 1,
                      }}
                    >
                      SIGN OUT
                    </Text>
                  </View>
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() => router.push('/auth/login')}
                style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 14 }}>
                  <View
                    style={{
                      width: 44, height: 44,
                      borderWidth: 2, borderColor: theme.border,
                      backgroundColor: theme.surface,
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <IconUser size={22} color={theme.ink} strokeWidth={2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontFamily: theme.fontHead,
                        fontSize: 11,
                        color: theme.ink,
                        letterSpacing: 1,
                      }}
                    >
                      SIGN IN
                    </Text>
                    <Text
                      style={{
                        fontFamily: theme.fontBody,
                        fontSize: 12,
                        color: theme.ink2,
                        marginTop: 4,
                      }}
                    >
                      Sign in to sync your sparks
                    </Text>
                  </View>
                  <IconChevronRight size={20} color={theme.ink2} strokeWidth={2.2} />
                </View>
              </Pressable>
            )}
          </PixelCard>
        </PixelSection>

        {/* General section */}
        <PixelSection title="GENERAL">
          <PixelRow
            label="Theme"
            description={currentTheme.label}
            onPress={() => setThemePickerOpen(true)}
            showArrow
          />
          <PixelRow
            divider
            label="Haptic feedback"
            value={hapticFeedback}
            onValueChange={setHapticFeedback}
          />
          <PixelRow
            divider
            label="Confirm delete"
            value={confirmDelete}
            onValueChange={setConfirmDelete}
          />
        </PixelSection>

        {/* Pixel Arcade design system sections */}
        <PixelSettingsBlock />

        {/* Upload section */}
        <PixelSection title="UPLOAD">
          <PixelRow
            label="Auto upload"
            description="Upload items automatically"
            value={autoUpload}
            onValueChange={setAutoUpload}
          />
          <PixelRow
            divider
            label="Wi-Fi only"
            description="Only upload on Wi-Fi"
            value={uploadOnWifiOnly}
            onValueChange={setUploadOnWifiOnly}
          />
        </PixelSection>

        {/* AI section */}
        <PixelSection title="AI ASSISTANT">
          <PixelRow label="Provider" description="Claude (Anthropic)" />
          <PixelRow
            divider
            label="Model"
            description={currentModel.label}
            onPress={() => setModelPickerOpen(true)}
            showArrow
          />
        </PixelSection>

        {/* App info */}
        <View style={{ alignItems: 'center', paddingVertical: 24, gap: 4 }}>
          <Text
            style={{
              fontFamily: theme.fontHead,
              fontSize: 10,
              color: theme.ink2,
              letterSpacing: 1.2,
            }}
          >
            GIMMICK V1.0.0
          </Text>
          <Text
            style={{
              fontFamily: theme.fontBody,
              fontSize: 11,
              color: theme.ink2,
              opacity: 0.8,
            }}
          >
            Capture everything, organize anything
          </Text>
        </View>
      </ScrollView>

      {/* Model Picker Modal — Pixel */}
      <PixelModal
        theme={theme}
        visible={modelPickerOpen}
        onClose={() => setModelPickerOpen(false)}
        title="SELECT MODEL"
      >
        <View style={{ gap: 6 }}>
          {aiModels.map((model) => {
            const isSel = aiModel === model.id;
            return (
              <Pressable
                key={model.id}
                onPress={() => {
                  setAiModel(model.id);
                  setModelPickerOpen(false);
                }}
                style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 12,
                    paddingVertical: 12,
                    borderWidth: 2,
                    borderColor: theme.border,
                    backgroundColor: isSel ? theme.accent : theme.surface,
                    gap: 12,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontFamily: theme.fontHead,
                        fontSize: 10,
                        color: isSel ? (theme.onAccent as string) : theme.ink,
                        letterSpacing: 1,
                      }}
                    >
                      {model.label}
                    </Text>
                    <Text
                      style={{
                        fontFamily: theme.fontBody,
                        fontSize: 12,
                        color: isSel ? (theme.onAccent as string) : theme.ink2,
                        marginTop: 4,
                        opacity: isSel ? 0.85 : 1,
                      }}
                    >
                      {model.description}
                    </Text>
                  </View>
                  {isSel && (
                    <IconCheck
                      size={18}
                      color={theme.onAccent as string}
                      strokeWidth={2.6}
                    />
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      </PixelModal>

      {/* Theme Picker Modal — Pixel */}
      <PixelModal
        theme={theme}
        visible={themePickerOpen}
        onClose={() => setThemePickerOpen(false)}
        title="THEME"
      >
        <View style={{ gap: 6 }}>
          {themeOptions.map((option) => {
            const Icon = option.icon;
            const isSel = themeMode === option.id;
            return (
              <Pressable
                key={option.id}
                onPress={() => {
                  setTheme(option.id);
                  setThemePickerOpen(false);
                }}
                style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 12,
                    paddingVertical: 12,
                    borderWidth: 2,
                    borderColor: theme.border,
                    backgroundColor: isSel ? theme.accent : theme.surface,
                    gap: 12,
                  }}
                >
                  <View
                    style={{
                      width: 36, height: 36,
                      borderWidth: 2, borderColor: theme.border,
                      backgroundColor: isSel ? theme.surface : theme.bg2,
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Icon
                      size={18}
                      color={isSel ? theme.ink : theme.ink2}
                      strokeWidth={2}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontFamily: theme.fontHead,
                        fontSize: 10,
                        color: isSel ? (theme.onAccent as string) : theme.ink,
                        letterSpacing: 1,
                      }}
                    >
                      {option.label}
                    </Text>
                    <Text
                      style={{
                        fontFamily: theme.fontBody,
                        fontSize: 12,
                        color: isSel ? (theme.onAccent as string) : theme.ink2,
                        marginTop: 4,
                        opacity: isSel ? 0.85 : 1,
                      }}
                    >
                      {option.description}
                    </Text>
                  </View>
                  {isSel && (
                    <IconCheck
                      size={18}
                      color={theme.onAccent as string}
                      strokeWidth={2.6}
                    />
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      </PixelModal>
    </View>
  );
}
