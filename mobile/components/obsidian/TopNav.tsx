/**
 * Gimmick · Obsidian — TopNav (mobile view switcher).
 *
 * 54px strip: back · home · [Tiles · Flows · Chrono] · Settings. The active view
 * renders as an accent pill (icon + label); the others as muted icon buttons.
 * Reference: the mobile DCs' `topNav(T, active)`. Navigation-agnostic — drives
 * everything through callbacks.
 */
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import {
  IconArrowLeft, IconHome, IconLayoutGrid, IconRoute, IconCalendarTime, IconSettings,
} from '@tabler/icons-react-native';
import { useObsidian } from '@/lib/obsidian';

export type MobileViewId = 'tiles' | 'flows' | 'chrono' | 'settings';

const CENTER: Array<{ id: MobileViewId; label: string; Icon: typeof IconHome }> = [
  { id: 'tiles', label: 'Tiles', Icon: IconLayoutGrid },
  { id: 'flows', label: 'Flows', Icon: IconRoute },
  { id: 'chrono', label: 'Chrono', Icon: IconCalendarTime },
];

interface ObsidianTopNavProps {
  active: MobileViewId;
  onNavigate?: (id: MobileViewId) => void;
  onBack?: () => void;
  onHome?: () => void;
}

export function ObsidianTopNav({ active, onNavigate, onBack, onHome }: ObsidianTopNavProps) {
  const c = useObsidian();

  const IconBtn = ({
    Icon, onPress, accessibilityLabel, on,
  }: { Icon: typeof IconHome; onPress?: () => void; accessibilityLabel: string; on?: boolean }) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 38, height: 38, borderRadius: 10,
        alignItems: 'center', justifyContent: 'center',
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Icon size={19} color={on ? c.accent : c.muted} strokeWidth={1.8} />
    </Pressable>
  );

  const Pill = ({ id, label, Icon }: { id: MobileViewId; label: string; Icon: typeof IconHome }) => (
    <Pressable
      onPress={() => onNavigate?.(id)}
      accessibilityRole="button"
      accessibilityState={{ selected: true }}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 7,
        height: 36, paddingHorizontal: 14, borderRadius: 11,
        backgroundColor: c.accent, opacity: pressed ? 0.9 : 1,
      })}
    >
      <Icon size={16} color={c.accentInk} strokeWidth={2} />
      <Text style={{ fontSize: 13, fontWeight: '600', color: c.accentInk }}>{label}</Text>
    </Pressable>
  );

  const Tab = ({ id, label, Icon }: { id: MobileViewId; label: string; Icon: typeof IconHome }) =>
    active === id
      ? <Pill id={id} label={label} Icon={Icon} />
      : <IconBtn Icon={Icon} onPress={() => onNavigate?.(id)} accessibilityLabel={label} />;

  return (
    <View
      style={{
        height: 54, flexDirection: 'row', alignItems: 'center', gap: 3,
        paddingHorizontal: 8,
        borderBottomWidth: 1, borderBottomColor: c.line,
        backgroundColor: c.canvas,
      }}
    >
      <IconBtn Icon={IconArrowLeft} onPress={onBack} accessibilityLabel="Indietro" />
      <IconBtn Icon={IconHome} onPress={onHome} accessibilityLabel="Home" />
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
        {CENTER.map((t) => <Tab key={t.id} id={t.id} label={t.label} Icon={t.Icon} />)}
      </View>
      <Tab id="settings" label="Settings" Icon={IconSettings} />
    </View>
  );
}
