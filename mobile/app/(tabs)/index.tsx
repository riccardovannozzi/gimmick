import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Camera, Video, FileText, Mic, FileUp, Image } from 'lucide-react-native';
import { SafeAreaWrapper } from '@/components/layout/SafeAreaWrapper';
import { CaptureButton } from '@/components/capture/CaptureButton';
import { BufferBar } from '@/components/capture/BufferBar';
import { ChatInput } from '@/components/chat/ChatInput';
import { useBufferStore, useAuthStore, toast } from '@/store';
import { uploadBufferItems } from '@/lib/api';
import { colors } from '@/constants';

// Row 1: Photo, Video, Gallery
// Row 2: Text, Voice, Files
const captureOptions = [
  // Row 1
  {
    id: 'photo',
    label: 'FOTO',
    icon: <Camera />,
    color: colors.capture.photo,
    route: '/capture/photo',
  },
  {
    id: 'video',
    label: 'VIDEO',
    icon: <Video />,
    color: colors.capture.video,
    route: '/capture/video',
  },
  {
    id: 'gallery',
    label: 'GALLERIA',
    icon: <Image />,
    color: colors.capture.gallery,
    route: '/capture/gallery',
  },
  // Row 2
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
] as const;

export default function HomeScreen() {
  const router = useRouter();
  const items = useBufferStore((state) => state.items);
  const clearBuffer = useBufferStore((state) => state.clearBuffer);
  const setUploading = useBufferStore((state) => state.setUploading);
  const isUploading = useBufferStore((state) => state.isUploading);
  const isAuthenticated = useAuthStore((state) => !!state.accessToken);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleCapture = (route: string) => {
    router.push(route as any);
  };

  const handleTextCommand = async (text: string) => {
    setIsProcessing(true);
    try {
      // TODO: Invia comando all'AI
      console.log('Comando testuale:', text);
      toast.info(`Comando: ${text}`);
    } catch (error) {
      console.error('Errore comando:', error);
      toast.error('Errore elaborazione comando');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVoiceCommand = async (audioUri: string, transcription?: string) => {
    setIsProcessing(true);
    try {
      // TODO: Se non c'è trascrizione, trascrivila
      // TODO: Processa come comando testuale
      console.log('Comando vocale:', audioUri);
      toast.info('Registrazione vocale ricevuta');
    } catch (error) {
      console.error('Errore comando vocale:', error);
      toast.error('Errore elaborazione audio');
    } finally {
      setIsProcessing(false);
    }
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
        <View className="py-4 items-center">
          <Text className="text-primary text-2xl font-bold">MOCA</Text>
        </View>

        {/* Capture buttons - 2x3 grid */}
        <View className="px-4">
          {/* Row 1: Photo, Video, Gallery */}
          <View className="flex-row gap-3 mb-3">
            {captureOptions.slice(0, 3).map((option) => (
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
          {/* Row 2: Text, Voice, Files */}
          <View className="flex-row gap-3">
            {captureOptions.slice(3, 6).map((option) => (
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
        </View>

        {/* Chat Input */}
        <View className="px-4 mt-4">
          <ChatInput
            onSubmitText={handleTextCommand}
            onVoiceResult={handleVoiceCommand}
            isProcessing={isProcessing}
          />
        </View>

        {/* Spacer */}
        <View className="flex-1" />

        {/* Buffer bar */}
        <BufferBar onSend={handleSend} />
      </View>
    </SafeAreaWrapper>
  );
}
