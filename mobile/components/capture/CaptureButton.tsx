import React from 'react';
import { TouchableOpacity, Text, View, Platform } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
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

  const size = 96;
  const strokeW = 3;
  const radius = (size - strokeW) / 2;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.5; // 50% of circle

  return (
    <View className={`flex-1 items-center ${disabled ? 'opacity-50' : ''}`}>
      <TouchableOpacity
        onPress={handlePress}
        disabled={disabled}
        activeOpacity={0.85}
        className="items-center justify-center"
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.background2,
          borderWidth: 1,
          borderColor: colors.primary,
          ...Platform.select({
            ios: {
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.04,
              shadowRadius: 3,
            },
            android: {
              elevation: 1,
            },
          }),
        }}
      >
        {/* Thick arc accent */}
        <Svg
          width={size}
          height={size}
          style={{ position: 'absolute' }}
        >
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.primary}
            strokeWidth={strokeW}
            fill="none"
            strokeDasharray={`${arcLength} ${circumference - arcLength}`}
            strokeDashoffset={circumference * 0.25}
            strokeLinecap="round"
          />
        </Svg>

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
        {React.cloneElement(icon as React.ReactElement<any>, isSvg ? {
          width: 32,
          height: 32,
          stroke: colors.primary,
          strokeWidth: 1.8,
        } : {
          size: 32,
          color: colors.primary,
          strokeWidth: 1.8,
        })}
      </TouchableOpacity>
    </View>
  );
}
