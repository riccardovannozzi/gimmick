import {
  readAsStringAsync,
  EncodingType,
} from 'expo-file-system/legacy';
import { supabase } from './supabase';
import { uploadApi } from './api';
import { getFileExtension, getMimeType } from '@/utils/formatters';

const BUCKET_NAME = 'sparks';

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

/**
 * URL firmati per PIÙ file in una sola richiesta.
 *
 * Serve alle liste: la lista Tiles e il dettaglio mostrano un'anteprima per
 * scheda, e con la forma singola ogni scheda costerebbe una richiesta.
 *
 * Passa dal BACKEND e non da `supabase.storage.createSignedUrls`. Il client
 * Supabase del mobile non ha mai una sessione — l'accesso avviene contro le API
 * nostre, e in tutta l'app non esiste una `supabase.auth.setSession` — quindi
 * firmare da qui vuol dire firmare da anonimi: le policy del bucket privato
 * rifiutano, l'errore veniva inghiottito e la mappa tornava vuota. Il risultato
 * era che ogni anteprima ripiegava sulla riga con icona e nome, senza un solo
 * messaggio d'errore. Il backend usa la chiave di servizio e non ha il problema.
 *
 * Restituisce una mappa percorso → URL. I percorsi che falliscono vengono
 * omessi: chi disegna mostra il ripiego, non un errore.
 */
export async function getSignedUrls(paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (paths.length === 0) return out;
  const res = await uploadApi.getSignedUrls(paths);
  for (const [path, url] of Object.entries(res.data?.urls ?? {})) out.set(path, url);
  return out;
}
