/**
 * Toast notification — stile Pixel Arcade.
 * Border 2px ink, offset shadow ink, font Press Start 2P per label, mini-card
 * con icon-tile colorato (success/error/info/warning → semantic colors).
 */
import React, { useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import {
  IconCheck,
  IconX as IconXClose,
  IconAlertTriangle,
  IconInfoCircle,
  IconExclamationMark,
} from '@tabler/icons-react-native';
import { config } from '@/constants';
import { usePixelTheme } from '@/components/pixel';
import type { ToastType } from '@/types';
import { useToastStore } from '@/store';

interface ToastItemProps {
  id: string;
  type: ToastType;
  message: string;
}

function ToastItem({ id, type, message }: ToastItemProps) {
  const theme = usePixelTheme();
  const hideToast = useToastStore((state) => state.hideToast);
  const translateY = useSharedValue(-100);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = withSpring(0, { damping: 15 });
    opacity.value = withTiming(1, { duration: config.animation.fast });
  }, []);

  const handleDismiss = () => {
    opacity.value = withTiming(0, { duration: config.animation.fast }, () => {
      runOnJS(hideToast)(id);
    });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  // Map semantic role → icon-tile color + label glyph
  const palette: Record<ToastType, { bg: string; Icon: typeof IconCheck; label: string }> = {
    success: { bg: theme.semantic.success, Icon: IconCheck, label: 'OK' },
    error:   { bg: theme.semantic.danger,  Icon: IconXClose, label: 'ERR' },
    info:    { bg: theme.semantic.info,    Icon: IconInfoCircle, label: 'INFO' },
    warning: { bg: theme.semantic.warning, Icon: IconAlertTriangle, label: 'WARN' },
  };
  const { bg, Icon, label } = palette[type];
  const sh = theme.shadowOffset;

  return (
    <Animated.View
      style={[
        animatedStyle,
        { marginHorizontal: 12, marginBottom: 8, position: 'relative', paddingRight: sh, paddingBottom: sh },
      ]}
    >
      {/* Offset shadow Android-safe */}
      {sh > 0 && (
        <View
          style={{
            position: 'absolute',
            left: sh, top: sh, right: 0, bottom: 0,
            backgroundColor: theme.shadowColor,
          }}
        />
      )}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 2,
          borderColor: theme.border,
          backgroundColor: theme.surface,
          paddingHorizontal: 10,
          paddingVertical: 10,
          gap: 10,
        }}
      >
        {/* Icon tile color-coded */}
        <View
          style={{
            width: 32,
            height: 32,
            borderWidth: 2,
            borderColor: theme.border,
            backgroundColor: bg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={16} color="#FFFFFF" strokeWidth={2.6} />
        </View>

        {/* Label sopra + message sotto */}
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: theme.fontHead,
              fontSize: 8,
              color: bg,
              letterSpacing: 1,
            }}
          >
            {label}
          </Text>
          <Text
            numberOfLines={2}
            style={{
              fontFamily: theme.fontBody,
              fontSize: 12,
              color: theme.ink,
              marginTop: 2,
              lineHeight: 16,
            }}
          >
            {message}
          </Text>
        </View>

        {/* Dismiss X */}
        <Pressable
          onPress={handleDismiss}
          hitSlop={8}
          style={({ pressed }) => ({
            width: 28, height: 28,
            borderWidth: 2, borderColor: theme.border,
            backgroundColor: theme.surfaceVariant,
            alignItems: 'center', justifyContent: 'center',
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <IconXClose size={14} color={theme.ink} strokeWidth={2.4} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

export function ToastContainer() {
  const toasts = useToastStore((state) => state.toasts);

  if (toasts.length === 0) return null;

  return (
    <View style={{ position: 'absolute', top: 48, left: 0, right: 0, zIndex: 50 }}>
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          id={toast.id}
          type={toast.type}
          message={toast.message}
        />
      ))}
    </View>
  );
}
