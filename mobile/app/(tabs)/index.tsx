import React, { useState } from 'react';
import { View, Text, Modal, Image as RNImage, TextInput, TouchableOpacity, Pressable, FlatList, ScrollView, LayoutAnimation } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Camera, Video, FileText, Mic, FileUp, Image, X, Save, Menu, LayoutGrid, Settings, ChevronDown, MessageCircle } from 'lucide-react-native';
import { SafeAreaWrapper } from '@/components/layout/SafeAreaWrapper';
import { CaptureButton } from '@/components/capture/CaptureButton';
import { BufferBar } from '@/components/capture/BufferBar';
import { ChatInput } from '@/components/chat/ChatInput';
import { useBufferStore, useAuthStore, useSettingsStore, toast } from '@/store';
import { uploadBufferItems, chatApi } from '@/lib/api';
import { colors } from '@/constants';
import type { BufferItem, MemoType } from '@/types';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
};

let msgCounter = 0;

// Map button ID → MemoType(s) in buffer
const buttonToMemoTypes: Record<string, MemoType[]> = {
  photo: ['photo'],
  video: ['video'],
  gallery: ['image'],
  text: ['text'],
  voice: ['audio_recording'],
  file: ['file'],
};

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
  const aiModel = useSettingsStore((state) => state.aiModel);
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingItem, setEditingItem] = useState<BufferItem | null>(null);
  const [editText, setEditText] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [chatMode, setChatMode] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Count buffer items per button type
  const bufferCounts = items.reduce((acc, item) => {
    acc[item.type] = (acc[item.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

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

  const toggleChatMode = (open: boolean) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setChatMode(open);
  };

  const addMessage = (role: 'user' | 'assistant', content: string) => {
    msgCounter++;
    const msg: ChatMessage = {
      id: `msg-${msgCounter}-${Date.now()}`,
      role,
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [msg, ...prev]);
    return msg;
  };

  const sendToAI = async (text: string) => {
    addMessage('user', text);
    setIsProcessing(true);
    try {
      // Build history from existing messages (reversed because FlatList is inverted)
      const history = [...messages].reverse().map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const result = await chatApi.send(text, history, aiModel);

      if (result.success && result.data?.reply) {
        addMessage('assistant', result.data.reply);
      } else {
        addMessage('assistant', result.error || 'Something went wrong.');
      }
    } catch (error) {
      console.error('Chat error:', error);
      addMessage('assistant', 'Connection error. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTextCommand = async (text: string) => {
    await sendToAI(text);
  };

  const handleVoiceCommand = async (audioUri: string) => {
    addMessage('user', '🎤 Voice message...');
    setIsProcessing(true);
    try {
      const history = [...messages].reverse().map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const result = await chatApi.voiceSend(audioUri, history, aiModel);

      if (result.success && result.data) {
        // Replace the placeholder with the actual transcription
        setMessages((prev) => {
          const updated = [...prev];
          const lastUserIdx = updated.findIndex((m) => m.role === 'user');
          if (lastUserIdx !== -1 && updated[lastUserIdx].content === '🎤 Voice message...') {
            updated[lastUserIdx] = { ...updated[lastUserIdx], content: result.data!.transcript };
          }
          return updated;
        });
        addMessage('assistant', result.data.reply);
      } else {
        addMessage('assistant', result.error || 'Failed to process voice message.');
      }
    } catch (error) {
      console.error('Voice chat error:', error);
      addMessage('assistant', 'Connection error. Please try again.');
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

  const renderChatMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    return (
      <View className={`px-4 mb-3 ${isUser ? 'items-end' : 'items-start'}`}>
        <View
          className="rounded-2xl px-4 py-3 max-w-[80%]"
          style={{
            backgroundColor: isUser ? colors.accent : colors.background2,
          }}
        >
          <Text style={{ color: isUser ? '#FFFFFF' : colors.primary, fontSize: 15 }}>
            {item.content}
          </Text>
        </View>
        <Text className="mt-1 px-1" style={{ color: colors.secondary, fontSize: 11 }}>
          {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaWrapper edges={['top']}>
      <View className="flex-1">
        {/* Header */}
        <View className="py-4 px-4 flex-row items-center">
          {chatMode ? (
            <TouchableOpacity onPress={() => toggleChatMode(false)} className="p-2 -ml-2">
              <ChevronDown size={24} color={colors.primary} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => setMenuOpen(true)} className="p-2 -ml-2">
              <Menu size={24} color={colors.primary} />
            </TouchableOpacity>
          )}
          <Text className="flex-1 text-primary text-2xl font-bold text-center mr-8">Gimmick</Text>
        </View>

        {/* Hamburger Menu Overlay */}
        {menuOpen && (
          <Pressable
            onPress={() => setMenuOpen(false)}
            className="absolute inset-0 z-50"
            style={{ backgroundColor: colors.overlayLight }}
          >
            <View
              className="absolute left-4 rounded-xl overflow-hidden"
              style={{ top: insets.top + 52, backgroundColor: colors.background2 }}
            >
              <TouchableOpacity
                onPress={() => { setMenuOpen(false); router.push('/(tabs)/history' as any); }}
                className="flex-row items-center px-5 py-4 gap-3"
                activeOpacity={0.7}
              >
                <LayoutGrid size={20} color={colors.primary} />
                <Text className="text-primary text-base font-medium">Tiles</Text>
              </TouchableOpacity>
              <View style={{ height: 1, backgroundColor: colors.border }} />
              <TouchableOpacity
                onPress={() => { setMenuOpen(false); router.push('/(tabs)/settings' as any); }}
                className="flex-row items-center px-5 py-4 gap-3"
                activeOpacity={0.7}
              >
                <Settings size={20} color={colors.primary} />
                <Text className="text-primary text-base font-medium">Settings</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        )}

        {chatMode ? (
          /* ====== CHAT MODE ====== */
          <View className="flex-1">
            {/* Mini capture bar */}
            <View
              className="flex-row items-center justify-center py-2"
              style={{ gap: 10 }}
            >
              {captureOptions.map((option) => {
                const types = buttonToMemoTypes[option.id] || [];
                const count = types.reduce((sum, t) => sum + (bufferCounts[t] || 0), 0);
                return (
                  <TouchableOpacity
                    key={option.id}
                    onPress={() => handleCapture(option.route)}
                    activeOpacity={0.7}
                    className="items-center justify-center"
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: `${option.color}20`,
                    }}
                  >
                    {React.cloneElement(option.icon as React.ReactElement<any>, {
                      size: 22,
                      color: option.color,
                      strokeWidth: 1.5,
                    })}
                    {count > 0 && (
                      <View
                        className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full items-center justify-center px-0.5"
                        style={{ backgroundColor: option.color }}
                      >
                        <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '700' }}>{count}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Chat messages */}
            <FlatList
              data={messages}
              renderItem={renderChatMessage}
              keyExtractor={(item) => item.id}
              inverted
              className="flex-1"
              contentContainerStyle={{ paddingVertical: 8 }}
              ListEmptyComponent={
                <View className="flex-1 items-center justify-center py-20">
                  <MessageCircle size={48} color={colors.border} strokeWidth={1} />
                  <Text className="mt-3" style={{ color: colors.secondary, fontSize: 15 }}>
                    Start a conversation
                  </Text>
                </View>
              }
            />

            {/* Chat input */}
            <View className="px-4 pb-2" style={{ paddingBottom: insets.bottom + 8 }}>
              <ChatInput
                onSubmitText={handleTextCommand}
                onSubmitVoice={handleVoiceCommand}
                isProcessing={isProcessing}
              />
            </View>
          </View>
        ) : (
          /* ====== NORMAL MODE ====== */
          <>
            {/* Capture buttons - 2x3 grid */}
            <View className="px-4">
              {/* Row 1: Photo, Video, Gallery */}
              <View className="flex-row gap-3 mb-3">
                {captureOptions.slice(0, 3).map((option) => {
                  const types = buttonToMemoTypes[option.id] || [];
                  const count = types.reduce((sum, t) => sum + (bufferCounts[t] || 0), 0);
                  return (
                    <CaptureButton
                      key={option.id}
                      icon={option.icon}
                      label={option.label}
                      color={option.color}
                      onPress={() => handleCapture(option.route)}
                      disabled={isUploading}
                      count={count}
                    />
                  );
                })}
              </View>
              {/* Row 2: Text, Voice, Files */}
              <View className="flex-row gap-3">
                {captureOptions.slice(3, 6).map((option) => {
                  const types = buttonToMemoTypes[option.id] || [];
                  const count = types.reduce((sum, t) => sum + (bufferCounts[t] || 0), 0);
                  return (
                    <CaptureButton
                      key={option.id}
                      icon={option.icon}
                      label={option.label}
                      color={option.color}
                      onPress={() => handleCapture(option.route)}
                      disabled={isUploading}
                      count={count}
                    />
                  );
                })}
              </View>
            </View>

            {/* Fake Chat Input - tap to open chat mode */}
            <Pressable
              onPress={() => toggleChatMode(true)}
              className="mx-4 mt-4"
            >
              <View
                className="flex-row items-center rounded-2xl px-4 h-[104px] border"
                style={{
                  backgroundColor: colors.background2,
                  borderColor: colors.border,
                }}
              >
                <MessageCircle size={20} color={colors.secondary} />
                <Text className="flex-1 mx-3" style={{ color: '#6B7280', fontSize: 16 }}>
                  Ask something...
                </Text>
                <Mic size={20} color={colors.secondary} />
              </View>
            </Pressable>

            {/* Buffer section */}
            <View className="flex-1 px-4 mt-4">
              <BufferBar onSend={handleSend} onItemPress={handleItemPress} large />
            </View>
          </>
        )}

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
