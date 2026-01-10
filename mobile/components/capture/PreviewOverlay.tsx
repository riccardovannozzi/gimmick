import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { X, Check, Edit2, FileText, Mic, File } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '@/constants';
import { useSettingsStore } from '@/store';
import type { MemoType } from '@/types';
import { formatDuration, truncateText } from '@/utils/formatters';

interface PreviewOverlayProps {
  visible: boolean;
  type: MemoType;
  uri: string;
  preview?: string;      // For text
  duration?: number;     // For audio, in ms
  fileName?: string;
  onCancel: () => void;
  onAdd: () => void;
  onEdit?: () => void;
}

function PreviewContent({
  type,
  uri,
  preview,
  duration,
  fileName,
}: Pick<PreviewOverlayProps, 'type' | 'uri' | 'preview' | 'duration' | 'fileName'>) {
  const isImage = type === 'photo' || type === 'image';
  const isAudio = type === 'audio_recording' || type === 'audio_file';
  const isText = type === 'text';
  const isFile = type === 'file';

  if (isImage) {
    return (
      <Image
        source={{ uri }}
        className="w-full h-64 rounded-xl"
        resizeMode="cover"
      />
    );
  }

  if (isText) {
    return (
      <View className="bg-background-1 rounded-xl p-4 min-h-32">
        <View className="flex-row items-center mb-3">
          <FileText size={24} color={colors.capture.text} />
          <Text className="text-primary font-medium ml-2">Nota di testo</Text>
        </View>
        <Text className="text-secondary leading-5">
          {truncateText(preview ?? '', 200)}
        </Text>
      </View>
    );
  }

  if (isAudio) {
    return (
      <View className="bg-background-1 rounded-xl p-4 items-center">
        <View className="w-16 h-16 rounded-full bg-capture-voice/20 items-center justify-center mb-3">
          <Mic size={32} color={colors.capture.voice} />
        </View>
        <Text className="text-primary font-medium">
          {type === 'audio_recording' ? 'Registrazione audio' : 'File audio'}
        </Text>
        {duration && (
          <Text className="text-secondary mt-1">{formatDuration(duration)}</Text>
        )}
        {fileName && (
          <Text className="text-secondary text-sm mt-1">{fileName}</Text>
        )}
      </View>
    );
  }

  if (isFile) {
    return (
      <View className="bg-background-1 rounded-xl p-4 items-center">
        <View className="w-16 h-16 rounded-full bg-capture-file/20 items-center justify-center mb-3">
          <File size={32} color={colors.capture.file} />
        </View>
        <Text className="text-primary font-medium">File</Text>
        {fileName && (
          <Text className="text-secondary text-sm mt-1 text-center">
            {truncateText(fileName, 40)}
          </Text>
        )}
      </View>
    );
  }

  return null;
}

export function PreviewOverlay({
  visible,
  type,
  uri,
  preview,
  duration,
  fileName,
  onCancel,
  onAdd,
  onEdit,
}: PreviewOverlayProps) {
  const hapticFeedback = useSettingsStore((state) => state.hapticFeedback);

  const handleAction = async (action: () => void) => {
    if (hapticFeedback) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    action();
  };

  if (!visible) return null;

  return (
    <View className="absolute inset-0 bg-black/80 justify-center px-6">
      {/* Preview content */}
      <View className="mb-8">
        <PreviewContent
          type={type}
          uri={uri}
          preview={preview}
          duration={duration}
          fileName={fileName}
        />
      </View>

      {/* Action buttons */}
      <View className="flex-row justify-center gap-6">
        {/* Cancel */}
        <TouchableOpacity
          onPress={() => handleAction(onCancel)}
          className="w-16 h-16 rounded-full bg-error items-center justify-center"
        >
          <X size={28} color="#fff" />
        </TouchableOpacity>

        {/* Edit (optional) */}
        {onEdit && (
          <TouchableOpacity
            onPress={() => handleAction(onEdit)}
            className="w-16 h-16 rounded-full bg-accent items-center justify-center"
          >
            <Edit2 size={28} color="#fff" />
          </TouchableOpacity>
        )}

        {/* Add */}
        <TouchableOpacity
          onPress={() => handleAction(onAdd)}
          className="w-16 h-16 rounded-full bg-success items-center justify-center"
        >
          <Check size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Labels */}
      <View className="flex-row justify-center gap-6 mt-3">
        <Text className="text-secondary text-sm w-16 text-center">Annulla</Text>
        {onEdit && (
          <Text className="text-secondary text-sm w-16 text-center">Modifica</Text>
        )}
        <Text className="text-secondary text-sm w-16 text-center">Aggiungi</Text>
      </View>
    </View>
  );
}
