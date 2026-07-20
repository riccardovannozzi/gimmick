/**
 * Gimmick · Obsidian — RN theme hook.
 *
 * Returns the Obsidian palette for the active mode. Reuses the app's existing
 * theme mode (settings + system) via `useTheme()`, so light/dark stays in sync
 * with the rest of the app — no extra provider needed.
 */
import { useTheme } from '@/lib/theme';
import { obsidianDark, obsidianLight, type ObsidianColors } from '@/constants/obsidian';

export function useObsidian(): ObsidianColors {
  const { isDark } = useTheme();
  return isDark ? obsidianDark : obsidianLight;
}

export type { ObsidianColors };
