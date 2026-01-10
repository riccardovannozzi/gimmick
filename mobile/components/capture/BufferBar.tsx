import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { Send, X, FileText, Mic, File } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useBufferStore, useSettingsStore } from '@/store';
import { colors, config } from '@/constants';
import type { BufferItem, MemoType } from '@/types';
import { truncateText } from '@/utils/formatters';

interface BufferBarProps {
  onSend: () => void;
  onItemPress?: (item: BufferItem) => void;
}

function getItemIcon(type: MemoType) {
  switch (type) {
    case 'text':
      return <FileText size={20} color={colors.capture.text} />;
    case 'audio_recording':
    case 'audio_file':
      return <Mic size={20} color={colors.capture.voice} />;
    case 'file':
      return <File size={20} color={colors.capture.file} />;
    default:
      return null;
  }
}

function BufferThumbnail({
  item,
  onPress,
  onRemove,
}: {
  item: BufferItem;
  onPress?: () => void;
  onRemove: () => void;
}) {
  const isImage = item.type === 'photo' || item.type === 'image';
  const hapticFeedback = useSettingsStore((state) => state.hapticFeedback);
  const confirmDelete = useSettingsStore((state) => state.confirmDelete);

  const handleRemove = async () => {
    if (hapticFeedback) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (confirmDelete) {
      Alert.alert(
        'Rimuovi elemento',
        'Vuoi rimuovere questo elemento dal buffer?',
        [
          { text: 'Annulla', style: 'cancel' },
          { text: 'Rimuovi', style: 'destructive', onPress: onRemove },
        ]
      );
    } else {
      onRemove();
    }
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      className="relative mr-2"
    >
      <View
        className="rounded-lg overflow-hidden bg-background-1 border border-border items-center justify-center"
        style={{
          width: config.ui.thumbnailSize,
          height: config.ui.thumbnailSize,
        }}
      >
        {isImage && item.uri ? (
          <Image
            source={{ uri: item.thumbnail ?? item.uri }}
            className="w-full h-full"
            resizeMode="cover"
          />
        ) : item.type === 'text' ? (
          <View className="p-1">
            <Text className="text-secondary text-xs" numberOfLines={2}>
              {truncateText(item.preview ?? '', 20)}
            </Text>
          </View>
        ) : (
          getItemIcon(item.type)
        )}
      </View>

      {/* Remove button */}
      <TouchableOpacity
        onPress={handleRemove}
        className="absolute -top-1 -right-1 w-5 h-5 bg-error rounded-full items-center justify-center"
      >
        <X size={12} color="#fff" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export function BufferBar({ onSend, onItemPress }: BufferBarProps) {
  const items = useBufferStore((state) => state.items);
  const removeItem = useBufferStore((state) => state.removeItem);
  const isUploading = useBufferStore((state) => state.isUploading);
  const hapticFeedback = useSettingsStore((state) => state.hapticFeedback);

  const handleSend = async () => {
    if (items.length === 0 || isUploading) return;

    if (hapticFeedback) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    onSend();
  };

  const count = items.length;

  return (
    <View
      className="bg-background-2 border-t border-border px-4 flex-row items-center"
      style={{ height: config.ui.bufferBarHeight }}
    >
      {/* Buffer label */}
      <Text className="text-secondary text-sm mr-3">Buffer:</Text>

      {/* Thumbnails scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="flex-1"
        contentContainerStyle={{ alignItems: 'center', paddingVertical: 8 }}
      >
        {items.length === 0 ? (
          <Text className="text-secondary text-sm italic">Nessun elemento</Text>
        ) : (
          items.map((item) => (
            <BufferThumbnail
              key={item.id}
              item={item}
              onPress={() => onItemPress?.(item)}
              onRemove={() => removeItem(item.id)}
            />
          ))
        )}
      </ScrollView>

      {/* Send button */}
      <TouchableOpacity
        onPress={handleSend}
        disabled={count === 0 || isUploading}
        activeOpacity={0.7}
        className={`
          rounded-full items-center justify-center ml-3
          ${count > 0 ? 'bg-accent' : 'bg-border'}
        `}
        style={{
          width: config.ui.sendButtonSize,
          height: config.ui.sendButtonSize,
        }}
      >
        <Send size={20} color={count > 0 ? '#fff' : colors.secondary} />

        {/* Badge */}
        {count > 0 && (
          <View className="absolute -top-1 -right-1 bg-error rounded-full min-w-5 h-5 items-center justify-center px-1">
            <Text className="text-white text-xs font-bold">{count}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}
