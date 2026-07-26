import React, { useState } from 'react';
import { ObsidianCaptureScreenLive } from '@/components/obsidian';
import { isObsidianShellEnabled } from '@/lib/feature-flags';
import {
  View,
  Text,
  Modal,
  Image as RNImage,
  TextInput,
  Pressable,
  FlatList,
  ScrollView,
  LayoutAnimation,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  IconX,
  IconSend,
  IconCamera,
  IconVideo,
  IconPhoto,
  IconEdit,
  IconMicrophone,
  IconPaperclip,
  IconSparkles,
  IconCheck,
} from '@tabler/icons-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaWrapper } from '@/components/layout/SafeAreaWrapper';
import { ChatInput } from '@/components/chat/ChatInput';
import { SetOptionsAccordion, EMPTY_OPTIONS, type TileOptions } from '@/components/SetOptionsAccordion';
import { useBufferStore, useAuthStore, useSettingsStore, toast } from '@/store';
import { uploadBufferItems, chatApi } from '@/lib/api';
import { useThemeColors } from '@/lib/theme';
import {
  usePixelTheme,
  PixelCard,
  PixelButton,
  PixelBadge,
  PixelIconButton,
  PixelBackground,
  ShadowLayer,
} from '@/components/pixel';
import { hexWithAlpha, type CaptureKey } from '@/constants/pixel-theme';
import { formatFileSize, formatDuration } from '@/utils/formatters';
import type { BufferItem, SparkType } from '@/types';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
};

let msgCounter = 0;

const buttonToSparkTypes: Record<string, SparkType[]> = {
  photo: ['photo'],
  video: ['video'],
  gallery: ['image'],
  text: ['text'],
  voice: ['audio_recording'],
  file: ['file'],
};

type CaptureOption = {
  id: CaptureKey;
  label: string;
  Icon: typeof IconCamera;
  route: string;
};

/**
 * Disposizione della griglia di cattura, una riga per array.
 *
 * Non è un semplice wrap a 3 colonne: la larghezza dei pulsanti esprime la
 * gerarchia dei canali. Text occupa da solo la prima riga perché è la cattura
 * più frequente e quella che non dipende da permessi o hardware; seguono i tre
 * canali di registrazione dal vivo; in fondo i due di importazione, che
 * partono da contenuto già esistente.
 */
const CAPTURE_ROWS: CaptureKey[][] = [
  ['text'],
  ['photo', 'video', 'voice'],
  ['gallery', 'file'],
];

const captureOptions: CaptureOption[] = [
  { id: 'photo',   label: 'PHOTO',   Icon: IconCamera,     route: '/capture/photo' },
  { id: 'video',   label: 'VIDEO',   Icon: IconVideo,      route: '/capture/video' },
  { id: 'gallery', label: 'IMAGE', Icon: IconPhoto,      route: '/capture/gallery' },
  { id: 'text',    label: 'TEXT',    Icon: IconEdit,       route: '/capture/text' },
  { id: 'voice',   label: 'REC',     Icon: IconMicrophone, route: '/capture/voice' },
  { id: 'file',    label: 'FILE',    Icon: IconPaperclip,  route: '/capture/file' },
];

function sparkToCaptureKey(type: SparkType): CaptureKey {
  switch (type) {
    case 'photo':
      return 'photo';
    // Gli spark 'image' appartengono al canale IMAGE, non a PHOTO: prima
    // finivano qui e venivano colorati come foto pur essendo contati sotto
    // IMAGE da `buttonToSparkTypes`, quindi lo stesso item compariva sotto due
    // identità diverse nella stessa schermata.
    case 'image':
      return 'gallery';
    case 'video':
      return 'video';
    case 'text':
      return 'text';
    case 'audio_recording':
      return 'voice';
    case 'file':
      return 'file';
    default:
      return 'text';
  }
}

function typeLabel(type: SparkType): string {
  switch (type) {
    case 'photo': return 'PHOTO';
    case 'image': return 'IMAGE';
    case 'video': return 'VIDEO';
    case 'audio_recording': return 'REC';
    case 'text': return 'TEXT';
    case 'file': return 'FILE';
    default: return 'ITEM';
  }
}

function PixelSparkChip({
  item, onRemove, onPress,
}: { item: BufferItem; onRemove: () => void; onPress?: () => void }) {
  const theme = usePixelTheme();
  const capKey = sparkToCaptureKey(item.type);
  const accentColor = theme.cap[capKey];
  const isMedia = item.type === 'photo' || item.type === 'image' || item.type === 'video';
  const isText = item.type === 'text';

  const getDetails = (): string => {
    if (isText) return item.preview || '';
    if (item.type === 'audio_recording') {
      return [
        item.duration ? formatDuration(item.duration) : null,
        item.size ? formatFileSize(item.size) : null,
      ].filter(Boolean).join(' · ');
    }
    if (isMedia) {
      const dur = item.duration
        ? formatDuration(item.duration < 1000 ? item.duration * 1000 : item.duration)
        : null;
      return [
        item.fileName,
        dur,
        item.width && item.height ? `${item.width}×${item.height}` : null,
        item.size ? formatFileSize(item.size) : null,
      ].filter(Boolean).join(' · ');
    }
    if (item.type === 'file') {
      return [item.fileName, item.size ? formatFileSize(item.size) : null]
        .filter(Boolean).join(' · ');
    }
    return '';
  };

  const details = getDetails();

  return (
    <View style={{ marginBottom: 10 }}>
      <PixelCard theme={theme} bg={theme.surface} style={{ padding: 10 }}>
        <Pressable onPress={onPress} android_ripple={null}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: isMedia || details ? 8 : 0 }}>
            <PixelBadge theme={theme} label={typeLabel(item.type)} bg={accentColor} color={theme.onAccent} />
            <Pressable
              onPress={onRemove}
              android_ripple={null}
              style={({ pressed }) => ({
                width: 26, height: 26,
                borderWidth: 2, borderColor: theme.border,
                backgroundColor: theme.surfaceVariant,
                alignItems: 'center', justifyContent: 'center',
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <IconX size={14} color={theme.ink} strokeWidth={2.5} />
            </Pressable>
          </View>

          {isMedia && item.uri && (
            <View style={{ borderWidth: 2, borderColor: theme.border, marginBottom: details ? 8 : 0 }}>
              <RNImage
                source={{ uri: item.thumbnail ?? item.uri }}
                style={{ width: '100%', height: 160 }}
                resizeMode="cover"
              />
            </View>
          )}

          {details ? (
            <Text
              numberOfLines={4}
              style={{ color: theme.ink, fontFamily: theme.fontBody, fontSize: 13, lineHeight: 18 }}
            >
              {details}
            </Text>
          ) : null}
        </Pressable>
      </PixelCard>
    </View>
  );
}

export default function HomeRoute() {
  if (isObsidianShellEnabled()) return <ObsidianCaptureScreenLive />;
  return <HomeScreenLegacy />;
}

function HomeScreenLegacy() {
  const theme = usePixelTheme();
  const colors = useThemeColors(); // ancora usato dai sub-component legacy
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // La griglia di cattura usa `flex: 1` per pulsante, quindi non serve più
  // calcolare a mano la dimensione delle tile né riservare spazio all'ombra
  // pixel sporgente: i pulsanti Obsidian sono piatti e si dividono la riga.
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
  const [setOptionsOpen, setSetOptionsOpen] = useState(false);
  const [tileOptions, setTileOptions] = useState<TileOptions>(EMPTY_OPTIONS);

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
      toast.warning('Please login to upload sparks');
      router.push('/auth/login' as any);
      return;
    }
    setUploading(true);
    try {
      const tagIds = tileOptions.tag_id ? [tileOptions.tag_id] : undefined;
      const result = await uploadBufferItems(items, tagIds, tileOptions);
      if (result.success) {
        toast.success(`${result.results.length} items uploaded!`);
        clearBuffer();
        setTileOptions(EMPTY_OPTIONS);
        setSetOptionsOpen(false);
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
      <View style={{ paddingHorizontal: 16, marginBottom: 10, alignItems: isUser ? 'flex-end' : 'flex-start' }}>
        <View style={{ maxWidth: '82%' }}>
          <ShadowLayer theme={theme}>
            <View
              style={{
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderWidth: 2,
                borderColor: theme.border,
                backgroundColor: isUser ? theme.accent : theme.surface,
              }}
            >
              <Text
                style={{
                  color: isUser ? theme.onAccent : theme.ink,
                  fontFamily: theme.fontBody,
                  fontSize: 14,
                  lineHeight: 19,
                }}
              >
                {item.content}
              </Text>
            </View>
          </ShadowLayer>
        </View>
        <Text
          style={{
            color: theme.ink3,
            fontFamily: theme.fontBody,
            fontSize: 10,
            marginTop: 4,
            paddingHorizontal: 4,
          }}
        >
          {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  const bufferCount = items.length;

  return (
    <PixelBackground theme={theme}>
      <View style={{ flex: 1 }}>
        {chatMode ? (
          /* ====== CHAT MODE ====== */
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            // Offset = altezza TopNav (insets.top + paddingTop 10 + riga icone ~32 + paddingBottom 8 + border 2)
            keyboardVerticalOffset={insets.top + 52}
          >
            {/* Chat header */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderBottomWidth: 2,
                borderBottomColor: theme.border,
                gap: 10,
              }}
            >
              <IconSparkles size={20} color={theme.accent} strokeWidth={2} />
              <Text
                style={{
                  fontFamily: theme.fontHead,
                  fontSize: 12,
                  color: theme.ink,
                  letterSpacing: 1.2,
                  flex: 1,
                }}
              >
                AI ASSISTANT
              </Text>
              <PixelIconButton
                theme={theme}
                onPress={toggleChatMode}
                bg={theme.semantic.danger}
              >
                <IconX size={22} color="#FFFFFF" strokeWidth={2.4} />
              </PixelIconButton>
            </View>

            <FlatList
              data={messages}
              renderItem={renderChatMessage}
              keyExtractor={(item) => item.id}
              inverted
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingVertical: 12 }}
              ListEmptyComponent={
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 }}>
                  <IconSparkles size={48} color={theme.ink3} strokeWidth={1} />
                  <Text
                    style={{
                      color: theme.ink2,
                      fontFamily: theme.fontHead,
                      fontSize: 10,
                      marginTop: 14,
                      letterSpacing: 1,
                    }}
                  >
                    ASK ME ANYTHING
                  </Text>
                </View>
              }
            />

            <View style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 8 }}>
              <ChatInput
                onSubmitText={handleTextCommand}
                onSubmitVoice={handleVoiceCommand}
                isProcessing={isProcessing}
              />
            </View>
          </KeyboardAvoidingView>
        ) : (
          /* ====== NORMAL MODE ====== */
          <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
          >
            <View style={{ marginHorizontal: 16, marginTop: 16, gap: 10 }}>
              {/* ASK / SEND GIMMICK — top action button. When the buffer is
                  empty the button opens the chat (ASK GIMMICK); as soon as
                  the user captures something, the same button switches to
                  SEND to GIMMICK and triggers the buffer upload. */}
              <PixelButton
                theme={theme}
                big
                full
                bg={bufferCount > 0 ? theme.semantic.success : theme.ink}
                color={bufferCount > 0 ? theme.onAccent : theme.bg1}
                label={
                  bufferCount > 0
                    ? `SEND TO GIMMICK (${bufferCount})`
                    : 'ASK GIMMICK'
                }
                leading={
                  bufferCount > 0 ? (
                    <IconSend
                      size={18}
                      color={theme.onAccent as string}
                      strokeWidth={2.4}
                    />
                  ) : (
                    <Text
                      style={{
                        fontFamily: theme.fontHead,
                        fontSize: 12,
                        color: theme.bg1 as string,
                      }}
                    >
                      ▶
                    </Text>
                  )
                }
                onPress={bufferCount > 0 ? handleSend : toggleChatMode}
                style={
                  bufferCount > 0 && isUploading ? { opacity: 0.5 } : undefined
                }
              />

              {/* Capture grid — righe a larghezza variabile (vedi CAPTURE_ROWS) */}
              {CAPTURE_ROWS.map((row, rowIdx) => (
                <View key={rowIdx} style={{ flexDirection: 'row', gap: 8 }}>
                  {row.map((id) => {
                    const option = captureOptions.find((o) => o.id === id);
                    if (!option) return null;
                    const types = buttonToSparkTypes[option.id] || [];
                    const count = types.reduce(
                      (sum, t) => sum + items.filter((i) => i.type === t).length,
                      0,
                    );
                    const accent = theme.cap[option.id];
                    const Icon = option.Icon;
                    return (
                      <Pressable
                        key={option.id}
                        onPress={() => handleCapture(option.route)}
                        disabled={isUploading}
                        android_ripple={null}
                        // `flex: 1` su ogni pulsante: le righe si dividono la
                        // larghezza disponibile, quindi una riga da uno dà un
                        // pulsante pieno e una da tre pulsanti in terzi, senza
                        // calcoli di dimensione.
                        style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.85 : 1 })}
                      >
                        <View
                          style={{
                            height: 46,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 7,
                            paddingHorizontal: 10,
                            borderRadius: 10,
                            borderWidth: 1,
                            borderColor: theme.border,
                            backgroundColor: theme.surfaceVariant,
                          }}
                        >
                          <Icon size={17} color={accent} strokeWidth={1.8} />
                          <Text
                            numberOfLines={1}
                            style={{
                              fontFamily: theme.fontHead,
                              fontSize: 12,
                              color: theme.ink,
                              letterSpacing: 0.2,
                            }}
                          >
                            {option.label}
                          </Text>
                          {/* Contatore in linea, non più a badge sovrapposto:
                              su un pulsante basso e largo un badge d'angolo
                              verrebbe tagliato dal borderRadius. */}
                          {count > 0 && (
                            <PixelBadge
                              theme={theme}
                              label={String(count)}
                              bg={accent}
                              color={theme.onAccent}
                            />
                          )}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ))}

              {/* "Set options" — toggles an accordion below where the user can
                  pre-set tile metadata (Action / Date / Tag / Type / Status)
                  before the buffer is uploaded. Visible only when the buffer
                  has content. */}
              {bufferCount > 0 && (
                <PixelButton
                  theme={theme}
                  full
                  bg={theme.surface}
                  label={setOptionsOpen ? 'SET OPTIONS  ▲' : 'SET OPTIONS  ▼'}
                  onPress={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setSetOptionsOpen((v) => !v);
                  }}
                />
              )}
              {bufferCount > 0 && setOptionsOpen && (
                <SetOptionsAccordion
                  colors={colors}
                  options={tileOptions}
                  onChange={setTileOptions}
                />
              )}
            </View>

            {/* Buffer chips */}
            {bufferCount > 0 && (
              <View style={{ marginTop: 16, paddingHorizontal: 16 }}>
                <Text
                  style={{
                    fontFamily: theme.fontHead,
                    fontSize: 10,
                    color: theme.ink2,
                    letterSpacing: 1.2,
                    marginBottom: 10,
                  }}
                >
                  BUFFER ({bufferCount})
                </Text>
                <View>
                  {[...items].reverse().map((item) => (
                    <PixelSparkChip
                      key={item.id}
                      item={item}
                      onRemove={() => removeItem(item.id)}
                      onPress={() => {
                        setEditingItem(item);
                        if (item.type === 'text') setEditText(item.preview || '');
                      }}
                    />
                  ))}
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
              style={{ flex: 1, backgroundColor: theme.bg1 }}
            >
              {/* Header */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderBottomWidth: 2,
                  borderBottomColor: theme.border,
                }}
              >
                <PixelIconButton
                  theme={theme}
                  onPress={handleCloseEdit}
                  size={48}
                  bg={theme.semantic.danger}
                >
                  <IconX size={22} color="#FFFFFF" strokeWidth={2.4} />
                </PixelIconButton>

                <Text
                  style={{
                    fontFamily: theme.fontHead,
                    fontSize: 11,
                    color: theme.ink,
                    letterSpacing: 1.2,
                  }}
                >
                  {editingItem?.type === 'text' ? 'EDIT NOTE' : 'PREVIEW'}
                </Text>

                {editingItem?.type === 'text' ? (
                  <PixelIconButton
                    theme={theme}
                    onPress={handleSaveEdit}
                    size={48}
                    bg={editText.trim() ? theme.semantic.success : theme.surfaceVariant}
                    disabled={!editText.trim()}
                  >
                    <IconCheck
                      size={22}
                      color={editText.trim() ? '#FFFFFF' : theme.ink3}
                      strokeWidth={2.4}
                    />
                  </PixelIconButton>
                ) : (
                  <View style={{ width: 48 }} />
                )}
              </View>

              {/* Content */}
              <View style={{ flex: 1, padding: 16 }}>
                {editingItem?.type === 'text' ? (
                  <View
                    style={{
                      flex: 1,
                      borderWidth: 2,
                      borderColor: theme.border,
                      backgroundColor: theme.surface,
                      padding: 12,
                    }}
                  >
                    <TextInput
                      style={{
                        flex: 1,
                        textAlignVertical: 'top',
                        color: theme.ink,
                        fontFamily: theme.fontBody,
                        fontSize: 16,
                        lineHeight: 24,
                      }}
                      multiline
                      value={editText}
                      onChangeText={setEditText}
                      placeholder="Write your note..."
                      placeholderTextColor={hexWithAlpha(theme.ink2, 0.6)}
                      autoFocus
                    />
                  </View>
                ) : editingItem?.type === 'photo' ||
                  editingItem?.type === 'image' ||
                  editingItem?.type === 'video' ? (
                  <View
                    style={{
                      flex: 1,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 2,
                      borderColor: theme.border,
                      backgroundColor: theme.surface,
                    }}
                  >
                    <RNImage
                      source={{ uri: editingItem.uri }}
                      style={{ width: '100%', height: '100%' }}
                      resizeMode="contain"
                    />
                  </View>
                ) : (
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <Text
                      style={{
                        color: theme.ink3,
                        fontFamily: theme.fontHead,
                        fontSize: 10,
                        letterSpacing: 1,
                      }}
                    >
                      PREVIEW NOT AVAILABLE
                    </Text>
                  </View>
                )}
              </View>

              {/* Footer */}
              {editingItem?.type === 'text' && (
                <View
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderTopWidth: 2,
                    borderTopColor: theme.border,
                  }}
                >
                  <Text
                    style={{
                      color: theme.ink2,
                      fontFamily: theme.fontHead,
                      fontSize: 9,
                      letterSpacing: 1,
                      textAlign: 'right',
                    }}
                  >
                    {editText.length} CHARS
                  </Text>
                </View>
              )}
            </KeyboardAvoidingView>
          </SafeAreaWrapper>
        </Modal>
      </View>
    </PixelBackground>
  );
}
