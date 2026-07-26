import React, { useState } from 'react';
import { View, Text, Pressable, KeyboardAvoidingView, Platform, ScrollView, TextInput } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { IconX, IconCheck, IconTag } from '@tabler/icons-react-native';
import { SafeAreaWrapper } from '@/components/layout/SafeAreaWrapper';
import { useBufferStore, toast } from '@/store';
import { usePendingTagStore } from '@/store/pendingTagStore';
import { useObsidian } from '@/lib/obsidian';
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
  const c = useObsidian();
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
      toast.warning('Inserisci del testo');
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

    toast.success('Nota aggiunta al buffer');
    router.back();
  };

  const charCount = text.length;
  const canSave = text.trim().length > 0 && !saving;

  return (
    <SafeAreaWrapper edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, backgroundColor: c.canvas }}
      >
        {/* Header — X (chiudi) · titolo · check (salva). Bordo inferiore sottile. */}
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
            onPress={handleClose}
            accessibilityLabel="Chiudi"
            hitSlop={6}
            android_ripple={{ color: c.line, borderless: true }}
            style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface2, borderWidth: 1, borderColor: c.line }}
          >
            <IconX size={19} color={c.text} strokeWidth={1.9} />
          </Pressable>

          <Text style={{ fontSize: 16, fontWeight: '700', color: c.text }}>Nuova nota</Text>

          <Pressable
            onPress={handleSave}
            disabled={!canSave}
            accessibilityLabel="Salva"
            hitSlop={6}
            android_ripple={{ color: c.line, borderless: true }}
            style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: canSave ? c.accent : c.surface2, borderWidth: 1, borderColor: canSave ? c.accent : c.line }}
          >
            <IconCheck size={20} color={canSave ? c.accentInk : c.subtle} strokeWidth={2.2} />
          </Pressable>
        </View>

        {/* Editor — campo Obsidian che riempie lo spazio */}
        <View style={{ flex: 1, padding: 16 }}>
          <View style={{ flex: 1, backgroundColor: c.field, borderWidth: 1, borderColor: c.line2, borderRadius: 12, padding: 14 }}>
            <TextInput
              value={text}
              onChangeText={setText}
              selection={selection}
              onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
              placeholder="Scrivi la tua nota…  (usa #tag per etichettare)"
              placeholderTextColor={c.subtle}
              multiline
              autoFocus
              textAlignVertical="top"
              style={{ flex: 1, fontSize: 19, lineHeight: 28, color: c.text }}
            />
          </View>
        </View>

        {/* Autocomplete #hashtag → tag esistenti (prefisso su nome/alias).
            Compare sopra il footer mentre digiti un hashtag; toccare un tag
            completa il testo e lo registra come tag del tile. */}
        {tagMatches.length > 0 && (
          <View style={{ maxHeight: 200, borderTopWidth: 1, borderTopColor: c.line, backgroundColor: c.surface }}>
            <ScrollView keyboardShouldPersistTaps="handled">
              {tagMatches.map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() => applyTag(t)}
                  android_ripple={{ color: c.accent + '22' }}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 10,
                    paddingHorizontal: 16, minHeight: 46,
                    borderBottomWidth: 1, borderBottomColor: c.line,
                  }}
                >
                  <IconTag size={16} color={c.subtle} strokeWidth={1.8} />
                  <Text style={{ flex: 1, fontSize: 15, fontWeight: '500', color: c.text }}>{t.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Footer — contatore caratteri */}
        <View
          style={{
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderTopWidth: 1,
            borderTopColor: c.line,
            flexDirection: 'row',
            justifyContent: 'flex-end',
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: '600', letterSpacing: 0.6, color: c.subtle }}>
            {charCount} caratteri
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaWrapper>
  );
}
