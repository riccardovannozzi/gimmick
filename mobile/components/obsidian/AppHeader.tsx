/**
 * Gimmick · Obsidian — AppHeader (capture / home header).
 *
 * 54px header used on the capture home: menu (opens the Drawer) · logo +
 * Gimmick · buffer pill (spark + count) · avatar. Reference: the Capture DC's
 * `appHeader`. Distinct from ObsidianTopNav (the view switcher).
 */
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { IconMenu2, IconSparkles } from '@tabler/icons-react-native';
import { useObsidian } from '@/lib/obsidian';

interface ObsidianAppHeaderProps {
  appName?: string;
  bufferCount?: number;
  userInitials?: string;
  onMenu?: () => void;
  onBuffer?: () => void;
  onAvatar?: () => void;
}

export function ObsidianAppHeader({
  appName = 'Gimmick', bufferCount = 0, userInitials = 'RI', onMenu, onBuffer, onAvatar,
}: ObsidianAppHeaderProps) {
  const c = useObsidian();
  return (
    <View style={{ height: 54, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, backgroundColor: c.canvas }}>
      <Pressable onPress={onMenu} accessibilityLabel="Apri menu" hitSlop={6} style={({ pressed }) => ({ width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
        <IconMenu2 size={19} color={c.muted} strokeWidth={1.8} />
      </Pressable>

      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 24, height: 24, borderRadius: 7, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 8, height: 8, borderRadius: 2.5, backgroundColor: c.accentInk }} />
        </View>
        <Text style={{ fontSize: 17, fontWeight: '600', color: c.text }}>{appName}</Text>
      </View>

      {bufferCount > 0 && (
        <Pressable onPress={onBuffer} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.line, borderRadius: 20, paddingVertical: 4, paddingLeft: 8, paddingRight: 11, opacity: pressed ? 0.7 : 1 })}>
          <IconSparkles size={16} color={c.accent} strokeWidth={1.8} />
          <Text style={{ fontSize: 13, fontWeight: '600', color: c.text }}>{bufferCount}</Text>
        </Pressable>
      )}

      <Pressable onPress={onAvatar} accessibilityLabel="Profilo" style={({ pressed }) => ({ width: 34, height: 34, borderRadius: 17, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', marginLeft: 2, opacity: pressed ? 0.85 : 1 })}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: c.accentInk }}>{userInitials}</Text>
      </Pressable>
    </View>
  );
}
