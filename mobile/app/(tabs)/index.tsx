import React, { useState } from 'react';
import { View, Text, Modal, Image as RNImage, TextInput, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Camera, Video, FileText, Mic, FileUp, Image, X, Save } from 'lucide-react-native';
import { SafeAreaWrapper } from '@/components/layout/SafeAreaWrapper';
import { CaptureButton } from '@/components/capture/CaptureButton';
import { BufferBar } from '@/components/capture/BufferBar';
import { ChatInput } from '@/components/chat/ChatInput';
import { useBufferStore, useAuthStore, toast } from '@/store';
import { uploadBufferItems } from '@/lib/api';
import { colors } from '@/constants';
import type { BufferItem } from '@/types';

// Row 1: Photo, Video, Gallery
// Row 2: Text, Voice, Files
const captureOptions = [
  // Row 1
  {
    id: 'photo',
    label: 'PHOTO',
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
    label: 'GALLERY',
    icon: <Image />,
    color: colors.capture.gallery,
    route: '/capture/gallery',
  },
  // Row 2
  {
    id: 'text',
    label: 'TEXT',
    icon: <FileText />,
    color: colors.capture.text,
    route: '/capture/text',
  },
  {
    id: 'voice',
    label: 'VOICE',
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
  const insets = useSafeAreaInsets();
  const items = useBufferStore((state) => state.items);
  const clearBuffer = useBufferStore((state) => state.clearBuffer);
  const setUploading = useBufferStore((state) => state.setUploading);
  const isUploading = useBufferStore((state) => state.isUploading);
  const updateItem = useBufferStore((state) => state.updateItem);
  const isAuthenticated = useAuthStore((state) => !!state.accessToken);
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingItem, setEditingItem] = useState<BufferItem | null>(null);
  const [editText, setEditText] = useState('');

  const handleCapture = (route: string) => {
    router.push(route as any);
  };

  const handleItemPress = (item: BufferItem) => {
    setEditingItem(item);
    if (item.type === 'text') {
      setEditText(item.preview ?? '');
    }
  };

  const handleSaveEdit = () => {
    if (editingItem && editingItem.type === 'text') {
      updateItem(editingItem.id, {
        preview: editText,
      });
      toast.success('Text updated');
    }
    setEditingItem(null);
    setEditText('');
  };

  const handleCloseEdit = () => {
    setEditingItem(null);
    setEditText('');
  };

  const handleTextCommand = async (text: string) => {
    setIsProcessing(true);
    try {
      // TODO: Send command to AI
      console.log('Text command:', text);
      toast.info(`Command: ${text}`);
    } catch (error) {
      console.error('Command error:', error);
      toast.error('Command processing error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVoiceCommand = async (audioUri: string, transcription?: string) => {
    setIsProcessing(true);
    try {
      // TODO: If no transcription, transcribe it
      // TODO: Process as text command
      console.log('Voice command:', audioUri);
      toast.info('Voice recording received');
    } catch (error) {
      console.error('Voice command error:', error);
      toast.error('Audio processing error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSend = async () => {
    if (items.length === 0) return;

    // Check authentication
    if (!isAuthenticated) {
      toast.warning('Please login to upload memos');
      router.push('/(tabs)/settings' as any);
      return;
    }

    setUploading(true);

    try {
      const result = await uploadBufferItems(items);

      if (result.success) {
        toast.success(`${result.results.length} items uploaded successfully!`);
        clearBuffer();
      } else {
        const successCount = result.results.length;
        const errorCount = result.errors.length;

        if (successCount > 0) {
          toast.warning(`${successCount} uploaded, ${errorCount} errors`);
          // Remove successful items from buffer
          // For now, clear all - in production you'd track which succeeded
        } else {
          toast.error(`Error: ${result.errors[0]}`);
        }
      }
    } catch (error) {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaWrapper edges={['top']}>
      <View className="flex-1">
        {/* Header */}
        <View className="py-4 items-center">
          <Text className="text-primary text-2xl font-bold">Gimmick</Text>
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

        {/* Buffer section - sotto l'input */}
        <View className="flex-1 px-4 mt-4">
          <BufferBar onSend={handleSend} onItemPress={handleItemPress} large />
        </View>

        {/* Edit Modal - Full screen */}
        <Modal
          visible={editingItem !== null}
          animationType="slide"
          statusBarTranslucent={false}
          onRequestClose={handleCloseEdit}
        >
          <SafeAreaWrapper edges={['top']}>
            <View className="flex-1 bg-background-1">
              {/* Header */}
              <View className="flex-row items-center justify-between px-4 py-4 border-b border-border">
                <TouchableOpacity onPress={handleCloseEdit} className="p-2">
                  <X size={24} color={colors.secondary} />
                </TouchableOpacity>
                <Text className="text-primary text-lg font-semibold">
                  {editingItem?.type === 'text' ? 'Edit text' : 'Preview'}
                </Text>
                {editingItem?.type === 'text' ? (
                  <TouchableOpacity onPress={handleSaveEdit} className="p-2">
                    <Save size={24} color={colors.accent} />
                  </TouchableOpacity>
                ) : (
                  <View className="w-10" />
                )}
              </View>

              {/* Content - Full height with bottom safe area */}
              <View className="flex-1 p-4" style={{ paddingBottom: insets.bottom + 16 }}>
                {editingItem?.type === 'text' ? (
                  <TextInput
                    className="flex-1 rounded-xl p-4"
                    style={{
                      textAlignVertical: 'top',
                      backgroundColor: colors.background2,
                      color: colors.primary,
                      fontSize: 16,
                    }}
                    multiline
                    value={editText}
                    onChangeText={setEditText}
                    placeholder="Type here..."
                    placeholderTextColor={colors.secondary}
                    autoFocus
                  />
                ) : editingItem?.type === 'photo' || editingItem?.type === 'image' || editingItem?.type === 'video' ? (
                  <View className="flex-1 items-center justify-center">
                    <RNImage
                      source={{ uri: editingItem.uri }}
                      className="w-full h-full rounded-xl"
                      resizeMode="contain"
                    />
                  </View>
                ) : (
                  <View className="flex-1 items-center justify-center">
                    <Text className="text-secondary">
                      Preview not available for this file type
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </SafeAreaWrapper>
        </Modal>
      </View>
    </SafeAreaWrapper>
  );
}
