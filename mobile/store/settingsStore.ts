import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PixelSettings } from '@/components/pixel';

export type { PixelSettings };

interface SettingsState {
  // Photo settings
  photoQuality: 'low' | 'medium' | 'high';
  saveOriginal: boolean;

  // Audio settings
  audioQuality: 'low' | 'medium' | 'high';

  // Upload settings
  autoUpload: boolean;
  uploadOnWifiOnly: boolean;

  // UI settings
  hapticFeedback: boolean;
  confirmDelete: boolean;

  // AI settings
  aiProvider: string;
  aiModel: string;

  // Theme (legacy ThemeProvider in mobile/lib/theme.tsx)
  theme: 'light' | 'dark' | 'system';

  // Pixel Arcade design system settings (handoff/README.md)
  pixelSettings: PixelSettings;

  // Actions
  setPhotoQuality: (quality: 'low' | 'medium' | 'high') => void;
  setSaveOriginal: (save: boolean) => void;
  setAudioQuality: (quality: 'low' | 'medium' | 'high') => void;
  setAutoUpload: (auto: boolean) => void;
  setUploadOnWifiOnly: (wifiOnly: boolean) => void;
  setHapticFeedback: (enabled: boolean) => void;
  setConfirmDelete: (confirm: boolean) => void;
  setAiProvider: (provider: string) => void;
  setAiModel: (model: string) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setPixelSetting: <K extends keyof PixelSettings>(k: K, v: PixelSettings[K]) => void;
  setPixelSettings: (next: PixelSettings) => void;
  resetSettings: () => void;
}

export const defaultPixelSettings: PixelSettings = {
  paletteId: 'cmyk',
  mode: 'light',
  shadowSize: 'm',
  bgColorId: 'paletteDefault',
  backgroundId: 'none',
  captureTreatment: 'tinted',
  scanlines: false,
};

const defaultSettings = {
  photoQuality: 'high' as const,
  saveOriginal: false,
  audioQuality: 'high' as const,
  autoUpload: false,
  uploadOnWifiOnly: true,
  hapticFeedback: true,
  confirmDelete: true,
  aiProvider: 'anthropic',
  aiModel: 'claude-haiku-4-5-20251001',
  theme: 'dark' as const,
  pixelSettings: defaultPixelSettings,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaultSettings,

      setPhotoQuality: (photoQuality) => set({ photoQuality }),
      setSaveOriginal: (saveOriginal) => set({ saveOriginal }),
      setAudioQuality: (audioQuality) => set({ audioQuality }),
      setAutoUpload: (autoUpload) => set({ autoUpload }),
      setUploadOnWifiOnly: (uploadOnWifiOnly) => set({ uploadOnWifiOnly }),
      setHapticFeedback: (hapticFeedback) => set({ hapticFeedback }),
      setConfirmDelete: (confirmDelete) => set({ confirmDelete }),
      setAiProvider: (aiProvider) => set({ aiProvider }),
      setAiModel: (aiModel) => set({ aiModel }),
      setTheme: (theme) => set({ theme }),
      setPixelSetting: (k, v) =>
        set((s) => ({ pixelSettings: { ...s.pixelSettings, [k]: v } })),
      setPixelSettings: (pixelSettings) => set({ pixelSettings }),
      resetSettings: () => set(defaultSettings),
    }),
    {
      name: 'gimmick-settings',
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Partial<SettingsState>;
        if (version < 2 || !state.pixelSettings) {
          return { ...state, pixelSettings: defaultPixelSettings } as SettingsState;
        }
        return state as SettingsState;
      },
    }
  )
);
