import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react-native';
import { colors, config } from '@/constants';
import type { ToastType } from '@/types';
import { useToastStore } from '@/store';

interface ToastItemProps {
  id: string;
  type: ToastType;
  message: string;
}

const toastConfig: Record<ToastType, { icon: React.ReactNode; bgColor: string }> = {
  success: {
    icon: <CheckCircle size={20} color={colors.success} />,
    bgColor: 'bg-background-2 border-l-4 border-l-success',
  },
  error: {
    icon: <XCircle size={20} color={colors.error} />,
    bgColor: 'bg-background-2 border-l-4 border-l-error',
  },
  info: {
    icon: <Info size={20} color={colors.accent} />,
    bgColor: 'bg-background-2 border-l-4 border-l-accent',
  },
  warning: {
    icon: <AlertTriangle size={20} color={colors.warning} />,
    bgColor: 'bg-background-2 border-l-4 border-l-warning',
  },
};

function ToastItem({ id, type, message }: ToastItemProps) {
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

  const { icon, bgColor } = toastConfig[type];

  return (
    <Animated.View
      style={animatedStyle}
      className={`
        flex-row items-center mx-4 mb-2 p-3 rounded-lg
        ${bgColor}
        shadow-lg
      `}
    >
      <View className="mr-3">{icon}</View>
      <Text className="text-primary flex-1 text-sm">{message}</Text>
      <TouchableOpacity onPress={handleDismiss} className="p-1 ml-2">
        <X size={16} color={colors.secondary} />
      </TouchableOpacity>
    </Animated.View>
  );
}

export function ToastContainer() {
  const toasts = useToastStore((state) => state.toasts);

  if (toasts.length === 0) return null;

  return (
    <View className="absolute top-12 left-0 right-0 z-50">
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
