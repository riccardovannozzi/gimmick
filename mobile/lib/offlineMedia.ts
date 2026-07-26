/**
 * Media durevoli per l'outbox offline.
 *
 * Foto/audio/video catturati finiscono nella cache dir del sistema, che l'OS
 * può ripulire in qualsiasi momento — fatale se una cattura deve sopravvivere
 * offline fino alla prossima connessione (anche giorni dopo, oltre il riavvio
 * dell'app). Copiamo ogni file in una dir persistente dell'app
 * (`documentDirectory/outbox/`), così l'URI persistito nel buffer resta valido
 * quando il sync worker finalmente lo carica.
 *
 * Import `legacy` come nel resto del progetto (vedi lib/storage.ts): l'API a
 * classi di expo-file-system 19 non serve per queste operazioni.
 */
import {
  documentDirectory,
  getInfoAsync,
  makeDirectoryAsync,
  copyAsync,
  deleteAsync,
} from 'expo-file-system/legacy';
import { getFileExtension } from '@/utils/formatters';

const OUTBOX_DIR = `${documentDirectory}outbox/`;

async function ensureDir(): Promise<void> {
  const info = await getInfoAsync(OUTBOX_DIR);
  if (!info.exists) {
    await makeDirectoryAsync(OUTBOX_DIR, { intermediates: true });
  }
}

/** True se l'URI vive nella nostra dir durevole (quindi cancellabile in sicurezza). */
export function isOutboxUri(uri?: string): boolean {
  return !!uri && uri.startsWith(OUTBOX_DIR);
}

/**
 * Copia un file catturato nell'outbox durevole e ne restituisce il nuovo URI.
 * Best-effort: su qualsiasi errore (es. URI content:// non copiabile) torna
 * l'URI originale — una cattura non deve MAI fallire per questo.
 */
export async function copyToOutbox(uri: string): Promise<string> {
  try {
    if (!uri || isOutboxUri(uri)) return uri;
    await ensureDir();
    const ext = getFileExtension(uri);
    const name = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}${ext ? `.${ext}` : ''}`;
    const dest = `${OUTBOX_DIR}${name}`;
    await copyAsync({ from: uri, to: dest });
    return dest;
  } catch {
    return uri;
  }
}

/**
 * Cancella un file dell'outbox. No-op per URI che non sono nostri: non tocchiamo
 * mai gli originali in cache/galleria che non abbiamo copiato noi.
 */
export async function deleteOutboxFile(uri?: string): Promise<void> {
  try {
    if (isOutboxUri(uri)) await deleteAsync(uri as string, { idempotent: true });
  } catch {
    /* best-effort */
  }
}
