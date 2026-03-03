import React from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Clock, FileText, Image, Mic, Film, File, Trash2, ArrowLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaWrapper } from '@/components/layout/SafeAreaWrapper';
import { memosApi } from '@/lib/api';
import { captureColors } from '@/constants/colors';
import { useThemeColors } from '@/lib/theme';
import { formatDate, formatFileSize } from '@/utils/formatters';
import type { Memo } from '@/types';

const typeIcons: Record<string, typeof FileText> = {
  photo: Image,
  image: Image,
  video: Film,
  audio_recording: Mic,
  text: FileText,
  file: File,
};

const typeColors: Record<string, string> = {
  photo: captureColors.photo,
  image: captureColors.photo,
  video: captureColors.video,
  audio_recording: captureColors.voice,
  text: captureColors.text,
  file: captureColors.file,
};

function MemoItem({ memo, onDelete }: { memo: Memo; onDelete: (id: string) => void }) {
  const colors = useThemeColors();
  const Icon = typeIcons[memo.type] || FileText;
  const iconColor = typeColors[memo.type] || colors.secondary;

  return (
    <View
      className="flex-row items-center px-4 py-3 border-b"
      style={{ borderColor: colors.border }}
    >
      <View
        className="w-10 h-10 rounded-lg items-center justify-center mr-3"
        style={{ backgroundColor: `${iconColor}20` }}
      >
        <Icon size={20} color={iconColor} />
      </View>

      <View className="flex-1">
        <Text className="text-sm font-medium" style={{ color: colors.primary }}>
          {memo.file_name || memo.content?.substring(0, 40) || memo.type}
        </Text>
        <Text className="text-xs mt-0.5" style={{ color: colors.secondary }}>
          {formatDate(memo.created_at)}
          {memo.file_size ? ` · ${formatFileSize(memo.file_size)}` : ''}
        </Text>
      </View>

      <Pressable
        onPress={() => onDelete(memo.id)}
        className="w-8 h-8 items-center justify-center"
      >
        <Trash2 size={16} color={colors.secondary} />
      </Pressable>
    </View>
  );
}

export default function HistoryScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['memos', { page: 1, limit: 50 }],
    queryFn: () => memosApi.list({ page: 1, limit: 50 }),
  });

  const deleteMutation = useMutation({
    mutationFn: memosApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memos'] });
    },
  });

  const memos = data?.data || [];

  return (
    <SafeAreaWrapper edges={['top']}>
      <View className="flex-1">
        {/* Header */}
        <View className="flex-row items-center px-4 py-4 border-b" style={{ borderColor: colors.border }}>
          <TouchableOpacity onPress={() => router.push('/(tabs)/' as any)} className="mr-3">
            <ArrowLeft size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text className="text-xl font-bold" style={{ color: colors.primary }}>
            Tiles
          </Text>
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : memos.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <View
              className="w-20 h-20 rounded-full items-center justify-center mb-4"
              style={{ backgroundColor: colors.background2 }}
            >
              <Clock size={40} color={colors.secondary} />
            </View>
            <Text
              className="text-lg font-medium text-center mb-2"
              style={{ color: colors.primary }}
            >
              Nessun memo salvato
            </Text>
            <Text className="text-sm text-center" style={{ color: colors.secondary }}>
              I memo che carichi appariranno qui
            </Text>
          </View>
        ) : (
          <FlatList
            data={memos}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <MemoItem memo={item} onDelete={(id) => deleteMutation.mutate(id)} />
            )}
            onRefresh={refetch}
            refreshing={isLoading}
          />
        )}
      </View>
    </SafeAreaWrapper>
  );
}
