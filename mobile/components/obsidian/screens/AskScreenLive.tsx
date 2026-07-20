/**
 * Gimmick · Obsidian — Ask Gimmick (chat), wired to live data.
 *
 * Holds the conversation state and talks to the backend via chatApi.send
 * (text-only loop). Feeds the presentational ObsidianAskScreen. Voice (Whisper)
 * and the inline tile-result/confirm card are deferred — text chat first.
 */
import React from 'react';
import { chatApi } from '@/lib/api';
import { generateId } from '@/utils/formatters';
import { ObsidianAskScreen, type AskMessage } from './AskScreen';

export interface ObsidianAskScreenLiveProps {
  onBack?: () => void;
}

export function ObsidianAskScreenLive({ onBack }: ObsidianAskScreenLiveProps) {
  const [messages, setMessages] = React.useState<AskMessage[]>([]);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const send = React.useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    const userMsg: AskMessage = { id: generateId('m'), role: 'user', content: trimmed };
    const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const res = await chatApi.send(trimmed, history);
      const reply = res.success && res.data?.reply ? res.data.reply : (res.error || 'Errore nella risposta.');
      setMessages((prev) => [...prev, { id: generateId('m'), role: 'assistant', content: reply }]);
    } catch {
      setMessages((prev) => [...prev, { id: generateId('m'), role: 'assistant', content: 'Errore di rete.' }]);
    } finally {
      setLoading(false);
    }
  }, [messages, loading]);

  return (
    <ObsidianAskScreen
      onBack={onBack}
      messages={messages}
      input={input}
      onInput={setInput}
      onSend={() => send(input)}
      isLoading={loading}
      onSuggestion={(s) => send(s)}
      onNewChat={() => { setMessages([]); setInput(''); }}
    />
  );
}
