import React from 'react';
import {
  Modal as RNModal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ModalProps as RNModalProps,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useThemeColors } from '@/lib/theme';

interface ModalProps extends RNModalProps {
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
  showCloseButton?: boolean;
  closeOnBackdrop?: boolean;
}

export function Modal({
  title,
  onClose,
  children,
  showCloseButton = true,
  closeOnBackdrop = true,
  visible,
  ...props
}: ModalProps) {
  const colors = useThemeColors();
  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
      {...props}
    >
      <TouchableWithoutFeedback onPress={closeOnBackdrop ? onClose : undefined}>
        <View className="flex-1 bg-black/70 justify-center items-center px-4">
          <TouchableWithoutFeedback>
            <View className="bg-background-2 rounded-2xl w-full max-w-md overflow-hidden">
              {/* Header */}
              {(title || showCloseButton) && (
                <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
                  <Text className="text-primary text-lg font-semibold flex-1">
                    {title ?? ''}
                  </Text>
                  {showCloseButton && (
                    <TouchableOpacity
                      onPress={onClose}
                      className="p-1"
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <X size={24} color={colors.secondary} />
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Content */}
              <View className="p-4">{children}</View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </RNModal>
  );
}
