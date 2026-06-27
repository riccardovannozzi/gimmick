/**
 * Gimmick · Obsidian — StatusBar.
 *
 * Real RN status-bar treatment for the Obsidian shell: sets the OS status-bar
 * content style for the active theme (dark glyphs on light, light glyphs on
 * dark) and fills the top safe-area inset with a themed background so content
 * scrolls under a clean strip. Reference: the mobile DCs' `statusBar`.
 *
 * (The DC draws a fake clock/battery because it's an HTML prototype; a real app
 * lets the OS render those and only controls the bar style + inset fill.)
 */
import React from 'react';
import { View } from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useObsidian } from '@/lib/obsidian';

interface ObsidianStatusBarProps {
  /** Background of the inset strip. Defaults to the canvas color. */
  background?: string;
}

export function ObsidianStatusBar({ background }: ObsidianStatusBarProps) {
  const c = useObsidian();
  const insets = useSafeAreaInsets();
  return (
    <>
      <ExpoStatusBar style={c.dark ? 'light' : 'dark'} />
      <View style={{ height: insets.top, backgroundColor: background ?? c.canvas }} />
    </>
  );
}
