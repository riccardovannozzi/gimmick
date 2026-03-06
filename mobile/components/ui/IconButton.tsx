import React from 'react';
import { TouchableOpacity, TouchableOpacityProps } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '@/store';
import { useThemeColors } from '@/lib/theme';

type IconButtonVariant = 'default' | 'filled' | 'ghost';
type IconButtonSize = 'sm' | 'md' | 'lg';

interface IconButtonProps extends TouchableOpacityProps {
  icon: React.ReactNode;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  color?: string;
}

const sizeMap: Record<IconButtonSize, number> = {
  sm: 32,
  md: 44,
  lg: 56,
};

export function IconButton({
  icon,
  variant = 'default',
  size = 'md',
  color,
  disabled,
  onPress,
  style,
  ...props
}: IconButtonProps) {
  const colors = useThemeColors();
  const hapticFeedback = useSettingsStore((state) => state.hapticFeedback);

  const handlePress = async (e: any) => {
    if (hapticFeedback) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress?.(e);
  };

  const buttonSize = sizeMap[size];

  const getVariantBg = () => {
    if (color) return color;
    switch (variant) {
      case 'filled': return colors.accent;
      case 'ghost': return 'transparent';
      default: return colors.surfaceVariant;
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.7}
      style={[
        {
          width: buttonSize,
          height: buttonSize,
          borderRadius: buttonSize / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: getVariantBg(),
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
      {...props}
    >
      {icon}
    </TouchableOpacity>
  );
}
