import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { X, FileText } from 'lucide-react-native';
import { SafeAreaWrapper } from '@/components/layout/SafeAreaWrapper';
import { useThemeColors } from '@/lib/theme';

export default function TextEditorScreen() {
  const colors = useThemeColors();
  const router = useRouter();

  return (
    <SafeAreaWrapper>
      <View className="flex-1">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
          <TouchableOpacity onPress={() => router.back()}>
            <X size={24} color={colors.secondary} />
          </TouchableOpacity>
          <Text className="text-primary text-lg font-semibold">Editor Testo AI</Text>
          <View className="w-6" />
        </View>

        {/* Content - Placeholder */}
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-20 h-20 rounded-full bg-background-2 items-center justify-center mb-4">
            <FileText size={40} color={colors.secondary} />
          </View>
          <Text className="text-primary text-lg font-medium text-center mb-2">
            Editor AI in arrivo
          </Text>
          <Text className="text-secondary text-sm text-center">
            L'editor testo con AI sara disponibile nella prossima versione
          </Text>
        </View>
      </View>
    </SafeAreaWrapper>
  );
}
