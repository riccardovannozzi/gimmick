import React, { useState, useEffect } from 'react';
import PdfThumbnail from 'react-native-pdf-thumbnail';
import { View, Text, Modal, Image as RNImage, TextInput, TouchableOpacity, FlatList, ScrollView, LayoutAnimation, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { X, Save, Send, Mic, Camera, Video, Images, PenSquare, Paperclip, Sparkles, Check } from 'lucide-react-native';
import { SafeAreaWrapper } from '@/components/layout/SafeAreaWrapper';
import { ChatInput } from '@/components/chat/ChatInput';
import { useBufferStore, useAuthStore, useSettingsStore, toast } from '@/store';
import { uploadBufferItems, chatApi } from '@/lib/api';
import { captureColors, captureColorsBg } from '@/constants/colors';
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
  { id: 'photo', label: 'PHOTO', icon: <Camera />, color: captureColors.photo, bg: captureColorsBg.photo, route: '/capture/photo' },
  { id: 'video', label: 'VIDEO', icon: <Video />, color: captureColors.video, bg: captureColorsBg.video, route: '/capture/video' },
  { id: 'gallery', label: 'GALLERY', icon: <Images />, color: captureColors.gallery, bg: captureColorsBg.gallery, route: '/capture/gallery' },
  { id: 'text', label: 'TEXT', icon: <PenSquare />, color: captureColors.text, bg: captureColorsBg.text, route: '/capture/text' },
  { id: 'voice', label: 'VOICE', icon: <Mic />, color: captureColors.voice, bg: captureColorsBg.voice, route: '/capture/voice' },
  { id: 'file', label: 'FILE', icon: <Paperclip />, color: captureColors.file, bg: captureColorsBg.file, route: '/capture/file' },
] as const;

function MemoChip({ item, index, onRemove, onPress, colors }: { item: BufferItem; index: number; onRemove: () => void; onPress?: () => void; colors: any }) {
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
  const isPdf = item.type === 'file' && item.mimeType === 'application/pdf';
  const [pdfThumb, setPdfThumb] = useState<string | null>(null);

  useEffect(() => {
    if (isPdf && item.uri) {
      PdfThumbnail.generate(item.uri, 0)
        .then((result) => setPdfThumb(result.uri))
        .catch(() => {});
    }
  }, [isPdf, item.uri]);

  const getSecondLine = () => {
    if (isText) return item.preview || '';
    if (item.type === 'audio_recording') {
      return [item.duration ? formatDuration(item.duration) : null, item.size ? formatFileSize(item.size) : null].filter(Boolean).join(' · ') || '';
    }
    if (isMedia) {
      const dur = item.duration
        ? formatDuration(item.duration < 1000 ? item.duration * 1000 : item.duration)
        : null;
      return [item.fileName, dur, item.width && item.height ? `${item.width}×${item.height}` : null, item.size ? formatFileSize(item.size) : null].filter(Boolean).join(' · ') || '';
    }
    if (item.type === 'file') {
      return [item.fileName, item.size ? formatFileSize(item.size) : null].filter(Boolean).join(' · ') || '';
    }
    return getDetails(item);
  };

  if (isMedia && item.uri) {
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onPress}
        style={{
          backgroundColor: colors.surfaceVariant,
          borderRadius: 12,
          marginBottom: 8,
          paddingHorizontal: 14,
          paddingVertical: 12,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: chipColor, fontSize: 12, fontWeight: '700' }}>
            {getTypeLabel(item.type)}
          </Text>
          <TouchableOpacity
            onPress={onRemove}
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: `${colors.tertiary}20`,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={14} color={colors.secondary} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
        <RNImage
          source={{ uri: item.thumbnail ?? item.uri }}
          style={{ width: '100%', height: 160, borderRadius: 10, marginTop: 8 }}
          resizeMode="cover"
        />
        {(getSecondLine() || item.type === 'video') ? (
          <Text
            numberOfLines={2}
            style={{ color: '#FFFFFF', fontSize: 15, marginTop: 8 }}
          >
            {getSecondLine() || `${item.duration ? formatDuration(item.duration) : 'Video'}`}
          </Text>
        ) : null}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={{
        backgroundColor: colors.surfaceVariant,
        borderRadius: 12,
        marginBottom: 8,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 12,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: chipColor, fontSize: 12, fontWeight: '700' }}>
          {getTypeLabel(item.type)}
        </Text>
        {getSecondLine() ? (
          <Text
            numberOfLines={4}
            style={{ color: '#FFFFFF', fontSize: 15, marginTop: 4 }}
          >
            {getSecondLine()}
          </Text>
        ) : null}
      </View>
      <TouchableOpacity
        onPress={onRemove}
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: `${colors.tertiary}20`,
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: 8,
        }}
      >
        <X size={14} color={colors.secondary} strokeWidth={2.5} />
      </TouchableOpacity>
    </TouchableOpacity>
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
                gap: 10,
              }}
            >
              {/* Row 1 */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {captureOptions.slice(0, 3).map((option) => {
                  const types = buttonToMemoTypes[option.id] || [];
                  const count = types.reduce(
                    (sum, t) => sum + items.filter((i) => i.type === t).length,
                    0,
                  );
                  return (
                    <TouchableOpacity
                      key={option.id}
                      onPress={() => handleCapture(option.route)}
                      disabled={isUploading}
                      activeOpacity={0.7}
                      style={{
                        flex: 1,
                        aspectRatio: 1,
                        borderRadius: 16,
                        backgroundColor: option.bg,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {React.cloneElement(option.icon as React.ReactElement<any>, {
                        size: 42,
                        color: option.color,
                        strokeWidth: 1.4,
                      })}
                      <Text style={{ fontSize: 11, fontWeight: '600', color: '#FFFFFF', marginTop: 20, letterSpacing: 0.5 }}>
                        {option.label}
                      </Text>
                      {count > 0 && (
                        <View
                          style={{
                            position: 'absolute',
                            top: 6,
                            right: 6,
                            minWidth: 20,
                            height: 20,
                            borderRadius: 10,
                            backgroundColor: option.color,
                            alignItems: 'center',
                            justifyContent: 'center',
                            paddingHorizontal: 4,
                          }}
                        >
                          <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '700' }}>
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
                {captureOptions.slice(3, 6).map((option) => {
                  const types = buttonToMemoTypes[option.id] || [];
                  const count = types.reduce(
                    (sum, t) => sum + items.filter((i) => i.type === t).length,
                    0,
                  );
                  return (
                    <TouchableOpacity
                      key={option.id}
                      onPress={() => handleCapture(option.route)}
                      disabled={isUploading}
                      activeOpacity={0.7}
                      style={{
                        flex: 1,
                        aspectRatio: 1,
                        borderRadius: 16,
                        backgroundColor: option.bg,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {React.cloneElement(option.icon as React.ReactElement<any>, {
                        size: 42,
                        color: option.color,
                        strokeWidth: 1.4,
                      })}
                      <Text style={{ fontSize: 11, fontWeight: '600', color: '#FFFFFF', marginTop: 20, letterSpacing: 0.5 }}>
                        {option.label}
                      </Text>
                      {count > 0 && (
                        <View
                          style={{
                            position: 'absolute',
                            top: 6,
                            right: 6,
                            minWidth: 20,
                            height: 20,
                            borderRadius: 10,
                            backgroundColor: option.color,
                            alignItems: 'center',
                            justifyContent: 'center',
                            paddingHorizontal: 4,
                          }}
                        >
                          <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '700' }}>
                            {count}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
              {/* Ask AI button — same width as Voice, half height */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  onPress={toggleChatMode}
                  activeOpacity={0.7}
                  style={{
                    flex: 1,
                    borderRadius: 16,
                    backgroundColor: colors.background3,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    paddingVertical: 18,
                  }}
                >
                  <Sparkles size={22} color="#FFFFFF" strokeWidth={1.8} />
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.3 }}>
                    ASK GIMMICK
                  </Text>
                </TouchableOpacity>
                {bufferCount > 0 && (
                  <TouchableOpacity
                    onPress={handleSend}
                    disabled={isUploading}
                    activeOpacity={0.7}
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 28,
                      backgroundColor: colors.surfaceVariant,
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: isUploading ? 0.6 : 1,
                    }}
                  >
                    <Send size={22} color={colors.onAccent} />
                  </TouchableOpacity>
                )}
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
                  {[...items].reverse().map((item) => {
                    const sameType = items.filter((it) => it.type === item.type);
                    const typeIndex = sameType.indexOf(item) + 1;
                    return (
                      <MemoChip
                        key={item.id}
                        item={item}
                        index={typeIndex}
                        onRemove={() => removeItem(item.id)}
                        onPress={() => {
                          setEditingItem(item);
                          if (item.type === 'text') setEditText(item.preview || '');
                        }}
                        colors={colors}
                      />
                    );
                  })}
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
          <SafeAreaWrapper edges={['top', 'bottom']}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              className="flex-1"
              style={{ backgroundColor: colors.background1 }}
            >
              {/* Header */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <TouchableOpacity
                  onPress={handleCloseEdit}
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: colors.surfaceVariant,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <X size={26} color="#FFFFFF" />
                </TouchableOpacity>

                <Text style={{ fontSize: 20, fontWeight: '300', color: colors.secondary }}>
                  {editingItem?.type === 'text' ? 'Edit note' : 'Preview'}
                </Text>

                {editingItem?.type === 'text' ? (
                  <TouchableOpacity
                    onPress={handleSaveEdit}
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 28,
                      backgroundColor: editText.trim() ? '#22C55E' : colors.border,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Check size={26} color={editText.trim() ? '#fff' : colors.secondary} />
                  </TouchableOpacity>
                ) : (
                  <View style={{ width: 56 }} />
                )}
              </View>

              {/* Content */}
              <View className="flex-1 p-4">
                {editingItem?.type === 'text' ? (
                  <TextInput
                    style={{
                      flex: 1,
                      textAlignVertical: 'top',
                      color: colors.primary,
                      fontSize: 20,
                      lineHeight: 30,
                    }}
                    multiline
                    value={editText}
                    onChangeText={setEditText}
                    placeholder="Write your note..."
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
                    <Text style={{ color: colors.tertiary }}>
                      Preview not available
                    </Text>
                  </View>
                )}
              </View>

              {/* Footer */}
              {editingItem?.type === 'text' && (
                <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
                  <Text style={{ color: colors.secondary, fontSize: 13, textAlign: 'right' }}>
                    {editText.length} characters
                  </Text>
                </View>
              )}
            </KeyboardAvoidingView>
          </SafeAreaWrapper>
        </Modal>
      </View>
    </View>
  );
}
