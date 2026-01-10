import { useState, useRef } from 'react';
import { Audio } from 'expo-av';

export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);

  const startRecording = async () => {
    try {
      // Richiedi permessi
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        throw new Error('Permesso microfono negato');
      }

      // Configura audio
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Inizia registrazione
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      recordingRef.current = recording;
      setIsRecording(true);
    } catch (error) {
      console.error('Errore avvio registrazione:', error);
      throw error;
    }
  };

  const stopRecording = async (): Promise<string | null> => {
    try {
      if (!recordingRef.current) return null;

      setIsRecording(false);
      await recordingRef.current.stopAndUnloadAsync();

      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      setRecordingUri(uri);

      return uri;
    } catch (error) {
      console.error('Errore stop registrazione:', error);
      return null;
    }
  };

  const cancelRecording = async () => {
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch (error) {
        console.error('Errore cancellazione registrazione:', error);
      }
      recordingRef.current = null;
    }
    setIsRecording(false);
    setRecordingUri(null);
  };

  return {
    isRecording,
    recordingUri,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
