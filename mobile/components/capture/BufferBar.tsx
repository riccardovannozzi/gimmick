import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { Send, X, Camera, Paperclip } from 'lucide-react-native';
import NiPenToSquare from '@/assets/icons/ni-pen-to-square.svg';
import NiMicrophone from '@/assets/icons/ni-microphone.svg';
import NiCameraReels from '@/assets/icons/ni-camera-reels.svg';
import NiGallerySquare from '@/assets/icons/ni-gallery-square.svg';
import * as Haptics from 'expo-haptics';
import { useBufferStore, useSettingsStore } from '@/store';
import { config } from '@/constants';
import { captureColors } from '@/constants/colors';
import { useThemeColors } from '@/lib/theme';
import type { BufferItem, MemoType } from '@/types';

interface BufferBarProps {
  onSend: () => void;
  onItemPress?: (item: BufferItem) => void;
  large?: boolean;
}

function getItemColor(type: MemoType, secondaryColor: string): string {
  switch (type) {
    case 'text':
      return captureColors.text;
    case 'audio_recording':
      return captureColors.voice;
    case 'file':
      return captureColors.file;
    case 'photo':
    case 'image':
      return captureColors.photo;
    case 'video':
      return captureColors.video;
    default:
      return secondaryColor;
  }
}

function getItemIcon(type: MemoType, size = 20) {
  const color = '#FFFFFF';
  switch (type) {
    case 'text':
      return <NiPenToSquare width={size} height={size} stroke={color} strokeWidth={1.8} />;
    case 'audio_recording':
      return <NiMicrophone width={size} height={size} stroke={color} strokeWidth={1.8} />;
    case 'file':
      return <Paperclip size={size} color={color} strokeWidth={1.8} />;
    case 'photo':
      return <Camera size={size} color={color} strokeWidth={1.8} />;
    case 'video':
      return <NiCameraReels width={size} height={size} stroke={color} strokeWidth={1.8} />;
    case 'image':
      return <NiGallerySquare width={size} height={size} stroke={color} strokeWidth={1.8} />;
    default:
      return null;
  }
}

function getItemLabel(type: MemoType): string {
  switch (type) {
    case 'text': return 'Text';
    case 'audio_recording': return 'Voice';
    case 'file': return 'File';
    case 'photo': return 'Photo';
    case 'video': return 'Video';
    case 'image': return 'Gallery';
    default: return 'Item';
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
  const colors = useThemeColors();
  const isImage = item.type === 'photo' || item.type === 'image' || item.type === 'video';
  const isText = item.type === 'text';
  const hapticFeedback = useSettingsStore((state) => state.hapticFeedback);
  const confirmDelete = useSettingsStore((state) => state.confirmDelete);
  const itemColor = getItemColor(item.type, colors.secondary);

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

  const formatSize = (bytes: number) =>
    bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(0)} kb`
      : `${(bytes / (1024 * 1024)).toFixed(1)} Mb`;

  const formatDuration = (sec: number) =>
    `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

  // Close button shared across all cards
  const closeButton = (
    <TouchableOpacity
      onPress={handleRemove}
      className="rounded-full items-center justify-center"
      style={{
        width: 32,
        height: 32,
        backgroundColor: 'rgba(0,0,0,0.3)',
      }}
    >
      <X size={16} color="#FFFFFF" strokeWidth={2.5} />
    </TouchableOpacity>
  );

  // ── TEXT CARD ──
  // White bg, dashed blue left border, black text
  if (isText) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        className="flex-row mb-3 overflow-hidden"
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          borderLeftWidth: 5,
          borderLeftColor: colors.accent,
          borderStyle: 'dashed',
          minHeight: 72,
        }}
      >
        {/* Icon */}
        <View className="items-center justify-center pl-4">
          {React.cloneElement(getItemIcon(item.type, 22)!, {
            stroke: '#000000',
            color: '#000000',
          })}
        </View>

        {/* Text preview */}
        <View className="flex-1 px-3 py-3">
          <Text
            style={{ color: '#000000', fontSize: 16, lineHeight: 22 }}
            numberOfLines={5}
          >
            {item.preview ?? ''}
          </Text>
        </View>

        {/* Close */}
        <View className="items-center justify-center pr-3">
          <TouchableOpacity
            onPress={handleRemove}
            className="rounded-full items-center justify-center"
            style={{
              width: 32,
              height: 32,
              backgroundColor: 'rgba(0,0,0,0.15)',
            }}
          >
            <X size={16} color="#000000" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }

  // ── MEDIA CARD (photo / video / image) ──
  // Colored bg, thumbnail on left, white text
  if (isImage && item.uri) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        className="flex-row mb-3 overflow-hidden"
        style={{
          backgroundColor: itemColor,
          borderRadius: 16,
          minHeight: 100,
        }}
      >
        {/* Thumbnail */}
        <Image
          source={{ uri: item.thumbnail ?? item.uri }}
          style={{ width: 100, height: 100, borderRadius: 12, margin: 8 }}
          resizeMode="cover"
        />

        {/* Info */}
        <View className="flex-1 justify-center py-3 pr-2">
          <View className="flex-row items-center mb-1">
            {getItemIcon(item.type, 18)}
            <Text
              className="ml-2 font-semibold"
              style={{ color: '#FFFFFF', fontSize: 17 }}
              numberOfLines={1}
            >
              {item.fileName || getItemLabel(item.type)}
            </Text>
          </View>
          {item.fileSize && (
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>
              {formatSize(item.fileSize)}
            </Text>
          )}
        </View>

        {/* Close */}
        <View className="items-center justify-center pr-3">
          {closeButton}
        </View>
      </TouchableOpacity>
    );
  }

  // ── DEFAULT CARD (voice / file) ──
  // Solid colored bg, icon + text white
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      className="flex-row items-center mb-3 px-4"
      style={{
        backgroundColor: itemColor,
        borderRadius: 16,
        height: 56,
      }}
    >
      {/* Icon */}
      <View className="mr-3">
        {getItemIcon(item.type, 22)}
      </View>

      {/* Title / duration */}
      <View className="flex-1">
        {item.duration ? (
          <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700' }}>
            {formatDuration(item.duration)}
          </Text>
        ) : (
          <>
            <Text
              style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}
              numberOfLines={1}
            >
              {item.fileName || getItemLabel(item.type)}
            </Text>
            {item.fileSize && (
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>
                {formatSize(item.fileSize)}
              </Text>
            )}
          </>
        )}
      </View>

      {/* Close */}
      {closeButton}
    </TouchableOpacity>
  );
}

export function BufferBar({ onSend, onItemPress, large = false }: BufferBarProps) {
  const colors = useThemeColors();
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

  // Layout large: lista verticale
  if (large) {
    return (
      <View className="flex-1">
        <ScrollView
          showsVerticalScrollIndicator={false}
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 80 }}
        >
          {items.map((item) => (
            <BufferThumbnail
              key={item.id}
              item={item}
              onPress={() => onItemPress?.(item)}
              onRemove={() => removeItem(item.id)}
            />
          ))}
        </ScrollView>

        {/* Send button */}
        {count > 0 && (
          <View className="absolute bottom-0 right-0">
            <TouchableOpacity
              onPress={handleSend}
              disabled={isUploading}
              activeOpacity={0.7}
              className="rounded-full items-center justify-center flex-row"
              style={{
                width: 96,
                height: 48,
                backgroundColor: colors.primary,
              }}
            >
              <Send size={20} color={colors.background1} />
              <View className="absolute -top-2 -right-2 bg-error rounded-full min-w-6 h-6 items-center justify-center px-1">
                <Text className="text-white text-sm font-bold">{count}</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  // Layout compatto
  return (
    <View
      className="bg-background-2 border-t border-border px-4 flex-row items-center"
      style={{ height: config.ui.bufferBarHeight }}
    >
      <Text className="text-secondary text-sm mr-3">Buffer:</Text>
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
      <TouchableOpacity
        onPress={handleSend}
        disabled={count === 0 || isUploading}
        activeOpacity={0.7}
        className={`rounded-full items-center justify-center ml-3 ${count > 0 ? 'bg-accent' : 'bg-border'}`}
        style={{
          width: config.ui.sendButtonSize,
          height: config.ui.sendButtonSize,
        }}
      >
        <Send size={20} color={count > 0 ? '#fff' : colors.secondary} />
        {count > 0 && (
          <View className="absolute -top-1 -right-1 bg-error rounded-full min-w-5 h-5 items-center justify-center px-1">
            <Text className="text-white text-xs font-bold">{count}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}
