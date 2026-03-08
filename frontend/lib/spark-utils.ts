import type { SparkType } from '@/types';

export const typeColors: Record<SparkType, string> = {
  photo: 'bg-blue-500/20 text-blue-400',
  image: 'bg-green-500/20 text-green-400',
  video: 'bg-orange-500/20 text-orange-400',
  audio_recording: 'bg-red-500/20 text-red-400',
  text: 'bg-purple-500/20 text-purple-400',
  file: 'bg-yellow-500/20 text-yellow-400',
};

export const typeLabels: Record<SparkType, string> = {
  photo: 'Foto',
  image: 'Immagine',
  video: 'Video',
  audio_recording: 'Registrazione Audio',
  text: 'Testo',
  file: 'File',
};

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
