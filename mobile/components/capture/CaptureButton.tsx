import React from 'react';
import { TouchableOpacity, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '@/store';
import { useThemeColors } from '@/lib/theme';

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
  const colors = useThemeColors();

  const handlePress = async () => {
    if (hapticFeedback) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onPress();
  };

  return (
    <View className={`flex-1 items-center ${disabled ? 'opacity-50' : ''}`}>
      <TouchableOpacity
        onPress={handlePress}
        disabled={disabled}
        activeOpacity={0.7}
        className="items-center justify-center"
        style={{
          width: 96,
          height: 96,
          borderRadius: 48,
          backgroundColor: `${color}15`,
          borderWidth: 1.5,
          borderColor: colors.primary,
        }}
      >
        {/* Badge */}
        {count > 0 && (
          <View
            className="absolute -top-2 -right-2 z-10 min-w-[40px] h-[40px] rounded-full items-center justify-center px-1"
            style={{ backgroundColor: color }}
          >
            <Text className="text-white text-[20px] font-bold">{count}</Text>
          </View>
        )}

        {/* Icon */}
        {React.cloneElement(icon as React.ReactElement<{ size?: number; color?: string; strokeWidth?: number }>, {
          size: 44,
          color: color,
          strokeWidth: 1.5,
        })}
      </TouchableOpacity>

      {/* Label below circle */}
      <Text className="text-primary text-[10px] font-medium uppercase tracking-wide mt-2">
        {label}
      </Text>
    </View>
  );
}
