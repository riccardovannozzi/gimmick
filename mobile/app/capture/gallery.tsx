import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { IconPhoto } from '@tabler/icons-react-native';
import { useBufferStore, toast } from '@/store';
import { createSparkForTile } from '@/lib/api';
import { invalidateTileData } from '@/lib/invalidate';
import { useObsidian } from '@/lib/obsidian';

export default function GalleryCaptureScreen() {
  const c = useObsidian();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { tile: tileId } = useLocalSearchParams<{ tile?: string }>();
  const addItem = useBufferStore((state) => state.addItem);

  useEffect(() => {
    pickImage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        toast.error('Accesso alle immagini negato');
        router.back();
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 10,
      });

      if (result.canceled) {
        router.back();
        return;
      }

      if (tileId) {
        let ok = 0;
        for (const asset of result.assets) {
          const res = await createSparkForTile({
            type: 'image',
            tileId,
            uri: asset.uri,
            mimeType: asset.mimeType ?? 'image/jpeg',
            fileName: asset.fileName ?? undefined,
            size: asset.fileSize ?? undefined,
          });
          if (res.success) ok += 1;
        }
        invalidateTileData(queryClient, tileId);
        toast.success(ok === 1 ? 'Immagine salvata' : `${ok} immagini salvate`);
        router.back();
        return;
      }

      for (const asset of result.assets) {
        addItem({
          type: 'image',
          uri: asset.uri,
          mimeType: asset.mimeType ?? 'image/jpeg',
          fileName: asset.fileName ?? undefined,
          width: asset.width,
          height: asset.height,
          size: asset.fileSize ?? undefined,
        });
      }

      const count = result.assets.length;
      toast.success(
        count === 1 ? 'Immagine aggiunta al buffer' : `${count} immagini aggiunte al buffer`
      );

      router.back();
    } catch (error) {
      console.error('Error picking image:', error);
      toast.error('Errore nella selezione dell’immagine');
      router.back();
    }
  };

  // Overlay di attesa mentre si apre il picker di sistema — card Obsidian
  // (angoli morbidi, hairline, icona tinta col colore del canale gallery).
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
            backgroundColor: c.cap.gallery + '2E',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconPhoto size={24} color={c.cap.gallery} strokeWidth={1.9} />
        </View>
        <Text style={{ fontSize: 14, fontWeight: '600', color: c.text }}>Seleziona le immagini…</Text>
      </View>
    </View>
  );
}
