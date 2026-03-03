import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { X, Check } from 'lucide-react-native';
import { SafeAreaWrapper } from '@/components/layout/SafeAreaWrapper';
import { useBufferStore, toast } from '@/store';
import { useThemeColors } from '@/lib/theme';

export default function TextCaptureScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const [text, setText] = useState('');
  const addItem = useBufferStore((state) => state.addItem);

  const handleClose = () => {
    router.back();
  };

  const handleSave = () => {
    if (!text.trim()) {
      toast.warning('Please enter some text');
      return;
    }

    addItem({
      type: 'text',
      uri: '', // Text doesn't have a URI
      preview: text,
    });

    toast.success('Note added to buffer');
    router.back();
  };

  const charCount = text.length;

  return (
    <SafeAreaWrapper edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
          <TouchableOpacity
            onPress={handleClose}
            className="w-10 h-10 items-center justify-center"
          >
            <X size={24} color={colors.secondary} />
          </TouchableOpacity>

          <Text className="text-primary text-lg font-semibold">New note</Text>

          <TouchableOpacity
            onPress={handleSave}
            disabled={!text.trim()}
            className={`w-10 h-10 rounded-full items-center justify-center ${
              text.trim() ? 'bg-success' : 'bg-border'
            }`}
          >
            <Check size={20} color={text.trim() ? '#fff' : colors.secondary} />
          </TouchableOpacity>
        </View>

        {/* Text input */}
        <View className="flex-1 p-4">
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Write your note..."
            placeholderTextColor={colors.secondary}
            multiline
            autoFocus
            textAlignVertical="top"
            className="flex-1 text-primary text-base leading-6"
            style={{ fontSize: 16 }}
          />
        </View>

        {/* Footer with char count */}
        <View className="px-4 py-3 border-t border-border">
          <Text className="text-secondary text-sm text-right">
            {charCount} characters
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaWrapper>
  );
}
