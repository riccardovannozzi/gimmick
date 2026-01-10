import React from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Camera, FileText, Mic, FileUp, Image } from 'lucide-react-native';
import { SafeAreaWrapper } from '@/components/layout/SafeAreaWrapper';
import { CaptureButton } from '@/components/capture/CaptureButton';
import { BufferBar } from '@/components/capture/BufferBar';
import { useBufferStore, useAuthStore, toast } from '@/store';
import { uploadBufferItems } from '@/lib/api';
import { colors } from '@/constants';

const captureOptions = [
  {
    id: 'photo',
    label: 'FOTO',
    icon: <Camera />,
    color: colors.capture.photo,
    route: '/capture/photo',
  },
  {
    id: 'text',
    label: 'TESTO',
    icon: <FileText />,
    color: colors.capture.text,
    route: '/capture/text',
  },
  {
    id: 'voice',
    label: 'VOCE',
    icon: <Mic />,
    color: colors.capture.voice,
    route: '/capture/voice',
  },
  {
    id: 'file',
    label: 'FILE',
    icon: <FileUp />,
    color: colors.capture.file,
    route: '/capture/file',
  },
  {
    id: 'gallery',
    label: 'GALLERIA',
    icon: <Image />,
    color: colors.capture.gallery,
    route: '/capture/gallery',
  },
] as const;

export default function HomeScreen() {
  const router = useRouter();
  const items = useBufferStore((state) => state.items);
  const clearBuffer = useBufferStore((state) => state.clearBuffer);
  const setUploading = useBufferStore((state) => state.setUploading);
  const isUploading = useBufferStore((state) => state.isUploading);
  const isAuthenticated = useAuthStore((state) => !!state.accessToken);

  const handleCapture = (route: string) => {
    router.push(route as any);
  };

  const handleSend = async () => {
    if (items.length === 0) return;

    // Check authentication
    if (!isAuthenticated) {
      toast.warning('Effettua il login per caricare i memo');
      router.push('/(tabs)/settings' as any);
      return;
    }

    setUploading(true);

    try {
      const result = await uploadBufferItems(items);

      if (result.success) {
        toast.success(`${result.results.length} elementi caricati con successo!`);
        clearBuffer();
      } else {
        const successCount = result.results.length;
        const errorCount = result.errors.length;

        if (successCount > 0) {
          toast.warning(`${successCount} caricati, ${errorCount} errori`);
          // Remove successful items from buffer
          // For now, clear all - in production you'd track which succeeded
        } else {
          toast.error(`Errore: ${result.errors[0]}`);
        }
      }
    } catch (error) {
      toast.error('Errore durante il caricamento');
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaWrapper edges={['top']}>
      <View className="flex-1">
        {/* Header */}
        <View className="px-4 py-4">
          <Text className="text-primary text-2xl font-bold">MOCA</Text>
          <Text className="text-secondary text-sm mt-1">
            Cattura rapida multi-formato
          </Text>
        </View>

        {/* Capture buttons */}
        <View className="flex-1 px-4 gap-3">
          {captureOptions.map((option) => (
            <CaptureButton
              key={option.id}
              icon={option.icon}
              label={option.label}
              color={option.color}
              onPress={() => handleCapture(option.route)}
              disabled={isUploading}
            />
          ))}
        </View>

        {/* Buffer bar */}
        <BufferBar onSend={handleSend} />
      </View>
    </SafeAreaWrapper>
  );
}
