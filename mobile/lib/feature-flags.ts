/**
 * Gimmick · Obsidian — Mobile feature flags (strangler migration).
 *
 * Mirrors frontend/lib/feature-flags.ts. The Obsidian RN shell is OFF by
 * default; the production pixel screens stay live. Flip via the Expo public env
 * `EXPO_PUBLIC_OBSIDIAN_SHELL=1` (or `true`) to route the real tabs to the
 * Obsidian screens. The `/obsidian-*` QA-preview routes are always reachable
 * regardless of this flag.
 */
export function isObsidianShellEnabled(): boolean {
  const v = process.env.EXPO_PUBLIC_OBSIDIAN_SHELL;
  return v === '1' || v === 'true';
}
