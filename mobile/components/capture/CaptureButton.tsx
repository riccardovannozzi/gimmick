import React from 'react';
import { TouchableOpacity, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '@/store';

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
        flex-1 aspect-square items-center justify-center bg-background-2 rounded-2xl border border-border
        ${disabled ? 'opacity-50' : ''}
      `}
    >
      {/* Icon container with color background */}
      <View
        className="w-14 h-14 rounded-xl items-center justify-center mb-2"
        style={{ backgroundColor: `${color}20` }}
      >
        {React.cloneElement(icon as React.ReactElement<{ size?: number; color?: string }>, {
          size: 28,
          color: color,
        })}
      </View>

      {/* Label */}
      <Text className="text-primary text-xs font-medium uppercase tracking-wide">
        {label}
      </Text>
    </TouchableOpacity>
  );
}
