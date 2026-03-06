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

  const size = 72;

  return (
    <View className={`flex-1 items-center ${disabled ? 'opacity-50' : ''}`}>
      <TouchableOpacity
        onPress={handlePress}
        disabled={disabled}
        activeOpacity={0.7}
        className="items-center justify-center"
        style={{
          width: size,
          height: size,
          borderRadius: 20,
          backgroundColor: colors.surfaceVariant,
        }}
      >
        {React.cloneElement(icon as React.ReactElement<any>, {
          size: 28,
          color: color,
          strokeWidth: 1.8,
        })}

        {count > 0 && (
          <View
            className="absolute -top-1 -right-1 min-w-6 h-6 rounded-full items-center justify-center px-1"
            style={{
              backgroundColor: colors.accent,
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>{count}</Text>
          </View>
        )}
      </TouchableOpacity>

      <Text
        className="mt-2 text-center"
        style={{ color: colors.secondary, fontSize: 11, fontWeight: '500' }}
      >
        {label}
      </Text>
    </View>
  );
}
