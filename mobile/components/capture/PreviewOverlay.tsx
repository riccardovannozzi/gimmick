import React from 'react';
import { View, Text, Image, Pressable } from 'react-native';
import { Video as ExpoVideo, ResizeMode } from 'expo-av';
import { IconX, IconCheck, IconPencil, IconFileText, IconMicrophone, IconFile } from '@tabler/icons-react-native';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '@/store';
import { useObsidian, type ObsidianColors } from '@/lib/obsidian';
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
 * Cornice Obsidian per i contenuti di preview: card piena con angoli morbidi,
 * senza bordo — sull'overlay scuro il contenuto si stacca già da solo.
 */
function PreviewFrame({
  c, children, bg,
}: { c: ObsidianColors; children: React.ReactNode; bg?: string }) {
  return (
    <View
      style={{
        borderRadius: 16,
        backgroundColor: bg ?? c.surface,
        overflow: 'hidden',
      }}
    >
      {children}
    </View>
  );
}

/** Pastiglia tonda tinta col colore del canale (audio / file). */
function TypeBadge({ tint, children }: { tint: string; children: React.ReactNode }) {
  return (
    <View
      style={{
        width: 56, height: 56, borderRadius: 28,
        backgroundColor: tint + '2E',
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      {children}
    </View>
  );
}

function PreviewContent({
  c,
  type,
  uri,
  preview,
  duration,
  fileName,
}: Pick<PreviewOverlayProps, 'type' | 'uri' | 'preview' | 'duration' | 'fileName'> & { c: ObsidianColors }) {
  const isImage = type === 'photo' || type === 'image';
  const isVideo = type === 'video';
  const isAudio = type === 'audio_recording';
  const isText = type === 'text';
  const isFile = type === 'file';

  if (isImage) {
    return (
      <PreviewFrame c={c} bg="#000">
        <Image
          source={{ uri }}
          style={{ width: '100%', height: 256 }}
          resizeMode="cover"
        />
      </PreviewFrame>
    );
  }

  if (isVideo) {
    return (
      <PreviewFrame c={c} bg="#000">
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
                bottom: 8,
                right: 8,
                paddingHorizontal: 9,
                height: 24,
                borderRadius: 12,
                justifyContent: 'center',
                backgroundColor: c.accentSoft,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: c.accent }}>
                {formatDuration(duration)}
              </Text>
            </View>
          ) : null}
        </View>
      </PreviewFrame>
    );
  }

  if (isText) {
    return (
      <PreviewFrame c={c}>
        <View style={{ padding: 16, minHeight: 128 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 }}>
            <IconFileText size={20} color={c.cap.text} strokeWidth={1.9} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: c.text }}>Nota di testo</Text>
          </View>
          <Text style={{ fontSize: 14, lineHeight: 20, color: c.muted }}>
            {truncateText(preview ?? '', 200)}
          </Text>
        </View>
      </PreviewFrame>
    );
  }

  if (isAudio) {
    return (
      <PreviewFrame c={c}>
        <View style={{ padding: 18, alignItems: 'center', gap: 10 }}>
          <TypeBadge tint={c.cap.voice}>
            <IconMicrophone size={26} color={c.cap.voice} strokeWidth={1.9} />
          </TypeBadge>
          <Text style={{ fontSize: 14, fontWeight: '700', color: c.text }}>
            {type === 'audio_recording' ? 'Registrazione audio' : 'File audio'}
          </Text>
          {duration ? (
            <Text style={{ fontSize: 13, color: c.muted }}>{formatDuration(duration)}</Text>
          ) : null}
          {fileName ? (
            <Text style={{ fontSize: 12, color: c.subtle }}>{fileName}</Text>
          ) : null}
        </View>
      </PreviewFrame>
    );
  }

  if (isFile) {
    return (
      <PreviewFrame c={c}>
        <View style={{ padding: 18, alignItems: 'center', gap: 10 }}>
          <TypeBadge tint={c.cap.file}>
            <IconFile size={26} color={c.cap.file} strokeWidth={1.9} />
          </TypeBadge>
          <Text style={{ fontSize: 14, fontWeight: '700', color: c.text }}>File</Text>
          {fileName ? (
            <Text numberOfLines={2} style={{ fontSize: 12, color: c.muted, textAlign: 'center' }}>
              {truncateText(fileName, 40)}
            </Text>
          ) : null}
        </View>
      </PreviewFrame>
    );
  }

  return null;
}

/**
 * Azione tonda dell'overlay — stesso linguaggio dei controlli camera: cerchio
 * 64px a fondo pieno (superficie scura o accent), senza cornice.
 */
function ActionButton({
  bg, onPress, label, children,
}: { bg: string; onPress: () => void; label: string; children: React.ReactNode }) {
  const SIZE = 64;
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      hitSlop={6}
      android_ripple={{ color: 'rgba(255,255,255,0.22)', borderless: true }}
      style={{
        width: SIZE, height: SIZE, borderRadius: SIZE / 2,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: bg,
      }}
    >
      {children}
    </Pressable>
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
  const c = useObsidian();
  const hapticFeedback = useSettingsStore((state) => state.hapticFeedback);

  const handleAction = async (action: () => void) => {
    if (hapticFeedback) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    action();
  };

  if (!visible) return null;

  const label = { fontSize: 12, fontWeight: '600' as const, color: 'rgba(255,255,255,0.85)' };

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', paddingHorizontal: 24 }}>
      {/* Preview content */}
      <View style={{ marginBottom: 44 }}>
        <PreviewContent
          c={c}
          type={type}
          uri={uri}
          preview={preview}
          duration={duration}
          fileName={fileName}
        />
      </View>

      {/* Azioni — annulla (neutra), modifica (neutra), aggiungi (accent) */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 32 }}>
        <View style={{ alignItems: 'center', gap: 8 }}>
          <ActionButton bg={c.accentSoft} onPress={() => handleAction(onCancel)} label="Annulla">
            <IconX size={26} color={c.accent} strokeWidth={2} />
          </ActionButton>
          <Text style={label}>Annulla</Text>
        </View>

        {onEdit && (
          <View style={{ alignItems: 'center', gap: 8 }}>
            <ActionButton bg={c.accentSoft} onPress={() => handleAction(onEdit)} label="Modifica">
              <IconPencil size={24} color={c.accent} strokeWidth={2} />
            </ActionButton>
            <Text style={label}>Modifica</Text>
          </View>
        )}

        <View style={{ alignItems: 'center', gap: 8 }}>
          <ActionButton bg={c.accent} onPress={() => handleAction(onAdd)} label="Aggiungi">
            <IconCheck size={28} color={c.accentInk} strokeWidth={2.2} />
          </ActionButton>
          <Text style={label}>Aggiungi</Text>
        </View>
      </View>
    </View>
  );
}
