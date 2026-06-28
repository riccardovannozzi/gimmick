'use client';

/**
 * Gimmick · Obsidian — Ask Gimmick collegata ai dati reali (Fase 7).
 *
 * `AskLive` gestisce la conversazione e chiama `chatApi.send` (loop tool-use lato
 * backend), mostrando i pulsanti filtro Spark/Tile (seedano `useFilterStore` e
 * navigano a /sparks o /tiles, come la ChatPanel arcade). `AskPanel` è il
 * contenitore overlay a destra montato dallo shell al posto della ChatPanel.
 *
 * GAP (vedi MIGRATION_PLAN.md): voce (Whisper) e TTS non portati; le risposte
 * sono rese come testo semplice (no markdown) nelle bolle Obsidian.
 */
import { useCallback, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AskView, type AskMessage } from '@/components/views/ask';
import { useObsidianTheme } from '@/lib/theme/obsidian-provider';
import { useFilterStore } from '@/store/filter-store';
import { chatApi } from '@/lib/api';

export function AskLive({ onClose }: { onClose?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const setSparkFilter = useFilterStore((s) => s.setSparkFilter);
  const setTileFilter = useFilterStore((s) => s.setTileFilter);

  const [messages, setMessages] = useState<AskMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const send = useCallback(
    async (text: string) => {
      const t = text.trim();
      if (!t || isLoading) return;
      const history = messages;
      const next = [...history, { role: 'user' as const, content: t }];
      setMessages(next);
      setInput('');
      setIsLoading(true);
      try {
        const res = await chatApi.send(t, history);
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
    [messages, isLoading],
  );

  const onSparkFilter = useCallback(
    (ids: string[]) => {
      setSparkFilter(ids);
      if (pathname !== '/sparks') router.push('/sparks');
      onClose?.();
    },
    [setSparkFilter, pathname, router, onClose],
  );

  const onTileFilter = useCallback(
    (ids: string[]) => {
      setTileFilter(ids);
      if (pathname !== '/tiles') router.push('/tiles');
      onClose?.();
    },
    [setTileFilter, pathname, router, onClose],
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
      onNewChat={() => setMessages([])}
      onClose={onClose}
    />
  );
}

/** Overlay a destra montato dallo shell quando "Ask Gimmick" è aperto. */
export function AskPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { mode } = useObsidianTheme();
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
      <AskLive onClose={onClose} />
    </div>
  );
}
