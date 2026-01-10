import React from 'react';
import { View, Text } from 'react-native';
import { Modal } from './Modal';
import { Button } from './Button';

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'primary' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function ConfirmModal({
  visible,
  title,
  message,
  confirmText = 'Conferma',
  cancelText = 'Annulla',
  confirmVariant = 'primary',
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmModalProps) {
  return (
    <Modal
      visible={visible}
      title={title}
      onClose={onCancel}
      showCloseButton={false}
      closeOnBackdrop={!loading}
    >
      <View className="gap-4">
        <Text className="text-secondary text-base leading-6">{message}</Text>

        <View className="flex-row gap-3 mt-2">
          <View className="flex-1">
            <Button
              title={cancelText}
              variant="secondary"
              onPress={onCancel}
              disabled={loading}
              fullWidth
            />
          </View>
          <View className="flex-1">
            <Button
              title={confirmText}
              variant={confirmVariant}
              onPress={onConfirm}
              loading={loading}
              fullWidth
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
