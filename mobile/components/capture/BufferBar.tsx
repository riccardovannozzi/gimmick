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

  const cardBg = '#2C2C2E';
  const label = getItemLabel(item.type);

  // ── TEXT CARD ──
  if (isText) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        className="mb-4"
        style={{
          backgroundColor: cardBg,
          borderRadius: 24,
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 20,
        }}
      >
        {/* Header: label + close */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <Text style={{ color: colors.secondary, fontSize: 14, fontWeight: '500' }}>
            {label}
          </Text>
          <TouchableOpacity onPress={handleRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X size={18} color={colors.secondary} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <Text
          style={{ color: colors.primary, fontSize: 18, lineHeight: 26, fontWeight: '300' }}
          numberOfLines={6}
        >
          {item.preview ?? ''}
        </Text>
      </TouchableOpacity>
    );
  }

  // ── MEDIA CARD (photo / video / image) ──
  if (isImage && item.uri) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        className="mb-4"
        style={{
          backgroundColor: cardBg,
          borderRadius: 24,
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 20,
        }}
      >
        {/* Header: label + close */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ color: colors.secondary, fontSize: 14, fontWeight: '500' }}>
            {label}
          </Text>
          <TouchableOpacity onPress={handleRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X size={18} color={colors.secondary} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* Thumbnail + info */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Image
            source={{ uri: item.thumbnail ?? item.uri }}
            style={{ width: 72, height: 72, borderRadius: 14 }}
            resizeMode="cover"
          />
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text
              style={{ color: colors.primary, fontSize: 18, fontWeight: '300' }}
              numberOfLines={1}
            >
              {item.fileName || label}
            </Text>
            {item.fileSize && (
              <Text style={{ color: colors.tertiary, fontSize: 14, marginTop: 2 }}>
                {formatSize(item.fileSize)}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  // ── DEFAULT CARD (voice / file) ──
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      className="mb-4"
      style={{
        backgroundColor: cardBg,
        borderRadius: 24,
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 20,
      }}
    >
      {/* Header: label + close */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ color: colors.secondary, fontSize: 14, fontWeight: '500' }}>
          {label}
        </Text>
        <TouchableOpacity onPress={handleRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <X size={18} color={colors.secondary} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      {item.duration ? (
        <Text style={{ color: colors.primary, fontSize: 36, fontWeight: '200' }}>
          {formatDuration(item.duration)}
        </Text>
      ) : (
        <>
          <Text
            style={{ color: colors.primary, fontSize: 18, fontWeight: '300' }}
            numberOfLines={1}
          >
            {item.fileName || label}
          </Text>
          {item.fileSize && (
            <Text style={{ color: colors.tertiary, fontSize: 14, marginTop: 2 }}>
              {formatSize(item.fileSize)}
            </Text>
          )}
        </>
      )}
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
