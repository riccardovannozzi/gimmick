import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

  // Actions
  setPhotoQuality: (quality: 'low' | 'medium' | 'high') => void;
  setSaveOriginal: (save: boolean) => void;
  setAudioQuality: (quality: 'low' | 'medium' | 'high') => void;
  setAutoUpload: (auto: boolean) => void;
  setUploadOnWifiOnly: (wifiOnly: boolean) => void;
  setHapticFeedback: (enabled: boolean) => void;
  setConfirmDelete: (confirm: boolean) => void;
  resetSettings: () => void;
}

const defaultSettings = {
  photoQuality: 'high' as const,
  saveOriginal: false,
  audioQuality: 'high' as const,
  autoUpload: false,
  uploadOnWifiOnly: true,
  hapticFeedback: true,
  confirmDelete: true,
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
      resetSettings: () => set(defaultSettings),
    }),
    {
      name: 'gimmick-settings',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
