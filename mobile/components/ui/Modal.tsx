/**
 * Wrapper di PixelModal che mantiene l'API legacy (title/onClose/visible/
 * showCloseButton/closeOnBackdrop) usata dagli screen non ancora migrati.
 * Internamente delega al PixelModal del design system Pixel Arcade.
 */
import React from 'react';
import { ModalProps as RNModalProps } from 'react-native';
import { usePixelTheme, PixelModal } from '@/components/pixel';

interface ModalProps extends Omit<RNModalProps, 'children'> {
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
  ...rest
}: ModalProps) {
  const theme = usePixelTheme();
  return (
    <PixelModal
      theme={theme}
      visible={visible}
      onClose={onClose}
      title={title}
      showCloseButton={showCloseButton}
      closeOnBackdrop={closeOnBackdrop}
      {...rest}
    >
      {children}
    </PixelModal>
  );
}
