/**
 * Gimmick · Obsidian — Drawer (tag / cartelle).
 *
 * Slide-in left drawer: logo + tag count, search, collapsible tag groups with
 * children, and a Settings footer. Reference: the Capture DC's `drawer`. Uses
 * an RN Modal for the overlay (handles Android back) + Animated slide-in.
 * Single tag per tile → children select exclusively.
 */
import React from 'react';
import { Animated, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import {
  IconChevronRight, IconChevronDown, IconSearch, IconSettings,
  IconHome, IconSun, IconRipple, IconCurrencyEuro,
  IconLayoutGrid, IconRoute, IconCalendarTime,
} from '@tabler/icons-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useObsidian } from '@/lib/obsidian';
import type { MobileViewId } from './TopNav';

const PANEL = 290;

export interface DrawerChild { id: string; name: string }
export interface DrawerGroup {
  id: string;
  name: string;
  Icon: typeof IconHome;
  color: string;
  defaultOpen?: boolean;
  children?: DrawerChild[];
}

export const DEFAULT_DRAWER_GROUPS: DrawerGroup[] = [
  { id: 'home', name: 'Home', Icon: IconHome, color: '#6FCF97' },
  {
    id: 'gds', name: 'Golfo del Sole', Icon: IconSun, color: '#E0B341', defaultOpen: true,
    children: [{ id: 'gds-report', name: 'GDS_Report' }, { id: 'gds-fv', name: 'GDS_Fotovoltaico' }, { id: 'gds-varie', name: 'GDS_Varie' }],
  },
  { id: 'om', name: 'Ortano Mare', Icon: IconRipple, color: '#5B8DEF' },
  { id: 'money', name: 'Money', Icon: IconCurrencyEuro, color: '#6FCF97' },
];

/** App views reachable from the drawer. The Capture screen has no TopNav — its
 *  AppHeader menu is the only navigation affordance it owns — so without these
 *  entries Capture would be a dead end. */
const VIEW_LINKS: Array<{ id: MobileViewId; name: string; Icon: typeof IconHome }> = [
  { id: 'tiles', name: 'Tiles', Icon: IconLayoutGrid },
  { id: 'flows', name: 'Flows', Icon: IconRoute },
  { id: 'chrono', name: 'Chrono', Icon: IconCalendarTime },
];

interface ObsidianDrawerProps {
  open: boolean;
  onClose: () => void;
  groups?: DrawerGroup[];
  count?: number;
  activeChildId?: string;
  onSelectChild?: (id: string) => void;
  onSettings?: () => void;
  /** Navigate to one of the main views. Omit to hide the VISTE section (QA preview). */
  onNavigateView?: (id: MobileViewId) => void;
}

export function ObsidianDrawer({
  open, onClose, groups = DEFAULT_DRAWER_GROUPS, count = 26, activeChildId = 'gds-report', onSelectChild, onSettings,
  onNavigateView,
}: ObsidianDrawerProps) {
  const c = useObsidian();
  const insets = useSafeAreaInsets();
  const tx = React.useRef(new Animated.Value(-PANEL)).current;
  const fade = React.useRef(new Animated.Value(0)).current;
  const [openState, setOpenState] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.map((g) => [g.id, g.defaultOpen ?? false])),
  );

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

  const toggle = (id: string) => setOpenState((o) => ({ ...o, [id]: !o[id] }));

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
          <Text style={{ fontSize: 11, fontWeight: '600', color: c.muted, backgroundColor: c.surface2, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 7, fontVariant: ['tabular-nums'] }}>
            {count}
          </Text>
        </View>

        {/* Search */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginHorizontal: 14, marginBottom: 8, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.line, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9 }}>
          <IconSearch size={14} color={c.subtle} strokeWidth={1.8} />
          <Text style={{ fontSize: 13, color: c.subtle }}>Cerca tag…</Text>
        </View>

        {/* Groups */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 10, paddingVertical: 6 }}>
          {onNavigateView && (
            <View style={{ marginBottom: 10 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1.2, color: c.subtle, paddingHorizontal: 8, marginBottom: 4 }}>VISTE</Text>
              {VIEW_LINKS.map((v) => (
                <Pressable
                  key={v.id}
                  onPress={() => { onNavigateView(v.id); onClose(); }}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 8, paddingVertical: 9, borderRadius: 8, backgroundColor: pressed ? c.surface2 : 'transparent' })}
                >
                  <v.Icon size={17} color={c.muted} strokeWidth={1.8} />
                  <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: c.text }}>{v.name}</Text>
                </Pressable>
              ))}
              <View style={{ height: 1, backgroundColor: c.line, marginHorizontal: 8, marginTop: 8 }} />
              <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1.2, color: c.subtle, paddingHorizontal: 8, marginTop: 10 }}>TAG</Text>
            </View>
          )}
          {groups.map((g) => {
            const isOpen = openState[g.id];
            const Chevron = isOpen ? IconChevronDown : IconChevronRight;
            return (
              <View key={g.id} style={{ marginBottom: 2 }}>
                <Pressable onPress={() => toggle(g.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 8, paddingVertical: 9 }}>
                  <Chevron size={13} color={c.subtle} strokeWidth={1.8} />
                  <g.Icon size={17} color={g.color} strokeWidth={1.8} />
                  <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: c.text }}>{g.name}</Text>
                </Pressable>
                {isOpen && g.children && g.children.length > 0 && (
                  <View style={{ marginLeft: 15, paddingLeft: 13, borderLeftWidth: 1, borderLeftColor: c.line }}>
                    {g.children.map((k) => {
                      const on = k.id === activeChildId;
                      return (
                        <Pressable
                          key={k.id}
                          onPress={() => onSelectChild?.(k.id)}
                          style={{ paddingHorizontal: 9, paddingVertical: 8, borderRadius: 8, backgroundColor: on ? c.accentSoft : 'transparent' }}
                        >
                          <Text style={{ fontSize: 14, fontWeight: on ? '600' : '500', color: on ? c.accent : c.muted }}>{k.name}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>

        {/* Footer */}
        <Pressable
          onPress={onSettings}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingVertical: 13, paddingBottom: 13 + insets.bottom, borderTopWidth: 1, borderTopColor: c.line }}
        >
          <IconSettings size={16} color={c.muted} strokeWidth={1.8} />
          <Text style={{ fontSize: 14, fontWeight: '500', color: c.muted }}>Impostazioni</Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}
