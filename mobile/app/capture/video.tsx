import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { CameraView, CameraType, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { IconX, IconRefresh, IconCircle, IconSquare } from '@tabler/icons-react-native';
import * as Haptics from 'expo-haptics';
import { File } from 'expo-file-system/next';
import { PreviewOverlay } from '@/components/capture/PreviewOverlay';
import { useBufferStore, useSettingsStore, toast } from '@/store';
const MAX_DURATION = 30; // 30 seconds

export default function VideoCaptureScreen() {
  const router = useRouter();
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

  // Check permissions
  if (!cameraPermission || !micPermission) {
    return (
      <View className="flex-1 bg-background-1 items-center justify-center">
        <Text className="text-primary">Loading...</Text>
      </View>
    );
  }

  // Permissions denied
  if (!cameraPermission.granted || !micPermission.granted) {
    return (
      <View className="flex-1 bg-background-1 items-center justify-center px-8">
        <Text className="text-primary text-lg font-medium text-center mb-4">
          Permissions required
        </Text>
        <Text className="text-secondary text-center mb-6">
          Gimmick needs camera and microphone access to record video
        </Text>
        <TouchableOpacity
          onPress={async () => {
            await requestCameraPermission();
            await requestMicPermission();
          }}
          className="bg-accent px-6 py-3 rounded-lg"
        >
          <Text className="text-white font-medium">Grant access</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleClose} className="mt-4">
          <Text className="text-secondary">Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      {/* Camera */}
      <CameraView
        ref={cameraRef}
        style={{ flex: 1 }}
        facing={facing}
        mode="video"
      >
        {/* Top controls */}
        <View className="flex-row justify-between items-center px-4 pt-12">
          <TouchableOpacity
            onPress={handleClose}
            className="w-10 h-10 rounded-full bg-black/50 items-center justify-center"
            disabled={isRecording}
          >
            <IconX size={24} color="#fff" />
          </TouchableOpacity>

          {/* Recording indicator & timer */}
          {isRecording && (
            <View className="flex-row items-center bg-black/50 px-3 py-2 rounded-full">
              <View className="w-3 h-3 rounded-full bg-error mr-2" />
              <Text className="text-white font-mono">
                {formatTime(recordingTime)} / {formatTime(MAX_DURATION)}
              </Text>
            </View>
          )}

          {/* Placeholder for alignment */}
          <View className="w-10" />
        </View>

        {/* Progress bar during recording */}
        {isRecording && (
          <View className="absolute top-28 left-4 right-4">
            <View className="h-1 bg-white/30 rounded-full overflow-hidden">
              <View
                className="h-full bg-error rounded-full"
                style={{ width: `${(recordingTime / MAX_DURATION) * 100}%` }}
              />
            </View>
          </View>
        )}

        {/* Bottom controls */}
        <View className="absolute bottom-12 left-0 right-0 flex-row justify-center items-center">
          {/* Spacer */}
          <View className="w-16" />

          {/* Record button */}
          <TouchableOpacity
            onPress={handleRecordPress}
            className="mx-8"
          >
            <View className="w-20 h-20 rounded-full border-4 border-white items-center justify-center">
              {isRecording ? (
                // Stop icon (square)
                <View className="w-8 h-8 rounded bg-error" />
              ) : (
                // Record icon (red circle)
                <View className="w-16 h-16 rounded-full bg-error" />
              )}
            </View>
          </TouchableOpacity>

          {/* Flip camera button */}
          <TouchableOpacity
            onPress={toggleFacing}
            className="w-16 h-16 rounded-full bg-black/50 items-center justify-center"
            disabled={isRecording}
            style={{ opacity: isRecording ? 0.5 : 1 }}
          >
            <IconRefresh size={28} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Recording hint */}
        {!isRecording && !capturedUri && (
          <View className="absolute bottom-36 left-0 right-0 items-center">
            <Text className="text-white/70 text-sm">
              Press to record (max {MAX_DURATION}s)
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
