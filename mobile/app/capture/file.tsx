import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { IconPaperclip } from '@tabler/icons-react-native';
import { useBufferStore, toast } from '@/store';
import { createSparkForTile } from '@/lib/api';
import { usePixelTheme } from '@/components/pixel';

export default function FileCaptureScreen() {
  const theme = usePixelTheme();
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
          queryClient.invalidateQueries({ queryKey: ['tile', tileId] });
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

        toast.success(`File "${asset.name}" added to buffer`);
      }

      router.back();
    } catch (error) {
      console.error('Error picking document:', error);
      toast.error('Error selecting file');
      router.back();
    }
  };

  // Loading overlay con cornice/shadow Pixel (stesso linguaggio di gallery).
  const sh = theme.shadowOffset;
  const accent = theme.cap.file;

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
      <View style={{ position: 'relative', paddingRight: sh, paddingBottom: sh }}>
        {sh > 0 && (
          <View
            style={{
              position: 'absolute',
              left: sh,
              top: sh,
              right: 0,
              bottom: 0,
              backgroundColor: '#FFFFFF',
            }}
          />
        )}
        <View
          style={{
            paddingHorizontal: 20,
            paddingVertical: 18,
            borderWidth: 2,
            borderColor: '#FFFFFF',
            backgroundColor: theme.surface,
            alignItems: 'center',
            gap: 10,
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderWidth: 2,
              borderColor: theme.border,
              backgroundColor: accent,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconPaperclip size={22} color="#FFFFFF" strokeWidth={2} />
          </View>
          <Text
            style={{
              fontFamily: theme.fontHead,
              fontSize: 10,
              color: theme.ink,
              letterSpacing: 1,
            }}
          >
            SELECT A FILE…
          </Text>
        </View>
      </View>
    </View>
  );
}
