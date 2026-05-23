import React, { useState, useRef } from 'react';
import { View, Text, Pressable } from 'react-native';
import { CameraView, CameraType, useCameraPermissions, FlashMode } from 'expo-camera';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { IconX, IconRefresh, IconBolt, IconBoltOff, IconCamera } from '@tabler/icons-react-native';
import * as Haptics from 'expo-haptics';
import { PreviewOverlay } from '@/components/capture/PreviewOverlay';
import { useBufferStore, useSettingsStore, toast } from '@/store';
import { usePixelTheme, PixelButton } from '@/components/pixel';
import { createSparkForTile } from '@/lib/api';

export default function PhotoCaptureScreen() {
  const theme = usePixelTheme();
  const colors = {
    border: theme.border,
    tertiary: theme.ink2,
    secondary: theme.ink2,
    primary: theme.ink,
    accent: theme.accent,
    onAccent: theme.onAccent,
    background1: theme.bg1,
    background2: theme.bg2,
    surfaceVariant: theme.surface,
    error: theme.cap.voice,
    warning: theme.cap.file,
  } as const;
  const router = useRouter();
  const queryClient = useQueryClient();
  // When reached from a tile detail (`/capture/photo?tile=<id>`), the spark
  // is created directly against that tile; otherwise the legacy buffer flow.
  const { tile: tileId } = useLocalSearchParams<{ tile?: string }>();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [isTakingPhoto, setIsTakingPhoto] = useState(false);

  const addItem = useBufferStore((state) => state.addItem);
  const hapticFeedback = useSettingsStore((state) => state.hapticFeedback);

  const handleClose = () => {
    router.back();
  };

  const toggleFacing = () => {
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  };

  const toggleFlash = () => {
    setFlash((current) => (current === 'off' ? 'on' : 'off'));
  };

  const takePicture = async () => {
    if (!cameraRef.current || isTakingPhoto) return;

    try {
      setIsTakingPhoto(true);
      if (hapticFeedback) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: false,
      });

      if (photo?.uri) {
        setCapturedUri(photo.uri);
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      toast.error('Error taking photo');
    } finally {
      setIsTakingPhoto(false);
    }
  };

  const handleCancel = () => {
    setCapturedUri(null);
  };

  const handleAdd = async () => {
    if (!capturedUri) return;
    if (tileId) {
      const res = await createSparkForTile({ type: 'photo', tileId, uri: capturedUri });
      if (!res.success) {
        toast.error(res.error || 'Errore nel salvataggio');
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['tile', tileId] });
      toast.success('Foto salvata');
      router.back();
      return;
    }
    addItem({
      type: 'photo',
      uri: capturedUri,
    });

    toast.success('Photo added to buffer');
    router.back();
  };

  const handleEdit = () => {
    // TODO: Navigate to image editor
    toast.info('Image editor coming soon!');
  };

  // Permission not determined yet
  if (!permission) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: theme.fontHead, fontSize: 10, color: theme.ink, letterSpacing: 1 }}>
          LOADING…
        </Text>
      </View>
    );
  }

  // Permission denied
  if (!permission.granted) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 16 }}>
        <Text
          style={{
            fontFamily: theme.fontHead,
            fontSize: 12,
            color: theme.ink,
            textAlign: 'center',
            letterSpacing: 1,
          }}
        >
          CAMERA ACCESS DENIED
        </Text>
        <Text
          style={{
            fontFamily: theme.fontBody,
            fontSize: 13,
            color: theme.ink2,
            textAlign: 'center',
          }}
        >
          Gimmick needs camera access to take photos
        </Text>
        <PixelButton
          theme={theme}
          big
          label="GRANT ACCESS"
          bg={theme.accent}
          color={theme.onAccent}
          onPress={requestPermission}
        />
        <PixelButton
          theme={theme}
          label="GO BACK"
          bg={theme.surface}
          color={theme.ink}
          onPress={handleClose}
        />
      </View>
    );
  }

  // Camera-overlay icon button: square con border 2px bianco + bg colorato
  // (o trasparente per il flip neutro) + offset shadow bianco. Pattern
  // Android-safe (View interno bg/border, Pressable solo per touch).
  const CameraIconBtn = ({
    onPress, children, size = 44, bg, disabled,
  }: { onPress: () => void; children: React.ReactNode; size?: number; bg?: string; disabled?: boolean }) => {
    const sh = theme.shadowOffset;
    return (
      <View style={{ position: 'relative', paddingRight: sh, paddingBottom: sh, opacity: disabled ? 0.5 : 1 }}>
        {sh > 0 && (
          <View
            style={{
              position: 'absolute',
              left: sh, top: sh, right: 0, bottom: 0,
              backgroundColor: '#FFFFFF',
            }}
          />
        )}
        <Pressable
          onPress={onPress}
          disabled={disabled}
          style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
        >
          <View
            style={{
              width: size,
              height: size,
              borderWidth: 2,
              borderColor: '#FFFFFF',
              backgroundColor: bg ?? 'rgba(0,0,0,0.6)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {children}
          </View>
        </Pressable>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {/* Camera */}
      <CameraView
        ref={cameraRef}
        style={{ flex: 1 }}
        facing={facing}
        flash={flash}
      >
        {/* Top controls */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingTop: 48,
          }}
        >
          <CameraIconBtn onPress={handleClose} bg={theme.semantic.danger}>
            <IconX size={22} color="#FFFFFF" strokeWidth={2.4} />
          </CameraIconBtn>
          <CameraIconBtn onPress={toggleFlash} bg={theme.semantic.warning}>
            {flash === 'on' ? (
              <IconBolt size={22} color="#FFFFFF" strokeWidth={2.4} />
            ) : (
              <IconBoltOff size={22} color="#FFFFFF" strokeWidth={2.4} />
            )}
          </CameraIconBtn>
        </View>

        {/* Bottom controls */}
        <View
          style={{
            position: 'absolute',
            bottom: 48,
            left: 0,
            right: 0,
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 28,
          }}
        >
          {/* Spacer */}
          <View style={{ width: 56 }} />

          {/* Capture button — stesso stile del tile ADD: quadrato verde pieno
              con border 2px bianco + offset shadow bianco + icona camera al
              centro. Opacità ridotta durante lo scatto. */}
          <CameraIconBtn
            onPress={takePicture}
            size={78}
            bg={theme.semantic.success}
            disabled={isTakingPhoto}
          >
            <IconCamera size={36} color="#FFFFFF" strokeWidth={2.2} />
          </CameraIconBtn>

          {/* Flip camera — colore neutro come prima */}
          <CameraIconBtn onPress={toggleFacing} size={56}>
            <IconRefresh size={26} color="#FFFFFF" strokeWidth={2.2} />
          </CameraIconBtn>
        </View>
      </CameraView>

      {/* Preview overlay */}
      <PreviewOverlay
        visible={!!capturedUri}
        type="photo"
        uri={capturedUri ?? ''}
        onCancel={handleCancel}
        onAdd={handleAdd}
        onEdit={handleEdit}
      />
    </View>
  );
}
