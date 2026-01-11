import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useBufferStore, toast } from '@/store';

export default function GalleryCaptureScreen() {
  const router = useRouter();
  const addItem = useBufferStore((state) => state.addItem);

  useEffect(() => {
    pickImage();
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

      // Add each selected image to buffer
      for (const asset of result.assets) {
        addItem({
          type: 'image',
          uri: asset.uri,
          mimeType: asset.mimeType ?? 'image/jpeg',
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
