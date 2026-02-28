import React from 'react';
import { View, Text, Switch, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, LogOut } from 'lucide-react-native';
import { SafeAreaWrapper } from '@/components/layout/SafeAreaWrapper';
import { useSettingsStore, useAuthStore } from '@/store';
import { colors } from '@/constants';

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
  const content = (
    <View className="flex-row items-center justify-between py-4 px-4 border-b border-border">
      <View className="flex-1 mr-4">
        <Text className="text-primary text-base">{label}</Text>
        {description && (
          <Text className="text-secondary text-sm mt-1">{description}</Text>
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

      {showArrow && <ChevronRight size={20} color={colors.secondary} />}
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
  return (
    <View className="mb-6">
      <Text className="text-secondary text-xs font-medium uppercase px-4 mb-2">
        {title}
      </Text>
      <View className="bg-background-2 rounded-lg overflow-hidden mx-4">
        {children}
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const {
    hapticFeedback,
    setHapticFeedback,
    confirmDelete,
    setConfirmDelete,
    autoUpload,
    setAutoUpload,
    uploadOnWifiOnly,
    setUploadOnWifiOnly,
  } = useSettingsStore();

  const { user, signOut } = useAuthStore();
  const router = useRouter();

  return (
    <SafeAreaWrapper edges={['top']}>
      <ScrollView className="flex-1">
        {/* Header */}
        <View className="px-4 py-4 border-b border-border">
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
                  className="flex-row items-center py-4 px-4"
                >
                  <LogOut size={20} color={colors.error} />
                  <Text className="text-error ml-3">Sign out</Text>
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
    </SafeAreaWrapper>
  );
}
