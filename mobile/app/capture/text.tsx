import React, { useState } from 'react';
import { View, Text, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { IconX, IconCheck } from '@tabler/icons-react-native';
import { SafeAreaWrapper } from '@/components/layout/SafeAreaWrapper';
import { useBufferStore, toast } from '@/store';
import { usePixelTheme, PixelTextInput } from '@/components/pixel';
import { sparksApi } from '@/lib/api';

export default function TextCaptureScreen() {
  const theme = usePixelTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  // When reached from the tile detail (Sparks → text), `?tile=<id>` is set and
  // the spark is created directly against that tile (skipping the buffer).
  const { tile: tileId } = useLocalSearchParams<{ tile?: string }>();
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const addItem = useBufferStore((state) => state.addItem);

  const handleClose = () => {
    router.back();
  };

  const handleSave = async () => {
    if (!text.trim()) {
      toast.warning('Please enter some text');
      return;
    }
    if (tileId) {
      try {
        setSaving(true);
        const res = await sparksApi.create({
          type: 'text',
          tile_id: tileId,
          content: text,
        });
        if (!res.success) {
          toast.error(res.error || 'Errore nel salvataggio');
          setSaving(false);
          return;
        }
        queryClient.invalidateQueries({ queryKey: ['tile', tileId] });
        toast.success('Spark salvato');
        router.back();
      } catch {
        toast.error('Errore nel salvataggio');
      } finally {
        setSaving(false);
      }
      return;
    }
    addItem({
      type: 'text',
      uri: '',
      preview: text,
    });

    toast.success('Note added to buffer');
    router.back();
  };

  const charCount = text.length;
  const canSave = text.trim().length > 0 && !saving;

  // Pixel header tile: border 2px ink + bg colorato + offset shadow ink.
  // Pattern Android-safe (View bg + Pressable wrapping View interno).
  const HeaderTile = ({
    onPress, bg, disabled, children,
  }: { onPress: () => void; bg: string; disabled?: boolean; children: React.ReactNode }) => {
    const sh = theme.shadowOffset;
    const SIZE = 48;
    return (
      <View style={{ position: 'relative', paddingRight: sh, paddingBottom: sh, opacity: disabled ? 0.4 : 1 }}>
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
          onPress={onPress}
          disabled={disabled}
          style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
        >
          <View
            style={{
              width: SIZE,
              height: SIZE,
              borderWidth: 2,
              borderColor: theme.border,
              backgroundColor: bg,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {children}
          </View>
        </Pressable>
      </View>
    );
  };

  return (
    <SafeAreaWrapper edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, backgroundColor: theme.bg1 }}
      >
        {/* Header — bordo inferiore 2px, X danger + title PressStart2P + ✓ success */}
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
          <HeaderTile onPress={handleClose} bg={theme.semantic.danger}>
            <IconX size={22} color="#FFFFFF" strokeWidth={2.4} />
          </HeaderTile>

          <Text
            style={{
              fontFamily: theme.fontHead,
              fontSize: 11,
              color: theme.ink,
              letterSpacing: 1.2,
            }}
          >
            NEW NOTE
          </Text>

          <HeaderTile
            onPress={handleSave}
            disabled={!canSave}
            bg={canSave ? theme.semantic.success : theme.surfaceVariant}
          >
            <IconCheck
              size={22}
              color={canSave ? '#FFFFFF' : theme.ink3}
              strokeWidth={2.4}
            />
          </HeaderTile>
        </View>

        {/* Text input — PixelTextInput multiline che riempie lo spazio */}
        <View style={{ flex: 1, padding: 16 }}>
          <PixelTextInput
            theme={theme}
            containerStyle={{ flex: 1 }}
            value={text}
            onChangeText={setText}
            placeholder="Write your note..."
            multiline
            autoFocus
            style={{
              fontSize: 16,
              lineHeight: 24,
            }}
          />
        </View>

        {/* Footer — bordo superiore 2px, char count PressStart2P */}
        <View
          style={{
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderTopWidth: 2,
            borderTopColor: theme.border,
            flexDirection: 'row',
            justifyContent: 'flex-end',
          }}
        >
          <Text
            style={{
              fontFamily: theme.fontHead,
              fontSize: 9,
              color: theme.ink2,
              letterSpacing: 1,
            }}
          >
            {charCount} CHARS
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaWrapper>
  );
}
