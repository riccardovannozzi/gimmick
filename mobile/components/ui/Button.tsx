/**
 * Wrapper di PixelButton che mantiene l'API legacy (title/variant/size/icon/
 * iconPosition/fullWidth/loading) usata dagli screen non ancora migrati.
 * Internamente delega al PixelButton del design system Pixel Arcade.
 */
import React from 'react';
import { ActivityIndicator, View, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '@/store';
import { usePixelTheme, PixelButton } from '@/components/pixel';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}

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
  style,
}: ButtonProps) {
  const theme = usePixelTheme();
  const hapticFeedback = useSettingsStore((state) => state.hapticFeedback);

  const handlePress = async () => {
    if (hapticFeedback) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress?.();
  };

  // Mappa variant legacy → token Pixel
  const variantBg = (() => {
    switch (variant) {
      case 'primary': return theme.accent;
      case 'secondary': return theme.surface;
      case 'ghost': return 'transparent';
      case 'danger': return '#E24B4A';
    }
  })();
  const variantColor = (() => {
    switch (variant) {
      case 'primary': return theme.onAccent;
      case 'secondary': return theme.ink;
      case 'ghost': return theme.ink;
      case 'danger': return '#FFFFFF';
    }
  })();

  const isBig = size === 'lg';

  return (
    <PixelButton
      theme={theme}
      label={title}
      big={isBig}
      full={fullWidth}
      bg={variantBg}
      color={variantColor}
      leading={
        loading ? (
          <ActivityIndicator size="small" color={variantColor as string} />
        ) : icon && iconPosition === 'left' ? (
          icon
        ) : undefined
      }
      onPress={disabled || loading ? undefined : handlePress}
      style={{
        ...(disabled || loading ? { opacity: 0.5 } : null),
        ...(style ?? {}),
      }}
    />
  );
}
