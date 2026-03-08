'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { X, Send, Loader2, Bot, User, Filter, LayoutGrid, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';

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
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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

  // Cleanup audio on unmount
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

  // ---------------------------------------------------------------------------
  // Voice input with live transcript (Web Speech API)
  // ---------------------------------------------------------------------------

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
      // Show live transcript in input field
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
    // The transcript is already in the input field — user can edit or send
  }, []);

  // ---------------------------------------------------------------------------
  // Text-to-speech (OpenAI TTS)
  // ---------------------------------------------------------------------------

  const speakMessage = useCallback(async (text: string, msgIndex: number) => {
    // If already speaking this message, stop
    if (speakingMsgIndex === msgIndex) {
      audioRef.current?.pause();
      audioRef.current = null;
      setSpeakingMsgIndex(null);
      return;
    }

    // Stop any current playback
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
    <div className="fixed inset-y-0 right-0 w-[420px] z-50 flex flex-col bg-zinc-950 border-l border-zinc-800 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-5 h-16 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-blue-400" />
          <span className="text-base font-semibold text-white">Ask Gimmick</span>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="text-zinc-400 hover:text-white">
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4" ref={scrollContainerRef}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-20">
            <Bot className="h-12 w-12 text-zinc-600 mb-4" />
            <p className="text-zinc-400 text-sm">
              Chiedimi qualcosa sui tuoi spark.
            </p>
            <p className="text-zinc-500 text-xs mt-2">
              Es: &quot;Quanti spark ho?&quot;, &quot;Trova le note sul viaggio&quot;
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, i) => (
              <div key={i}>
                <div
                  className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="h-4 w-4 text-blue-400" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-zinc-800 text-zinc-200'
                    }`}
                  >
                    {msg.role === 'assistant' ? (
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                          ul: ({ children }) => <ul className="list-disc list-inside mb-2">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal list-inside mb-2">{children}</ol>,
                          li: ({ children }) => <li className="mb-0.5">{children}</li>,
                          code: ({ children }) => <code className="bg-zinc-700 px-1 py-0.5 rounded text-xs">{children}</code>,
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center shrink-0 mt-0.5">
                      <User className="h-4 w-4 text-zinc-300" />
                    </div>
                  )}
                </div>
                {/* Action buttons for assistant messages */}
                {msg.role === 'assistant' && (
                  <div className="ml-10 mt-1.5 flex gap-2 flex-wrap">
                    {/* TTS button */}
                    <button
                      onClick={() => speakMessage(msg.content, i)}
                      disabled={loadingTts && speakingMsgIndex !== i}
                      className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-30"
                    >
                      {speakingMsgIndex === i && loadingTts ? (
                        <><Loader2 className="h-3 w-3 animate-spin" /> Carico...</>
                      ) : speakingMsgIndex === i ? (
                        <><VolumeX className="h-3 w-3" /> Stop</>
                      ) : (
                        <><Volume2 className="h-3 w-3" /> Ascolta</>
                      )}
                    </button>
                    {/* Filter buttons */}
                    {msg.foundSparkIds && msg.foundSparkIds.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSparkFilter(msg.foundSparkIds!)}
                        className="border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300 text-xs"
                      >
                        <Filter className="h-3 w-3 mr-1.5" />
                        Filtra spark ({msg.foundSparkIds.length})
                      </Button>
                    )}
                    {msg.foundTileIds && msg.foundTileIds.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTileFilter(msg.foundTileIds!)}
                        className="border-purple-500/30 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 hover:text-purple-300 text-xs"
                      >
                        <LayoutGrid className="h-3 w-3 mr-1.5" />
                        Filtra tile ({msg.foundTileIds.length})
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4 text-blue-400" />
                </div>
                <div className="bg-zinc-800 rounded-xl px-4 py-2.5">
                  <Loader2 className="h-4 w-4 text-zinc-400 animate-spin" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-zinc-800">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Scrivi un messaggio..."
            className="min-h-[44px] max-h-[120px] resize-none bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 focus-visible:ring-blue-500"
            rows={1}
          />
          {/* Mic button */}
          <Button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isLoading}
            className={`shrink-0 h-[44px] w-[44px] p-0 ${
              isRecording
                ? 'bg-red-600 hover:bg-red-700 animate-pulse'
                : 'bg-zinc-700 hover:bg-zinc-600'
            }`}
          >
            {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          {/* Send button */}
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="bg-blue-600 hover:bg-blue-700 shrink-0 h-[44px] w-[44px] p-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
