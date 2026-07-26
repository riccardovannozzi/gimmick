/**
 * Gimmick · Obsidian — NavPill (home indicator strip).
 *
 * The bottom home-indicator pill, respecting the bottom safe-area inset.
 * Reference: the mobile DCs' `navPill` (128×4 rounded bar).
 */
import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useObsidian } from '@/lib/obsidian';

export function ObsidianNavPill() {
  const c = useObsidian();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        // Inset di sistema PIENO + margine extra, così sopra i pulsanti/gesture
        // bar di Android resta sempre spazio (prima sottraeva 8 e li toccava).
        height: 40,
        paddingBottom: (insets.bottom || 0) + 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: c.canvas,
      }}
    >
      <View
        style={{
          width: 128,
          height: 4,
          borderRadius: 2,
          backgroundColor: c.dark ? 'rgba(255,255,255,0.4)' : 'rgba(24,20,38,0.32)',
        }}
      />
    </View>
  );
}
