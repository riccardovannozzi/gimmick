'use client';

/**
 * Gimmick · Obsidian — Ask Gimmick collegata ai dati reali (Fase 7).
 *
 * `AskLive` gestisce la conversazione e chiama `chatApi` (loop tool-use lato
 * backend), mostrando i pulsanti filtro Spark/Tile (seedano `useFilterStore` e
 * navigano a /sparks o /tiles, come la ChatPanel arcade). `AskPanel` è il
 * contenitore overlay a destra montato dallo shell al posto della ChatPanel.
 *
 * Allineata alla chat mobile: allegati (`/api/chat/attach`), messaggi vocali
 * (`/api/chat/voice`, Whisper), lettura ad alta voce (`/api/chat/tts`), risposte
 * rese in Markdown e conversazione persistita in `useChatStore`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AskView } from '@/components/views/ask';
import { Icon } from '@/components/shell';
import { useObsidianTheme } from '@/lib/theme/obsidian-provider';
import { useFilterStore } from '@/store/filter-store';
import { useChatStore, type AskMessage } from '@/store/chat-store';
import { useVoiceRecorder } from '@/hooks/use-voice-recorder';
import { chatApi } from '@/lib/api';

/**
 * Quanti turni passati accompagnano la domanda. Il backend ne accetta al
 * massimo 50 (`chatSchema`) e ora che la conversazione è persistita può
 * superarli: senza questo taglio, una chat lunga comincerebbe a farsi rifiutare
 * con un errore di validazione.
 */
const HISTORY_LIMIT = 50;

/** Domanda di riserva quando si allega un file senza scrivere nulla: la rotta
 *  `/attach` esige un messaggio, e "guarda questo" è ciò che si intendeva. */
const DEFAULT_ATTACHMENT_PROMPT = 'Cosa contiene questo file?';

const toHistory = (msgs: AskMessage[]) =>
  msgs.slice(-HISTORY_LIMIT).map(({ role, content }) => ({ role, content }));

export function AskLive({ onClose }: { onClose?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const setSparkFilter = useFilterStore((s) => s.setSparkFilter);
  const setTileFilter = useFilterStore((s) => s.setTileFilter);

  const messages = useChatStore((s) => s.messages);
  const setMessages = useChatStore((s) => s.setMessages);
  const clearMessages = useChatStore((s) => s.clear);
  const hydrate = useChatStore((s) => s.hydrate);
  const expireIfStale = useChatStore((s) => s.expireIfStale);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [voiceError, setVoiceError] = useState('');
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);

  const recorder = useVoiceRecorder();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Il pannello si smonta a ogni chiusura: qui si rilegge la conversazione dal
  // localStorage e si applica la scadenza per inattività.
  useEffect(() => {
    hydrate();
    expireIfStale();
  }, [hydrate, expireIfStale]);

  /** Ferma la lettura in corso. Una risposta letta a metà mentre se ne apre
   *  un'altra continuerebbe a parlare sopra. */
  const stopSpeaking = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    setSpeakingIndex(null);
  }, []);

  // Chiudere il pannello (o cambiare pagina) con l'audio acceso lo lascerebbe
  // parlare da solo, senza più un pulsante per zittirlo.
  useEffect(() => stopSpeaking, [stopSpeaking]);

  const send = useCallback(
    async (text: string) => {
      const file = attachment;
      const t = text.trim() || (file ? DEFAULT_ATTACHMENT_PROMPT : '');
      if (!t || isLoading) return;

      const history = messages;
      const next: AskMessage[] = [
        ...history,
        { role: 'user', content: t, ...(file ? { attachmentName: file.name } : {}) },
      ];
      setMessages(next);
      setInput('');
      setAttachment(null);
      setVoiceError('');
      setIsLoading(true);
      try {
        const res = file
          ? await chatApi.sendWithFile(t, file, toHistory(history))
          : await chatApi.send(t, toHistory(history));
        if (res.success && res.data?.reply) {
          setMessages([
            ...next,
            {
              role: 'assistant',
              content: res.data.reply,
              foundSparkIds: res.data.foundSparkIds?.length ? res.data.foundSparkIds : undefined,
              foundTileIds: res.data.foundTileIds?.length ? res.data.foundTileIds : undefined,
            },
          ]);
        } else {
          setMessages([...next, { role: 'assistant', content: res.error || 'Errore nella risposta.' }]);
        }
      } catch {
        setMessages([...next, { role: 'assistant', content: 'Errore di connessione.' }]);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, isLoading, attachment, setMessages],
  );

  // ── Voce ───────────────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    setVoiceError('');
    stopSpeaking();
    await recorder.start();
  }, [recorder, stopSpeaking]);

  const stopRecording = useCallback(async () => {
    const blob = await recorder.stop();
    if (!blob || blob.size === 0) return;

    // Il messaggio compare subito come segnaposto e viene riscritto con la
    // trascrizione quando torna: senza, il turno resterebbe invisibile per tutto
    // il tempo di Whisper + Claude.
    const history = messages;
    const placeholder: AskMessage[] = [...history, { role: 'user', content: '🎙 Messaggio vocale…' }];
    setMessages(placeholder);
    setIsLoading(true);
    try {
      const res = await chatApi.sendVoice(blob, toHistory(history));
      if (res.success && res.data?.reply) {
        const transcript = res.data.transcript?.trim();
        setMessages([
          ...history,
          { role: 'user', content: transcript || '🎙 Messaggio vocale' },
          {
            role: 'assistant',
            content: res.data.reply,
            foundSparkIds: res.data.foundSparkIds?.length ? res.data.foundSparkIds : undefined,
            foundTileIds: res.data.foundTileIds?.length ? res.data.foundTileIds : undefined,
          },
        ]);
      } else {
        setMessages([...placeholder, { role: 'assistant', content: res.error || 'Errore nella risposta.' }]);
      }
    } catch {
      setMessages([...placeholder, { role: 'assistant', content: 'Errore di connessione.' }]);
    } finally {
      setIsLoading(false);
    }
  }, [recorder, messages, setMessages]);

  // ── Lettura ad alta voce ───────────────────────────────────────────────────
  const speak = useCallback(
    async (index: number) => {
      if (speakingIndex === index) {
        stopSpeaking();
        return;
      }
      stopSpeaking();
      const text = messages[index]?.content;
      if (!text) return;
      setSpeakingIndex(index);
      const audio = await chatApi.speak(text);
      if (!audio) {
        setSpeakingIndex(null);
        setVoiceError('Lettura non riuscita.');
        return;
      }
      // Nel frattempo l'utente può aver fermato tutto o chiesto un'altra
      // risposta: la richiesta TTS è asincrona e non va data per ancora valida.
      if (useChatStore.getState().messages[index]?.content !== text) {
        setSpeakingIndex(null);
        return;
      }
      audioRef.current = audio;
      audio.addEventListener('ended', () => {
        audioRef.current = null;
        setSpeakingIndex(null);
      });
      try {
        await audio.play();
      } catch {
        audioRef.current = null;
        setSpeakingIndex(null);
      }
    },
    [messages, speakingIndex, stopSpeaking],
  );

  const clearAll = useCallback(() => {
    stopSpeaking();
    setAttachment(null);
    setVoiceError('');
    clearMessages();
  }, [clearMessages, stopSpeaking]);

  const onSparkFilter = useCallback(
    (ids: string[]) => {
      stopSpeaking();
      setSparkFilter(ids);
      if (pathname !== '/sparks') router.push('/sparks');
      onClose?.();
    },
    [setSparkFilter, pathname, router, onClose, stopSpeaking],
  );

  const onTileFilter = useCallback(
    (ids: string[]) => {
      stopSpeaking();
      setTileFilter(ids);
      if (pathname !== '/tiles') router.push('/tiles');
      onClose?.();
    },
    [setTileFilter, pathname, router, onClose, stopSpeaking],
  );

  return (
    <AskView
      messages={messages}
      input={input}
      onInput={setInput}
      onSend={() => send(input)}
      isLoading={isLoading}
      onSuggestion={(s) => send(s)}
      onSparkFilter={onSparkFilter}
      onTileFilter={onTileFilter}
      attachmentName={attachment?.name ?? null}
      onAttach={setAttachment}
      onRemoveAttachment={() => setAttachment(null)}
      recording={recorder.status === 'recording'}
      recordingElapsed={recorder.elapsed}
      voiceError={recorder.error || voiceError}
      onStartRecording={startRecording}
      onStopRecording={stopRecording}
      onCancelRecording={recorder.cancel}
      onSpeak={speak}
      speakingIndex={speakingIndex}
      onClear={clearAll}
    />
  );
}

/** Overlay a destra montato dallo shell quando "Ask Gimmick" è aperto. */
export function AskPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { mode } = useObsidianTheme();

  // Il pulsante "Ask Gimmick" della navbar apre soltanto, non fa toggle: tolta
  // la testata, chiudere il pannello dipende da qui. Esc + il controllo
  // flottante qui sotto sono le due strade, nessuna barra di mezzo.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      data-theme={mode}
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 440,
        maxWidth: '90vw',
        zIndex: 60,
        background: 'var(--ob-surface)',
        borderLeft: '1px solid var(--ob-line-2)',
        boxShadow: '-12px 0 40px -24px rgba(0,0,0,0.4)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <button
        type="button"
        className="ob-ask__close"
        onClick={onClose}
        aria-label="Chiudi Ask Gimmick"
        title="Chiudi (Esc)"
      >
        <Icon name="chevR" size={16} />
      </button>
      <AskLive onClose={onClose} />
    </div>
  );
}
