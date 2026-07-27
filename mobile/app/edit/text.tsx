import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { IconX, IconFileText } from '@tabler/icons-react-native';
import { SafeAreaWrapper } from '@/components/layout/SafeAreaWrapper';
import { useObsidian } from '@/lib/obsidian';

export default function TextEditorScreen() {
  const c = useObsidian();
  const router = useRouter();

  return (
    <SafeAreaWrapper>
      <View style={{ flex: 1, backgroundColor: c.canvas }}>
        {/* Header — X tonda + titolo, hairline inferiore */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: c.line,
          }}
        >
          <Pressable
            onPress={() => router.back()}
            accessibilityLabel="Chiudi"
            hitSlop={6}
            android_ripple={{ color: c.line, borderless: true }}
            style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accentSoft }}
          >
            <IconX size={19} color={c.accent} strokeWidth={1.9} />
          </Pressable>

          <Text style={{ fontSize: 16, fontWeight: '700', color: c.text }}>Editor testo AI</Text>

          <View style={{ width: 40 }} />
        </View>

        {/* Placeholder content */}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 14 }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: c.cap.text + '2E',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconFileText size={36} color={c.cap.text} strokeWidth={1.8} />
          </View>
          <Text style={{ fontSize: 17, fontWeight: '700', color: c.text, textAlign: 'center' }}>
            Editor AI in arrivo
          </Text>
          <Text style={{ fontSize: 14, lineHeight: 20, color: c.muted, textAlign: 'center' }}>
            L'editor testo con AI sarà disponibile nella prossima versione
          </Text>
        </View>
      </View>
    </SafeAreaWrapper>
  );
}
