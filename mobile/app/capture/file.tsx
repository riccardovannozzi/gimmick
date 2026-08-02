import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { IconPaperclip } from '@tabler/icons-react-native';
import { useBufferStore, toast } from '@/store';
import { createSparkForTile } from '@/lib/api';
import { invalidateTileData } from '@/lib/invalidate';
import { useObsidian } from '@/lib/obsidian';

export default function FileCaptureScreen() {
  const c = useObsidian();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { tile: tileId } = useLocalSearchParams<{ tile?: string }>();
  const addItem = useBufferStore((state) => state.addItem);

  useEffect(() => {
    pickDocument();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        router.back();
        return;
      }

      const asset = result.assets[0];

      if (asset) {
        if (tileId) {
          const res = await createSparkForTile({
            type: 'file',
            tileId,
            uri: asset.uri,
            fileName: asset.name,
            mimeType: asset.mimeType ?? 'application/octet-stream',
            size: asset.size,
          });
          if (!res.success) {
            toast.error(res.error || 'Errore nel salvataggio');
            router.back();
            return;
          }
          invalidateTileData(queryClient, tileId);
          toast.success(`File "${asset.name}" salvato`);
          router.back();
          return;
        }
        addItem({
          type: 'file',
          uri: asset.uri,
          fileName: asset.name,
          mimeType: asset.mimeType ?? 'application/octet-stream',
          size: asset.size,
        });

        toast.success(`File "${asset.name}" aggiunto al buffer`);
      }

      router.back();
    } catch (error) {
      console.error('Error picking document:', error);
      toast.error('Errore nella selezione del file');
      router.back();
    }
  };

  // Overlay di attesa mentre si apre il picker di sistema — card Obsidian
  // (stesso linguaggio di gallery).
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
      }}
    >
      <View
        style={{
          paddingHorizontal: 24,
          paddingVertical: 20,
          borderRadius: 16,
          backgroundColor: c.surface,
          alignItems: 'center',
          gap: 12,
        }}
      >
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: c.cap.file + '2E',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconPaperclip size={22} color={c.cap.file} strokeWidth={1.9} />
        </View>
        <Text style={{ fontSize: 14, fontWeight: '600', color: c.text }}>Seleziona un file…</Text>
      </View>
    </View>
  );
}
