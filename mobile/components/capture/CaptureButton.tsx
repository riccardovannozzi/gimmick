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
  count?: number;
}

export function CaptureButton({
  icon,
  label,
  color,
  onPress,
  disabled = false,
  count = 0,
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
        flex-1 aspect-square items-center justify-center rounded-2xl
        ${disabled ? 'opacity-50' : ''}
      `}
      style={{ backgroundColor: `${color}20` }}
    >
      {/* Badge */}
      {count > 0 && (
        <View
          className="absolute top-2 right-2 z-10 min-w-[22px] h-[22px] rounded-full items-center justify-center px-1"
          style={{ backgroundColor: color }}
        >
          <Text className="text-white text-xs font-bold">{count}</Text>
        </View>
      )}

      {/* Icon - centered in upper area */}
      <View className="flex-1 items-center justify-center">
        {React.cloneElement(icon as React.ReactElement<{ size?: number; color?: string; strokeWidth?: number }>, {
          size: 48,
          color: color,
          strokeWidth: 1.2,
        })}
      </View>

      {/* Label - pinned to bottom */}
      <Text className="text-primary text-xs font-medium uppercase tracking-wide mb-3">
        {label}
      </Text>
    </TouchableOpacity>
  );
}
