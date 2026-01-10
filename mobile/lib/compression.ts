import {
  getInfoAsync,
  copyAsync,
  deleteAsync,
  cacheDirectory,
} from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

const DEFAULT_OPTIONS: CompressionOptions = {
  maxWidth: 1920,
  maxHeight: 1080,
  quality: 0.8,
};

/**
 * Compress an image file
 */
export async function compressImage(
  uri: string,
  options: CompressionOptions = {}
): Promise<{ uri: string; error?: string }> {
  try {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    const result = await manipulateAsync(
      uri,
      [
        {
          resize: {
            width: opts.maxWidth,
            height: opts.maxHeight,
          },
        },
      ],
      {
        compress: opts.quality,
        format: SaveFormat.JPEG,
      }
    );

    return { uri: result.uri };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Compression failed';
    return { uri, error: message };
  }
}

/**
 * Generate thumbnail from image
 */
export async function generateThumbnail(
  uri: string,
  size: number = 200
): Promise<{ uri: string; error?: string }> {
  try {
    const result = await manipulateAsync(
      uri,
      [
        {
          resize: {
            width: size,
            height: size,
          },
        },
      ],
      {
        compress: 0.6,
        format: SaveFormat.JPEG,
      }
    );

    return { uri: result.uri };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Thumbnail generation failed';
    return { uri: '', error: message };
  }
}

/**
 * Get file info (size)
 */
export async function getFileInfo(uri: string): Promise<{
  size: number;
  exists: boolean;
  error?: string;
}> {
  try {
    const info = await getInfoAsync(uri);

    if (!info.exists) {
      return { size: 0, exists: false };
    }

    return {
      size: info.size ?? 0,
      exists: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get file info';
    return { size: 0, exists: false, error: message };
  }
}

/**
 * Copy file to app's cache directory
 */
export async function copyToCache(uri: string): Promise<{ uri: string; error?: string }> {
  try {
    const fileName = uri.split('/').pop() ?? `file_${Date.now()}`;
    const cacheUri = `${cacheDirectory}${fileName}`;

    await copyAsync({
      from: uri,
      to: cacheUri,
    });

    return { uri: cacheUri };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to copy file';
    return { uri: '', error: message };
  }
}

/**
 * Delete cached file
 */
export async function deleteCachedFile(uri: string): Promise<{ error?: string }> {
  try {
    const info = await getInfoAsync(uri);

    if (info.exists) {
      await deleteAsync(uri, { idempotent: true });
    }

    return {};
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete file';
    return { error: message };
  }
}
