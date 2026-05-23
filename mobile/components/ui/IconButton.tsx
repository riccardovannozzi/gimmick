/**
 * Wrapper di PixelIconButton che mantiene l'API legacy (icon/variant/size/
 * color) usata dagli screen non ancora migrati. Internamente delega al
 * PixelIconButton del design system Pixel Arcade.
 */
import React from 'react';
import { ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '@/store';
import { usePixelTheme, PixelIconButton } from '@/components/pixel';

type IconButtonVariant = 'default' | 'filled' | 'ghost';
type IconButtonSize = 'sm' | 'md' | 'lg';

interface IconButtonProps {
  icon: React.ReactNode;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  color?: string;
  disabled?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
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
}: IconButtonProps) {
  const theme = usePixelTheme();
  const hapticFeedback = useSettingsStore((state) => state.hapticFeedback);

  const handlePress = async () => {
    if (hapticFeedback) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress?.();
  };

  const bg = (() => {
    if (color) return color;
    switch (variant) {
      case 'filled': return theme.accent;
      case 'ghost': return 'transparent';
      default: return theme.surfaceVariant;
    }
  })();

  return (
    <PixelIconButton
      theme={theme}
      onPress={disabled ? undefined : handlePress}
      bg={bg}
      size={sizeMap[size]}
      disabled={disabled}
      style={style}
    >
      {icon}
    </PixelIconButton>
  );
}
