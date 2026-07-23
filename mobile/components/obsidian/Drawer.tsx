/**
 * Gimmick · Obsidian — Drawer di navigazione.
 *
 * Pannello a scorrimento da sinistra con i collegamenti alle altre viste
 * dell'app, più Impostazioni a piè di pagina. La schermata Capture non ha
 * TopNav — il menu del suo AppHeader è l'unica navigazione che possiede — quindi
 * senza queste voci Capture sarebbe un vicolo cieco.
 *
 * Usa una Modal RN per l'overlay (gestisce il tasto Indietro di Android) con
 * scorrimento Animated.
 */
import React from 'react';
import { Animated, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import {
  IconSettings, IconLayoutGrid, IconRoute, IconCalendarTime, IconHome,
} from '@tabler/icons-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useObsidian } from '@/lib/obsidian';
import { OB_BTN_H } from '@/constants/obsidian';
import type { MobileViewId } from './TopNav';

const PANEL = 290;

const VIEW_LINKS: Array<{ id: MobileViewId; name: string; Icon: typeof IconLayoutGrid }> = [
  { id: 'tiles', name: 'Tiles', Icon: IconLayoutGrid },
  { id: 'flows', name: 'Flows', Icon: IconRoute },
  { id: 'chrono', name: 'Chrono', Icon: IconCalendarTime },
];

interface ObsidianDrawerProps {
  open: boolean;
  onClose: () => void;
  onSettings?: () => void;
  /** Naviga a una delle viste principali. Omesso → nessun collegamento (preview QA). */
  onNavigateView?: (id: MobileViewId) => void;
  /** Torna alla Home/Cattura. Omesso (es. sulla Capture stessa) → voce nascosta. */
  onHome?: () => void;
}

export function ObsidianDrawer({ open, onClose, onSettings, onNavigateView, onHome }: ObsidianDrawerProps) {
  const c = useObsidian();
  const insets = useSafeAreaInsets();
  const tx = React.useRef(new Animated.Value(-PANEL)).current;
  const fade = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (open) {
      Animated.parallel([
        Animated.timing(tx, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      tx.setValue(-PANEL);
      fade.setValue(0);
    }
  }, [open, tx, fade]);

  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.42)', opacity: fade }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Chiudi drawer" />
      </Animated.View>

      <Animated.View
        style={{
          position: 'absolute', top: 0, bottom: 0, left: 0, width: PANEL,
          backgroundColor: c.sidebar, borderRightWidth: 1, borderRightColor: c.line,
          paddingTop: insets.top, transform: [{ translateX: tx }],
        }}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 16, paddingTop: 18, paddingBottom: 14 }}>
          <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: c.accentInk }} />
          </View>
          <Text style={{ flex: 1, fontSize: 17, fontWeight: '600', color: c.text }}>Gimmick</Text>
        </View>

        {/* Viste */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 10, paddingVertical: 6 }}>
          {onHome && (
            <Pressable
              onPress={() => { onHome(); onClose(); }}
              android_ripple={{ color: c.accent + '33' }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, minHeight: OB_BTN_H, borderRadius: 8 }}
            >
              <IconHome size={22} color={c.muted} strokeWidth={1.8} />
              <Text style={{ flex: 1, fontSize: 17, fontWeight: '600', color: c.text }}>Cattura</Text>
            </Pressable>
          )}
          {onNavigateView && VIEW_LINKS.map((v) => (
            // Stile statico e non `({pressed}) => …`: passato come funzione non
            // veniva applicato, e senza flexDirection la riga tornava a colonna
            // con l'icona sopra l'etichetta.
            <Pressable
              key={v.id}
              onPress={() => { onNavigateView(v.id); onClose(); }}
              android_ripple={{ color: c.accent + '33' }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, minHeight: OB_BTN_H, borderRadius: 8 }}
            >
              <v.Icon size={22} color={c.muted} strokeWidth={1.8} />
              <Text style={{ flex: 1, fontSize: 17, fontWeight: '600', color: c.text }}>{v.name}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Footer */}
        <Pressable
          onPress={onSettings}
          android_ripple={{ color: c.accent + '33' }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, minHeight: OB_BTN_H, paddingBottom: insets.bottom, borderTopWidth: 1, borderTopColor: c.line }}
        >
          <IconSettings size={20} color={c.muted} strokeWidth={1.8} />
          <Text style={{ fontSize: 16, fontWeight: '500', color: c.muted }}>Impostazioni</Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}
