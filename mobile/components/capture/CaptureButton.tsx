import React from 'react';
import { TouchableOpacity, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '@/store';
import { config } from '@/constants';

interface CaptureButtonProps {
  icon: React.ReactNode;
  label: string;
  color: string;
  onPress: () => void;
  disabled?: boolean;
}

export function CaptureButton({
  icon,
  label,
  color,
  onPress,
  disabled = false,
}: CaptureButtonProps) {
  const hapticFeedback = useSettingsStore((state) => state.hapticFeedback);

  const handlePress = async () => {
    if (hapticFeedback) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onPress();
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.7}
      className={`
        flex-row items-center bg-background-2 rounded-xl px-4 border border-border
        ${disabled ? 'opacity-50' : ''}
      `}
      style={{ height: config.ui.captureButtonHeight }}
    >
      {/* Icon container with color background */}
      <View
        className="w-10 h-10 rounded-lg items-center justify-center mr-4"
        style={{ backgroundColor: `${color}20` }}
      >
        {React.cloneElement(icon as React.ReactElement<{ size?: number; color?: string }>, {
          size: 22,
          color: color,
        })}
      </View>

      {/* Label */}
      <Text className="text-primary text-base font-medium flex-1">{label}</Text>

      {/* Arrow indicator */}
      <View className="w-6 h-6 items-center justify-center">
        <Text className="text-secondary text-lg">&gt;</Text>
      </View>
    </TouchableOpacity>
  );
}
