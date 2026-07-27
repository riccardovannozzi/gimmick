import React, { useState, useRef } from 'react';
import { View, Text, Pressable } from 'react-native';
import { CameraView, CameraType, useCameraPermissions, FlashMode } from 'expo-camera';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { IconX, IconRefresh, IconBolt, IconBoltOff, IconCamera } from '@tabler/icons-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { PreviewOverlay } from '@/components/capture/PreviewOverlay';
import { useBufferStore, useSettingsStore, toast } from '@/store';
import { useObsidian } from '@/lib/obsidian';
import { createSparkForTile } from '@/lib/api';

export default function PhotoCaptureScreen() {
  const c = useObsidian();
  const insets = useSafeAreaInsets();
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
      toast.error('Errore nello scatto');
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

    toast.success('Foto aggiunta al buffer');
    router.back();
  };

  const handleEdit = () => {
    // TODO: Navigate to image editor
    toast.info('Editor immagini in arrivo!');
  };

  // Permission not determined yet
  if (!permission) {
    return (
      <View style={{ flex: 1, backgroundColor: c.canvas, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 14, color: c.muted }}>Caricamento…</Text>
      </View>
    );
  }

  // Permission denied
  if (!permission.granted) {
    return (
      <View style={{ flex: 1, backgroundColor: c.canvas, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 14 }}>
        <Text style={{ fontSize: 17, fontWeight: '700', color: c.text, textAlign: 'center' }}>
          Accesso alla fotocamera negato
        </Text>
        <Text style={{ fontSize: 14, lineHeight: 20, color: c.muted, textAlign: 'center', marginBottom: 6 }}>
          Gimmick ha bisogno della fotocamera per scattare foto
        </Text>
        <Pressable
          onPress={requestPermission}
          android_ripple={{ color: c.accent + '55' }}
          style={{ alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', minHeight: 50, borderRadius: 13, backgroundColor: c.accent }}
        >
          <Text style={{ fontSize: 15, fontWeight: '600', color: c.accentInk }}>Concedi accesso</Text>
        </Pressable>
        <Pressable
          onPress={handleClose}
          android_ripple={{ color: c.line }}
          style={{ alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', minHeight: 50, borderRadius: 13, backgroundColor: c.accentSoft }}
        >
          <Text style={{ fontSize: 15, fontWeight: '600', color: c.accent }}>Indietro</Text>
        </Pressable>
      </View>
    );
  }

  // Controllo circolare sopra il feed — stile Obsidian: fondo accentSoft pieno
  // con il glifo in accent (gli stessi due token dei chip della UI). Niente
  // cornice: il contrasto lo dà il fondo, leggibile su qualsiasi inquadratura.
  const CamBtn = ({
    onPress, children, size = 52, bg = c.accentSoft, disabled,
  }: { onPress: () => void; children: React.ReactNode; size?: number; bg?: string; disabled?: boolean }) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      android_ripple={{ color: 'rgba(255,255,255,0.2)', borderless: true }}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: bg, opacity: disabled ? 0.6 : 1 }}
    >
      {children}
    </Pressable>
  );

  const flashOn = flash === 'on';

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
            paddingTop: insets.top + 10,
          }}
        >
          <CamBtn onPress={handleClose}>
            <IconX size={22} color={c.accent} strokeWidth={2} />
          </CamBtn>
          <CamBtn onPress={toggleFlash} bg={flashOn ? c.accent : c.accentSoft}>
            {flashOn ? (
              <IconBolt size={22} color={c.accentInk} strokeWidth={2} />
            ) : (
              <IconBoltOff size={22} color={c.accent} strokeWidth={2} />
            )}
          </CamBtn>
        </View>

        {/* Bottom controls */}
        <View
          style={{
            position: 'absolute',
            bottom: insets.bottom + 28,
            left: 0,
            right: 0,
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 32,
          }}
        >
          {/* Spacer per centrare lo shutter con il flip a destra */}
          <View style={{ width: 52 }} />

          {/* Shutter — cerchio accent pieno, senza anello */}
          <Pressable
            onPress={takePicture}
            disabled={isTakingPhoto}
            hitSlop={6}
            android_ripple={{ color: 'rgba(255,255,255,0.25)', borderless: true }}
            style={{ width: 78, height: 78, borderRadius: 39, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accent, opacity: isTakingPhoto ? 0.6 : 1 }}
          >
            <IconCamera size={32} color={c.accentInk} strokeWidth={2} />
          </Pressable>

          {/* Flip camera */}
          <CamBtn onPress={toggleFacing}>
            <IconRefresh size={24} color={c.accent} strokeWidth={2} />
          </CamBtn>
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
