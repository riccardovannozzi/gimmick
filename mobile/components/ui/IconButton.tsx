import React from 'react';
import { TouchableOpacity, TouchableOpacityProps, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '@/store';

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

const variantStyles: Record<IconButtonVariant, string> = {
  default: 'bg-background-2 border border-border',
  filled: 'bg-accent',
  ghost: 'bg-transparent',
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
  const hapticFeedback = useSettingsStore((state) => state.hapticFeedback);

  const handlePress = async (e: any) => {
    if (hapticFeedback) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress?.(e);
  };

  const buttonSize = sizeMap[size];

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.7}
      className={`
        items-center justify-center rounded-full
        ${variantStyles[variant]}
        ${disabled ? 'opacity-50' : ''}
      `}
      style={[
        {
          width: buttonSize,
          height: buttonSize,
          backgroundColor: color,
        },
        style,
      ]}
      {...props}
    >
      {icon}
    </TouchableOpacity>
  );
}
