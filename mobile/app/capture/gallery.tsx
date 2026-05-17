import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useBufferStore, toast } from '@/store';
import { createSparkForTile } from '@/lib/api';

export default function GalleryCaptureScreen() {
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
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        toast.error('Gallery access denied');
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
        // Direct attach to the originating tile — upload + create spark per asset.
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

      // Add each selected image to buffer
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
        count === 1
          ? 'Image added to buffer'
          : `${count} images added to buffer`
      );

      router.back();
    } catch (error) {
      console.error('Error picking image:', error);
      toast.error('Error selecting image');
      router.back();
    }
  };

  return (
    <View className="flex-1 bg-black/50 items-center justify-center">
      <View className="bg-background-2 rounded-2xl p-6">
        <Text className="text-primary text-lg">Select images...</Text>
      </View>
    </View>
  );
}
