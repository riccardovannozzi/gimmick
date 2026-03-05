import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { Send, X, FileText, Mic, File, Camera, Video, Image as ImageIcon } from 'lucide-react-native';
import Svg, { Rect } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useBufferStore, useSettingsStore } from '@/store';
import { config } from '@/constants';
import { captureColors } from '@/constants/colors';
import { useThemeColors } from '@/lib/theme';
import type { BufferItem, MemoType } from '@/types';
import { truncateText } from '@/utils/formatters';

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

function getItemIcon(type: MemoType, size = 20, secondaryColor = '#9CA3AF') {
  const color = getItemColor(type, secondaryColor);
  switch (type) {
    case 'text':
      return <FileText size={size} color={color} />;
    case 'audio_recording':
      return <Mic size={size} color={color} />;
    case 'file':
      return <File size={size} color={color} />;
    case 'photo':
      return <Camera size={size} color={color} />;
    case 'video':
      return <Video size={size} color={color} />;
    case 'image':
      return <ImageIcon size={size} color={color} />;
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
  large = false,
}: {
  item: BufferItem;
  onPress?: () => void;
  onRemove: () => void;
  large?: boolean;
}) {
  const colors = useThemeColors();
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

  // Layout large: full-width row
  if (large) {
    const itemColor = getItemColor(item.type, colors.secondary);
    const [cardSize, setCardSize] = React.useState({ w: 0, h: 0 });
    const rx = 16;
    const perimeter = cardSize.w && cardSize.h
      ? 2 * (cardSize.w + cardSize.h - 4 * rx) + 2 * Math.PI * rx
      : 0;
    const arcLen = perimeter * 0.5;
    // Offset to position thick arc on right + bottom edges
    const topEdge = cardSize.w - 2 * rx + Math.PI * rx / 2;

    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setCardSize({ w: width, h: height });
        }}
        className="flex-row items-center rounded-2xl mb-3 px-2 py-3"
        style={{
          backgroundColor: colors.background2,
          borderWidth: 1,
          borderColor: colors.primary,
          minHeight: 80,
        }}
      >
        {/* Thick arc accent on right + bottom border */}
        {perimeter > 0 && (
          <Svg
            width={cardSize.w}
            height={cardSize.h}
            style={{ position: 'absolute', top: 0, left: 0 }}
          >
            <Rect
              x={1.5}
              y={1.5}
              width={cardSize.w - 3}
              height={cardSize.h - 3}
              rx={rx}
              ry={rx}
              stroke={colors.primary}
              strokeWidth={3}
              fill="none"
              strokeDasharray={`${arcLen} ${perimeter - arcLen}`}
              strokeDashoffset={-topEdge}
              strokeLinecap="round"
            />
          </Svg>
        )}
        {/* Left: thumbnail or icon */}
        {isImage && item.uri ? (
          <Image
            source={{ uri: item.thumbnail ?? item.uri }}
            className="rounded-xl"
            style={{ width: 60, height: 60 }}
            resizeMode="cover"
          />
        ) : (
          <View
            className="rounded-xl items-center justify-center"
            style={{ width: 60, height: 60, backgroundColor: `${itemColor}15` }}
          >
            {getItemIcon(item.type, 28, colors.secondary)}
          </View>
        )}

        {/* Center: label / preview */}
        <View className="flex-1 ml-3 mr-2">
          {item.type === 'text' ? (
            <Text className="text-primary text-lg">
              {item.preview ?? ''}
            </Text>
          ) : (
            <>
              <Text className="text-primary text-lg font-medium">
                {getItemLabel(item.type)}
              </Text>
              {item.fileName && (
                <Text className="text-secondary text-base" numberOfLines={1}>
                  {item.fileName}
                </Text>
              )}
            </>
          )}
        </View>

        {/* Right: remove button */}
        <TouchableOpacity
          onPress={handleRemove}
          className="w-10 h-10 items-center justify-center"
        >
          <X size={20} color={colors.primary} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }

  // Layout compatto (stessa struttura row del large)
  const itemColor = getItemColor(item.type, colors.secondary);
  const [cardSize, setCardSize] = React.useState({ w: 0, h: 0 });
  const rx = 16;
  const perimeter = cardSize.w && cardSize.h
    ? 2 * (cardSize.w + cardSize.h - 4 * rx) + 2 * Math.PI * rx
    : 0;
  const arcLen = perimeter * 0.5;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setCardSize({ w: width, h: height });
      }}
      className="flex-row items-center rounded-2xl mb-3 px-2 py-3"
      style={{
        backgroundColor: colors.background2,
        borderWidth: 1,
        borderColor: colors.primary,
        minHeight: 80,
      }}
    >
      {/* Thick arc accent on border */}
      {perimeter > 0 && (
        <Svg
          width={cardSize.w}
          height={cardSize.h}
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
          <Rect
            x={1.5}
            y={1.5}
            width={cardSize.w - 3}
            height={cardSize.h - 3}
            rx={rx}
            ry={rx}
            stroke={colors.primary}
            strokeWidth={3}
            fill="none"
            strokeDasharray={`${arcLen} ${perimeter - arcLen}`}
            strokeLinecap="round"
          />
        </Svg>
      )}
      {/* Left: thumbnail or icon */}
      {isImage && item.uri ? (
        <Image
          source={{ uri: item.thumbnail ?? item.uri }}
          className="rounded-xl"
          style={{ width: 60, height: 60 }}
          resizeMode="cover"
        />
      ) : (
        <View
          className="rounded-xl items-center justify-center"
          style={{ width: 60, height: 60, backgroundColor: `${itemColor}15` }}
        >
          {getItemIcon(item.type, 28, colors.secondary)}
        </View>
      )}

      {/* Center: label / preview */}
      <View className="flex-1 ml-3 mr-2">
        {item.type === 'text' ? (
          <Text className="text-primary text-lg">
            {item.preview ?? ''}
          </Text>
        ) : (
          <>
            <Text className="text-primary text-lg font-medium">
              {getItemLabel(item.type)}
            </Text>
            {item.fileName && (
              <Text className="text-secondary text-base" numberOfLines={1}>
                {item.fileName}
              </Text>
            )}
          </>
        )}
      </View>

      {/* Right: remove button */}
      <TouchableOpacity
        onPress={handleRemove}
        className="w-10 h-10 items-center justify-center"
      >
        <X size={20} color={colors.primary} />
      </TouchableOpacity>
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
          {items.map((item) => (
            <BufferThumbnail
              key={item.id}
              item={item}
              onPress={() => onItemPress?.(item)}
              onRemove={() => removeItem(item.id)}
              large
            />
          ))}
        </ScrollView>

        {/* Send button fisso in basso a destra */}
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

              {/* Badge */}
              <View className="absolute -top-2 -right-2 bg-error rounded-full min-w-6 h-6 items-center justify-center px-1">
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
