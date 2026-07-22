import React, { useState } from 'react';
import { View, Text, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { IconX, IconCheck, IconTag } from '@tabler/icons-react-native';
import { SafeAreaWrapper } from '@/components/layout/SafeAreaWrapper';
import { useBufferStore, toast } from '@/store';
import { usePendingTagStore } from '@/store/pendingTagStore';
import { usePixelTheme, PixelTextInput } from '@/components/pixel';
import { sparksApi, tagsApi } from '@/lib/api';
import type { Tag } from '@/types';

/** Chiave di confronto: minuscolo, senza accenti, soli alfanumerici. */
function normKey(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
}

/**
 * Hashtag attivo sotto il cursore: dall'ultimo '#' (a inizio parola) fino al
 * caret, purché non ci siano spazi in mezzo. Il query è un singolo token; i
 * nomi composti si scelgono dalla lista (es. "#gol" propone "Golfo del Sole").
 */
function activeHashtag(text: string, caret: number): { start: number; query: string } | null {
  for (let i = caret - 1; i >= 0; i--) {
    const ch = text[i];
    if (ch === '#') {
      if (i === 0 || /\s/.test(text[i - 1])) return { start: i, query: text.slice(i + 1, caret) };
      return null;
    }
    if (/\s/.test(ch)) return null; // spazio prima del '#' → nessun hashtag attivo
  }
  return null;
}

export default function TextCaptureScreen() {
  const theme = usePixelTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  // When reached from the tile detail (Sparks → text), `?tile=<id>` is set and
  // the spark is created directly against that tile (skipping the buffer).
  const { tile: tileId } = useLocalSearchParams<{ tile?: string }>();
  const [text, setText] = useState('');
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [saving, setSaving] = useState(false);
  const addItem = useBufferStore((state) => state.addItem);
  const setPendingTag = usePendingTagStore((s) => s.set);
  const clearPendingTag = usePendingTagStore((s) => s.clear);

  // Tag dell'utente per l'autocomplete degli #hashtag.
  const tagsQuery = useQuery({ queryKey: ['tags'], queryFn: () => tagsApi.list(), staleTime: 300_000 });
  const tags: Tag[] = tagsQuery.data?.data ?? [];

  // Match per prefisso su nome+alias del tag correntemente digitato dopo '#'.
  // "#golfo" → sia "Golfo" sia "Golfo del Sole" (entrambi iniziano per golfo).
  const active = activeHashtag(text, selection.start);
  const tagMatches = !active
    ? []
    : tags
        .filter((t) => {
          if (t.is_root) return false;
          const q = normKey(active.query);
          return normKey(t.name).startsWith(q) || (t.aliases ?? []).some((a) => normKey(a).startsWith(q));
        })
        .slice(0, 8);

  /** Inserisce il tag scelto: completa l'hashtag col nome pieno e lo registra
   *  come tag del tile in creazione (verrà applicato all'invio del buffer). */
  const applyTag = (tag: Tag) => {
    if (!active) return;
    const caret = selection.start;
    const before = text.slice(0, active.start);
    const after = text.slice(caret);
    const insert = `#${tag.name} `;
    setText(before + insert + after);
    const newCaret = (before + insert).length;
    setSelection({ start: newCaret, end: newCaret });
    setPendingTag(tag.id, tag.name);
  };

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
        // Path diretto (spark su tile esistente): il tag scelto via #hashtag va
        // applicato subito a QUESTO tile, non al buffer.
        const pending = usePendingTagStore.getState();
        if (pending.tagId) {
          await tagsApi.tagTiles(pending.tagId, [tileId]).catch(() => {});
          clearPendingTag();
        }
        queryClient.invalidateQueries({ queryKey: ['tile', tileId] });
        queryClient.invalidateQueries({ queryKey: ['tags'] });
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
            selection={selection}
            onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
            placeholder="Write your note...  (usa #tag per etichettare)"
            multiline
            autoFocus
            style={{
              fontSize: 16,
              lineHeight: 24,
            }}
          />
        </View>

        {/* Autocomplete #hashtag → tag esistenti (prefisso su nome/alias).
            Compare sopra il footer mentre digiti un hashtag; toccare un tag
            completa il testo e lo registra come tag del tile. */}
        {tagMatches.length > 0 && (
          <View style={{ maxHeight: 180, borderTopWidth: 2, borderTopColor: theme.border, backgroundColor: theme.surface }}>
            <ScrollView keyboardShouldPersistTaps="handled">
              {tagMatches.map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() => applyTag(t)}
                  style={({ pressed }) => ({
                    flexDirection: 'row', alignItems: 'center', gap: 10,
                    paddingHorizontal: 16, minHeight: 44,
                    backgroundColor: pressed ? theme.surfaceVariant : 'transparent',
                    borderBottomWidth: 1, borderBottomColor: theme.border,
                  })}
                >
                  <IconTag size={16} color={theme.ink2} strokeWidth={1.8} />
                  <Text style={{ flex: 1, fontFamily: theme.fontBody, fontSize: 15, color: theme.ink }}>{t.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

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
