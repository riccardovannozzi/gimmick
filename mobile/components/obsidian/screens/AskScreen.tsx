/**
 * Gimmick · Obsidian — Mobile Ask Gimmick (chat).
 *
 * Bito-led assistant chat: user/bot bubbles, an inline tile-result + confirm
 * row, suggestion chips and a composer. Reference: GimmickMobileAsk.dc.html.
 */
import React from 'react';
import { View, Text, Pressable, ScrollView, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import {
  IconArrowLeft, IconPlus, IconSparkles, IconPaperclip, IconMicrophone, IconSend,
  IconTag, IconCheck, IconAlignLeft,
} from '@tabler/icons-react-native';
import { useObsidian } from '@/lib/obsidian';
import type { ObsidianColors } from '@/constants/obsidian';
import { ObsidianStatusBar } from '../StatusBar';
import { ObsidianNavPill } from '../NavPill';
import { BitoMascot } from '../Mascot';

function UserMsg({ c, children }: { c: ObsidianColors; children: React.ReactNode }) {
  return (
    <View style={{ alignSelf: 'flex-end', maxWidth: '82%', backgroundColor: c.accent, borderRadius: 14, borderBottomRightRadius: 4, paddingHorizontal: 13, paddingVertical: 10 }}>
      <Text style={{ fontSize: 13.5, lineHeight: 20, color: c.accentInk }}>{children}</Text>
    </View>
  );
}
function Bubble({ c, children }: { c: ObsidianColors; children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 14, borderBottomLeftRadius: 4, paddingHorizontal: 13, paddingVertical: 10 }}>
      <Text style={{ fontSize: 13.5, lineHeight: 20, color: c.text }}>{children}</Text>
    </View>
  );
}
function BotWrap({ c, children }: { c: ObsidianColors; children: React.ReactNode }) {
  return (
    <View style={{ alignSelf: 'flex-start', maxWidth: '90%', flexDirection: 'row', gap: 8 }}>
      <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' }}>
        <BitoMascot size={21} />
      </View>
      <View style={{ flex: 1, gap: 8 }}>{children}</View>
    </View>
  );
}

function TileResult({ c }: { c: ObsidianColors }) {
  return (
    <View style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderLeftWidth: 2.5, borderLeftColor: c.timed, borderRadius: 12, padding: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 5, flexWrap: 'wrap' }}>
        <Text style={{ fontSize: 10, fontWeight: '600', color: c.accent, backgroundColor: c.accentSoft, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 }}>Oggi · 16:00</Text>
        <Text style={{ fontSize: 13.5, fontWeight: '600', color: c.text }}>Call Marco</Text>
      </View>
      <Text style={{ fontSize: 12, color: c.muted, lineHeight: 17, marginBottom: 9 }}>Brief Teleport · creato dalla nota vocale.</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flexDirection: 'row', gap: 5 }}>
          <View style={{ width: 17, height: 17, borderRadius: 5, backgroundColor: c.cap.voice + (c.dark ? '2e' : '1c'), alignItems: 'center', justifyContent: 'center' }}><IconMicrophone size={10} color={c.cap.voice} strokeWidth={1.8} /></View>
          <View style={{ width: 17, height: 17, borderRadius: 5, backgroundColor: c.cap.text + (c.dark ? '2e' : '1c'), alignItems: 'center', justifyContent: 'center' }}><IconAlignLeft size={10} color={c.cap.text} strokeWidth={1.8} /></View>
        </View>
        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <IconTag size={11} color={c.accent} strokeWidth={1.8} />
          <Text style={{ fontSize: 11, fontWeight: '600', color: c.muted }}>GDS</Text>
        </View>
      </View>
    </View>
  );
}
function ConfirmRow({ c }: { c: ObsidianColors }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Pressable style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 34, borderRadius: 9, backgroundColor: c.accent }}>
        <IconCheck size={13} color={c.accentInk} strokeWidth={2.2} />
        <Text style={{ fontSize: 12.5, fontWeight: '600', color: c.accentInk }}>Conferma</Text>
      </Pressable>
      <Pressable style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: 34, borderRadius: 9, borderWidth: 1, borderColor: c.line2 }}>
        <Text style={{ fontSize: 12.5, fontWeight: '600', color: c.muted }}>Modifica</Text>
      </Pressable>
    </View>
  );
}

const SUGGESTIONS = ['Riepilogo di oggi', 'Cosa scade?', 'Spark da smistare'];

export function ObsidianAskScreen({ onBack }: { onBack?: () => void }) {
  const c = useObsidian();
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.canvas }}>
      <ObsidianStatusBar />

      {/* Top nav */}
      <View style={{ height: 54, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: c.line }}>
        <Pressable onPress={onBack} hitSlop={6} style={({ pressed }) => ({ width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
          <IconArrowLeft size={18} color={c.muted} strokeWidth={1.8} />
        </Pressable>
        <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' }}>
          <BitoMascot size={27} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: c.text }}>Ask Gimmick</Text>
          <Text style={{ fontSize: 11, color: c.subtle }}>Bito · sa tutto dei tuoi tile</Text>
        </View>
        <View style={{ width: 36, height: 36, borderRadius: 10, borderWidth: 1, borderColor: c.line2, alignItems: 'center', justifyContent: 'center' }}>
          <IconPlus size={16} color={c.muted} strokeWidth={1.8} />
        </View>
      </View>

      {/* Thread */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 13 }}>
        <BotWrap c={c}><Bubble c={c}>Ciao Ruslan. 5 tile per oggi e 4 spark nel buffer. Da dove partiamo?</Bubble></BotWrap>
        <UserMsg c={c}>Trasforma la nota vocale di stamattina in un evento per la call con Marco alle 16.</UserMsg>
        <BotWrap c={c}>
          <Bubble c={c}>Fatto. Ho creato questo evento — lo confermi?</Bubble>
          <TileResult c={c} />
          <ConfirmRow c={c} />
        </BotWrap>
        <UserMsg c={c}>Perfetto. Cosa scade questa settimana?</UserMsg>
        <BotWrap c={c}><Bubble c={c}>Una scadenza: certificato Aruba, lun 30/06. Ti ricordo domenica sera?</Bubble></BotWrap>
      </ScrollView>

      {/* Suggestions */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 7, paddingHorizontal: 14, paddingBottom: 10 }}>
        {SUGGESTIONS.map((s) => (
          <Pressable key={s} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9, backgroundColor: c.accentSoft, borderWidth: 1, borderColor: c.line }}>
            <IconSparkles size={11} color={c.accent} strokeWidth={1.8} />
            <Text style={{ fontSize: 12, fontWeight: '600', color: c.accent }}>{s}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Composer */}
      <View style={{ paddingHorizontal: 14, paddingBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.field, borderWidth: 1, borderColor: c.line2, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8 }}>
          <View style={{ width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}><IconPaperclip size={16} color={c.subtle} strokeWidth={1.8} /></View>
          <TextInput placeholder="Chiedi a Gimmick…" placeholderTextColor={c.subtle} style={{ flex: 1, fontSize: 13.5, color: c.text }} />
          <View style={{ width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}><IconMicrophone size={16} color={c.subtle} strokeWidth={1.8} /></View>
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}><IconSend size={16} color={c.accentInk} strokeWidth={1.8} /></View>
        </View>
      </View>

      <ObsidianNavPill />
    </KeyboardAvoidingView>
  );
}
