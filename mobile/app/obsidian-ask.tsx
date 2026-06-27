/**
 * Gimmick · Obsidian — Mobile Ask route (QA preview). At /obsidian-ask.
 */
import React from 'react';
import { useRouter } from 'expo-router';
import { ObsidianAskScreen } from '@/components/obsidian';

export default function ObsidianAskRoute() {
  const router = useRouter();
  return <ObsidianAskScreen onBack={() => { if (router.canGoBack()) router.back(); }} />;
}
