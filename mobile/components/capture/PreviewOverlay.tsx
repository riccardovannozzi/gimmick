import React from 'react';
import { View, Text, Image, Pressable } from 'react-native';
import { Video as ExpoVideo, ResizeMode } from 'expo-av';
import { IconX, IconCheck, IconPencil, IconFileText, IconMicrophone, IconFile } from '@tabler/icons-react-native';
import * as Haptics from 'expo-haptics';
import { captureColors } from '@/constants/colors';
import { useSettingsStore } from '@/store';
import { usePixelTheme } from '@/components/pixel';
import type { PixelTheme } from '@/constants/pixel-theme';
import type { SparkType } from '@/types';
import { formatDuration, truncateText } from '@/utils/formatters';

interface PreviewOverlayProps {
  visible: boolean;
  type: SparkType;
  uri: string;
  preview?: string;      // For text
  duration?: number;     // For audio, in ms
  fileName?: string;
  onCancel: () => void;
  onAdd: () => void;
  onEdit?: () => void;
}

/**
 * Wrapper Pixel per i contenuti di preview: border 2px bianco + offset shadow
 * bianco — su overlay nero serve cornice chiara per essere visibile.
 */
function PixelPreviewFrame({
  theme, children, bg,
}: { theme: PixelTheme; children: React.ReactNode; bg?: string }) {
  const sh = theme.shadowOffset;
  return (
    <View style={{ position: 'relative', paddingRight: sh, paddingBottom: sh }}>
      {sh > 0 && (
        <View
          style={{
            position: 'absolute',
            left: sh, top: sh, right: 0, bottom: 0,
            backgroundColor: '#FFFFFF',
          }}
        />
      )}
      <View
        style={{
          borderWidth: 2,
          borderColor: '#FFFFFF',
          backgroundColor: bg ?? theme.surface,
          overflow: 'hidden',
        }}
      >
        {children}
      </View>
    </View>
  );
}

function PreviewContent({
  theme,
  type,
  uri,
  preview,
  duration,
  fileName,
}: Pick<PreviewOverlayProps, 'type' | 'uri' | 'preview' | 'duration' | 'fileName'> & { theme: PixelTheme }) {
  const isImage = type === 'photo' || type === 'image';
  const isVideo = type === 'video';
  const isAudio = type === 'audio_recording';
  const isText = type === 'text';
  const isFile = type === 'file';

  if (isImage) {
    return (
      <PixelPreviewFrame theme={theme} bg="#000">
        <Image
          source={{ uri }}
          style={{ width: '100%', height: 256 }}
          resizeMode="cover"
        />
      </PixelPreviewFrame>
    );
  }

  if (isVideo) {
    return (
      <PixelPreviewFrame theme={theme} bg="#000">
        <View style={{ width: '100%', height: 256 }}>
          <ExpoVideo
            source={{ uri }}
            style={{ width: '100%', height: '100%' }}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay
            isLooping
            isMuted={false}
          />
          {duration ? (
            <View
              style={{
                position: 'absolute',
                bottom: 6,
                right: 6,
                paddingHorizontal: 6,
                paddingVertical: 3,
                borderWidth: 2,
                borderColor: '#FFFFFF',
                backgroundColor: 'rgba(0,0,0,0.7)',
              }}
            >
              <Text style={{ fontFamily: theme.fontHead, fontSize: 8, color: '#FFFFFF', letterSpacing: 1 }}>
                {formatDuration(duration)}
              </Text>
            </View>
          ) : null}
        </View>
      </PixelPreviewFrame>
    );
  }

  if (isText) {
    return (
      <PixelPreviewFrame theme={theme}>
        <View style={{ padding: 14, minHeight: 128 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 }}>
            <IconFileText size={22} color={theme.cap.text} strokeWidth={2} />
            <Text style={{ fontFamily: theme.fontHead, fontSize: 10, color: theme.ink, letterSpacing: 1 }}>
              TEXT NOTE
            </Text>
          </View>
          <Text style={{ fontFamily: theme.fontBody, fontSize: 13, color: theme.ink2, lineHeight: 18 }}>
            {truncateText(preview ?? '', 200)}
          </Text>
        </View>
      </PixelPreviewFrame>
    );
  }

  if (isAudio) {
    return (
      <PixelPreviewFrame theme={theme}>
        <View style={{ padding: 14, alignItems: 'center', gap: 8 }}>
          <View
            style={{
              width: 56, height: 56,
              borderWidth: 2, borderColor: theme.border,
              backgroundColor: theme.cap.voice,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <IconMicrophone size={28} color="#FFFFFF" strokeWidth={2} />
          </View>
          <Text style={{ fontFamily: theme.fontHead, fontSize: 10, color: theme.ink, letterSpacing: 1 }}>
            {type === 'audio_recording' ? 'AUDIO RECORDING' : 'AUDIO FILE'}
          </Text>
          {duration ? (
            <Text style={{ fontFamily: theme.fontBody, fontSize: 12, color: theme.ink2 }}>
              {formatDuration(duration)}
            </Text>
          ) : null}
          {fileName ? (
            <Text style={{ fontFamily: theme.fontBody, fontSize: 11, color: theme.ink2 }}>
              {fileName}
            </Text>
          ) : null}
        </View>
      </PixelPreviewFrame>
    );
  }

  if (isFile) {
    return (
      <PixelPreviewFrame theme={theme}>
        <View style={{ padding: 14, alignItems: 'center', gap: 8 }}>
          <View
            style={{
              width: 56, height: 56,
              borderWidth: 2, borderColor: theme.border,
              backgroundColor: theme.cap.file,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <IconFile size={28} color="#FFFFFF" strokeWidth={2} />
          </View>
          <Text style={{ fontFamily: theme.fontHead, fontSize: 10, color: theme.ink, letterSpacing: 1 }}>
            FILE
          </Text>
          {fileName ? (
            <Text
              numberOfLines={2}
              style={{ fontFamily: theme.fontBody, fontSize: 11, color: theme.ink2, textAlign: 'center' }}
            >
              {truncateText(fileName, 40)}
            </Text>
          ) : null}
        </View>
      </PixelPreviewFrame>
    );
  }

  return null;
}

/**
 * Pixel action tile: square 64×64 con border 2px bianco + bg colorato + offset
 * shadow bianco. Su overlay nero servono cornice e sfumatura chiare per essere
 * visibili. Pattern Android-safe.
 */
function ActionTile({
  theme, bg, onPress, children,
}: { theme: PixelTheme; bg: string; onPress: () => void; children: React.ReactNode }) {
  const sh = theme.shadowOffset;
  const SIZE = 64;
  return (
    <View style={{ position: 'relative', paddingRight: sh, paddingBottom: sh }}>
      {sh > 0 && (
        <View
          style={{
            position: 'absolute',
            left: sh, top: sh, right: 0, bottom: 0,
            backgroundColor: '#FFFFFF',
          }}
        />
      )}
      <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
        <View
          style={{
            width: SIZE,
            height: SIZE,
            borderWidth: 2,
            borderColor: '#FFFFFF',
            backgroundColor: bg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {children}
        </View>
      </Pressable>
    </View>
  );
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
  const theme = usePixelTheme();
  const hapticFeedback = useSettingsStore((state) => state.hapticFeedback);

  const handleAction = async (action: () => void) => {
    if (hapticFeedback) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    action();
  };

  if (!visible) return null;

  // Ruoli semantici: cancel=danger, edit=info, add=success
  const CANCEL_BG = theme.semantic.danger;
  const EDIT_BG = theme.semantic.info;
  const ADD_BG = theme.semantic.success;

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', paddingHorizontal: 24 }}>
      {/* Preview content */}
      <View style={{ marginBottom: 48 }}>
        <PreviewContent
          theme={theme}
          type={type}
          uri={uri}
          preview={preview}
          duration={duration}
          fileName={fileName}
        />
      </View>

      {/* Action buttons */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 36 }}>
        <View style={{ alignItems: 'center', gap: 6 }}>
          <ActionTile theme={theme} bg={CANCEL_BG} onPress={() => handleAction(onCancel)}>
            <IconX size={26} color="#FFFFFF" strokeWidth={2.4} />
          </ActionTile>
          <Text
            style={{
              fontFamily: theme.fontHead,
              fontSize: 9,
              color: '#FFFFFF',
              letterSpacing: 1,
            }}
          >
            CANCEL
          </Text>
        </View>

        {onEdit && (
          <View style={{ alignItems: 'center', gap: 6 }}>
            <ActionTile theme={theme} bg={EDIT_BG} onPress={() => handleAction(onEdit)}>
              <IconPencil size={26} color="#FFFFFF" strokeWidth={2.4} />
            </ActionTile>
            <Text
              style={{
                fontFamily: theme.fontHead,
                fontSize: 9,
                color: '#FFFFFF',
                letterSpacing: 1,
              }}
            >
              EDIT
            </Text>
          </View>
        )}

        <View style={{ alignItems: 'center', gap: 6 }}>
          <ActionTile theme={theme} bg={ADD_BG} onPress={() => handleAction(onAdd)}>
            <IconCheck size={26} color="#FFFFFF" strokeWidth={2.4} />
          </ActionTile>
          <Text
            style={{
              fontFamily: theme.fontHead,
              fontSize: 9,
              color: '#FFFFFF',
              letterSpacing: 1,
            }}
          >
            ADD
          </Text>
        </View>
      </View>
    </View>
  );
}
