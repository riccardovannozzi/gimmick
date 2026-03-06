/**
 * Gimmick Color Palettes — Phantom-inspired dark design system
 */

// Capture colors — brand colors, same in both themes
export const captureColors = {
  photo: '#AB9FF2',    // phantom purple (light)
  video: '#59A5F5',    // soft blue
  text: '#AB9FF2',     // phantom purple
  voice: '#F2726F',    // coral red
  file: '#F2C94C',     // warm yellow
  gallery: '#6FCF97',  // soft green
  scan: '#59A5F5',     // soft blue
  ai: '#7B61FF',       // vivid purple
} as const;

// Semantic colors — same in both themes
export const semanticColors = {
  success: '#6FCF97',
  error: '#F2726F',
  warning: '#F2C94C',
} as const;

export const darkTheme = {
  // Surfaces (Phantom-style deep black hierarchy)
  background1: '#0C0C0E',     // Deepest background
  background2: '#1C1C1E',     // Cards, containers
  background3: '#2C2C2E',     // Elevated cards, hover
  surface: '#1C1C1E',         // Surface containers
  surfaceVariant: '#232326',  // Surface variant (action buttons)

  // Text
  primary: '#FFFFFF',          // Pure white
  secondary: '#8E8E93',       // iOS gray
  tertiary: '#636366',        // Muted gray

  // Accent
  accent: '#AB9FF2',           // Phantom light purple
  accentContainer: '#2A2640', // Purple muted container
  onAccent: '#FFFFFF',         // White on accent

  // Border
  border: 'rgba(255,255,255,0.08)',  // Very subtle white
  outline: '#48484A',                // System gray 3

  // Nav
  navBar: '#0C0C0E',
  navIndicator: '#AB9FF2',
  onNavIndicator: '#FFFFFF',

  // FAB
  fabBg: '#7B61FF',            // Vivid purple
  fabIcon: '#FFFFFF',

  ...semanticColors,
  capture: captureColors,
  overlay: 'rgba(0, 0, 0, 0.75)',
  overlayLight: 'rgba(0, 0, 0, 0.5)',
} as const;

export const lightTheme = {
  // Surfaces
  background1: '#F2F2F7',      // iOS light gray bg
  background2: '#FFFFFF',      // White cards
  background3: '#E5E5EA',      // Elevated
  surface: '#FFFFFF',
  surfaceVariant: '#F2F2F7',

  // Text
  primary: '#1C1C1E',
  secondary: '#8E8E93',
  tertiary: '#AEAEB2',

  // Accent
  accent: '#7B61FF',            // Vivid purple
  accentContainer: '#EDE9FF',   // Light purple container
  onAccent: '#FFFFFF',

  // Border
  border: 'rgba(0,0,0,0.08)',
  outline: '#C7C7CC',

  // Nav
  navBar: '#F2F2F7',
  navIndicator: '#7B61FF',
  onNavIndicator: '#FFFFFF',

  // FAB
  fabBg: '#7B61FF',
  fabIcon: '#FFFFFF',

  ...semanticColors,
  capture: captureColors,
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.3)',
} as const;

export type ThemeColors = typeof darkTheme;
export type CaptureType = keyof typeof captureColors;

// Default export for backward compatibility during migration
export const colors = darkTheme;
