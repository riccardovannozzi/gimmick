/**
 * Da file caricato a blocco di contenuto per la Messages API di Claude.
 *
 * La chat accetta un allegato per messaggio; qui si decide COME farlo arrivare
 * al modello, che non è una scelta unica: Claude legge nativamente immagini e
 * PDF (blocchi `image` / `document`), mentre per tutto il resto non esiste un
 * tipo di blocco e il contenuto va estratto in testo prima di partire.
 *
 * Chi non rientra in nessuno dei due casi viene RIFIUTATO con un messaggio che
 * dice quali formati passano: allegare un .zip e ricevere una risposta generica
 * ("non riesco a leggerlo") sarebbe peggio di un errore in fase di upload.
 */
import Anthropic from '@anthropic-ai/sdk';

/**
 * Tetto per file: la richiesta intera non può superare i 32MB e il base64
 * gonfia di circa un terzo, quindi 12MB di file grezzo lasciano margine per
 * cronologia, prompt di sistema e definizioni dei tool.
 */
export const MAX_ATTACHMENT_BYTES = 12 * 1024 * 1024;

/** Testo estratto: oltre questa soglia si tronca, per non bruciare il contesto. */
const MAX_TEXT_CHARS = 180_000;

/** I soli formati immagine che l'API accetta. Un .bmp o un .tiff qui non entra. */
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
type ImageMime = (typeof IMAGE_TYPES)[number];
const isImageMime = (m: string): m is ImageMime => (IMAGE_TYPES as readonly string[]).includes(m);

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * Formati che sono testo anche quando il mime dice altro (o non dice niente:
 * parecchi client mandano `application/octet-stream` per un .md).
 */
const TEXT_EXTENSIONS = ['.txt', '.md', '.markdown', '.csv', '.json', '.log', '.yml', '.yaml', '.xml', '.html'];

const isTextual = (mime: string, name: string): boolean =>
  mime.startsWith('text/') ||
  mime === 'application/json' ||
  mime.endsWith('+json') ||
  mime === 'application/xml' ||
  TEXT_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext));

export interface UploadedFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

/** Errore da restituire al client con 400: il file non è allegabile. */
export class UnsupportedAttachmentError extends Error {}

/**
 * Impacchetta il testo estratto con il nome del file. Senza l'intestazione il
 * modello vede un muro di testo senza sapere che è un allegato, e nella risposta
 * non sa come chiamarlo.
 */
function textBlock(name: string, body: string): Anthropic.TextBlockParam {
  const trimmed = body.length > MAX_TEXT_CHARS
    ? `${body.slice(0, MAX_TEXT_CHARS)}\n\n[…troncato: il file supera i ${MAX_TEXT_CHARS} caratteri]`
    : body;
  return { type: 'text', text: `Contenuto del file allegato "${name}":\n\n${trimmed}` };
}

export async function fileToContentBlock(file: UploadedFile): Promise<Anthropic.ContentBlockParam> {
  const name = file.originalname || 'allegato';
  const mime = (file.mimetype || '').toLowerCase();

  if (file.buffer.byteLength > MAX_ATTACHMENT_BYTES) {
    throw new UnsupportedAttachmentError(
      `File troppo grande (${Math.round(file.buffer.byteLength / 1024 / 1024)}MB). Il limite è ${MAX_ATTACHMENT_BYTES / 1024 / 1024}MB.`
    );
  }
  if (file.buffer.byteLength === 0) {
    throw new UnsupportedAttachmentError('Il file è vuoto.');
  }

  // Immagini e PDF: Claude li legge da sé, si passano così come sono.
  if (isImageMime(mime)) {
    return {
      type: 'image',
      source: { type: 'base64', media_type: mime, data: file.buffer.toString('base64') },
    };
  }

  if (mime === 'application/pdf' || name.toLowerCase().endsWith('.pdf')) {
    // NOTA: il tetto di pagine dipende dal modello — 100 per quelli con
    // finestra da 200k (l'Haiku usato qui), 600 per i più capienti. Oltre, è
    // l'API a rifiutare: non lo anticipiamo perché contare le pagine
    // richiederebbe di aprire il PDF solo per questo.
    return {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: file.buffer.toString('base64') },
      title: name,
    };
  }

  // DOCX: nessun tipo di blocco nativo, si estrae il testo (stessa libreria
  // dell'indicizzazione degli spark, così un .docx si legge allo stesso modo
  // ovunque nell'app).
  if (mime === DOCX_MIME || name.toLowerCase().endsWith('.docx')) {
    try {
      const mammoth = await import('mammoth');
      const { value } = await mammoth.extractRawText({ buffer: file.buffer });
      if (!value.trim()) throw new Error('nessun testo estratto');
      return textBlock(name, value);
    } catch (err) {
      throw new UnsupportedAttachmentError(
        `Non sono riuscito a leggere il documento Word: ${err instanceof Error ? err.message : 'errore sconosciuto'}`
      );
    }
  }

  if (isTextual(mime, name)) {
    return textBlock(name, file.buffer.toString('utf-8'));
  }

  throw new UnsupportedAttachmentError(
    `Formato non supportato (${mime || 'sconosciuto'}). Puoi allegare immagini (JPEG, PNG, GIF, WebP), PDF, documenti Word o file di testo.`
  );
}
