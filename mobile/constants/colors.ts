/**
 * Gimmick Color Palettes
 */

// Capture colors — brand colors, same in both themes
export const captureColors = {
  photo: '#3B82F6',
  video: '#EC4899',
  text: '#22C55E',
  voice: '#EF4444',
  file: '#F59E0B',
  gallery: '#8B5CF6',
} as const;

// Semantic colors — same in both themes
export const semanticColors = {
  success: '#22C55E',
  error: '#EF4444',
  warning: '#F59E0B',
} as const;

export const darkTheme = {
  background1: '#1E1E1E',
  background2: '#252526',
  background3: '#2D2D30',
  primary: '#F5F5F5',
  secondary: '#9CA3AF',
  accent: '#528BFF',
  border: '#3E3E42',
  ...semanticColors,
  capture: captureColors,
  overlay: 'rgba(0, 0, 0, 0.7)',
  overlayLight: 'rgba(0, 0, 0, 0.5)',
} as const;

export const lightTheme = {
  background1: '#F5F5F4',
  background2: '#FFFFFF',
  background3: '#E5E5E4',
  primary: '#1A1A1A',
  secondary: '#6B7280',
  accent: '#3B6EE6',
  border: '#E2E4E9',
  ...semanticColors,
  capture: captureColors,
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.3)',
} as const;

export type ThemeColors = typeof darkTheme;
export type CaptureType = keyof typeof captureColors;

// Default export for backward compatibility during migration
export const colors = darkTheme;
