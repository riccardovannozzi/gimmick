'use client';

import { create } from 'zustand';
import { MASCOTS } from '@/lib/mascots';

/**
 * Card Roster settings — per `/MASCOT.md` § "Settings · Mascot preferences".
 * Drives which mascots are allowed to surface in the product and how
 * intrusive they're allowed to be.
 *
 * In addition to the GLOBAL prefs, each mascot can carry its own typed
 * configuration blob (see KronConfig / FlockyConfig below) accessed via
 * `useMascotConfig('<id>')`. New mascots that need bespoke options should
 * add their type to MascotConfigs + default in DEFAULT_CONFIGS.
 *
 * Persisted to localStorage. When the user-settings backend ships this
 * should move to `user_settings.mascots` (jsonb).
 */

export type MascotFrequency = 'off' | 'rare' | 'normal' | 'often';

export interface MascotSettings {
  enabled: string[];        // mascot ids actively allowed to surface
  frequency: MascotFrequency;
  animations: boolean;
  dialog: boolean;
}

// ─── Per-mascot configs ────────────────────────────────────────────────────

/** Sound preference shared by mascots that play a jingle on notification.
 *  `src` can be:
 *    - null  → use the mascot's default audio at /sounds/<mascot>-default.mp3
 *    - "/sounds/..." path → bundled file in /public/sounds
 *    - "data:audio/..." → user-uploaded file persisted as data URL */
export interface MascotSoundConfig {
  enabled: boolean;
  src: string | null;
}

/** Kron — timed-appointment reminder. Up to 2 notifications, each
 *  configurable in minutes-before-event. Plays a tibetan-bell jingle. */
export interface KronConfig {
  notifications: Array<{ enabled: boolean; minutesBefore: number }>;
  sound: MascotSoundConfig;
}

export type FlockyMorningMode = 'first-open' | 'scheduled';

/** Flocky — daily appointments digest. Two pushes:
 *   - morning roundup: triggered either at first-open of the day or at
 *     specific times (comma-separated list like "13:00,14:50,23:30");
 *   - end-of-day recap: a single time-of-day summary of what's done /
 *     not done.
 *   Plays a rooster-crow jingle. */
export interface FlockyConfig {
  morning: {
    mode: FlockyMorningMode;
    /** "HH:MM" entries; ignored unless mode === 'scheduled'. */
    times: string[];
  };
  recap: {
    enabled: boolean;
    /** "HH:MM" time when the done/not-done summary fires. */
    time: string;
  };
  sound: MascotSoundConfig;
}

/**
 * Default audio file paths — base name **without extension**.
 * The resolver in SoundSection probes mp3 / wav / ogg / m4a in order and
 * picks the first one that exists, so users can drop any common format.
 *
 * Drop the file in `frontend/public/sounds/` with one of those extensions
 * (e.g. `kron-default.wav`) and the mascot picks it up automatically.
 */
export const DEFAULT_SOUND_BASE: Record<string, string> = {
  kron: '/sounds/kron-default',
  flocky: '/sounds/flocky-default',
};

export const SUPPORTED_AUDIO_EXTS = ['mp3', 'wav', 'ogg', 'm4a'] as const;

export interface MascotConfigs {
  kron?: KronConfig;
  flocky?: FlockyConfig;
}

export const DEFAULT_CONFIGS: { kron: KronConfig; flocky: FlockyConfig } = {
  kron: {
    notifications: [
      { enabled: true, minutesBefore: 30 },
      { enabled: true, minutesBefore: 5 },
    ],
    sound: { enabled: true, src: null },
  },
  flocky: {
    morning: { mode: 'first-open', times: ['08:30'] },
    recap: { enabled: true, time: '20:00' },
    sound: { enabled: true, src: null },
  },
};

const STORAGE_KEY = 'gimmick-mascot-settings-v2';
const LEGACY_KEY = 'gimmick-mascot-settings-v1';

interface PersistedShape {
  settings: MascotSettings;
  configs: MascotConfigs;
}

function defaultSettings(): MascotSettings {
  return {
    enabled: MASCOTS.map((m) => m.id),  // all 10 on by default
    frequency: 'normal',
    animations: true,
    dialog: true,
  };
}

function defaultConfigs(): MascotConfigs {
  return {
    kron: DEFAULT_CONFIGS.kron,
    flocky: DEFAULT_CONFIGS.flocky,
  };
}

function load(): PersistedShape {
  if (typeof window === 'undefined') return { settings: defaultSettings(), configs: defaultConfigs() };
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_KEY);
    if (!raw) return { settings: defaultSettings(), configs: defaultConfigs() };
    const parsed = JSON.parse(raw);
    // v1 shape was just MascotSettings; v2 wraps it. Detect & migrate.
    const isV2 = parsed && typeof parsed === 'object' && 'settings' in parsed;
    const rawSettings = (isV2 ? parsed.settings : parsed) as Partial<MascotSettings>;
    const rawConfigs = (isV2 ? parsed.configs : {}) as Partial<MascotConfigs>;
    return {
      settings: {
        enabled: Array.isArray(rawSettings?.enabled) ? rawSettings.enabled : defaultSettings().enabled,
        frequency: (['off', 'rare', 'normal', 'often'] as const).includes(rawSettings?.frequency as MascotFrequency)
          ? (rawSettings!.frequency as MascotFrequency)
          : 'normal',
        animations: typeof rawSettings?.animations === 'boolean' ? rawSettings.animations : true,
        dialog: typeof rawSettings?.dialog === 'boolean' ? rawSettings.dialog : true,
      },
      configs: {
        // Deep merge with defaults so older persisted snapshots (e.g. before
        // `sound` was added) silently gain the missing fields.
        kron: { ...DEFAULT_CONFIGS.kron, ...(rawConfigs?.kron ?? {}), sound: { ...DEFAULT_CONFIGS.kron.sound, ...(rawConfigs?.kron?.sound ?? {}) } },
        flocky: { ...DEFAULT_CONFIGS.flocky, ...(rawConfigs?.flocky ?? {}), sound: { ...DEFAULT_CONFIGS.flocky.sound, ...(rawConfigs?.flocky?.sound ?? {}) } },
      },
    };
  } catch {
    return { settings: defaultSettings(), configs: defaultConfigs() };
  }
}

function save(state: PersistedShape) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore quota */ }
}

interface CardRosterState {
  settings: MascotSettings;
  configs: MascotConfigs;
  toggleMascot: (id: string) => void;
  setFrequency: (f: MascotFrequency) => void;
  setAnimations: (on: boolean) => void;
  setDialog: (on: boolean) => void;
  enableAll: () => void;
  disableAll: () => void;
  /** Helper that any surface can call before rendering its mascot. */
  isEnabled: (id: string) => boolean;
  /** Type-safe getters for the per-mascot configs (always return a value
   *  — fall back to DEFAULT_CONFIGS so callers never deal with undefined). */
  getKron: () => KronConfig;
  getFlocky: () => FlockyConfig;
  updateKron: (patch: Partial<KronConfig>) => void;
  updateFlocky: (patch: Partial<FlockyConfig>) => void;
}

export const useCardRoster = create<CardRosterState>((set, get) => {
  const initial = load();
  return {
    settings: initial.settings,
    configs: initial.configs,

    toggleMascot: (id) => {
      const cur = get().settings;
      const has = cur.enabled.includes(id);
      const settings: MascotSettings = {
        ...cur,
        enabled: has ? cur.enabled.filter((x) => x !== id) : [...cur.enabled, id],
      };
      save({ settings, configs: get().configs });
      set({ settings });
    },

    setFrequency: (frequency) => {
      const settings = { ...get().settings, frequency };
      save({ settings, configs: get().configs });
      set({ settings });
    },

    setAnimations: (animations) => {
      const settings = { ...get().settings, animations };
      save({ settings, configs: get().configs });
      set({ settings });
    },

    setDialog: (dialog) => {
      const settings = { ...get().settings, dialog };
      save({ settings, configs: get().configs });
      set({ settings });
    },

    enableAll: () => {
      const settings = { ...get().settings, enabled: MASCOTS.map((m) => m.id) };
      save({ settings, configs: get().configs });
      set({ settings });
    },

    disableAll: () => {
      const settings = { ...get().settings, enabled: [] };
      save({ settings, configs: get().configs });
      set({ settings });
    },

    isEnabled: (id) => get().settings.enabled.includes(id),

    getKron: () => get().configs.kron ?? DEFAULT_CONFIGS.kron,
    getFlocky: () => get().configs.flocky ?? DEFAULT_CONFIGS.flocky,

    updateKron: (patch) => {
      const cur = get().configs.kron ?? DEFAULT_CONFIGS.kron;
      const configs: MascotConfigs = { ...get().configs, kron: { ...cur, ...patch } };
      save({ settings: get().settings, configs });
      set({ configs });
    },

    updateFlocky: (patch) => {
      const cur = get().configs.flocky ?? DEFAULT_CONFIGS.flocky;
      const configs: MascotConfigs = { ...get().configs, flocky: { ...cur, ...patch } };
      save({ settings: get().settings, configs });
      set({ configs });
    },
  };
});
