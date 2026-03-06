import React, { useState } from 'react';
import { View, TextInput, Pressable, Text, ActivityIndicator } from 'react-native';
import { Mic, Send, Square } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '@/store';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { useThemeColors } from '@/lib/theme';

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
  const colors = useThemeColors();
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
          height: 56,
          borderRadius: 16,
          paddingHorizontal: 20,
          backgroundColor: colors.surfaceVariant,
          opacity: 0.7,
        }}
      >
        <ActivityIndicator size="small" color={colors.accent} />
        <Text style={{ flex: 1, marginLeft: 12, color: colors.tertiary }}>
          Processing...
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
          height: 56,
          borderRadius: 16,
          paddingHorizontal: 20,
          backgroundColor: colors.surfaceVariant,
          borderWidth: 2,
          borderColor: colors.error,
        }}
      >
        <View
          style={{
            width: 10,
            height: 10,
            backgroundColor: colors.error,
            borderRadius: 5,
          }}
        />
        <Text style={{ flex: 1, marginLeft: 12, color: colors.secondary }}>
          Listening...
        </Text>
        <Pressable
          onPress={handleStopRecording}
          style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
        >
          <Square size={18} color={colors.error} fill={colors.error} />
        </Pressable>
      </View>
    );
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        height: 56,
        borderRadius: 16,
        paddingHorizontal: 16,
        backgroundColor: colors.surfaceVariant,
      }}
    >
      <TextInput
        style={{
          flex: 1,
          fontSize: 16,
          color: colors.primary,
          marginHorizontal: 8,
        }}
        placeholder={placeholder}
        placeholderTextColor={colors.tertiary}
        value={text}
        onChangeText={setText}
        onSubmitEditing={handleSubmit}
        returnKeyType="send"
      />

      {hasText ? (
        <Pressable
          onPress={handleSubmit}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Send size={18} color={colors.onAccent} />
        </Pressable>
      ) : (
        <Pressable
          onPress={handleStartRecording}
          style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
        >
          <Mic size={22} color={colors.secondary} />
        </Pressable>
      )}
    </View>
  );
}

export default ChatInput;
