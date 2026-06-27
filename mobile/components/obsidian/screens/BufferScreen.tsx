/**
 * Gimmick · Obsidian — Mobile Buffer (triage).
 *
 * Swipe-style triage of unsorted sparks: a card stack with the front card
 * (voice spark + AI suggestion) and a Scarta / Modifica / Conferma action row;
 * an empty state when the buffer is cleared. Reference: GimmickMobileBuffer.dc.html.
 */
import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import {
  IconArrowLeft, IconDots, IconPlayerPlay, IconSparkles, IconCheckbox, IconClock,
  IconTag, IconMicrophone, IconX, IconNote, IconCheck,
} from '@tabler/icons-react-native';
import { useObsidian } from '@/lib/obsidian';
import type { ObsidianColors } from '@/constants/obsidian';
import { ObsidianStatusBar } from '../StatusBar';
import { ObsidianNavPill } from '../NavPill';

const TOTAL = 6;
const PLAYER_BARS = [10, 18, 26, 14, 30, 38, 22, 12, 28, 36, 20, 11, 17, 30, 24, 14, 22, 32, 18, 10, 16];

function TopBar({ c, title, count, onBack }: { c: ObsidianColors; title: string; count?: number; onBack?: () => void }) {
  return (
    <View style={{ height: 52, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: c.line }}>
      <Pressable onPress={onBack} hitSlop={6} style={({ pressed }) => ({ width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
        <IconArrowLeft size={18} color={c.muted} strokeWidth={1.8} />
      </Pressable>
      <Text style={{ fontSize: 16, fontWeight: '600', color: c.text }}>{title}</Text>
      {count != null && count > 0 ? (
        <Text style={{ fontSize: 12, fontWeight: '600', color: c.accent, backgroundColor: c.accentSoft, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>{count}</Text>
      ) : null}
      <View style={{ flex: 1 }} />
      <View style={{ width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}>
        <IconDots size={16} color={c.muted} strokeWidth={1.8} />
      </View>
    </View>
  );
}

function SuggChip({ c, Icon, label, color }: { c: ObsidianColors; Icon: typeof IconTag; label: string; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6 }}>
      <Icon size={12} color={color ?? c.muted} strokeWidth={1.8} />
      <Text style={{ fontSize: 12, fontWeight: '600', color: color ?? c.text }}>{label}</Text>
    </View>
  );
}

function FrontCard({ c }: { c: ObsidianColors }) {
  const voice = c.cap.voice;
  return (
    <View style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line2, borderRadius: 20, padding: 18, gap: 15 }}>
      {/* header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: voice + (c.dark ? '24' : '16'), borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
          <IconMicrophone size={12} color={voice} strokeWidth={1.8} />
          <Text style={{ fontSize: 12, fontWeight: '600', color: voice }}>Memo vocale</Text>
        </View>
        <Text style={{ fontSize: 11, color: c.subtle }}>oggi · 09:12</Text>
      </View>

      {/* voice player */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: c.field, borderWidth: 1, borderColor: c.line, borderRadius: 14, padding: 14 }}>
        <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: voice, alignItems: 'center', justifyContent: 'center' }}>
          <IconPlayerPlay size={20} color="#fff" fill="#fff" />
        </View>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2.5, height: 26 }}>
          {PLAYER_BARS.map((v, i) => <View key={i} style={{ width: 2.6, height: v, borderRadius: 2, backgroundColor: i < 8 ? voice : c.line2 }} />)}
        </View>
        <Text style={{ fontSize: 11, color: c.subtle, fontVariant: ['tabular-nums'] }}>02:14</Text>
      </View>

      {/* AI suggestion */}
      <View style={{ backgroundColor: c.accentSoft, borderRadius: 14, padding: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 9 }}>
          <IconSparkles size={13} color={c.accent} strokeWidth={1.8} />
          <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: c.accent }}>BITO PROPONE</Text>
        </View>
        <Text style={{ fontSize: 15, fontWeight: '600', color: c.text, lineHeight: 20, marginBottom: 12 }}>OM/Sopralluogo Galaxia — installazione D-matrix</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
          <SuggChip c={c} Icon={IconCheckbox} label="To-do" />
          <SuggChip c={c} Icon={IconClock} label="Mar 24 · 10:00" />
          <SuggChip c={c} Icon={IconTag} label="Golfo del Sole" color={c.cap.photo} />
        </View>
      </View>
    </View>
  );
}

function StackBehind({ c, dx, lift, opacity }: { c: ObsidianColors; dx: number; lift: number; opacity: number }) {
  return (
    <View style={{ position: 'absolute', left: dx, right: dx, top: -lift, height: 60, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 20, opacity, transform: [{ scaleX: 1 - dx * 0.004 }] }} />
  );
}

function EmptyState({ c, onCapture }: { c: ObsidianColors; onCapture?: () => void }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
      <View style={{ width: 88, height: 88, borderRadius: 24, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line2, alignItems: 'center', justifyContent: 'center', marginBottom: 22 }}>
        <IconCheck size={38} color={c.accent} strokeWidth={1.8} />
      </View>
      <Text style={{ fontSize: 20, fontWeight: '700', color: c.text, marginBottom: 8 }}>Buffer vuoto</Text>
      <Text style={{ fontSize: 14, lineHeight: 21, color: c.muted, textAlign: 'center', maxWidth: 240 }}>Hai smistato tutto. I nuovi spark che catturi appariranno qui.</Text>
      <Pressable onPress={onCapture} style={({ pressed }) => ({ marginTop: 26, flexDirection: 'row', alignItems: 'center', gap: 8, height: 46, paddingHorizontal: 22, borderRadius: 13, backgroundColor: c.accent, opacity: pressed ? 0.9 : 1 })}>
        <IconMicrophone size={16} color={c.accentInk} strokeWidth={1.8} />
        <Text style={{ fontSize: 14, fontWeight: '600', color: c.accentInk }}>Cattura qualcosa</Text>
      </Pressable>
    </View>
  );
}

export function ObsidianBufferScreen() {
  const c = useObsidian();
  const [index, setIndex] = React.useState(0);
  const remaining = TOTAL - index;
  const advance = () => setIndex((i) => Math.min(i + 1, TOTAL));
  const reset = () => setIndex(0);

  const ActionBtn = ({ Icon, label, color, fill, onPress }: { Icon: typeof IconX; label: string; color: string; fill?: boolean; onPress?: () => void }) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1, height: 60, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 5,
        backgroundColor: fill ? color : (c.dark ? 'transparent' : c.surface),
        borderWidth: 1, borderColor: fill ? color : c.line2, opacity: pressed ? 0.8 : 1,
      })}
    >
      <Icon size={19} color={fill ? c.accentInk : color} strokeWidth={1.8} />
      <Text style={{ fontSize: 11, fontWeight: '600', color: fill ? c.accentInk : color }}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
      <ObsidianStatusBar />
      <TopBar c={c} title="Buffer" count={remaining} onBack={remaining === 0 ? reset : undefined} />

      {remaining > 0 ? (
        <>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 18, paddingBottom: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: c.subtle }}>{index + 1} di {TOTAL} da smistare</Text>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {Array.from({ length: TOTAL }).map((_, i) => (
                  <View key={i} style={{ width: i === index ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i === index ? c.accent : c.line2 }} />
                ))}
              </View>
            </View>
            <View style={{ position: 'relative', marginTop: 6 }}>
              <StackBehind c={c} dx={14} lift={12} opacity={c.dark ? 0.6 : 0.85} />
              <StackBehind c={c} dx={7} lift={6} opacity={c.dark ? 0.6 : 0.85} />
              <View style={{ position: 'relative', zIndex: 3 }}>
                <FrontCard c={c} />
              </View>
            </View>
          </ScrollView>

          <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14, borderTopWidth: 1, borderTopColor: c.line }}>
            <ActionBtn Icon={IconX} label="Scarta" color={c.cap.voice} onPress={advance} />
            <ActionBtn Icon={IconNote} label="Modifica" color={c.muted} />
            <ActionBtn Icon={IconCheck} label="Conferma" color={c.accent} fill onPress={advance} />
          </View>
        </>
      ) : (
        <>
          <EmptyState c={c} onCapture={reset} />
          <ObsidianNavPill />
        </>
      )}
    </View>
  );
}
