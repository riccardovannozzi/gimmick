import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Audio } from 'expo-av';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { IconX, IconMicrophone, IconSquare, IconPlayerPlay, IconPlayerPause } from '@tabler/icons-react-native';
import * as Haptics from 'expo-haptics';
import { PreviewOverlay } from '@/components/capture/PreviewOverlay';
import { useBufferStore, useSettingsStore, toast } from '@/store';
import { usePixelTheme, PixelButton } from '@/components/pixel';
import { formatDuration } from '@/utils/formatters';
import { createSparkForTile } from '@/lib/api';

export default function VoiceCaptureScreen() {
  const theme = usePixelTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { tile: tileId } = useLocalSearchParams<{ tile?: string }>();
  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);

  const addItem = useBufferStore((state) => state.addItem);
  const hapticFeedback = useSettingsStore((state) => state.hapticFeedback);

  useEffect(() => {
    checkPermissions();
    return () => {
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync();
      }
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingDuration((prev) => prev + 1000);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const checkPermissions = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      setPermissionGranted(status === 'granted');

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
    } catch (error) {
      console.error('Error checking permissions:', error);
      setPermissionGranted(false);
    }
  };

  const handleClose = () => {
    router.back();
  };

  const startRecording = async () => {
    try {
      if (hapticFeedback) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingDuration(0);
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Error starting recording');
    }
  };

  const stopRecording = async () => {
    try {
      if (!recordingRef.current) return;

      if (hapticFeedback) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();

      setIsRecording(false);
      recordingRef.current = null;

      if (uri) {
        setRecordedUri(uri);
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
      toast.error('Error stopping recording');
    }
  };

  const playRecording = async () => {
    try {
      if (!recordedUri) return;

      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: recordedUri },
        { shouldPlay: true }
      );

      soundRef.current = sound;
      setIsPlaying(true);

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlaying(false);
        }
      });
    } catch (error) {
      console.error('Error playing recording:', error);
      toast.error('Playback error');
    }
  };

  const stopPlayback = async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        setIsPlaying(false);
      }
    } catch (error) {
      console.error('Error stopping playback:', error);
    }
  };

  const handleCancel = () => {
    setRecordedUri(null);
    setRecordingDuration(0);
  };

  const handleAdd = async () => {
    if (!recordedUri) return;
    if (tileId) {
      const res = await createSparkForTile({
        type: 'audio_recording',
        tileId,
        uri: recordedUri,
        duration: recordingDuration,
      });
      if (!res.success) {
        toast.error(res.error || 'Errore nel salvataggio');
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['tile', tileId] });
      toast.success('Audio salvato');
      router.back();
      return;
    }

    addItem({
      type: 'audio_recording',
      uri: recordedUri,
      duration: recordingDuration,
    });

    toast.success('Recording added to buffer');
    router.back();
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Pixel button helper: square con border 2px ink + bg colorato + offset
  // shadow ink. Pattern Android-safe.
  const PixelTile = ({
    onPress, bg, disabled, size = 48, children,
  }: { onPress: () => void; bg: string; disabled?: boolean; size?: number; children: React.ReactNode }) => {
    const sh = theme.shadowOffset;
    return (
      <View style={{ position: 'relative', paddingRight: sh, paddingBottom: sh, opacity: disabled ? 0.4 : 1 }}>
        {sh > 0 && (
          <View
            style={{
              position: 'absolute',
              left: sh, top: sh, right: 0, bottom: 0,
              backgroundColor: theme.shadowColor,
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
              borderColor: theme.border,
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
  };

  // Permission loading
  if (permissionGranted === null) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: theme.fontHead, fontSize: 10, color: theme.ink, letterSpacing: 1 }}>
          LOADING…
        </Text>
      </View>
    );
  }

  // Permission denied
  if (!permissionGranted) {
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
          MICROPHONE ACCESS DENIED
        </Text>
        <Text
          style={{
            fontFamily: theme.fontBody,
            fontSize: 13,
            color: theme.ink2,
            textAlign: 'center',
          }}
        >
          Gimmick needs microphone access to record audio
        </Text>
        <PixelButton
          theme={theme}
          big
          label="TRY AGAIN"
          bg={theme.accent}
          color={theme.onAccent}
          onPress={checkPermissions}
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
    <View style={{ flex: 1, backgroundColor: theme.bg1 }}>
      {/* Header — bordo inferiore 2px, X danger + title PressStart2P */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingTop: 48,
          paddingBottom: 12,
          borderBottomWidth: 2,
          borderBottomColor: theme.border,
          gap: 14,
        }}
      >
        <PixelTile onPress={handleClose} bg={theme.semantic.danger}>
          <IconX size={22} color="#FFFFFF" strokeWidth={2.4} />
        </PixelTile>
        <Text
          style={{
            fontFamily: theme.fontHead,
            fontSize: 11,
            color: theme.ink,
            letterSpacing: 1.2,
            flex: 1,
          }}
        >
          REC NOTE
        </Text>
      </View>

      {/* Main content */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24 }}>
        {/* Duration display — monospace grande */}
        <Text
          style={{
            fontFamily: theme.fontHead,
            fontSize: 36,
            color: theme.ink,
            letterSpacing: 2,
          }}
        >
          {formatDuration(recordingDuration)}
        </Text>

        {/* Recording indicator — pill PressStart2P con dot danger */}
        {isRecording && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderWidth: 2,
              borderColor: theme.border,
              backgroundColor: theme.surface,
            }}
          >
            <View style={{ width: 10, height: 10, backgroundColor: theme.semantic.danger }} />
            <Text
              style={{
                fontFamily: theme.fontHead,
                fontSize: 10,
                color: theme.semantic.danger,
                letterSpacing: 1,
              }}
            >
              RECORDING…
            </Text>
          </View>
        )}

        {/* Record/Stop — verde (success) per avviare, rosso (danger) per
            fermare. Stesso linguaggio del capture button di video. */}
        {!recordedUri && (
          <PixelTile
            onPress={isRecording ? stopRecording : startRecording}
            size={96}
            bg={isRecording ? theme.semantic.danger : theme.semantic.success}
          >
            {isRecording ? (
              <IconSquare size={40} color="#FFFFFF" fill="#FFFFFF" strokeWidth={2.2} />
            ) : (
              <IconMicrophone size={44} color="#FFFFFF" strokeWidth={2} />
            )}
          </PixelTile>
        )}

        {/* Playback controls — blu (info) per play, danger per stop */}
        {recordedUri && !isRecording && (
          <PixelTile
            onPress={isPlaying ? stopPlayback : playRecording}
            size={96}
            bg={isPlaying ? theme.semantic.danger : theme.semantic.info}
          >
            {isPlaying ? (
              <IconPlayerPause size={40} color="#FFFFFF" fill="#FFFFFF" strokeWidth={2} />
            ) : (
              <IconPlayerPlay
                size={40}
                color="#FFFFFF"
                fill="#FFFFFF"
                strokeWidth={2}
                style={{ marginLeft: 4 }}
              />
            )}
          </PixelTile>
        )}

        {/* Hint — visibile prima di registrare */}
        {!isRecording && !recordedUri && (
          <Text
            style={{
              fontFamily: theme.fontHead,
              fontSize: 9,
              color: theme.ink2,
              letterSpacing: 1,
              marginTop: 16,
            }}
          >
            PRESS TO RECORD
          </Text>
        )}
      </View>

      {/* Preview overlay */}
      <PreviewOverlay
        visible={!!recordedUri}
        type="audio_recording"
        uri={recordedUri ?? ''}
        duration={recordingDuration}
        onCancel={handleCancel}
        onAdd={handleAdd}
      />
    </View>
  );
}
