/**
 * MOCA Color Palette - Dark Theme
 */
export const colors = {
  // Background colors
  background1: '#1E1E1E',
  background2: '#252526',

  // Text colors
  primary: '#F5F5F5',
  secondary: '#9CA3AF',

  // Accent & UI
  accent: '#528BFF',
  border: '#3E3E42',

  // Status colors
  success: '#22C55E',
  error: '#EF4444',
  warning: '#F59E0B',

  // Capture button colors
  capture: {
    photo: '#3B82F6',
    video: '#EC4899',
    text: '#22C55E',
    voice: '#EF4444',
    file: '#F59E0B',
    gallery: '#8B5CF6',
  },

  // Overlay & transparency
  overlay: 'rgba(0, 0, 0, 0.7)',
  overlayLight: 'rgba(0, 0, 0, 0.5)',
} as const;

export type CaptureType = keyof typeof colors.capture;
