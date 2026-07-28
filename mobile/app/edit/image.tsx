import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { IconX, IconPhoto } from '@tabler/icons-react-native';
import { SafeAreaWrapper } from '@/components/layout/SafeAreaWrapper';
import { useObsidian } from '@/lib/obsidian';
import { OB_CAP_BTN_BG, OB_CAP_BTN_GLYPH, OB_CAP_BTN_R } from '@/constants/obsidian';

export default function ImageEditorScreen() {
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
            style={{ width: 44, height: 44, borderRadius: OB_CAP_BTN_R, alignItems: 'center', justifyContent: 'center', backgroundColor: OB_CAP_BTN_BG }}
          >
            <IconX size={20} color={OB_CAP_BTN_GLYPH} strokeWidth={1.9} />
          </Pressable>

          <Text style={{ fontSize: 16, fontWeight: '700', color: c.text }}>Editor immagini</Text>

          <View style={{ width: 40 }} />
        </View>

        {/* Placeholder content */}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 14 }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: c.cap.photo + '2E',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconPhoto size={36} color={c.cap.photo} strokeWidth={1.8} />
          </View>
          <Text style={{ fontSize: 17, fontWeight: '700', color: c.text, textAlign: 'center' }}>
            Editor in arrivo
          </Text>
          <Text style={{ fontSize: 14, lineHeight: 20, color: c.muted, textAlign: 'center' }}>
            L'editor immagini sarà disponibile nella prossima versione
          </Text>
        </View>
      </View>
    </SafeAreaWrapper>
  );
}
