'use client';

/**
 * Cattura da webcam sul web: foto (`mode="photo"`) e video (`mode="video"`).
 *
 * È il pezzo che rende veri i nomi dei canali. Finché il frontend sapeva solo
 * aprire un file picker, "Photo" e "Video" promettevano una creazione che non
 * avveniva — ed erano di fatto duplicati di File/attach, che l'importazione la
 * fa già. Qui la cattura avviene davvero, quindi:
 *   - Photo → spark `photo` (catturata ora, timestamp attendibile)
 *   - Video → spark `video` registrato dal dispositivo
 * mentre il picker resta il canale `image` (contenuto preesistente, data ignota).
 *
 * Flusso a due stadi — ripresa live, poi revisione — così uno scatto storto o
 * una registrazione sbagliata si rifanno senza uscire dalla modale.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { IconCamera, IconVideo, IconX, IconRefresh, IconCheck, IconPlayerStopFilled } from '@tabler/icons-react';

type Phase = 'starting' | 'live' | 'recording' | 'review' | 'error';
export type CaptureMode = 'photo' | 'video';

/** Risultato della cattura. `duration` valorizzata solo per il video (secondi). */
export interface CapturedMedia {
  file: File;
  duration?: number;
}

export interface CameraCaptureProps {
  open: boolean;
  mode: CaptureMode;
  onCancel: () => void;
  onCapture: (media: CapturedMedia) => void | Promise<void>;
}

/**
 * Primo formato supportato dal browser. Chrome/Firefox danno webm; Safari solo
 * mp4. Senza questa scelta esplicita `new MediaRecorder(stream)` può fallire o
 * produrre un file che il browser stesso non sa poi rileggere.
 */
function pickVideoMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t));
}

export function CameraCapture({ open, mode, onCancel, onCapture }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);

  const [phase, setPhase] = useState<Phase>('starting');
  const [error, setError] = useState('');
  const [shot, setShot] = useState<{ url: string; file: File; duration?: number } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [saving, setSaving] = useState(false);

  const isVideo = mode === 'video';

  /** Spegne webcam e microfono. Va invocato su OGNI uscita: senza, la spia della
   *  telecamera resta accesa anche a modale chiusa. */
  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    setPhase('starting');
    setError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
        // L'audio serve solo al video: chiederlo per una foto farebbe comparire
        // senza motivo il microfono nel prompt dei permessi.
        audio: isVideo,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => { /* autoplay negato */ });
      }
      setPhase('live');
    } catch (e) {
      const name = e instanceof DOMException ? e.name : '';
      setError(
        name === 'NotAllowedError'
          ? `Permesso negato. Autorizza ${isVideo ? 'fotocamera e microfono' : 'la fotocamera'} dalle impostazioni del browser e riprova.`
          : name === 'NotFoundError'
            ? `Nessun${isVideo ? 'a fotocamera o microfono rilevati' : 'a fotocamera rilevata'} su questo dispositivo.`
            : name === 'NotReadableError'
              ? 'Il dispositivo è già in uso da un\'altra applicazione.'
              : 'Cattura non disponibile in questo browser.',
      );
      setPhase('error');
    }
  }, [isVideo]);

  useEffect(() => {
    if (!open) return;
    start();
    return () => stopStream();
  }, [open, start, stopStream]);

  // Revoca l'object URL della cattura scartata, altrimenti resta in memoria.
  useEffect(() => () => { if (shot) URL.revokeObjectURL(shot.url); }, [shot]);

  // Cronometro della registrazione.
  useEffect(() => {
    if (phase !== 'recording') return;
    const id = window.setInterval(() => {
      setElapsed(Math.floor((performance.now() - startedAtRef.current) / 1000));
    }, 250);
    return () => window.clearInterval(id);
  }, [phase]);

  // ── Foto ───────────────────────────────────────────────────────────────────
  const takeShot = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const file = new File([blob], `photo-${stamp}.jpg`, { type: 'image/jpeg' });
      setShot({ url: URL.createObjectURL(blob), file });
      setPhase('review');
      stopStream();
    }, 'image/jpeg', 0.9);
  }, [stopStream]);

  // ── Video ──────────────────────────────────────────────────────────────────
  const startRecording = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    const mimeType = pickVideoMime();
    if (!mimeType) {
      setError('Registrazione video non supportata da questo browser.');
      setPhase('error');
      return;
    }
    const rec = new MediaRecorder(stream, { mimeType });
    chunksRef.current = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      chunksRef.current = [];
      const ext = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const file = new File([blob], `video-${stamp}.${ext}`, { type: mimeType });
      // Durata misurata sul tempo di registrazione: il webm prodotto da
      // MediaRecorder ha spesso durata non interrogabile finché non è
      // riprodotto per intero.
      const duration = Math.max(1, Math.round((performance.now() - startedAtRef.current) / 1000));
      setShot({ url: URL.createObjectURL(blob), file, duration });
      setPhase('review');
      stopStream();
    };
    recorderRef.current = rec;
    startedAtRef.current = performance.now();
    setElapsed(0);
    rec.start();
    setPhase('recording');
  }, [stopStream]);

  const stopRecording = useCallback(() => {
    recorderRef.current?.state === 'recording' && recorderRef.current.stop();
    recorderRef.current = null;
  }, []);

  const retake = useCallback(() => {
    if (shot) URL.revokeObjectURL(shot.url);
    setShot(null);
    start();
  }, [shot, start]);

  const confirm = useCallback(async () => {
    if (!shot || saving) return;
    setSaving(true);
    try {
      await onCapture({ file: shot.file, duration: shot.duration });
    } finally {
      setSaving(false);
    }
  }, [shot, saving, onCapture]);

  const close = useCallback(() => {
    stopRecording();
    stopStream();
    onCancel();
  }, [stopRecording, stopStream, onCancel]);

  // Esc chiude; Spazio scatta o avvia/ferma la registrazione.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { close(); return; }
      if (e.key !== ' ') return;
      if (phase === 'live') { e.preventDefault(); isVideo ? startRecording() : takeShot(); }
      else if (phase === 'recording') { e.preventDefault(); stopRecording(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, phase, isVideo, close, takeShot, startRecording, stopRecording]);

  if (!open) return null;

  const accent = isVideo ? 'var(--ob-type-video)' : 'var(--ob-type-photo)';
  const title = phase === 'review'
    ? (isVideo ? 'Conferma la registrazione' : 'Conferma lo scatto')
    : (isVideo ? 'Registra un video' : 'Scatta una foto');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={close}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(680px, 92vw)', background: 'var(--ob-surface)',
          border: '1px solid var(--ob-line-2)', borderRadius: 12, overflow: 'hidden',
          boxShadow: 'var(--ob-shadow-card)', fontFamily: 'var(--ob-font-sans)',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
          borderBottom: '1px solid var(--ob-line)', background: 'var(--ob-head)',
        }}>
          {isVideo ? <IconVideo size={16} style={{ color: accent }} /> : <IconCamera size={16} style={{ color: accent }} />}
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ob-text)' }}>{title}</span>
          {phase === 'recording' && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginLeft: 4 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--ob-error)' }} />
              <span style={{ fontFamily: 'var(--ob-font-mono)', fontSize: 11.5, color: 'var(--ob-text)' }}>
                {String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}
              </span>
            </span>
          )}
          <div style={{ flex: 1 }} />
          <button type="button" onClick={close} aria-label="Chiudi" style={iconBtn}><IconX size={15} /></button>
        </div>

        <div style={{
          position: 'relative', aspectRatio: '16 / 9', background: '#000',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {phase === 'error' ? (
            <p style={{ color: 'var(--ob-subtle)', fontSize: 12.5, textAlign: 'center', padding: '0 32px', lineHeight: 1.5 }}>
              {error}
            </p>
          ) : phase === 'review' && shot ? (
            isVideo ? (
              <video src={shot.url} controls playsInline style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shot.url} alt="Anteprima dello scatto" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            )
          ) : (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                // Anteprima specchiata: inquadrarsi in un'immagine non speculare
                // disorienta. Il file salvato NON è specchiato — canvas e
                // MediaRecorder leggono lo stream originale, non il CSS.
                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
              />
              {phase === 'starting' && (
                <span style={{ position: 'absolute', color: 'var(--ob-subtle)', fontSize: 12 }}>
                  Attivazione {isVideo ? 'fotocamera e microfono' : 'fotocamera'}…
                </span>
              )}
            </>
          )}
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '10px 12px', borderTop: '1px solid var(--ob-line)', background: 'var(--ob-head)',
        }}>
          {phase === 'review' ? (
            <>
              <button type="button" onClick={retake} style={ghostBtn}>
                <IconRefresh size={14} /> Rifai
              </button>
              <button type="button" onClick={confirm} disabled={saving} style={primaryBtn(saving)}>
                <IconCheck size={14} /> {saving ? 'Salvataggio…' : (isVideo ? 'Usa questo video' : 'Usa questa foto')}
              </button>
            </>
          ) : phase === 'error' ? (
            <button type="button" onClick={start} style={ghostBtn}><IconRefresh size={14} /> Riprova</button>
          ) : phase === 'recording' ? (
            <button type="button" onClick={stopRecording} aria-label="Ferma la registrazione" style={{
              width: 52, height: 52, borderRadius: '50%', border: '3px solid var(--ob-line-2)',
              background: 'var(--ob-error)', color: '#fff', display: 'flex',
              alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}>
              <IconPlayerStopFilled size={18} />
            </button>
          ) : (
            <button
              type="button"
              onClick={isVideo ? startRecording : takeShot}
              disabled={phase !== 'live'}
              aria-label={isVideo ? 'Avvia la registrazione' : 'Scatta'}
              style={{
                width: 52, height: 52, borderRadius: '50%', border: '3px solid var(--ob-line-2)',
                background: phase === 'live' ? accent : 'var(--ob-surface-2)',
                cursor: phase === 'live' ? 'pointer' : 'default',
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center',
  justifyContent: 'center', color: 'var(--ob-subtle)', background: 'transparent',
  border: 'none', cursor: 'pointer',
};

const ghostBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 12px',
  borderRadius: 8, background: 'transparent', color: 'var(--ob-text)',
  border: '1px solid var(--ob-line-2)', fontFamily: 'var(--ob-font-sans)',
  fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
};

const primaryBtn = (disabled: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 12px',
  borderRadius: 8, background: 'var(--ob-accent)', color: 'var(--ob-on-accent, #fff)',
  border: 'none', fontFamily: 'var(--ob-font-sans)', fontSize: 12.5, fontWeight: 600,
  cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1,
});
