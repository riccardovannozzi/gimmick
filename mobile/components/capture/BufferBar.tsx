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
  if (isText) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        className="flex-row mb-3 overflow-hidden"
        style={{
          backgroundColor: colors.background2,
          borderRadius: 16,
          borderLeftWidth: 4,
          borderLeftColor: colors.accent,
          minHeight: 72,
        }}
      >
        <View className="items-center justify-center pl-4">
          {React.cloneElement(getItemIcon(item.type, 22)!, {
            stroke: colors.accent,
            color: colors.accent,
          })}
        </View>

        <View className="flex-1 px-3 py-3">
          <Text
            style={{ color: colors.primary, fontSize: 16, lineHeight: 22 }}
            numberOfLines={5}
          >
            {item.preview ?? ''}
          </Text>
        </View>

        <View className="items-center justify-center pr-3">
          <TouchableOpacity
            onPress={handleRemove}
            className="rounded-full items-center justify-center"
            style={{
              width: 32,
              height: 32,
              backgroundColor: `${colors.tertiary}30`,
            }}
          >
            <X size={16} color={colors.secondary} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }

  // ── MEDIA CARD (photo / video / image) ──
  if (isImage && item.uri) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        className="flex-row mb-3 overflow-hidden"
        style={{
          backgroundColor: colors.background2,
          borderRadius: 16,
          minHeight: 100,
        }}
      >
        <Image
          source={{ uri: item.thumbnail ?? item.uri }}
          style={{ width: 100, height: 100, borderRadius: 12, margin: 8 }}
          resizeMode="cover"
        />

        <View className="flex-1 justify-center py-3 pr-2">
          <View className="flex-row items-center mb-1">
            {getItemIcon(item.type, 18)}
            <Text
              className="ml-2 font-semibold"
              style={{ color: colors.primary, fontSize: 17 }}
              numberOfLines={1}
            >
              {item.fileName || getItemLabel(item.type)}
            </Text>
          </View>
          {item.fileSize && (
            <Text style={{ color: colors.secondary, fontSize: 14 }}>
              {formatSize(item.fileSize)}
            </Text>
          )}
        </View>

        <View className="items-center justify-center pr-3">
          {closeButton}
        </View>
      </TouchableOpacity>
    );
  }

  // ── DEFAULT CARD (voice / file) ──
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      className="flex-row items-center mb-3 px-4"
      style={{
        backgroundColor: colors.background2,
        borderRadius: 16,
        height: 56,
      }}
    >
      <View className="mr-3">
        {getItemIcon(item.type, 22)}
      </View>

      <View className="flex-1">
        {item.duration ? (
          <Text style={{ color: colors.primary, fontSize: 18, fontWeight: '700' }}>
            {formatDuration(item.duration)}
          </Text>
        ) : (
          <>
            <Text
              style={{ color: colors.primary, fontSize: 16, fontWeight: '600' }}
              numberOfLines={1}
            >
              {item.fileName || getItemLabel(item.type)}
            </Text>
            {item.fileSize && (
              <Text style={{ color: colors.secondary, fontSize: 13 }}>
                {formatSize(item.fileSize)}
              </Text>
            )}
          </>
        )}
      </View>

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
                backgroundColor: colors.accent,
              }}
            >
              <Send size={20} color={colors.onAccent} />
              <View
                className="absolute -top-2 -right-2 rounded-full min-w-6 h-6 items-center justify-center px-1"
                style={{ backgroundColor: colors.error }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>{count}</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  return (
    <View
      style={{
        height: config.ui.bufferBarHeight,
        backgroundColor: colors.background2,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <Text style={{ color: colors.secondary, fontSize: 13, marginRight: 12 }}>Buffer:</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="flex-1"
        contentContainerStyle={{ alignItems: 'center', paddingVertical: 8 }}
      >
        {items.length === 0 ? (
          <Text style={{ color: colors.tertiary, fontSize: 13, fontStyle: 'italic' }}>No items</Text>
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
        style={{
          width: config.ui.sendButtonSize,
          height: config.ui.sendButtonSize,
          borderRadius: config.ui.sendButtonSize / 2,
          backgroundColor: count > 0 ? colors.accent : colors.border,
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: 12,
        }}
      >
        <Send size={20} color={count > 0 ? colors.onAccent : colors.secondary} />
        {count > 0 && (
          <View
            className="absolute -top-1 -right-1 rounded-full min-w-5 h-5 items-center justify-center px-1"
            style={{ backgroundColor: colors.error }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>{count}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}
