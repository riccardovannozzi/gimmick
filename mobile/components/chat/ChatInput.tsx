import React, { useState } from 'react';
import { View, TextInput, Pressable, Text, ActivityIndicator } from 'react-native';
import { MessageCircle, Mic, Send, Square } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '@/store';
import { colors } from '@/constants';

interface ChatInputProps {
  onSubmitText: (text: string) => void;
  onVoiceResult: (audioUri: string, transcription?: string) => void;
  isProcessing?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSubmitText,
  onVoiceResult,
  isProcessing = false,
  placeholder = 'Ask something...',
}: ChatInputProps) {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const hapticFeedback = useSettingsStore((state) => state.hapticFeedback);

  const handleStartRecording = async () => {
    try {
      if (hapticFeedback) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      setIsRecording(true);
      // TODO: Implement real recording
    } catch (error) {
      console.error('Recording start error:', error);
    }
  };

  const handleStopRecording = async () => {
    try {
      if (hapticFeedback) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      setIsRecording(false);
      // TODO: Implement stop and callback
      onVoiceResult('mock-uri');
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

  // Stato: Processing
  if (isProcessing) {
    return (
      <View
        className="flex-row items-center rounded-2xl px-4 h-[104px] border"
        style={{
          backgroundColor: colors.background2,
          borderColor: colors.border,
          opacity: 0.7,
        }}
      >
        <ActivityIndicator size="small" color={colors.accent} />
        <Text className="flex-1 mx-3" style={{ color: colors.secondary }}>
          Processing...
        </Text>
      </View>
    );
  }

  // Stato: Recording
  if (isRecording) {
    return (
      <View
        className="flex-row items-center rounded-2xl px-4 h-[104px] border"
        style={{
          backgroundColor: colors.background2,
          borderColor: colors.error,
        }}
      >
        <View
          style={{
            width: 12,
            height: 12,
            backgroundColor: colors.error,
            borderRadius: 6,
          }}
        />
        <Text className="flex-1 mx-3" style={{ color: colors.secondary }}>
          Listening...
        </Text>
        <Pressable
          onPress={handleStopRecording}
          className="w-8 h-8 items-center justify-center"
        >
          <Square size={20} color={colors.error} fill={colors.error} />
        </Pressable>
      </View>
    );
  }

  // Stato: Idle / Typing
  return (
    <View
      className="flex-row items-center rounded-2xl px-4 h-[104px] border"
      style={{
        backgroundColor: colors.background2,
        borderColor: colors.border,
      }}
    >
      <MessageCircle size={20} color={colors.secondary} />

      <TextInput
        className="flex-1 mx-3 text-base"
        style={{ color: colors.primary }}
        placeholder={placeholder}
        placeholderTextColor="#6B7280"
        value={text}
        onChangeText={setText}
        onSubmitEditing={handleSubmit}
        returnKeyType="send"
        editable={!isProcessing}
      />

      {hasText ? (
        <Pressable
          onPress={handleSubmit}
          className="w-8 h-8 items-center justify-center"
        >
          <Send size={20} color={colors.accent} />
        </Pressable>
      ) : (
        <Pressable
          onPress={handleStartRecording}
          className="w-8 h-8 items-center justify-center"
        >
          <Mic size={20} color={colors.secondary} />
        </Pressable>
      )}
    </View>
  );
}

export default ChatInput;
