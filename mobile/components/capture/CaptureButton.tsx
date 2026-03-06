import React from 'react';
import { TouchableOpacity, Text, View, Platform } from 'react-native';
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
  isSvg?: boolean;
}

export function CaptureButton({
  icon,
  label,
  color,
  onPress,
  disabled = false,
  count = 0,
  isSvg = false,
}: CaptureButtonProps) {
  const hapticFeedback = useSettingsStore((state) => state.hapticFeedback);
  const colors = useThemeColors();

  const handlePress = async () => {
    if (hapticFeedback) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onPress();
  };

  const size = 80;

  return (
    <View className={`flex-1 items-center ${disabled ? 'opacity-50' : ''}`}>
      <TouchableOpacity
        onPress={handlePress}
        disabled={disabled}
        activeOpacity={0.8}
        className="items-center justify-center"
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          ...Platform.select({
            ios: {
              shadowColor: color,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
            },
            android: {
              elevation: 4,
            },
          }),
        }}
      >
        {/* Icon */}
        {React.cloneElement(icon as React.ReactElement<any>, isSvg ? {
          width: 32,
          height: 32,
          stroke: '#000000',
          strokeWidth: 1.8,
        } : {
          size: 32,
          color: '#000000',
          strokeWidth: 1.8,
        })}

        {/* Badge */}
        {count > 0 && (
          <View
            className="absolute -top-1 -right-1 min-w-6 h-6 rounded-full items-center justify-center px-1"
            style={{
              backgroundColor: colors.background1,
              borderWidth: 2,
              borderColor: color,
            }}
          >
            <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>{count}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Label below */}
      <Text
        className="mt-2 text-center"
        style={{ color: '#000000', fontSize: 12, fontWeight: '500' }}
      >
        {label.toLowerCase()}
      </Text>
    </View>
  );
}
