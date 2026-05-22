import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Switch, TouchableOpacity, ScrollView, Pressable, Modal, LayoutAnimation } from 'react-native';
import { useRouter } from 'expo-router';
import { IconChevronRight, IconLogout, IconCheck, IconSun, IconMoon, IconDeviceMobile, IconUser, IconChevronDown, IconPin, IconBolt, IconClock, IconCalendar } from '@tabler/icons-react-native';
import { SafeAreaWrapper } from '@/components/layout/SafeAreaWrapper';
import { useSettingsStore, useAuthStore, toast } from '@/store';
import { useThemeColors } from '@/lib/theme';
import { settingsApi } from '@/lib/api';
import { ColorPickerGrid } from '@/components/ColorPickerGrid';
import { DEFAULT_ACTION_COLORS, getColorName } from '@/constants/palette';
import type { ActionType } from '@/types';
import {
  usePixelTheme,
  usePixelSettings,
  PixelCard,
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

interface SettingRowProps {
  label: string;
  description?: string;
  value?: boolean;
  onValueChange?: (value: boolean) => void;
  onPress?: () => void;
  showArrow?: boolean;
  icon?: React.ReactNode;
}

function SettingRow({
  label,
  description,
  value,
  onValueChange,
  onPress,
  showArrow,
  icon,
}: SettingRowProps) {
  const colors = useThemeColors();
  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 20,
      }}
    >
      {icon && (
        <View style={{ marginRight: 16 }}>{icon}</View>
      )}
      <View style={{ flex: 1, marginRight: 12 }}>
        <Text style={{ fontSize: 16, color: colors.primary }}>{label}</Text>
        {description && (
          <Text style={{ fontSize: 13, color: colors.tertiary, marginTop: 2 }}>{description}</Text>
        )}
      </View>

      {onValueChange !== undefined && (
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: colors.outline, true: colors.accent }}
          thumbColor="#fff"
        />
      )}

      {showArrow && <IconChevronRight size={20} color={colors.tertiary} />}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

function SettingSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const colors = useThemeColors();
  return (
    <View style={{ marginBottom: 24 }}>
      <Text
        style={{
          fontSize: 12,
          fontWeight: '600',
          color: colors.tertiary,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          paddingHorizontal: 20,
          marginBottom: 8,
        }}
      >
        {title}
      </Text>
      <View
        style={{
          marginHorizontal: 16,
          borderRadius: 20,
          backgroundColor: colors.background2,
          overflow: 'hidden',
        }}
      >
        {children}
      </View>
    </View>
  );
}

// ─── Pixel Arcade settings block ────────────────────────────────────────────
function PixelSection({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = usePixelTheme();
  return (
    <View style={{ marginBottom: 16 }}>
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

function PixelRow({
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
    <View style={{ marginHorizontal: 16, marginBottom: 24 }}>
      <PixelSection title="16-BIT MOOD">
        <PixelRow label="MODE">
          <Segmented<PaletteMode>
            theme={theme}
            options={[
              { id: 'light', label: 'LIGHT' },
              { id: 'dark', label: 'DARK' },
            ]}
            value={settings.mode}
            onChange={(v) => setSetting('mode', v)}
          />
        </PixelRow>
        <PixelRow label="PALETTE" stack>
          <ChipGrid<PaletteId>
            theme={theme}
            options={paletteOptions}
            swatched
            value={settings.paletteId}
            onChange={(v) => setSetting('paletteId', v)}
          />
        </PixelRow>
      </PixelSection>

      <PixelSection title="APPEARANCE">
        <PixelRow label="SHADOWS">
          <Segmented<ShadowSize>
            theme={theme}
            options={shadowOptions}
            value={settings.shadowSize}
            onChange={(v) => setSetting('shadowSize', v)}
          />
        </PixelRow>
        <PixelRow label="BACKGROUND" stack>
          <ChipGrid<BackgroundId>
            theme={theme}
            options={bgOptions}
            value={settings.backgroundId ?? 'none'}
            onChange={(v) => setSetting('backgroundId', v)}
          />
        </PixelRow>
        <PixelRow label="BG COLOR" stack>
          <ChipGrid<BgColorId>
            theme={theme}
            options={bgColorOptions}
            swatched
            value={settings.bgColorId ?? 'paletteDefault'}
            onChange={(v) => setSetting('bgColorId', v)}
          />
        </PixelRow>
        <PixelRow label="CAPTURE">
          <Segmented<CaptureTreatment>
            theme={theme}
            options={treatments}
            small
            value={settings.captureTreatment ?? 'tinted'}
            onChange={(v) => setSetting('captureTreatment', v)}
          />
        </PixelRow>
        <PixelRow label="SCANLINES">
          <PixelToggle
            theme={theme}
            on={!!settings.scanlines}
            onChange={(v) => setSetting('scanlines', v)}
          />
        </PixelRow>
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
      </PixelSection>
    </View>
  );
}

export default function SettingsScreen() {
  const colors = useThemeColors();
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
    theme,
    setTheme,
  } = useSettingsStore();

  const { user, signOut } = useAuthStore();
  const router = useRouter();
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const [actionColors, setActionColors] = useState<Record<ActionType, string>>(DEFAULT_ACTION_COLORS as Record<ActionType, string>);
  const [expandedAction, setExpandedAction] = useState<ActionType | null>(null);

  useEffect(() => {
    settingsApi.get<Record<ActionType, string>>('action_colors').then((res) => {
      if (res.data) setActionColors(res.data);
    }).catch(() => {});
  }, []);

  const handleColorChange = useCallback((type: ActionType, hex: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const next = { ...actionColors, [type]: hex };
    setActionColors(next);
    setExpandedAction(null);
    settingsApi.set('action_colors', next).then(() => {
      toast.show({ message: 'Colore aggiornato', type: 'success' });
    }).catch(() => {});
  }, [actionColors]);

  const ACTION_ITEMS: { type: ActionType; label: string; Icon: typeof IconPin }[] = [
    { type: 'none', label: 'Appunto', Icon: IconPin },
    { type: 'anytime', label: 'Da fare', Icon: IconBolt },
    { type: 'deadline', label: 'Scadenza', Icon: IconClock },
    { type: 'event', label: 'Evento', Icon: IconCalendar },
  ];

  const themeOptions = [
    { id: 'light' as const, label: 'Light', description: 'Light theme', icon: IconSun },
    { id: 'dark' as const, label: 'Dark', description: 'Dark theme', icon: IconMoon },
    { id: 'system' as const, label: 'System', description: 'Match device setting', icon: IconDeviceMobile },
  ];

  const currentTheme = themeOptions.find((t) => t.id === theme) || themeOptions[1];

  const aiModels = [
    { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku', description: 'Fast & economical' },
    { id: 'claude-sonnet-4-6', label: 'Claude Sonnet', description: 'Balanced' },
    { id: 'claude-opus-4-6', label: 'Claude Opus', description: 'Most capable' },
  ];

  const currentModel = aiModels.find((m) => m.id === aiModel) || aiModels[0];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background1 }}>
      <ScrollView className="flex-1">
        {/* Account card */}
        <View
          style={{
            marginHorizontal: 16,
            marginBottom: 24,
            borderRadius: 20,
            backgroundColor: colors.background2,
            overflow: 'hidden',
          }}
        >
          {user ? (
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20 }}>
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: colors.accentContainer,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 16,
                  }}
                >
                  <IconUser size={22} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: colors.primary }}>
                    {user.email ?? 'User'}
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.tertiary, marginTop: 2 }}>
                    Connected account
                  </Text>
                </View>
              </View>
              <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 20 }} />
              <TouchableOpacity
                onPress={signOut}
                style={{ flexDirection: 'row', alignItems: 'center', padding: 20, gap: 16 }}
              >
                <IconLogout size={20} color={colors.error} />
                <Text style={{ fontSize: 16, color: colors.error }}>Sign out</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => router.push('/auth/login')}
              style={{ flexDirection: 'row', alignItems: 'center', padding: 20 }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: colors.accentContainer,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 16,
                }}
              >
                <IconUser size={22} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.primary }}>
                  Not connected
                </Text>
                <Text style={{ fontSize: 13, color: colors.tertiary, marginTop: 2 }}>
                  Sign in to sync your sparks
                </Text>
              </View>
              <IconChevronRight size={20} color={colors.tertiary} />
            </TouchableOpacity>
          )}
        </View>

        {/* General section */}
        <SettingSection title="General">
          <SettingRow
            label="Theme"
            description={currentTheme.label}
            onPress={() => setThemePickerOpen(true)}
            showArrow
          />
          <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 20 }} />
          <SettingRow
            label="Haptic feedback"
            value={hapticFeedback}
            onValueChange={setHapticFeedback}
          />
          <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 20 }} />
          <SettingRow
            label="Confirm delete"
            value={confirmDelete}
            onValueChange={setConfirmDelete}
          />
        </SettingSection>

        {/* Pixel Arcade design system sections */}
        <PixelSettingsBlock />

        {/* Action Colors section */}
        <SettingSection title="Colori delle azioni">
          {ACTION_ITEMS.map(({ type, label, Icon }, index) => {
            const color = actionColors[type];
            const isExpanded = expandedAction === type;
            return (
              <View key={type}>
                {index > 0 && (
                  <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 20 }} />
                )}
                <TouchableOpacity
                  onPress={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setExpandedAction(isExpanded ? null : type);
                  }}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 14,
                    paddingHorizontal: 20,
                    gap: 12,
                  }}
                >
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: color,
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.15)',
                    }}
                  />
                  <Icon size={18} color={colors.secondary} />
                  <Text style={{ flex: 1, fontSize: 16, color: colors.primary }}>{label}</Text>
                  <Text style={{ fontSize: 13, color: colors.tertiary }}>{getColorName(color)}</Text>
                  <IconChevronDown
                    size={18}
                    color={colors.tertiary}
                    style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }}
                  />
                </TouchableOpacity>
                {isExpanded && (
                  <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
                    <ColorPickerGrid
                      selectedColor={color}
                      onSelect={(hex) => handleColorChange(type, hex)}
                      size={34}
                    />
                  </View>
                )}
              </View>
            );
          })}
        </SettingSection>

        {/* Upload section */}
        <SettingSection title="Upload">
          <SettingRow
            label="Auto upload"
            description="Upload items automatically"
            value={autoUpload}
            onValueChange={setAutoUpload}
          />
          <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 20 }} />
          <SettingRow
            label="Wi-Fi only"
            description="Only upload on Wi-Fi"
            value={uploadOnWifiOnly}
            onValueChange={setUploadOnWifiOnly}
          />
        </SettingSection>

        {/* AI section */}
        <SettingSection title="AI Assistant">
          <SettingRow
            label="Provider"
            description="Claude (Anthropic)"
          />
          <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 20 }} />
          <SettingRow
            label="Model"
            description={currentModel.label}
            onPress={() => setModelPickerOpen(true)}
            showArrow
          />
        </SettingSection>

        {/* App info */}
        <View style={{ alignItems: 'center', paddingVertical: 32 }}>
          <Text style={{ fontSize: 13, color: colors.tertiary }}>Gimmick v1.0.0</Text>
          <Text style={{ fontSize: 12, color: colors.tertiary, marginTop: 4, opacity: 0.7 }}>
            Capture everything, organize anything
          </Text>
        </View>
      </ScrollView>

      {/* Model Picker Modal */}
      <Modal
        visible={modelPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setModelPickerOpen(false)}
      >
        <Pressable
          onPress={() => setModelPickerOpen(false)}
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.overlay,
          }}
        >
          <View
            style={{
              width: '85%',
              borderRadius: 20,
              backgroundColor: colors.background2,
              overflow: 'hidden',
            }}
          >
            <Text style={{ fontSize: 22, fontWeight: '600', color: colors.primary, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16 }}>
              Select Model
            </Text>
            {aiModels.map((model) => (
              <TouchableOpacity
                key={model.id}
                onPress={() => {
                  setAiModel(model.id);
                  setModelPickerOpen(false);
                }}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 24,
                  paddingVertical: 16,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, color: colors.primary }}>{model.label}</Text>
                  <Text style={{ fontSize: 13, color: colors.tertiary, marginTop: 2 }}>{model.description}</Text>
                </View>
                {aiModel === model.id && (
                  <IconCheck size={22} color={colors.accent} />
                )}
              </TouchableOpacity>
            ))}
            <View style={{ height: 16 }} />
          </View>
        </Pressable>
      </Modal>

      {/* Theme Picker Modal */}
      <Modal
        visible={themePickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setThemePickerOpen(false)}
      >
        <Pressable
          onPress={() => setThemePickerOpen(false)}
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.overlay,
          }}
        >
          <View
            style={{
              width: '85%',
              borderRadius: 20,
              backgroundColor: colors.background2,
              overflow: 'hidden',
            }}
          >
            <Text style={{ fontSize: 22, fontWeight: '600', color: colors.primary, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16 }}>
              Theme
            </Text>
            {themeOptions.map((option) => {
              const Icon = option.icon;
              return (
                <TouchableOpacity
                  key={option.id}
                  onPress={() => {
                    setTheme(option.id);
                    setThemePickerOpen(false);
                  }}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 24,
                    paddingVertical: 16,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: colors.surfaceVariant,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 16,
                    }}
                  >
                    <Icon size={20} color={colors.secondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, color: colors.primary }}>{option.label}</Text>
                    <Text style={{ fontSize: 13, color: colors.tertiary, marginTop: 2 }}>{option.description}</Text>
                  </View>
                  {theme === option.id && (
                    <IconCheck size={22} color={colors.accent} />
                  )}
                </TouchableOpacity>
              );
            })}
            <View style={{ height: 16 }} />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
