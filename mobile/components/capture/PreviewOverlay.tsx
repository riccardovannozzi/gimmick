import React from 'react';
import { View, Text, Image, Pressable } from 'react-native';
import { Video as ExpoVideo, ResizeMode } from 'expo-av';
import { IconX, IconCheck, IconPencil, IconFileText, IconWaveSine, IconFile } from '@tabler/icons-react-native';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '@/store';
import { useObsidian, type ObsidianColors } from '@/lib/obsidian';
import { OB_CAP_BTN, OB_CAP_BTN_BG, OB_CAP_BTN_GLYPH, OB_CAP_BTN_LG, OB_CAP_BTN_R } from '@/constants/obsidian';
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
                backgroundColor: OB_CAP_BTN_BG,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: OB_CAP_BTN_GLYPH }}>
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
            <IconWaveSine size={26} color={c.cap.voice} strokeWidth={1.9} />
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
 * Azione dell'overlay — stesso linguaggio dei controlli camera: fondo nero e
 * glifo bianco; `primary` la rende tonda e più grande (conferma), le altre
 * restano quadrate con angoli arrotondati.
 */
function ActionButton({
  primary, onPress, label, children,
}: { primary?: boolean; onPress: () => void; label: string; children: React.ReactNode }) {
  const size = primary ? OB_CAP_BTN_LG : OB_CAP_BTN;
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      hitSlop={6}
      android_ripple={{ color: 'rgba(255,255,255,0.22)', borderless: !!primary }}
      style={{
        width: size, height: size, borderRadius: primary ? size / 2 : OB_CAP_BTN_R,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: OB_CAP_BTN_BG,
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

      {/* Azioni — annulla e modifica secondarie (quadrate), aggiungi primaria
          (tonda e più grande). Allineate in basso: le secondarie sono più
          piccole della primaria. */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: 28 }}>
        <View style={{ alignItems: 'center', gap: 8 }}>
          <ActionButton onPress={() => handleAction(onCancel)} label="Annulla">
            <IconX size={24} color={OB_CAP_BTN_GLYPH} strokeWidth={2} />
          </ActionButton>
          <Text style={label}>Annulla</Text>
        </View>

        {onEdit && (
          <View style={{ alignItems: 'center', gap: 8 }}>
            <ActionButton onPress={() => handleAction(onEdit)} label="Modifica">
              <IconPencil size={23} color={OB_CAP_BTN_GLYPH} strokeWidth={2} />
            </ActionButton>
            <Text style={label}>Modifica</Text>
          </View>
        )}

        <View style={{ alignItems: 'center', gap: 8 }}>
          <ActionButton primary onPress={() => handleAction(onAdd)} label="Aggiungi">
            <IconCheck size={34} color={OB_CAP_BTN_GLYPH} strokeWidth={2.2} />
          </ActionButton>
          <Text style={label}>Aggiungi</Text>
        </View>
      </View>
    </View>
  );
}
