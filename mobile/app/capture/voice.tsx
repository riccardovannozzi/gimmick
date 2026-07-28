import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Audio } from 'expo-av';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { IconX, IconWaveSine, IconSquare, IconPlayerPlay, IconPlayerPause } from '@tabler/icons-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { PreviewOverlay } from '@/components/capture/PreviewOverlay';
import { useBufferStore, useSettingsStore, toast } from '@/store';
import { useObsidian } from '@/lib/obsidian';
import { OB_CAP_BTN_BG, OB_CAP_BTN_GLYPH, OB_CAP_BTN_LG, OB_CAP_BTN_R } from '@/constants/obsidian';
import { formatDuration } from '@/utils/formatters';
import { createSparkForTile } from '@/lib/api';

export default function VoiceCaptureScreen() {
  const c = useObsidian();
  const insets = useSafeAreaInsets();
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
      toast.error('Errore nell’avvio della registrazione');
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
      toast.error('Errore nell’arresto della registrazione');
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
      toast.error('Errore di riproduzione');
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

    toast.success('Registrazione aggiunta al buffer');
    router.back();
  };

  // Azione primaria (record / playback) — cerchio grande nero, glifo bianco.
  const RoundBtn = ({
    onPress, size = OB_CAP_BTN_LG, children, label,
  }: { onPress: () => void; size?: number; children: React.ReactNode; label: string }) => (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      hitSlop={6}
      android_ripple={{ color: 'rgba(255,255,255,0.2)', borderless: true }}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: OB_CAP_BTN_BG }}
    >
      {children}
    </Pressable>
  );

  // Permission loading
  if (permissionGranted === null) {
    return (
      <View style={{ flex: 1, backgroundColor: c.canvas, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 14, color: c.muted }}>Caricamento…</Text>
      </View>
    );
  }

  // Permission denied
  if (!permissionGranted) {
    return (
      <View style={{ flex: 1, backgroundColor: c.canvas, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 14 }}>
        <Text style={{ fontSize: 17, fontWeight: '700', color: c.text, textAlign: 'center' }}>
          Accesso al microfono negato
        </Text>
        <Text style={{ fontSize: 14, lineHeight: 20, color: c.muted, textAlign: 'center', marginBottom: 6 }}>
          Gimmick ha bisogno del microfono per registrare audio
        </Text>
        <Pressable
          onPress={checkPermissions}
          android_ripple={{ color: c.accent + '55' }}
          style={{ alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', minHeight: 50, borderRadius: 13, backgroundColor: c.accent }}
        >
          <Text style={{ fontSize: 15, fontWeight: '600', color: c.accentInk }}>Riprova</Text>
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
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
      {/* Header — X tonda + titolo, hairline inferiore (come /capture/text) */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingTop: insets.top + 10,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: c.line,
          gap: 12,
        }}
      >
        <Pressable
          onPress={handleClose}
          accessibilityLabel="Chiudi"
          hitSlop={6}
          android_ripple={{ color: c.line, borderless: true }}
          style={{ width: 44, height: 44, borderRadius: OB_CAP_BTN_R, alignItems: 'center', justifyContent: 'center', backgroundColor: OB_CAP_BTN_BG }}
        >
          <IconX size={20} color={OB_CAP_BTN_GLYPH} strokeWidth={1.9} />
        </Pressable>
        <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: c.text }}>Nota vocale</Text>
      </View>

      {/* Main content */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24 }}>
        {/* Durata */}
        <Text style={{ fontSize: 44, fontWeight: '700', letterSpacing: 1, color: c.text, fontVariant: ['tabular-nums'] }}>
          {formatDuration(recordingDuration)}
        </Text>

        {/* Indicatore di registrazione — pill con dot rosso */}
        {isRecording && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingHorizontal: 12,
              height: 32,
              borderRadius: 16,
              backgroundColor: OB_CAP_BTN_BG,
            }}
          >
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.error }} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: c.error }}>Registrazione…</Text>
          </View>
        )}

        {/* Record/Stop — accent per avviare, rosso per fermare */}
        {!recordedUri && (
          <RoundBtn
            onPress={isRecording ? stopRecording : startRecording}
            label={isRecording ? 'Ferma registrazione' : 'Avvia registrazione'}
          >
            {isRecording ? (
              <IconSquare size={34} color={c.error} fill={c.error} strokeWidth={2} />
            ) : (
              <IconWaveSine size={42} color={OB_CAP_BTN_GLYPH} strokeWidth={2} />
            )}
          </RoundBtn>
        )}

        {/* Playback — riproduci / ferma l'ascolto */}
        {recordedUri && !isRecording && (
          <RoundBtn
            onPress={isPlaying ? stopPlayback : playRecording}
            label={isPlaying ? 'Ferma riproduzione' : 'Riproduci'}
          >
            {isPlaying ? (
              <IconPlayerPause size={36} color={OB_CAP_BTN_GLYPH} fill={OB_CAP_BTN_GLYPH} strokeWidth={2} />
            ) : (
              <IconPlayerPlay
                size={36}
                color={OB_CAP_BTN_GLYPH}
                fill={OB_CAP_BTN_GLYPH}
                strokeWidth={2}
                style={{ marginLeft: 4 }}
              />
            )}
          </RoundBtn>
        )}

        {/* Hint — visibile prima di registrare */}
        {!isRecording && !recordedUri && (
          <Text style={{ fontSize: 13, color: c.muted, marginTop: 12 }}>Tocca per registrare</Text>
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
