/**
 * Gimmick · Obsidian — Mobile Auth route. At /obsidian-auth.
 *
 * Flag-aware: with EXPO_PUBLIC_OBSIDIAN_SHELL on, the Login form is wired to the
 * auth store (signIn / signUp); otherwise the static QA walkthrough
 * (Login → Onboarding → First capture).
 */
import React from 'react';
import { useRouter } from 'expo-router';
import { ObsidianAuthScreen, ObsidianAuthScreenLive } from '@/components/obsidian';
import { isObsidianShellEnabled } from '@/lib/feature-flags';

export default function ObsidianAuthRoute() {
  const router = useRouter();

  if (isObsidianShellEnabled()) {
    return <ObsidianAuthScreenLive onAuthed={() => router.replace('/(tabs)' as never)} />;
  }
  return <ObsidianAuthScreen />;
}
