import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useBufferStore, toast } from '@/store';
import { formatFileSize } from '@/utils/formatters';

export default function FileCaptureScreen() {
  const router = useRouter();
  const addItem = useBufferStore((state) => state.addItem);

  useEffect(() => {
    pickDocument();
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
      toast.error('Errore selezione file');
      router.back();
    }
  };

  return (
    <View className="flex-1 bg-black/50 items-center justify-center">
      <View className="bg-background-2 rounded-2xl p-6">
        <Text className="text-primary text-lg">Seleziona un file...</Text>
      </View>
    </View>
  );
}
