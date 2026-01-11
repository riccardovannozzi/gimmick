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
  large?: boolean;
}

function getItemColor(type: MemoType): string {
  switch (type) {
    case 'text':
      return colors.capture.text;
    case 'audio_recording':
    case 'audio_file':
      return colors.capture.voice;
    case 'file':
      return colors.capture.file;
    case 'photo':
    case 'image':
      return colors.capture.photo;
    case 'video':
      return colors.capture.video;
    default:
      return colors.secondary;
  }
}

function getItemIcon(type: MemoType, size = 20) {
  const color = getItemColor(type);
  switch (type) {
    case 'text':
      return <FileText size={size} color={color} />;
    case 'audio_recording':
    case 'audio_file':
      return <Mic size={size} color={color} />;
    case 'file':
      return <File size={size} color={color} />;
    default:
      return null;
  }
}

function BufferThumbnail({
  item,
  onPress,
  onRemove,
  large = false,
}: {
  item: BufferItem;
  onPress?: () => void;
  onRemove: () => void;
  large?: boolean;
}) {
  const isImage = item.type === 'photo' || item.type === 'image' || item.type === 'video';
  const hapticFeedback = useSettingsStore((state) => state.hapticFeedback);
  const confirmDelete = useSettingsStore((state) => state.confirmDelete);

  const handleRemove = async () => {
    if (hapticFeedback) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (confirmDelete) {
      Alert.alert(
        'Remove item',
        'Do you want to remove this item from the buffer?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: onRemove },
        ]
      );
    } else {
      onRemove();
    }
  };

  // Layout large: stesse dimensioni dei CaptureButton (flex-1 aspect-square, rounded-2xl, bg-background-2)
  if (large) {
    const itemColor = getItemColor(item.type);
    return (
      <View className="flex-1 aspect-square" style={{ minWidth: '30%', maxWidth: '32%' }}>
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.8}
          className="flex-1 relative"
        >
          <View className="flex-1 rounded-2xl overflow-hidden bg-background-2 border border-border items-center justify-center">
            {isImage && item.uri ? (
              <Image
                source={{ uri: item.thumbnail ?? item.uri }}
                className="w-full h-full"
                resizeMode="cover"
              />
            ) : item.type === 'text' ? (
              <View className="flex-1 p-3 justify-center">
                <Text className="text-secondary text-xs" numberOfLines={4}>
                  {truncateText(item.preview ?? '', 50)}
                </Text>
              </View>
            ) : (
              <View
                className="w-14 h-14 rounded-xl items-center justify-center"
                style={{ backgroundColor: `${itemColor}20` }}
              >
                {getItemIcon(item.type, 28)}
              </View>
            )}
          </View>

          {/* Remove button */}
          <TouchableOpacity
            onPress={handleRemove}
            className="absolute -top-2 -right-2 w-6 h-6 bg-error rounded-full items-center justify-center"
          >
            <X size={14} color="#fff" />
          </TouchableOpacity>
        </TouchableOpacity>
      </View>
    );
  }

  // Layout compatto originale
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
          getItemIcon(item.type, 20)
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

export function BufferBar({ onSend, onItemPress, large = false }: BufferBarProps) {
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
  const sendButtonSize = large ? 56 : config.ui.sendButtonSize;

  // Layout large: griglia con stessa spaziatura dei pulsanti (gap-3 = 12px)
  if (large) {
    return (
      <View className="flex-1">
        {/* Thumbnails grid */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          className="flex-1"
          contentContainerStyle={{
            paddingBottom: 80,
          }}
        >
          {items.length === 0 ? (
            <View className="flex-1 items-center justify-center py-8">
              <Text className="text-secondary text-base italic">
                No items in buffer
              </Text>
            </View>
          ) : (
            <View className="flex-row flex-wrap gap-3">
              {items.map((item) => (
                <BufferThumbnail
                  key={item.id}
                  item={item}
                  onPress={() => onItemPress?.(item)}
                  onRemove={() => removeItem(item.id)}
                  large
                />
              ))}
            </View>
          )}
        </ScrollView>

        {/* Send button fisso in basso */}
        {count > 0 && (
          <View className="absolute bottom-4 right-0">
            <TouchableOpacity
              onPress={handleSend}
              disabled={isUploading}
              activeOpacity={0.7}
              className="bg-accent rounded-full items-center justify-center"
              style={{
                width: sendButtonSize,
                height: sendButtonSize,
              }}
            >
              <Send size={24} color="#fff" />

              {/* Badge */}
              <View className="absolute -top-1 -right-1 bg-error rounded-full min-w-6 h-6 items-center justify-center px-1">
                <Text className="text-white text-sm font-bold">{count}</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  // Layout compatto originale
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
          <Text className="text-secondary text-sm italic">No items</Text>
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
