import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { CameraView, CameraType, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { IconX, IconRefresh, IconCircle, IconSquare } from '@tabler/icons-react-native';
import * as Haptics from 'expo-haptics';
import { File } from 'expo-file-system/next';
import { PreviewOverlay } from '@/components/capture/PreviewOverlay';
import { useBufferStore, useSettingsStore, toast } from '@/store';
import { createSparkForTile } from '@/lib/api';
import { usePixelTheme, PixelButton } from '@/components/pixel';

const MAX_DURATION = 30; // 30 seconds

export default function VideoCaptureScreen() {
  const theme = usePixelTheme();
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
      toast.error('Error during recording');
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
      queryClient.invalidateQueries({ queryKey: ['tile', tileId] });
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

    toast.success('Video added to buffer');
    router.back();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Pixel overlay icon button: square con border 2px bianco + bg colorato +
  // offset shadow bianco. Mirror del CameraIconBtn in photo.tsx — pattern
  // Android-safe.
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

  // Check permissions
  if (!cameraPermission || !micPermission) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: theme.fontHead, fontSize: 10, color: theme.ink, letterSpacing: 1 }}>
          LOADING…
        </Text>
      </View>
    );
  }

  // Permissions denied
  if (!cameraPermission.granted || !micPermission.granted) {
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
          PERMISSIONS REQUIRED
        </Text>
        <Text
          style={{
            fontFamily: theme.fontBody,
            fontSize: 13,
            color: theme.ink2,
            textAlign: 'center',
          }}
        >
          Gimmick needs camera and microphone access to record video
        </Text>
        <PixelButton
          theme={theme}
          big
          label="GRANT ACCESS"
          bg={theme.accent}
          color={theme.onAccent}
          onPress={async () => {
            await requestCameraPermission();
            await requestMicPermission();
          }}
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
            paddingTop: 48,
          }}
        >
          <CameraIconBtn onPress={handleClose} bg={theme.semantic.danger} disabled={isRecording}>
            <IconX size={22} color="#FFFFFF" strokeWidth={2.4} />
          </CameraIconBtn>

          {/* Recording indicator & timer — pill PressStart2P con dot danger */}
          {isRecording && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderWidth: 2,
                borderColor: '#FFFFFF',
                backgroundColor: 'rgba(0,0,0,0.7)',
              }}
            >
              <View style={{ width: 10, height: 10, backgroundColor: theme.semantic.danger }} />
              <Text
                style={{
                  fontFamily: theme.fontHead,
                  fontSize: 10,
                  color: '#FFFFFF',
                  letterSpacing: 1,
                }}
              >
                {formatTime(recordingTime)} / {formatTime(MAX_DURATION)}
              </Text>
            </View>
          )}

          {/* Placeholder per allineamento (stesso width approx del danger btn) */}
          <View style={{ width: 48 }} />
        </View>

        {/* Progress bar during recording */}
        {isRecording && (
          <View style={{ position: 'absolute', top: 116, left: 16, right: 16 }}>
            <View
              style={{
                height: 8,
                borderWidth: 2,
                borderColor: '#FFFFFF',
                backgroundColor: 'rgba(255,255,255,0.2)',
              }}
            >
              <View
                style={{
                  height: '100%',
                  backgroundColor: theme.semantic.danger,
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
            bottom: 48,
            left: 0,
            right: 0,
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 28,
          }}
        >
          {/* Spacer simmetria con flip */}
          <View style={{ width: 56 }} />

          {/* Record/Stop — verde (success) per avviare, rosso (danger) per
              fermare. Stesso pattern del capture button di photo.tsx. */}
          <CameraIconBtn
            onPress={handleRecordPress}
            size={78}
            bg={isRecording ? theme.semantic.danger : theme.semantic.success}
          >
            {isRecording ? (
              <IconSquare size={32} color="#FFFFFF" fill="#FFFFFF" strokeWidth={2.2} />
            ) : (
              <IconCircle size={36} color="#FFFFFF" fill="#FFFFFF" strokeWidth={2.2} />
            )}
          </CameraIconBtn>

          {/* Flip camera — neutro come in photo.tsx */}
          <CameraIconBtn onPress={toggleFacing} size={56} disabled={isRecording}>
            <IconRefresh size={26} color="#FFFFFF" strokeWidth={2.2} />
          </CameraIconBtn>
        </View>

        {/* Recording hint */}
        {!isRecording && !capturedUri && (
          <View style={{ position: 'absolute', bottom: 144, left: 0, right: 0, alignItems: 'center' }}>
            <Text
              style={{
                fontFamily: theme.fontHead,
                fontSize: 9,
                color: 'rgba(255,255,255,0.7)',
                letterSpacing: 1,
              }}
            >
              PRESS TO RECORD (MAX {MAX_DURATION}S)
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
