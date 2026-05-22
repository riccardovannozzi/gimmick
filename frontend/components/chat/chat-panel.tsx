'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { IconX, IconSend, IconLoader2, IconRobot, IconUser, IconFilter, IconLayoutGrid, IconMicrophone, IconMicrophoneOff, IconVolume, IconVolumeOff } from '@tabler/icons-react';

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}
interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: Event) => void) | null;
}
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
}
import ReactMarkdown from 'react-markdown';
import { usePixelTheme } from '@/components/pixel';
import { chatApi } from '@/lib/api';
import { useFilterStore } from '@/store/filter-store';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  foundSparkIds?: string[];
  foundTileIds?: string[];
}

interface ChatPanelProps {
  open: boolean;
  onClose: () => void;
}

export function ChatPanel({ open, onClose }: ChatPanelProps) {
  const theme = usePixelTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [speakingMsgIndex, setSpeakingMsgIndex] = useState<number | null>(null);
  const [loadingTts, setLoadingTts] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const finalTranscriptRef = useRef('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const setSparkFilter = useFilterStore((s) => s.setSparkFilter);
  const setTileFilter = useFilterStore((s) => s.setTileFilter);

  useEffect(() => {
    if (open && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const handleSparkFilter = (sparkIds: string[]) => {
    setSparkFilter(sparkIds);
    if (pathname !== '/sparks') {
      router.push('/sparks');
    }
  };

  const handleTileFilter = (tileIds: string[]) => {
    setTileFilter(tileIds);
    if (pathname !== '/tiles') {
      router.push('/tiles');
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMessage: Message = { role: 'user', content: text };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

    try {
      const result = await chatApi.send(text, messages);

      if (result.success && result.data?.reply) {
        setMessages([
          ...updatedMessages,
          {
            role: 'assistant',
            content: result.data.reply,
            foundSparkIds: result.data.foundSparkIds?.length ? result.data.foundSparkIds : undefined,
            foundTileIds: result.data.foundTileIds?.length ? result.data.foundTileIds : undefined,
          },
        ]);
      } else {
        setMessages([
          ...updatedMessages,
          { role: 'assistant', content: result.error || 'Errore nella risposta.' },
        ]);
      }
    } catch {
      setMessages([
        ...updatedMessages,
        { role: 'assistant', content: 'Errore di connessione.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const startRecording = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error('SpeechRecognition not supported');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'it-IT';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognitionRef.current = recognition;
    finalTranscriptRef.current = '';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let final = '';
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      finalTranscriptRef.current = final;
      setInput(final + (interim ? interim : ''));
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.onerror = () => {
      setIsRecording(false);
    };

    recognition.start();
    setIsRecording(true);
    setInput('');
  }, []);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const speakMessage = useCallback(async (text: string, msgIndex: number) => {
    if (speakingMsgIndex === msgIndex) {
      audioRef.current?.pause();
      audioRef.current = null;
      setSpeakingMsgIndex(null);
      return;
    }

    audioRef.current?.pause();
    audioRef.current = null;

    setLoadingTts(true);
    setSpeakingMsgIndex(msgIndex);

    try {
      const audio = await chatApi.speak(text);
      if (!audio) {
        setSpeakingMsgIndex(null);
        return;
      }

      audioRef.current = audio;
      audio.onended = () => {
        audioRef.current = null;
        setSpeakingMsgIndex(null);
      };
      audio.onerror = () => {
        audioRef.current = null;
        setSpeakingMsgIndex(null);
      };
      await audio.play();
    } catch {
      setSpeakingMsgIndex(null);
    } finally {
      setLoadingTts(false);
    }
  }, [speakingMsgIndex]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 48,
        bottom: 0,
        right: 0,
        width: 240,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        background: theme.bg2,
        borderLeft: `2px solid ${theme.border}`,
        boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          height: 40,
          borderBottom: `2px solid ${theme.border}`,
          background: theme.surfaceVariant,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <IconRobot size={14} style={{ color: theme.accent }} />
          <span
            style={{
              fontFamily: 'var(--font-pixel-head)',
              fontSize: 11,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: theme.ink,
            }}
          >
            Ask Gimmick
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            width: 24,
            height: 24,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: theme.ink2,
          }}
        >
          <IconX size={14} />
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }} ref={scrollContainerRef}>
        {messages.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', padding: '64px 0' }}>
            <div
              style={{
                width: 48,
                height: 48,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: theme.surfaceVariant,
                border: `2px solid ${theme.border}`,
                color: theme.ink3,
                marginBottom: 12,
              }}
            >
              <IconRobot size={24} />
            </div>
            <p
              style={{
                fontFamily: 'var(--font-pixel-head)',
                fontSize: 10,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: theme.ink2,
                margin: 0,
              }}
            >
              Chiedimi qualcosa
            </p>
            <p style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 11, color: theme.ink3, marginTop: 6 }}>
              Es: &quot;Quanti spark ho?&quot;
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.map((msg, i) => (
              <div key={i}>
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  }}
                >
                  {msg.role === 'assistant' && (
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        background: theme.surface,
                        border: `2px solid ${theme.border}`,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: 2,
                        color: theme.accent,
                      }}
                    >
                      <IconRobot size={12} />
                    </div>
                  )}
                  <div
                    style={{
                      maxWidth: '80%',
                      padding: '8px 10px',
                      fontFamily: 'var(--font-pixel-body)',
                      fontSize: 12,
                      lineHeight: 1.5,
                      background: msg.role === 'user' ? theme.accent : theme.surface,
                      color: msg.role === 'user' ? theme.onAccent : theme.ink,
                      border: `2px solid ${theme.border}`,
                      ...(msg.role === 'user' ? { boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}` } : {}),
                    }}
                  >
                    {msg.role === 'assistant' ? (
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => <p style={{ marginBottom: 6, margin: '0 0 6px' }}>{children}</p>,
                          strong: ({ children }) => <strong style={{ fontWeight: 700 }}>{children}</strong>,
                          ul: ({ children }) => <ul style={{ listStyle: 'disc', paddingLeft: 16, marginBottom: 6 }}>{children}</ul>,
                          ol: ({ children }) => <ol style={{ listStyle: 'decimal', paddingLeft: 16, marginBottom: 6 }}>{children}</ol>,
                          li: ({ children }) => <li style={{ marginBottom: 2 }}>{children}</li>,
                          code: ({ children }) => <code style={{ background: theme.surfaceVariant, padding: '1px 4px', fontFamily: 'var(--font-pixel-body)', fontSize: 11 }}>{children}</code>,
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    ) : (
                      <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{msg.content}</p>
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        background: theme.surfaceVariant,
                        border: `2px solid ${theme.border}`,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: 2,
                        color: theme.ink2,
                      }}
                    >
                      <IconUser size={12} />
                    </div>
                  )}
                </div>
                {/* Action buttons for assistant messages */}
                {msg.role === 'assistant' && (
                  <div style={{ marginLeft: 32, marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button
                      onClick={() => speakMessage(msg.content, i)}
                      disabled={loadingTts && speakingMsgIndex !== i}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-pixel-head)',
                        fontSize: 9,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        color: theme.ink3,
                        padding: 0,
                        opacity: (loadingTts && speakingMsgIndex !== i) ? 0.3 : 1,
                      }}
                    >
                      {speakingMsgIndex === i && loadingTts ? (
                        <><IconLoader2 size={11} className="animate-spin" /> Carico...</>
                      ) : speakingMsgIndex === i ? (
                        <><IconVolumeOff size={11} /> Stop</>
                      ) : (
                        <><IconVolume size={11} /> Ascolta</>
                      )}
                    </button>
                    {msg.foundSparkIds && msg.foundSparkIds.length > 0 && (
                      <button
                        onClick={() => handleSparkFilter(msg.foundSparkIds!)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '3px 6px',
                          background: theme.surfaceVariant,
                          color: theme.accent,
                          border: `2px solid ${theme.accent}`,
                          fontFamily: 'var(--font-pixel-head)',
                          fontSize: 9,
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          cursor: 'pointer',
                        }}
                      >
                        <IconFilter size={10} />
                        Spark ({msg.foundSparkIds.length})
                      </button>
                    )}
                    {msg.foundTileIds && msg.foundTileIds.length > 0 && (
                      <button
                        onClick={() => handleTileFilter(msg.foundTileIds!)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '3px 6px',
                          background: theme.surfaceVariant,
                          color: theme.accent,
                          border: `2px solid ${theme.accent}`,
                          fontFamily: 'var(--font-pixel-head)',
                          fontSize: 9,
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          cursor: 'pointer',
                        }}
                      >
                        <IconLayoutGrid size={10} />
                        Tile ({msg.foundTileIds.length})
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div style={{ display: 'flex', gap: 8 }}>
                <div
                  style={{
                    width: 24,
                    height: 24,
                    background: theme.surface,
                    border: `2px solid ${theme.border}`,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    color: theme.accent,
                  }}
                >
                  <IconRobot size={12} />
                </div>
                <div style={{ background: theme.surface, border: `2px solid ${theme.border}`, padding: '8px 10px' }}>
                  <IconLoader2 size={14} className="animate-spin" style={{ color: theme.ink2 }} />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div
        style={{
          padding: 10,
          borderTop: `2px solid ${theme.border}`,
          background: theme.surfaceVariant,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Scrivi un messaggio..."
          rows={3}
          style={{
            height: 64,
            minHeight: 64,
            resize: 'none',
            background: theme.surface,
            border: `2px solid ${theme.border}`,
            padding: 8,
            color: theme.ink,
            fontFamily: 'var(--font-pixel-body)',
            fontSize: 12,
            outline: 'none',
          }}
        />
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isLoading}
            style={{
              width: 30,
              height: 30,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isRecording ? '#E24B4A' : theme.surface,
              color: isRecording ? '#FFFFFF' : theme.ink2,
              border: `2px solid ${theme.border}`,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.5 : 1,
              flexShrink: 0,
            }}
            className={isRecording ? 'animate-pulse' : ''}
          >
            {isRecording ? <IconMicrophoneOff size={14} /> : <IconMicrophone size={14} />}
          </button>
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="px-press"
            style={{
              width: 30,
              height: 30,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: theme.accent,
              color: theme.onAccent,
              border: `2px solid ${theme.border}`,
              cursor: (!input.trim() || isLoading) ? 'not-allowed' : 'pointer',
              opacity: (!input.trim() || isLoading) ? 0.5 : 1,
              flexShrink: 0,
              boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
            }}
          >
            <IconSend size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
