import React, { useState } from 'react';
import { View, Text, Switch, TouchableOpacity, ScrollView, Pressable, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, LogOut, Check, Sun, Moon, Smartphone, ArrowLeft } from 'lucide-react-native';
import { SafeAreaWrapper } from '@/components/layout/SafeAreaWrapper';
import { useSettingsStore, useAuthStore } from '@/store';
import { useThemeColors } from '@/lib/theme';

interface SettingRowProps {
  label: string;
  description?: string;
  value?: boolean;
  onValueChange?: (value: boolean) => void;
  onPress?: () => void;
  showArrow?: boolean;
}

function SettingRow({
  label,
  description,
  value,
  onValueChange,
  onPress,
  showArrow,
}: SettingRowProps) {
  const colors = useThemeColors();
  const content = (
    <View className="flex-row items-center justify-between py-5 px-6 border-b border-border">
      <View className="flex-1 mr-4">
        <Text className="text-primary text-lg">{label}</Text>
        {description && (
          <Text className="text-secondary text-base mt-1">{description}</Text>
        )}
      </View>

      {onValueChange !== undefined && (
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: colors.border, true: colors.accent }}
          thumbColor="#fff"
        />
      )}

      {showArrow && <ChevronRight size={24} color={colors.secondary} />}
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
    <View className="mb-6">
      <Text className="text-secondary text-sm font-medium uppercase px-4 mb-2">
        {title}
      </Text>
      <View
        className="rounded-2xl overflow-hidden mx-4"
        style={{
          backgroundColor: colors.background2,
          borderWidth: 1.5,
          borderColor: colors.primary,
        }}
      >
        {children}
      </View>
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

  const themeOptions = [
    { id: 'light' as const, label: 'Light', description: 'Light theme', icon: Sun },
    { id: 'dark' as const, label: 'Dark', description: 'Dark theme', icon: Moon },
    { id: 'system' as const, label: 'System', description: 'Match device setting', icon: Smartphone },
  ];

  const currentTheme = themeOptions.find((t) => t.id === theme) || themeOptions[1];

  const aiModels = [
    { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku', description: 'Fast & economical' },
    { id: 'claude-sonnet-4-6', label: 'Claude Sonnet', description: 'Balanced' },
    { id: 'claude-opus-4-6', label: 'Claude Opus', description: 'Most capable' },
  ];

  const currentModel = aiModels.find((m) => m.id === aiModel) || aiModels[0];

  return (
    <SafeAreaWrapper edges={['top']}>
      <ScrollView className="flex-1">
        {/* Header */}
        <View className="flex-row items-center px-4 py-4 border-b border-border">
          <TouchableOpacity onPress={() => router.push('/(tabs)/' as any)} className="mr-3">
            <ArrowLeft size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text className="text-primary text-xl font-bold">Settings</Text>
        </View>

        <View className="pt-6">
          {/* Account section */}
          <SettingSection title="Account">
            {user ? (
              <>
                <SettingRow
                  label={user.email ?? 'User'}
                  description="Connected account"
                />
                <TouchableOpacity
                  onPress={signOut}
                  className="flex-row items-center py-5 px-6 gap-4"
                >
                  <LogOut size={24} color={colors.error} />
                  <Text className="text-error text-lg">Sign out</Text>
                </TouchableOpacity>
              </>
            ) : (
              <SettingRow
                label="Not connected"
                description="Sign in to sync your memos"
                onPress={() => router.push('/auth/login')}
                showArrow
              />
            )}
          </SettingSection>

          {/* Upload section */}
          <SettingSection title="Upload">
            <SettingRow
              label="Auto upload"
              description="Automatically upload items from buffer"
              value={autoUpload}
              onValueChange={setAutoUpload}
            />
            <SettingRow
              label="Wi-Fi only"
              description="Only upload when connected to Wi-Fi"
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
            <SettingRow
              label="Model"
              description={currentModel.label + ' — ' + currentModel.description}
              onPress={() => setModelPickerOpen(true)}
              showArrow
            />
          </SettingSection>

          {/* Appearance section */}
          <SettingSection title="Appearance">
            <SettingRow
              label="Theme"
              description={currentTheme.label + ' — ' + currentTheme.description}
              onPress={() => setThemePickerOpen(true)}
              showArrow
            />
          </SettingSection>

          {/* UI section */}
          <SettingSection title="Interface">
            <SettingRow
              label="Haptic feedback"
              description="Vibration when pressing buttons"
              value={hapticFeedback}
              onValueChange={setHapticFeedback}
            />
            <SettingRow
              label="Confirm delete"
              description="Ask confirmation before removing items"
              value={confirmDelete}
              onValueChange={setConfirmDelete}
            />
          </SettingSection>

          {/* App info */}
          <View className="px-4 py-8 items-center">
            <Text className="text-secondary text-sm">Gimmick v1.0.0</Text>
            <Text className="text-secondary text-xs mt-1">
              Capture everything, organize anything
            </Text>
          </View>
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
          className="flex-1 items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
        >
          <View
            className="mx-8 rounded-2xl overflow-hidden w-[85%]"
            style={{
              backgroundColor: colors.background2,
              borderWidth: 1.5,
              borderColor: colors.primary,
            }}
          >
            <Text className="text-primary text-xl font-semibold px-6 pt-5 pb-3">
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
                className="flex-row items-center px-6 py-5"
              >
                <View className="flex-1">
                  <Text className="text-primary text-lg">{model.label}</Text>
                  <Text className="text-secondary text-base mt-0.5">{model.description}</Text>
                </View>
                {aiModel === model.id && (
                  <Check size={24} color={colors.accent} />
                )}
              </TouchableOpacity>
            ))}
            <View className="h-3" />
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
          className="flex-1 items-center justify-center"
          style={{ backgroundColor: colors.overlay }}
        >
          <View
            className="mx-8 rounded-2xl overflow-hidden w-[85%]"
            style={{
              backgroundColor: colors.background2,
              borderWidth: 1.5,
              borderColor: colors.primary,
            }}
          >
            <Text className="text-primary text-xl font-semibold px-6 pt-5 pb-3">
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
                  className="flex-row items-center px-6 py-5"
                >
                  <Icon size={24} color={colors.secondary} />
                  <View className="flex-1 ml-4">
                    <Text className="text-primary text-lg">{option.label}</Text>
                    <Text className="text-secondary text-base mt-0.5">{option.description}</Text>
                  </View>
                  {theme === option.id && (
                    <Check size={24} color={colors.accent} />
                  )}
                </TouchableOpacity>
              );
            })}
            <View className="h-3" />
          </View>
        </Pressable>
      </Modal>
    </SafeAreaWrapper>
  );
}
