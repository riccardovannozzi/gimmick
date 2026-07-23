/**
 * Gimmick · Obsidian — AppHeader (capture / home header).
 *
 * 54px header con la logica "chat": due pulsanti circolari agli estremi + un
 * dropdown centrale.
 *   · Sinistra — hamburger in un cerchio → apre il Drawer (settings e simili).
 *   · Centro   — titolo con chevron: dropdown per cambiare vista (Tiles / Flows
 *                / Chrono).
 *   · Destra   — "Ask Gimmick" in un cerchio → apre la chat.
 * Navigation-agnostic: tutto passa dai callback.
 */
import React from 'react';
import { View, Text, Pressable, Modal } from 'react-native';
import {
  IconMenu2, IconSparkles, IconChevronDown,
  IconLayoutGrid, IconRoute, IconCalendarTime,
} from '@tabler/icons-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useObsidian } from '@/lib/obsidian';
import type { MobileViewId } from './TopNav';

const NAV_ITEMS: Array<{ id: MobileViewId; label: string; Icon: typeof IconLayoutGrid }> = [
  { id: 'tiles', label: 'Tiles', Icon: IconLayoutGrid },
  { id: 'flows', label: 'Flows', Icon: IconRoute },
  { id: 'chrono', label: 'Chrono', Icon: IconCalendarTime },
];

interface ObsidianAppHeaderProps {
  /** Etichetta al centro (titolo del dropdown). */
  title?: string;
  /** Hamburger a sinistra → Drawer (settings e simili). */
  onMenu?: () => void;
  /** "Ask Gimmick" a destra → chat. */
  onAsk?: () => void;
  /** Voce scelta nel dropdown centrale. */
  onNavigateView?: (id: MobileViewId) => void;
}

// Spazio tra la status bar (spacer safe-area) e la navbar.
const HEADER_GAP = 20;

export function ObsidianAppHeader({ title = 'Gimmick', onMenu, onAsk, onNavigateView }: ObsidianAppHeaderProps) {
  const c = useObsidian();
  const insets = useSafeAreaInsets();
  const [navOpen, setNavOpen] = React.useState(false);

  return (
    // zIndex alto: il dropdown (Modal) è indipendente, ma teniamo l'header sopra
    // eventuali overlay dello stesso livello. marginTop = stacco dall'alto.
    <View style={{ height: 54, marginTop: HEADER_GAP, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, backgroundColor: c.canvas, zIndex: 10 }}>
      {/* Sinistra — hamburger in cerchio (apre Drawer/settings) */}
      <Pressable
        onPress={onMenu}
        accessibilityLabel="Menu"
        hitSlop={6}
        android_ripple={{ color: c.line, borderless: true }}
        style={{ width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface2, borderWidth: 1, borderColor: c.line }}
      >
        <IconMenu2 size={19} color={c.text} strokeWidth={1.9} />
      </Pressable>

      {/* Centro — titolo + chevron: apre il dropdown delle viste */}
      <Pressable
        onPress={() => setNavOpen(true)}
        accessibilityLabel="Cambia vista"
        hitSlop={6}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
      >
        <Text style={{ fontSize: 17, fontWeight: '700', color: c.text }}>{title}</Text>
        <IconChevronDown size={16} color={c.muted} strokeWidth={2} />
      </Pressable>

      {/* Destra — Ask Gimmick in cerchio */}
      <Pressable
        onPress={onAsk}
        accessibilityLabel="Ask Gimmick"
        hitSlop={6}
        android_ripple={{ color: c.line, borderless: true }}
        style={{ width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface2, borderWidth: 1, borderColor: c.line }}
      >
        <IconSparkles size={19} color={c.accent} strokeWidth={1.9} />
      </Pressable>

      {/* Dropdown centrale — Modal per stare sopra il contenuto senza problemi di
          z-order. Backdrop trasparente che chiude al tap fuori. */}
      <Modal visible={navOpen} transparent animationType="fade" onRequestClose={() => setNavOpen(false)} statusBarTranslucent>
        <Pressable style={{ flex: 1 }} onPress={() => setNavOpen(false)} accessibilityLabel="Chiudi">
          <View style={{ position: 'absolute', top: insets.top + HEADER_GAP + 54 + 4, left: 0, right: 0, alignItems: 'center' }}>
            <View
              style={{
                minWidth: 200, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 14, padding: 6,
                shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 12,
              }}
            >
              {NAV_ITEMS.map((it) => (
                <Pressable
                  key={it.id}
                  onPress={() => { setNavOpen(false); onNavigateView?.(it.id); }}
                  android_ripple={{ color: c.accent + '22' }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: 46, paddingHorizontal: 12, borderRadius: 9 }}
                >
                  <it.Icon size={18} color={c.muted} strokeWidth={1.8} />
                  <Text style={{ fontSize: 15, fontWeight: '600', color: c.text }}>{it.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
