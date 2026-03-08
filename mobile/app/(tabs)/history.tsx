import React, { useState, useMemo } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Clock, FileText, Image, Mic, Film, File, Trash2 } from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaWrapper } from '@/components/layout/SafeAreaWrapper';
import { sparksApi } from '@/lib/api';
import { captureColors } from '@/constants/colors';
import { useThemeColors } from '@/lib/theme';
import { formatDate, formatFileSize } from '@/utils/formatters';
import type { Spark } from '@/types';

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
  image: captureColors.gallery,
  video: captureColors.video,
  audio_recording: captureColors.voice,
  text: captureColors.text,
  file: captureColors.file,
};

const filterOptions = [
  { id: 'all', label: 'All' },
  { id: 'photo', label: 'Photos' },
  { id: 'video', label: 'Video' },
  { id: 'audio_recording', label: 'Audio' },
  { id: 'text', label: 'Text' },
  { id: 'file', label: 'Files' },
];

function groupByDate(sparks: Spark[]): { title: string; data: Spark[] }[] {
  const groups: Record<string, Spark[]> = {};
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  for (const spark of sparks) {
    const date = new Date(spark.created_at);
    let key: string;
    if (date.toDateString() === today.toDateString()) {
      key = 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      key = 'Yesterday';
    } else {
      key = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    }
    if (!groups[key]) groups[key] = [];
    groups[key].push(spark);
  }

  return Object.entries(groups).map(([title, data]) => ({ title, data }));
}

function SparkItem({ spark, onDelete, colors }: { spark: Spark; onDelete: (id: string) => void; colors: any }) {
  const Icon = typeIcons[spark.type] || FileText;
  const iconColor = typeColors[spark.type] || colors.secondary;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 14,
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: colors.surfaceVariant,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 14,
        }}
      >
        <Icon size={22} color={iconColor} />
      </View>

      <View style={{ flex: 1 }}>
        <Text
          style={{ fontSize: 15, fontWeight: '500', color: colors.primary }}
          numberOfLines={1}
        >
          {spark.file_name || spark.content?.substring(0, 40) || spark.type}
        </Text>
        <Text style={{ fontSize: 13, color: colors.tertiary, marginTop: 2 }}>
          {formatDate(spark.created_at)}
          {spark.file_size ? ` · ${formatFileSize(spark.file_size)}` : ''}
        </Text>
      </View>

      {/* AI indexing status indicator */}
      <View
        style={{
          width: 10,
          height: 10,
          borderRadius: 5,
          marginRight: 12,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.15)',
          backgroundColor:
            spark.ai_status === 'completed' ? '#22C55E' :
            spark.ai_status === 'processing' ? '#F59E0B' :
            spark.ai_status === 'failed' ? '#EF4444' :
            '#6B7280',
        }}
      />

      <TouchableOpacity
        onPress={() => onDelete(spark.id)}
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Trash2 size={18} color={colors.tertiary} />
      </TouchableOpacity>
    </View>
  );
}

export default function HistoryScreen() {
  const colors = useThemeColors();
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState('all');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['sparks', { page: 1, limit: 50 }],
    queryFn: () => sparksApi.list({ page: 1, limit: 50 }),
  });

  const deleteMutation = useMutation({
    mutationFn: sparksApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sparks'] });
    },
  });

  const allSparks = data?.data || [];
  const filteredSparks = activeFilter === 'all'
    ? allSparks
    : allSparks.filter((m: Spark) => m.type === activeFilter || (activeFilter === 'photo' && m.type === 'image'));

  const grouped = useMemo(() => groupByDate(filteredSparks), [filteredSparks]);

  const flatData = useMemo(() => {
    const result: ({ type: 'header'; title: string } | { type: 'spark'; spark: Spark })[] = [];
    for (const group of grouped) {
      result.push({ type: 'header', title: group.title });
      for (const spark of group.data) {
        result.push({ type: 'spark', spark });
      }
    }
    return result;
  }, [grouped]);

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background1 }}>
      <View className="flex-1">
        {/* Filter chips */}
        <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={filterOptions}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const isActive = activeFilter === item.id;
              return (
                <TouchableOpacity
                  onPress={() => setActiveFilter(item.id)}
                  activeOpacity={0.7}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 20,
                    backgroundColor: isActive ? colors.accentContainer : colors.surfaceVariant,
                    marginRight: 8,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '600',
                      color: isActive ? colors.accent : colors.secondary,
                    }}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : filteredSparks.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: colors.surfaceVariant,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <Clock size={36} color={colors.tertiary} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.primary, textAlign: 'center', marginBottom: 8 }}>
              No sparks yet
            </Text>
            <Text style={{ fontSize: 14, color: colors.tertiary, textAlign: 'center' }}>
              Your uploaded sparks will appear here
            </Text>
          </View>
        ) : (
          <FlatList
            data={flatData}
            keyExtractor={(item, index) => item.type === 'header' ? `h-${item.title}` : `s-${item.spark.id}`}
            renderItem={({ item }) => {
              if (item.type === 'header') {
                return (
                  <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.tertiary, letterSpacing: 0.5 }}>
                      {item.title}
                    </Text>
                  </View>
                );
              }
              return (
                <SparkItem
                  spark={item.spark}
                  onDelete={(id) => deleteMutation.mutate(id)}
                  colors={colors}
                />
              );
            }}
            onRefresh={refetch}
            refreshing={isLoading}
          />
        )}
      </View>
    </View>
  );
}
