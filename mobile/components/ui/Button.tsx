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

  const getVariantStyle = () => {
    switch (variant) {
      case 'primary':
        return { bg: colors.accent, text: colors.onAccent };
      case 'secondary':
        return { bg: colors.surfaceVariant, text: colors.primary, border: colors.border };
      case 'ghost':
        return { bg: 'transparent', text: colors.primary };
      case 'danger':
        return { bg: colors.error, text: '#FFFFFF' };
    }
  };

  const getSizeStyle = () => {
    switch (size) {
      case 'sm': return { px: 12, py: 8, fontSize: 13 };
      case 'md': return { px: 16, py: 12, fontSize: 15 };
      case 'lg': return { px: 24, py: 16, fontSize: 17 };
    }
  };

  const vs = getVariantStyle();
  const ss = getSizeStyle();

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: vs.bg,
        borderRadius: 16,
        paddingHorizontal: ss.px,
        paddingVertical: ss.py,
        width: fullWidth ? '100%' : undefined,
        opacity: disabled || loading ? 0.5 : 1,
        borderWidth: vs.border ? 1 : 0,
        borderColor: vs.border,
      }}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={vs.text}
        />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {icon && iconPosition === 'left' && icon}
          <Text style={{ fontWeight: '600', color: vs.text, fontSize: ss.fontSize }}>
            {title}
          </Text>
          {icon && iconPosition === 'right' && icon}
        </View>
      )}
    </TouchableOpacity>
  );
}
