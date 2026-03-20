import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Audio } from 'expo-av';
import { useRouter } from 'expo-router';
import { IconX, IconMicrophone, IconSquare, IconPlayerPlay, IconPlayerPause } from '@tabler/icons-react-native';
import * as Haptics from 'expo-haptics';
import { PreviewOverlay } from '@/components/capture/PreviewOverlay';
import { useBufferStore, useSettingsStore, toast } from '@/store';
import { useThemeColors } from '@/lib/theme';
import { formatDuration } from '@/utils/formatters';

export default function VoiceCaptureScreen() {
  const colors = useThemeColors();
  const router = useRouter();
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
      // Cleanup
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

  const handleAdd = () => {
    if (!recordedUri) return;

    addItem({
      type: 'audio_recording',
      uri: recordedUri,
      duration: recordingDuration,
    });

    toast.success('Recording added to buffer');
    router.back();
  };

  // Permission loading
  if (permissionGranted === null) {
    return (
      <View className="flex-1 bg-background-1 items-center justify-center">
        <Text className="text-primary">Loading...</Text>
      </View>
    );
  }

  // Permission denied
  if (!permissionGranted) {
    return (
      <View className="flex-1 bg-background-1 items-center justify-center px-8">
        <Text className="text-primary text-lg font-medium text-center mb-4">
          Microphone access denied
        </Text>
        <Text className="text-secondary text-center mb-6">
          Gimmick needs microphone access to record audio
        </Text>
        <TouchableOpacity
          onPress={checkPermissions}
          className="bg-accent px-6 py-3 rounded-lg"
        >
          <Text className="text-white font-medium">Try again</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleClose} className="mt-4">
          <Text className="text-secondary">Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background-1">
      {/* Header */}
      <View className="flex-row items-center px-4 pt-12">
        <TouchableOpacity
          onPress={handleClose}
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: colors.surfaceVariant,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconX size={26} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Main content */}
      <View className="flex-1 items-center justify-center">
        {/* Duration display */}
        <Text className="text-primary text-5xl font-light mb-12">
          {formatDuration(recordingDuration)}
        </Text>

        {/* Recording indicator */}
        {isRecording && (
          <View className="flex-row items-center mb-8">
            <View className="w-3 h-3 rounded-full bg-error mr-2 animate-pulse" />
            <Text className="text-error font-medium">Recording...</Text>
          </View>
        )}

        {/* Record/Stop button */}
        {!recordedUri && (
          <TouchableOpacity
            onPress={isRecording ? stopRecording : startRecording}
            className={`w-24 h-24 rounded-full items-center justify-center ${
              isRecording ? 'bg-error' : 'bg-capture-voice'
            }`}
          >
            {isRecording ? (
              <IconSquare size={36} color="#fff" fill="#fff" />
            ) : (
              <IconMicrophone size={40} color="#fff" />
            )}
          </TouchableOpacity>
        )}

        {/* Playback controls (after recording) */}
        {recordedUri && !isRecording && (
          <TouchableOpacity
            onPress={isPlaying ? stopPlayback : playRecording}
            className="w-24 h-24 rounded-full bg-accent items-center justify-center"
          >
            {isPlaying ? (
              <IconPlayerPause size={36} color="#fff" />
            ) : (
              <IconPlayerPlay size={36} color="#fff" style={{ marginLeft: 4 }} />
            )}
          </TouchableOpacity>
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
