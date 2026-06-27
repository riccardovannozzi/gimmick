/**
 * Feature flags (build-time, via env pubbliche Next.js).
 *
 * `NEXT_PUBLIC_OBSIDIAN_SHELL` abilita lo shell Obsidian al posto della shell
 * arcade nel layout dashboard. Default OFF: senza la variabile la produzione è
 * identica a prima. Usato durante la migrazione strangler (vedi
 * design_handoff_obsidian/MIGRATION_PLAN.md).
 */
export function isObsidianShellEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_OBSIDIAN_SHELL;
  return v === '1' || v === 'true';
}
