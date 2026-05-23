import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { IconX, IconPhoto } from '@tabler/icons-react-native';
import { SafeAreaWrapper } from '@/components/layout/SafeAreaWrapper';
import { usePixelTheme } from '@/components/pixel';

export default function ImageEditorScreen() {
  const theme = usePixelTheme();
  const router = useRouter();
  const sh = theme.shadowOffset;

  return (
    <SafeAreaWrapper>
      <View style={{ flex: 1, backgroundColor: theme.bg1 }}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 2,
            borderBottomColor: theme.border,
          }}
        >
          <View style={{ position: 'relative', paddingRight: sh, paddingBottom: sh }}>
            {sh > 0 && (
              <View
                style={{
                  position: 'absolute',
                  left: sh, top: sh, right: 0, bottom: 0,
                  backgroundColor: theme.shadowColor,
                }}
              />
            )}
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderWidth: 2,
                  borderColor: theme.border,
                  backgroundColor: theme.semantic.danger,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <IconX size={22} color="#FFFFFF" strokeWidth={2.4} />
              </View>
            </Pressable>
          </View>

          <Text
            style={{
              fontFamily: theme.fontHead,
              fontSize: 11,
              color: theme.ink,
              letterSpacing: 1.2,
            }}
          >
            IMAGE EDITOR
          </Text>

          <View style={{ width: 44 + sh }} />
        </View>

        {/* Placeholder content */}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 16 }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderWidth: 2,
              borderColor: theme.border,
              backgroundColor: theme.cap.photo,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconPhoto size={40} color="#FFFFFF" strokeWidth={1.8} />
          </View>
          <Text
            style={{
              fontFamily: theme.fontHead,
              fontSize: 12,
              color: theme.ink,
              textAlign: 'center',
              letterSpacing: 1.2,
            }}
          >
            EDITOR IN ARRIVO
          </Text>
          <Text
            style={{
              fontFamily: theme.fontBody,
              fontSize: 13,
              color: theme.ink2,
              textAlign: 'center',
              lineHeight: 18,
            }}
          >
            L'editor immagini sarà disponibile nella prossima versione
          </Text>
        </View>
      </View>
    </SafeAreaWrapper>
  );
}