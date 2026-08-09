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
  /**
   * Dopo quanti minuti di INATTIVITÀ la conversazione della chat si svuota da
   * sé. `0` = mai. Conta l'inattività e non l'età: una chat ripresa poco fa non
   * è vecchia.
   */
  chatRetentionMinutes: number;

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
  setChatRetentionMinutes: (minutes: number) => void;
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
  // Un giorno: abbastanza per riprendere il discorso il giorno dopo, non tanto
  // da ritrovarsi davanti una conversazione di cui non si ricorda il contesto.
  chatRetentionMinutes: 1440,
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
      setChatRetentionMinutes: (chatRetentionMinutes) => set({ chatRetentionMinutes }),
      setTheme: (theme) => set({ theme }),
      setPixelSetting: (k, v) =>
        set((s) => ({ pixelSettings: { ...s.pixelSettings, [k]: v } })),
      setPixelSettings: (pixelSettings) => set({ pixelSettings }),
      resetSettings: () => set(defaultSettings),
    }),
    {
      name: 'gimmick-settings',
      version: 3,
      storage: createJSONStorage(() => AsyncStorage),
      migrate: (persisted, version) => {
        let state = (persisted ?? {}) as Partial<SettingsState>;
        if (version < 2 || !state.pixelSettings) {
          state = { ...state, pixelSettings: defaultPixelSettings };
        }
        // v3: la chat è diventata persistente e le serve una scadenza. Chi
        // aggiorna non ha il campo: senza default resterebbe `undefined`, che
        // in `expireIfStale` vale "non scade mai" — silenziosamente diverso da
        // quel che vede un'installazione nuova.
        if (typeof state.chatRetentionMinutes !== 'number') {
          state = { ...state, chatRetentionMinutes: defaultSettings.chatRetentionMinutes };
        }
        return state as SettingsState;
      },
    }
  )
);
