import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { IconPhoto } from '@tabler/icons-react-native';
import { useBufferStore, toast } from '@/store';
import { createSparkForTile } from '@/lib/api';
import { usePixelTheme } from '@/components/pixel';

export default function GalleryCaptureScreen() {
  const theme = usePixelTheme();
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
        queryClient.invalidateQueries({ queryKey: ['tile', tileId] });
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
        count === 1 ? 'Image added to buffer' : `${count} images added to buffer`
      );

      router.back();
    } catch (error) {
      console.error('Error picking image:', error);
      toast.error('Error selecting image');
      router.back();
    }
  };

  // Loading overlay con cornice/shadow Pixel (border + shadow bianchi su
  // overlay scuro — stesso linguaggio di photo/video). Pattern Android-safe.
  const sh = theme.shadowOffset;
  // Capture color gallery = lavanda (theme.cap.gallery).
  const accent = theme.cap.gallery;

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
            <IconPhoto size={24} color="#FFFFFF" strokeWidth={2} />
          </View>
          <Text
            style={{
              fontFamily: theme.fontHead,
              fontSize: 10,
              color: theme.ink,
              letterSpacing: 1,
            }}
          >
            SELECT IMAGES…
          </Text>
        </View>
      </View>
    </View>
  );
}
