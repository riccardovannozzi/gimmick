import React, { useState } from 'react';
import { View, Pressable, Text, ActivityIndicator } from 'react-native';
import { IconMicrophone, IconSend, IconSquare } from '@tabler/icons-react-native';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '@/store';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { usePixelTheme, PixelTextInput } from '@/components/pixel';

interface ChatInputProps {
  onSubmitText: (text: string) => void;
  onSubmitVoice: (audioUri: string) => void;
  isProcessing?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSubmitText,
  onSubmitVoice,
  isProcessing = false,
  placeholder = 'Type a message...',
}: ChatInputProps) {
  const theme = usePixelTheme();
  const [text, setText] = useState('');
  const hapticFeedback = useSettingsStore((state) => state.hapticFeedback);
  const { isRecording, startRecording, stopRecording } = useVoiceRecorder();

  const handleStartRecording = async () => {
    try {
      if (hapticFeedback) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      await startRecording();
    } catch (error) {
      console.error('Recording start error:', error);
    }
  };

  const handleStopRecording = async () => {
    try {
      if (hapticFeedback) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      const uri = await stopRecording();
      if (uri) {
        onSubmitVoice(uri);
      }
    } catch (error) {
      console.error('Recording stop error:', error);
    }
  };

  const handleSubmit = async () => {
    if (text.trim()) {
      if (hapticFeedback) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      onSubmitText(text.trim());
      setText('');
    }
  };

  const hasText = text.trim().length > 0;

  if (isProcessing) {
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          height: 48,
          paddingHorizontal: 14,
          borderWidth: 2,
          borderColor: theme.border,
          backgroundColor: theme.surface,
          opacity: 0.8,
        }}
      >
        <ActivityIndicator size="small" color={theme.accent as string} />
        <Text
          style={{
            flex: 1,
            marginLeft: 10,
            fontFamily: theme.fontHead,
            fontSize: 9,
            color: theme.ink2,
            letterSpacing: 1,
          }}
        >
          PROCESSING...
        </Text>
      </View>
    );
  }

  if (isRecording) {
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          height: 48,
          paddingHorizontal: 14,
          borderWidth: 2,
          borderColor: theme.cap.voice,
          backgroundColor: theme.surface,
        }}
      >
        <View
          style={{
            width: 10,
            height: 10,
            backgroundColor: theme.cap.voice,
          }}
        />
        <Text
          style={{
            flex: 1,
            marginLeft: 10,
            fontFamily: theme.fontHead,
            fontSize: 9,
            color: theme.cap.voice,
            letterSpacing: 1,
          }}
        >
          LISTENING...
        </Text>
        <Pressable
          onPress={handleStopRecording}
          style={({ pressed }) => ({
            width: 32,
            height: 32,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <IconSquare size={16} color={theme.cap.voice} fill={theme.cap.voice} />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ flex: 1 }}>
        <PixelTextInput
          theme={theme}
          placeholder={placeholder}
          value={text}
          onChangeText={setText}
          onSubmitEditing={handleSubmit}
          returnKeyType="send"
        />
      </View>
      {hasText ? (
        <Pressable
          onPress={handleSubmit}
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderWidth: 2,
            borderColor: theme.border,
            backgroundColor: theme.accent,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <IconSend size={16} color={theme.onAccent as string} strokeWidth={2.2} />
        </Pressable>
      ) : (
        <Pressable
          onPress={handleStartRecording}
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderWidth: 2,
            borderColor: theme.border,
            backgroundColor: theme.surface,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <IconMicrophone size={18} color={theme.ink} strokeWidth={2} />
        </Pressable>
      )}
    </View>
  );
}

export default ChatInput;
