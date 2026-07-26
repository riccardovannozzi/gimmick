/**
 * Toast notification — stile Obsidian.
 *
 * Discreto e poco invasivo: card scura (surface + bordo sottile), icona
 * semantica piccola a sinistra, messaggio, X per chiudere. Niente tile colorato,
 * label "OK/WARN" o font pixel — coerente con la shell Obsidian mobile.
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  IconCheck,
  IconX as IconXClose,
  IconAlertTriangle,
  IconInfoCircle,
} from '@tabler/icons-react-native';
import { config } from '@/constants';
import { useObsidian } from '@/lib/obsidian';
import type { ToastType } from '@/types';
import { useToastStore } from '@/store';

interface ToastItemProps {
  id: string;
  type: ToastType;
  message: string;
}

function ToastItem({ id, type, message }: ToastItemProps) {
  const c = useObsidian();
  const hideToast = useToastStore((state) => state.hideToast);
  const translateY = useSharedValue(-24);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = withSpring(0, { damping: 16 });
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

  // Ruolo semantico → icona + colore (token Obsidian). Solo l'icona è colorata:
  // il messaggio resta in colore testo, così l'avviso non è aggressivo.
  const palette: Record<ToastType, { color: string; Icon: typeof IconCheck }> = {
    success: { color: c.success, Icon: IconCheck },
    error: { color: c.error, Icon: IconAlertTriangle },
    info: { color: c.info, Icon: IconInfoCircle },
    warning: { color: c.warning, Icon: IconAlertTriangle },
  };
  const { color, Icon } = palette[type];

  return (
    <Animated.View style={[animatedStyle, { marginHorizontal: 12, marginBottom: 8 }]}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.line,
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 10,
          shadowColor: '#000',
          shadowOpacity: 0.28,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 5 },
          elevation: 6,
        }}
      >
        <Icon size={17} color={color} strokeWidth={2} />
        <Text
          numberOfLines={3}
          style={{ flex: 1, fontSize: 13, lineHeight: 18, color: c.text }}
        >
          {message}
        </Text>
        <Pressable onPress={handleDismiss} hitSlop={10} accessibilityLabel="Chiudi notifica">
          <IconXClose size={15} color={c.subtle} strokeWidth={1.9} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

export function ToastContainer() {
  const toasts = useToastStore((state) => state.toasts);
  const insets = useSafeAreaInsets();

  if (toasts.length === 0) return null;

  return (
    <View style={{ position: 'absolute', top: insets.top + 8, left: 0, right: 0, zIndex: 50 }}>
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
