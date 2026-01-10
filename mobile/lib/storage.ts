import {
  readAsStringAsync,
  EncodingType,
} from 'expo-file-system/legacy';
import { supabase } from './supabase';
import { getFileExtension, getMimeType } from '@/utils/formatters';

const BUCKET_NAME = 'memos';

/**
 * Upload a file to Supabase Storage
 */
export async function uploadFile(
  uri: string,
  userId: string,
  folder: string = 'files'
): Promise<{ path: string; error?: string }> {
  try {
    const extension = getFileExtension(uri);
    const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${extension}`;
    const storagePath = `${userId}/${folder}/${fileName}`;

    // Read file as base64
    const base64 = await readAsStringAsync(uri, {
      encoding: EncodingType.Base64,
    });

    // Convert to Uint8Array
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const mimeType = getMimeType(extension);

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, bytes, {
        contentType: mimeType,
        upsert: false,
      });

    if (error) {
      return { path: '', error: error.message };
    }

    return { path: data.path };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    return { path: '', error: message };
  }
}

/**
 * Delete a file from Supabase Storage
 */
export async function deleteFile(path: string): Promise<{ error?: string }> {
  try {
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([path]);

    if (error) {
      return { error: error.message };
    }

    return {};
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Delete failed';
    return { error: message };
  }
}

/**
 * Get public URL for a file
 */
export function getPublicUrl(path: string): string {
  const { data } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(path);

  return data.publicUrl;
}

/**
 * Get signed URL for private file (valid for 1 hour)
 */
export async function getSignedUrl(path: string): Promise<{ url: string; error?: string }> {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(path, 3600); // 1 hour

    if (error) {
      return { url: '', error: error.message };
    }

    return { url: data.signedUrl };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get signed URL';
    return { url: '', error: message };
  }
}
