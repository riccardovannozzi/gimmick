/**
 * Gimmick · Obsidian — AppHeader (views header).
 *
 * Stessa impaginazione dell'header della home (CaptureScreen):
 *   · Sinistra — titolo della vista corrente, statico.
 *   · Destra   — due pulsanti quadrati: menu (Drawer) e "Ask Gimmick" (chat).
 * Il cambio vista NON sta sul titolo: si fa dal Drawer, come in home — una sola
 * strada per passare da una finestra all'altra.
 * Navigation-agnostic: tutto passa dai callback.
 */
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { IconMenu2, IconSparkles } from '@tabler/icons-react-native';
import { useObsidian } from '@/lib/obsidian';

interface ObsidianAppHeaderProps {
  /** Etichetta a sinistra: la vista corrente. */
  title?: string;
  /** Menu a destra → Drawer (viste, cattura, impostazioni). */
  onMenu?: () => void;
  /** "Ask Gimmick" a destra → chat. */
  onAsk?: () => void;
}

// Spazio tra la status bar (spacer safe-area) e la navbar. Uguale alla home.
const HEADER_GAP = 20;

export function ObsidianAppHeader({ title = 'Gimmick', onMenu, onAsk }: ObsidianAppHeaderProps) {
  const c = useObsidian();

  // Stessi pulsanti della home: quadrato 42 con angoli arrotondati, niente bordo.
  const sqBtn = {
    width: 42, height: 42, borderRadius: 12, alignItems: 'center' as const, justifyContent: 'center' as const,
  };

  return (
    <View style={{ marginTop: HEADER_GAP, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: c.dark ? '#000000' : c.canvas, zIndex: 10 }}>
      {/* Sinistra — titolo della vista */}
      <Text style={{ fontSize: 22, fontWeight: '700', color: c.text }}>{title}</Text>

      {/* Destra — menu (Drawer) + Ask (chat) */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable
          onPress={onMenu}
          accessibilityLabel="Menu"
          hitSlop={6}
          android_ripple={{ color: c.line, borderless: true }}
          style={[sqBtn, { backgroundColor: c.surface2 }]}
        >
          <IconMenu2 size={19} color={c.text} strokeWidth={1.9} />
        </Pressable>
        <Pressable
          onPress={onAsk}
          accessibilityLabel="Ask Gimmick"
          hitSlop={6}
          android_ripple={{ color: c.accent + '40', borderless: true }}
          style={[sqBtn, { backgroundColor: c.accent + '2E' }]}
        >
          <IconSparkles size={19} color={c.accent} strokeWidth={1.9} />
        </Pressable>
      </View>
    </View>
  );
}
