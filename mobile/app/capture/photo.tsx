import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { CameraView, CameraType, useCameraPermissions, FlashMode } from 'expo-camera';
import { useRouter } from 'expo-router';
import { X, RefreshCw, Zap, ZapOff, Circle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { PreviewOverlay } from '@/components/capture/PreviewOverlay';
import { useBufferStore, useSettingsStore, toast } from '@/store';
import { useThemeColors } from '@/lib/theme';

export default function PhotoCaptureScreen() {
  const colors = useThemeColors();
  const router = useRouter();
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

  const handleAdd = () => {
    if (!capturedUri) return;

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
      <View className="flex-1 bg-background-1 items-center justify-center">
        <Text className="text-primary">Loading...</Text>
      </View>
    );
  }

  // Permission denied
  if (!permission.granted) {
    return (
      <View className="flex-1 bg-background-1 items-center justify-center px-8">
        <Text className="text-primary text-lg font-medium text-center mb-4">
          Camera access denied
        </Text>
        <Text className="text-secondary text-center mb-6">
          Gimmick needs camera access to take photos
        </Text>
        <TouchableOpacity
          onPress={requestPermission}
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
        flash={flash}
      >
        {/* Top controls */}
        <View className="flex-row justify-between items-center px-4 pt-12">
          <TouchableOpacity
            onPress={handleClose}
            className="w-10 h-10 rounded-full bg-black/50 items-center justify-center"
          >
            <X size={24} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={toggleFlash}
            className="w-10 h-10 rounded-full bg-black/50 items-center justify-center"
          >
            {flash === 'on' ? (
              <Zap size={24} color={colors.warning} />
            ) : (
              <ZapOff size={24} color="#fff" />
            )}
          </TouchableOpacity>
        </View>

        {/* Bottom controls */}
        <View className="absolute bottom-12 left-0 right-0 flex-row justify-center items-center">
          {/* Spacer */}
          <View className="w-16" />

          {/* Capture button */}
          <TouchableOpacity
            onPress={takePicture}
            disabled={isTakingPhoto}
            className="mx-8"
          >
            <View className="w-20 h-20 rounded-full border-4 border-white items-center justify-center">
              <View
                className={`w-16 h-16 rounded-full ${
                  isTakingPhoto ? 'bg-white/50' : 'bg-white'
                }`}
              />
            </View>
          </TouchableOpacity>

          {/* Flip camera button */}
          <TouchableOpacity
            onPress={toggleFacing}
            className="w-16 h-16 rounded-full bg-black/50 items-center justify-center"
          >
            <RefreshCw size={28} color="#fff" />
          </TouchableOpacity>
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
