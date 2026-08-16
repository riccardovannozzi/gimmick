'use client';

/**
 * Gimmick · Obsidian — Registrazione vocale per la chat.
 *
 * Wrapper su MediaRecorder che consegna un Blob pronto per `/api/chat/voice`
 * (Whisper lato server). È l'equivalente web di `mobile/hooks/useVoiceRecorder`,
 * che su Expo usa `expo-av`: stessa forma — start / stop-con-risultato / cancel
 * — così le due chat si comportano allo stesso modo.
 *
 * Da non confondere con la dettatura del MarkdownEditor, che è Web Speech API e
 * gira nel browser: qui l'audio parte davvero verso il backend, perché la
 * trascrizione è solo metà del lavoro — l'altra metà è la risposta di Claude
 * nello stesso giro.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export type VoiceRecorderStatus = 'idle' | 'recording';

/**
 * Primo formato audio supportato dal browser, stessa logica di
 * `CameraCapture.pickVideoMime`: Chrome/Firefox danno webm/opus, Safari solo
 * mp4. Senza scelta esplicita `new MediaRecorder(stream)` può fallire.
 */
function pickAudioMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/mpeg'];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t));
}

export interface UseVoiceRecorder {
  status: VoiceRecorderStatus;
  /** Secondi trascorsi, per il contatore nel compositore. */
  elapsed: number;
  /** Permesso negato o microfono assente. Vuoto se non c'è stato errore. */
  error: string;
  start: () => Promise<boolean>;
  /** Chiude e restituisce l'audio. `null` se non è stato inciso nulla. */
  stop: () => Promise<Blob | null>;
  /** Interrompe e butta via la registrazione. */
  cancel: () => void;
}

export function useVoiceRecorder(): UseVoiceRecorder {
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  /** Risolutore di `stop()`: la registrazione si chiude in `onstop`, non subito. */
  const resolveRef = useRef<((b: Blob | null) => void) | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [status, setStatus] = useState<VoiceRecorderStatus>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');

  /** Spegne il microfono. Va invocato su OGNI uscita, altrimenti la spia del
   *  browser resta accesa anche a registrazione finita. */
  const release = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
  }, []);

  const start = useCallback(async () => {
    setError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        throw new Error('unsupported');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = pickAudioMime();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const chunks = chunksRef.current;
        const blob = chunks.length
          ? new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' })
          : null;
        release();
        setStatus('idle');
        setElapsed(0);
        // `cancel()` azzera il resolver prima di fermare: in quel caso il blob
        // finisce nel nulla, che è esattamente ciò che si è chiesto.
        resolveRef.current?.(blob);
        resolveRef.current = null;
      };
      recorderRef.current = recorder;
      recorder.start();

      setStatus('recording');
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
      return true;
    } catch (err) {
      release();
      setStatus('idle');
      const name = (err as { name?: string }).name;
      setError(
        name === 'NotAllowedError'
          ? 'Permesso microfono negato.'
          : name === 'NotFoundError'
            ? 'Nessun microfono disponibile.'
            : 'Registrazione non supportata da questo browser.'
      );
      return false;
    }
  }, [release]);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      release();
      setStatus('idle');
      return Promise.resolve(null);
    }
    return new Promise<Blob | null>((resolve) => {
      resolveRef.current = resolve;
      recorder.stop();
    });
  }, [release]);

  const cancel = useCallback(() => {
    const recorder = recorderRef.current;
    resolveRef.current = null;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
      return; // `onstop` fa la pulizia e riporta lo stato a idle
    }
    release();
    setStatus('idle');
    setElapsed(0);
  }, [release]);

  // Smontare il pannello a microfono acceso lascerebbe la spia accesa.
  useEffect(() => release, [release]);

  return { status, elapsed, error, start, stop, cancel };
}
