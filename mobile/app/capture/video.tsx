import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { CameraView, CameraType, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { IconX, IconRefresh, IconVideo, IconSquare } from '@tabler/icons-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { File } from 'expo-file-system/next';
import { PreviewOverlay } from '@/components/capture/PreviewOverlay';
import { useBufferStore, useSettingsStore, toast } from '@/store';
import { createSparkForTile } from '@/lib/api';
import { invalidateTileData } from '@/lib/invalidate';
import { useObsidian } from '@/lib/obsidian';
import { OB_CAP_BTN, OB_CAP_BTN_BG, OB_CAP_BTN_GLYPH, OB_CAP_BTN_LG, OB_CAP_BTN_R } from '@/constants/obsidian';

const MAX_DURATION = 30; // 30 seconds

export default function VideoCaptureScreen() {
  const c = useObsidian();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { tile: tileId } = useLocalSearchParams<{ tile?: string }>();
  const cameraRef = useRef<CameraView>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const addItem = useBufferStore((state) => state.addItem);
  const hapticFeedback = useSettingsStore((state) => state.hapticFeedback);

  // Timer for countdown during recording
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= MAX_DURATION - 1) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording]);

  const handleClose = () => {
    if (isRecording) {
      stopRecording();
    }
    router.back();
  };

  const toggleFacing = () => {
    if (!isRecording) {
      setFacing((current) => (current === 'back' ? 'front' : 'back'));
    }
  };

  const startRecording = async () => {
    if (!cameraRef.current || isRecording) return;

    try {
      setIsRecording(true);
      setRecordingTime(0);

      if (hapticFeedback) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }

      const video = await cameraRef.current.recordAsync({
        maxDuration: MAX_DURATION,
      });

      if (video?.uri) {
        setCapturedUri(video.uri);
      }
    } catch (error) {
      console.error('Error recording video:', error);
      toast.error('Errore durante la registrazione');
    } finally {
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    if (!cameraRef.current || !isRecording) return;

    try {
      if (hapticFeedback) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      cameraRef.current.stopRecording();
    } catch (error) {
      console.error('Error stopping recording:', error);
    }
  };

  const handleRecordPress = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleCancel = () => {
    setCapturedUri(null);
    setRecordingTime(0);
  };

  const handleAdd = async () => {
    if (!capturedUri) return;

    let fileSize: number | undefined;
    try {
      const file = new File(capturedUri);
      fileSize = file.size ?? undefined;
    } catch {};

    if (tileId) {
      const res = await createSparkForTile({
        type: 'video',
        tileId,
        uri: capturedUri,
        size: fileSize,
        duration: recordingTime * 1000,
        mimeType: 'video/mp4',
      });
      if (!res.success) {
        toast.error(res.error || 'Errore nel salvataggio');
        return;
      }
      invalidateTileData(queryClient, tileId);
      toast.success('Video salvato');
      router.back();
      return;
    }

    addItem({
      type: 'video',
      uri: capturedUri,
      duration: recordingTime * 1000,
      size: fileSize,
      mimeType: 'video/mp4',
    });

    toast.success('Video aggiunto al buffer');
    router.back();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Controllo secondario sopra il feed — stesso helper di photo.tsx: quadrato
  // con angoli arrotondati, fondo nero, glifo bianco.
  const CamBtn = ({
    onPress, children, size = OB_CAP_BTN, disabled,
  }: { onPress: () => void; children: React.ReactNode; size?: number; disabled?: boolean }) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      android_ripple={{ color: 'rgba(255,255,255,0.2)', borderless: false }}
      style={{ width: size, height: size, borderRadius: OB_CAP_BTN_R, alignItems: 'center', justifyContent: 'center', backgroundColor: OB_CAP_BTN_BG, opacity: disabled ? 0.6 : 1 }}
    >
      {children}
    </Pressable>
  );

  // Check permissions
  if (!cameraPermission || !micPermission) {
    return (
      <View style={{ flex: 1, backgroundColor: c.canvas, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 14, color: c.muted }}>Caricamento…</Text>
      </View>
    );
  }

  // Permissions denied
  if (!cameraPermission.granted || !micPermission.granted) {
    return (
      <View style={{ flex: 1, backgroundColor: c.canvas, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 14 }}>
        <Text style={{ fontSize: 17, fontWeight: '700', color: c.text, textAlign: 'center' }}>
          Permessi necessari
        </Text>
        <Text style={{ fontSize: 14, lineHeight: 20, color: c.muted, textAlign: 'center', marginBottom: 6 }}>
          Gimmick ha bisogno di fotocamera e microfono per registrare video
        </Text>
        <Pressable
          onPress={async () => {
            await requestCameraPermission();
            await requestMicPermission();
          }}
          android_ripple={{ color: c.accent + '55' }}
          style={{ alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', minHeight: 50, borderRadius: 13, backgroundColor: c.accent }}
        >
          <Text style={{ fontSize: 15, fontWeight: '600', color: c.accentInk }}>Concedi accesso</Text>
        </Pressable>
        <Pressable
          onPress={handleClose}
          android_ripple={{ color: c.line }}
          style={{ alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', minHeight: 50, borderRadius: 13, backgroundColor: OB_CAP_BTN_BG }}
        >
          <Text style={{ fontSize: 15, fontWeight: '600', color: OB_CAP_BTN_GLYPH }}>Indietro</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {/* Camera */}
      <CameraView
        ref={cameraRef}
        style={{ flex: 1 }}
        facing={facing}
        mode="video"
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
          <CamBtn onPress={handleClose} disabled={isRecording}>
            <IconX size={22} color={OB_CAP_BTN_GLYPH} strokeWidth={2} />
          </CamBtn>

          {/* Indicatore di registrazione — pill nera con dot rosso */}
          {isRecording && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingHorizontal: 12,
                height: 34,
                borderRadius: 17,
                backgroundColor: OB_CAP_BTN_BG,
              }}
            >
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.error }} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: OB_CAP_BTN_GLYPH }}>
                {formatTime(recordingTime)} / {formatTime(MAX_DURATION)}
              </Text>
            </View>
          )}

          {/* Placeholder per allineamento (stesso width del pulsante X) */}
          <View style={{ width: OB_CAP_BTN }} />
        </View>

        {/* Progress bar during recording */}
        {isRecording && (
          <View style={{ position: 'absolute', top: insets.top + 74, left: 16, right: 16 }}>
            <View
              style={{
                height: 4,
                borderRadius: 2,
                backgroundColor: 'rgba(255,255,255,0.24)',
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  height: '100%',
                  borderRadius: 2,
                  backgroundColor: c.error,
                  width: `${(recordingTime / MAX_DURATION) * 100}%`,
                }}
              />
            </View>
          </View>
        )}

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
          {/* Spacer per centrare il record con il flip a destra */}
          <View style={{ width: OB_CAP_BTN }} />

          {/* Record/Stop — azione primaria: cerchio grande nero. Lo stato lo
              dice il glifo (videocamera → quadrato di stop, rosso mentre
              registra), coerente con la pill e la barra di avanzamento. */}
          <Pressable
            onPress={handleRecordPress}
            hitSlop={6}
            android_ripple={{ color: 'rgba(255,255,255,0.25)', borderless: true }}
            style={{ width: OB_CAP_BTN_LG, height: OB_CAP_BTN_LG, borderRadius: OB_CAP_BTN_LG / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: OB_CAP_BTN_BG }}
          >
            {isRecording ? (
              <IconSquare size={30} color={c.error} fill={c.error} strokeWidth={2} />
            ) : (
              <IconVideo size={36} color={OB_CAP_BTN_GLYPH} strokeWidth={2} />
            )}
          </Pressable>

          {/* Flip camera */}
          <CamBtn onPress={toggleFacing} disabled={isRecording}>
            <IconRefresh size={24} color={OB_CAP_BTN_GLYPH} strokeWidth={2} />
          </CamBtn>
        </View>

        {/* Recording hint */}
        {!isRecording && !capturedUri && (
          <View style={{ position: 'absolute', bottom: insets.bottom + 124, left: 0, right: 0, alignItems: 'center' }}>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>
              Tocca per registrare (max {MAX_DURATION}s)
            </Text>
          </View>
        )}
      </CameraView>

      {/* Preview overlay */}
      <PreviewOverlay
        visible={!!capturedUri}
        type="video"
        uri={capturedUri ?? ''}
        duration={recordingTime}
        onCancel={handleCancel}
        onAdd={handleAdd}
      />
    </View>
  );
}
