import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  TouchableOpacityProps,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '@/lib/theme';
import { useSettingsStore } from '@/store';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, { bg: string; text: string; border?: string }> = {
  primary: {
    bg: 'bg-accent',
    text: 'text-white',
  },
  secondary: {
    bg: 'bg-background-2',
    text: 'text-primary',
    border: 'border border-border',
  },
  ghost: {
    bg: 'bg-transparent',
    text: 'text-primary',
  },
  danger: {
    bg: 'bg-error',
    text: 'text-white',
  },
};

const sizeStyles: Record<ButtonSize, { container: string; text: string }> = {
  sm: {
    container: 'px-3 py-2',
    text: 'text-sm',
  },
  md: {
    container: 'px-4 py-3',
    text: 'text-base',
  },
  lg: {
    container: 'px-6 py-4',
    text: 'text-lg',
  },
};

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  disabled,
  onPress,
  ...props
}: ButtonProps) {
  const colors = useThemeColors();
  const hapticFeedback = useSettingsStore((state) => state.hapticFeedback);

  const handlePress = async (e: any) => {
    if (hapticFeedback) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress?.(e);
  };

  const styles = variantStyles[variant];
  const sizes = sizeStyles[size];

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      className={`
        flex-row items-center justify-center rounded-lg
        ${styles.bg}
        ${styles.border ?? ''}
        ${sizes.container}
        ${fullWidth ? 'w-full' : ''}
        ${disabled || loading ? 'opacity-50' : ''}
      `}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' || variant === 'danger' ? '#fff' : colors.primary}
        />
      ) : (
        <View className="flex-row items-center gap-2">
          {icon && iconPosition === 'left' && icon}
          <Text className={`font-semibold ${styles.text} ${sizes.text}`}>
            {title}
          </Text>
          {icon && iconPosition === 'right' && icon}
        </View>
      )}
    </TouchableOpacity>
  );
}
