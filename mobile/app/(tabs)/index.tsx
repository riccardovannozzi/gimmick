import React, { useState } from 'react';
import { View, Text, Modal, Image as RNImage, TextInput, TouchableOpacity, FlatList, ScrollView, LayoutAnimation } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { X, Save, Send, Mic, ScanLine, Camera, Video, Images, PenSquare, Paperclip, Sparkles } from 'lucide-react-native';
import { SafeAreaWrapper } from '@/components/layout/SafeAreaWrapper';
import { ChatInput } from '@/components/chat/ChatInput';
import { useBufferStore, useAuthStore, useSettingsStore, toast } from '@/store';
import { uploadBufferItems, chatApi } from '@/lib/api';
import { captureColors } from '@/constants/colors';
import { useThemeColors } from '@/lib/theme';
import { formatFileSize, formatDuration } from '@/utils/formatters';
import type { BufferItem, MemoType } from '@/types';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
};

let msgCounter = 0;

const buttonToMemoTypes: Record<string, MemoType[]> = {
  photo: ['photo'],
  video: ['video'],
  gallery: ['image'],
  text: ['text'],
  voice: ['audio_recording'],
  file: ['file'],
};

const captureOptions = [
  { id: 'photo', label: 'Photo', icon: <Camera />, color: captureColors.photo, route: '/capture/photo' },
  { id: 'video', label: 'Video', icon: <Video />, color: captureColors.video, route: '/capture/video' },
  { id: 'gallery', label: 'Gallery', icon: <Images />, color: captureColors.gallery, route: '/capture/gallery' },
  { id: 'scan', label: 'Scan', icon: <ScanLine />, color: captureColors.scan, route: '/capture/photo' },
  { id: 'text', label: 'Text', icon: <PenSquare />, color: captureColors.text, route: '/capture/text' },
  { id: 'voice', label: 'Rec', icon: <Mic />, color: captureColors.voice, route: '/capture/voice' },
  { id: 'file', label: 'File', icon: <Paperclip />, color: captureColors.file, route: '/capture/file' },
  { id: 'ai', label: 'Ask AI', icon: <Sparkles />, color: captureColors.ai, route: null },
] as const;

function MemoChip({ item, index, onRemove, colors }: { item: BufferItem; index: number; onRemove: () => void; colors: any }) {
  const getChipColor = (type: MemoType) => {
    switch (type) {
      case 'photo': case 'image': return captureColors.photo;
      case 'video': return captureColors.video;
      case 'text': return captureColors.text;
      case 'audio_recording': return captureColors.voice;
      case 'file': return captureColors.file;
      default: return colors.accent;
    }
  };

  const getTypeLabel = (type: MemoType) => {
    switch (type) {
      case 'photo': return 'Photo';
      case 'image': return 'Image';
      case 'video': return 'Video';
      case 'audio_recording': return 'Rec';
      case 'text': return 'Text';
      case 'file': return 'File';
      default: return 'Item';
    }
  };

  const getDetails = (item: BufferItem) => {
    const parts: string[] = [];
    if (item.size) parts.push(formatFileSize(item.size));
    if (item.duration) parts.push(formatDuration(item.duration));
    if (item.type === 'text' && item.preview) {
      parts.push(item.preview.substring(0, 30));
    }
    if (item.fileName) parts.push(item.fileName);
    return parts.join(' · ') || getTypeLabel(item.type).toLowerCase();
  };

  const chipColor = getChipColor(item.type);
  const isMedia = item.type === 'photo' || item.type === 'image' || item.type === 'video';
  const isText = item.type === 'text';

  return (
    <View
      style={{
        backgroundColor: colors.surfaceVariant,
        borderRadius: 12,
        marginBottom: 8,
        minHeight: 56,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 10 }}>
        {isMedia && item.uri ? (
          <RNImage
            source={{ uri: item.thumbnail ?? item.uri }}
            style={{ width: 56, height: 56, borderTopLeftRadius: 12, borderBottomLeftRadius: isText ? 0 : 12 }}
            resizeMode="cover"
          />
        ) : (
          <View
            style={{
              width: 56,
              minHeight: 56,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {item.type === 'text' ? (
              <PenSquare size={20} color={chipColor} strokeWidth={1.8} />
            ) : item.type === 'audio_recording' ? (
              <Mic size={20} color={chipColor} strokeWidth={1.8} />
            ) : item.type === 'file' ? (
              <Paperclip size={20} color={chipColor} strokeWidth={1.8} />
            ) : (
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: chipColor }} />
            )}
          </View>
        )}
        {isText ? (
          <View style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 10 }}>
            <Text style={{ color: colors.primary, fontSize: 14, lineHeight: 20 }}>
              {item.preview || 'Text'}
            </Text>
          </View>
        ) : (
          <View style={{ flex: 1, paddingVertical: 8, paddingHorizontal: 10 }}>
            <Text
              numberOfLines={1}
              style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}
            >
              {item.type === 'file' || isMedia
                ? item.fileName || item.uri.split('/').pop() || `${getTypeLabel(item.type)} ${index}`
                : `${getTypeLabel(item.type)} ${index}`}
            </Text>
            <Text
              numberOfLines={1}
              style={{ color: colors.tertiary, fontSize: 12, marginTop: 2 }}
            >
              {item.type === 'audio_recording'
                ? [item.duration ? formatDuration(item.duration) : null, item.size ? formatFileSize(item.size) : null].filter(Boolean).join(' · ') || 'Audio'
                : isMedia
                  ? [item.width && item.height ? `${item.width}×${item.height}` : null, item.size ? formatFileSize(item.size) : null].filter(Boolean).join(' · ') || getTypeLabel(item.type)
                  : item.type === 'file'
                    ? (item.size ? formatFileSize(item.size) : 'File')
                    : getDetails(item)}
            </Text>
          </View>
        )}
        <TouchableOpacity
          onPress={onRemove}
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: `${colors.tertiary}20`,
            alignItems: 'center',
            justifyContent: 'center',
            alignSelf: 'flex-start',
            marginTop: 14,
          }}
        >
          <X size={14} color={colors.secondary} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const items = useBufferStore((state) => state.items);
  const clearBuffer = useBufferStore((state) => state.clearBuffer);
  const removeItem = useBufferStore((state) => state.removeItem);
  const setUploading = useBufferStore((state) => state.setUploading);
  const isUploading = useBufferStore((state) => state.isUploading);
  const updateItem = useBufferStore((state) => state.updateItem);
  const isAuthenticated = useAuthStore((state) => !!state.accessToken);
  const aiModel = useSettingsStore((state) => state.aiModel);
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingItem, setEditingItem] = useState<BufferItem | null>(null);
  const [editText, setEditText] = useState('');
  const [chatMode, setChatMode] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const handleCapture = (route: string) => {
    router.push(route as any);
  };

  const handleSaveEdit = () => {
    if (editingItem && editingItem.type === 'text') {
      updateItem(editingItem.id, { preview: editText });
      toast.success('Text updated');
    }
    setEditingItem(null);
    setEditText('');
  };

  const handleCloseEdit = () => {
    setEditingItem(null);
    setEditText('');
  };

  const toggleChatMode = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setChatMode(!chatMode);
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
      addMessage('assistant', 'Connection error. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTextCommand = async (text: string) => {
    await sendToAI(text);
  };

  const handleVoiceCommand = async (audioUri: string) => {
    addMessage('user', 'Voice message...');
    setIsProcessing(true);
    try {
      const history = [...messages].reverse().map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const result = await chatApi.voiceSend(audioUri, history, aiModel);
      if (result.success && result.data) {
        setMessages((prev) => {
          const updated = [...prev];
          const lastUserIdx = updated.findIndex((m) => m.role === 'user');
          if (lastUserIdx !== -1 && updated[lastUserIdx].content === 'Voice message...') {
            updated[lastUserIdx] = { ...updated[lastUserIdx], content: result.data!.transcript };
          }
          return updated;
        });
        addMessage('assistant', result.data.reply);
      } else {
        addMessage('assistant', result.error || 'Failed to process voice message.');
      }
    } catch (error) {
      addMessage('assistant', 'Connection error. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSend = async () => {
    if (items.length === 0) return;
    if (!isAuthenticated) {
      toast.warning('Please login to upload memos');
      router.push('/auth/login' as any);
      return;
    }
    setUploading(true);
    try {
      const result = await uploadBufferItems(items);
      if (result.success) {
        toast.success(`${result.results.length} items uploaded!`);
        clearBuffer();
      } else {
        const successCount = result.results.length;
        const errorCount = result.errors.length;
        if (successCount > 0) {
          toast.warning(`${successCount} uploaded, ${errorCount} errors`);
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
      <View style={{ paddingHorizontal: 16, marginBottom: 12, alignItems: isUser ? 'flex-end' : 'flex-start' }}>
        <View
          style={{
            borderRadius: 16,
            paddingHorizontal: 14,
            paddingVertical: 10,
            maxWidth: '80%',
            backgroundColor: isUser ? colors.accentContainer : colors.background2,
          }}
        >
          <Text style={{ color: colors.primary, fontSize: 15 }}>
            {item.content}
          </Text>
        </View>
        <Text style={{ color: colors.tertiary, fontSize: 11, marginTop: 4, paddingHorizontal: 4 }}>
          {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  const bufferCount = items.length;

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background1 }}>
      <View className="flex-1">
        {chatMode ? (
          /* ====== CHAT MODE ====== */
          <View className="flex-1">
            {/* Chat header */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 20,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <Sparkles size={22} color={colors.accent} />
              <Text style={{ fontSize: 18, fontWeight: '600', color: colors.primary, marginLeft: 10, flex: 1 }}>
                AI Assistant
              </Text>
              <TouchableOpacity onPress={toggleChatMode}>
                <X size={22} color={colors.secondary} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={messages}
              renderItem={renderChatMessage}
              keyExtractor={(item) => item.id}
              inverted
              className="flex-1"
              contentContainerStyle={{ paddingVertical: 8 }}
              ListEmptyComponent={
                <View className="flex-1 items-center justify-center py-20">
                  <Sparkles size={48} color={colors.border} strokeWidth={1} />
                  <Text style={{ color: colors.tertiary, fontSize: 15, marginTop: 12 }}>
                    Ask me anything
                  </Text>
                </View>
              }
            />

            <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
              <ChatInput
                onSubmitText={handleTextCommand}
                onSubmitVoice={handleVoiceCommand}
                isProcessing={isProcessing}
              />
            </View>
          </View>
        ) : (
          /* ====== NORMAL MODE ====== */
          <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
            {/* Capture Grid — Phantom style action buttons */}
            <View
              style={{
                marginHorizontal: 16,
                marginTop: 16,
                backgroundColor: colors.background2,
                borderRadius: 20,
                padding: 10,
                gap: 10,
              }}
            >
              {/* Row 1 */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {captureOptions.slice(0, 4).map((option) => {
                  const types = buttonToMemoTypes[option.id] || [];
                  const count = types.reduce(
                    (sum, t) => sum + items.filter((i) => i.type === t).length,
                    0,
                  );
                  return (
                    <TouchableOpacity
                      key={option.id}
                      onPress={() => option.id === 'ai' ? toggleChatMode() : handleCapture(option.route!)}
                      disabled={isUploading}
                      activeOpacity={0.7}
                      style={{
                        flex: 1,
                        aspectRatio: 1,
                        borderRadius: 16,
                        backgroundColor: colors.surfaceVariant,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {React.cloneElement(option.icon as React.ReactElement<any>, {
                        size: 24,
                        color: option.color,
                        strokeWidth: 1.8,
                      })}
                      <Text style={{ fontSize: 10, fontWeight: '500', color: colors.secondary, marginTop: 6 }}>
                        {option.label}
                      </Text>
                      {count > 0 && (
                        <View
                          style={{
                            position: 'absolute',
                            top: 4,
                            right: 4,
                            minWidth: 18,
                            height: 18,
                            borderRadius: 9,
                            backgroundColor: colors.accent,
                            alignItems: 'center',
                            justifyContent: 'center',
                            paddingHorizontal: 3,
                          }}
                        >
                          <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '700' }}>
                            {count}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
              {/* Row 2 */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {captureOptions.slice(4, 8).map((option) => {
                  const types = buttonToMemoTypes[option.id] || [];
                  const count = types.reduce(
                    (sum, t) => sum + items.filter((i) => i.type === t).length,
                    0,
                  );
                  return (
                    <TouchableOpacity
                      key={option.id}
                      onPress={() => option.id === 'ai' ? toggleChatMode() : handleCapture(option.route!)}
                      disabled={isUploading}
                      activeOpacity={0.7}
                      style={{
                        flex: 1,
                        aspectRatio: 1,
                        borderRadius: 16,
                        backgroundColor: colors.surfaceVariant,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {React.cloneElement(option.icon as React.ReactElement<any>, {
                        size: 24,
                        color: option.color,
                        strokeWidth: 1.8,
                      })}
                      <Text style={{ fontSize: 10, fontWeight: '500', color: colors.secondary, marginTop: 6 }}>
                        {option.label}
                      </Text>
                      {count > 0 && (
                        <View
                          style={{
                            position: 'absolute',
                            top: 4,
                            right: 4,
                            minWidth: 18,
                            height: 18,
                            borderRadius: 9,
                            backgroundColor: colors.accent,
                            alignItems: 'center',
                            justifyContent: 'center',
                            paddingHorizontal: 3,
                          }}
                        >
                          <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '700' }}>
                            {count}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Buffer chips */}
            {bufferCount > 0 && (
              <View
                style={{
                  marginTop: 12,
                  paddingHorizontal: 16,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.secondary, marginBottom: 12 }}>
                  Buffer ({bufferCount})
                </Text>
                <View>
                  {items.map((item, i) => {
                    const typeIndex = items.slice(0, i).filter((it) => it.type === item.type).length + 1;
                    return (
                      <MemoChip
                        key={item.id}
                        item={item}
                        index={typeIndex}
                        onRemove={() => removeItem(item.id)}
                        colors={colors}
                      />
                    );
                  })}
                </View>
                <View style={{ alignItems: 'flex-end', marginTop: 12 }}>
                  <TouchableOpacity
                    onPress={handleSend}
                    disabled={isUploading}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: colors.fabBg,
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 12,
                      gap: 6,
                      opacity: isUploading ? 0.6 : 1,
                    }}
                  >
                    <Send size={14} color={colors.onAccent} />
                    <Text style={{ color: colors.onAccent, fontSize: 13, fontWeight: '600' }}>
                      Upload
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        )}

        {/* Edit Modal */}
        <Modal
          visible={editingItem !== null}
          animationType="slide"
          statusBarTranslucent={false}
          onRequestClose={handleCloseEdit}
        >
          <SafeAreaWrapper edges={['top']}>
            <View className="flex-1" style={{ backgroundColor: colors.background1 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <TouchableOpacity onPress={handleCloseEdit} style={{ padding: 8 }}>
                  <X size={24} color={colors.secondary} />
                </TouchableOpacity>
                <Text style={{ color: colors.primary, fontSize: 18, fontWeight: '600' }}>
                  {editingItem?.type === 'text' ? 'Edit text' : 'Preview'}
                </Text>
                {editingItem?.type === 'text' ? (
                  <TouchableOpacity onPress={handleSaveEdit} style={{ padding: 8 }}>
                    <Save size={24} color={colors.accent} />
                  </TouchableOpacity>
                ) : (
                  <View style={{ width: 40 }} />
                )}
              </View>

              <View className="flex-1 p-4" style={{ paddingBottom: insets.bottom + 16 }}>
                {editingItem?.type === 'text' ? (
                  <TextInput
                    style={{
                      flex: 1,
                      textAlignVertical: 'top',
                      backgroundColor: colors.surfaceVariant,
                      color: colors.primary,
                      fontSize: 16,
                      borderRadius: 16,
                      padding: 16,
                    }}
                    multiline
                    value={editText}
                    onChangeText={setEditText}
                    placeholder="Type here..."
                    placeholderTextColor={colors.tertiary}
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
                    <Text style={{ color: colors.tertiary }}>
                      Preview not available
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </SafeAreaWrapper>
        </Modal>
      </View>
    </View>
  );
}
