/**
 * Gimmick · Obsidian — Ask Gimmick (chat), wired to live data.
 *
 * Holds the conversation state and talks to the backend via chatApi.send
 * (text-only loop). Feeds the presentational ObsidianAskScreen. Voice (Whisper)
 * and the inline tile-result/confirm card are deferred — text chat first.
 */
import React from 'react';
import { AppState } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useQuery } from '@tanstack/react-query';
import { chatApi, settingsApi } from '@/lib/api';
import { toast, useSettingsStore } from '@/store';
import { useChatStore } from '@/store/chatStore';
import { generateId } from '@/utils/formatters';
import { DEFAULT_ACTION_COLORS, type TileActionKey } from '@/constants/tile-colors';
import { ObsidianAskScreen } from './AskScreen';
import type { ChatMessage } from '@/store/chatStore';

/** File scelto e in attesa: resta qui finché non parte col prossimo messaggio. */
type PendingFile = { uri: string; name: string; type: string };

export interface ObsidianAskScreenLiveProps {
  /** Cablato dalla rotta: il tasto di sistema e lo swipe restano, questo li
   *  rende visibili a chi non li conosce. */
  onBack?: () => void;
  /** Apre una tile trovata dall'AI, nel dettaglio tile. */
  onOpenTile?: (id: string) => void;
}

export function ObsidianAskScreenLive({ onBack, onOpenTile }: ObsidianAskScreenLiveProps = {}) {
  // La conversazione vive nello STORE, non qui: uscire dalla schermata la
  // smontava e il discorso spariva — anche solo aprendo un tile trovato dalla
  // risposta, cioè facendo quello per cui le card esistono.
  const messages = useChatStore((s) => s.messages);
  const appendMessage = useChatStore((s) => s.append);
  const clearChat = useChatStore((s) => s.clear);
  const expireIfStale = useChatStore((s) => s.expireIfStale);
  const retention = useSettingsStore((s) => s.chatRetentionMinutes);

  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [file, setFile] = React.useState<PendingFile | null>(null);

  // Scadenza: si controlla all'ingresso e a ogni ritorno in primo piano, non con
  // un timer. Una chat non deve svanire sotto gli occhi mentre la leggi — e un
  // timer che scatta con l'app chiusa non esiste comunque.
  React.useEffect(() => {
    expireIfStale(retention);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') expireIfStale(retention);
    });
    return () => sub.remove();
  }, [retention, expireIfStale]);

  // Stessa chiave di query della vista Tiles: la cache è condivisa, quindi qui
  // di norma non parte nessuna richiesta in più — e una tile ha gli stessi
  // colori in chat e in elenco.
  const actionColorsQuery = useQuery({
    queryKey: ['settings', 'action_colors'],
    queryFn: () => settingsApi.get<Partial<Record<TileActionKey, string>>>('action_colors'),
    staleTime: 5 * 60 * 1000,
  });
  const actionColors = React.useMemo(
    () => ({ ...DEFAULT_ACTION_COLORS, ...(actionColorsQuery.data?.data ?? {}) }),
    [actionColorsQuery.data],
  );

  /**
   * Sceglie un file da allegare al prossimo messaggio. Uno per volta: una
   * seconda scelta sostituisce la precedente invece di accodarsi — il backend
   * accetta un allegato per turno, e mostrarne due in attesa prometterebbe
   * qualcosa che non succede.
   */
  const pickFile = React.useCallback(async () => {
    const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    setFile({
      uri: a.uri,
      name: a.name || 'allegato',
      // Il picker può non dedurre il mime: si manda un tipo generico e la
      // decisione la prende il backend, che guarda anche l'estensione.
      type: a.mimeType || 'application/octet-stream',
    });
  }, []);

  const send = React.useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    // Il messaggio in cronologia dice che c'era un allegato: la cronologia è
    // testo, quindi senza questa nota nei turni successivi il file sparirebbe
    // dal discorso e le domande di seguito ("e nell'altra pagina?") non
    // avrebbero appiglio.
    const shown = file ? `${trimmed}\n\n📎 ${file.name}` : trimmed;
    const userMsg: ChatMessage = { id: generateId('m'), role: 'user', content: shown };
    const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));
    appendMessage(userMsg);
    setInput('');
    const sending = file;
    setFile(null);
    setLoading(true);
    try {
      const res = sending
        ? await chatApi.sendWithFile(trimmed, sending, history)
        : await chatApi.send(trimmed, history);
      const reply = res.success && res.data?.reply ? res.data.reply : (res.error || 'Errore nella risposta.');
      // Formato rifiutato o file illeggibile: il backend risponde 400 con il
      // motivo. Va anche in toast, perché in mezzo alla conversazione una riga
      // d'errore si confonde con una risposta.
      if (!res.success && sending) toast.warning(res.error || 'Allegato non accettato');
      appendMessage({
        id: generateId('m'),
        role: 'assistant',
        content: reply,
        // Le tile restano attaccate AL TURNO che le ha trovate: scorrendo
        // indietro la conversazione ogni risposta conserva i propri risultati,
        // invece di mostrare sempre gli ultimi.
        tiles: res.success ? res.data?.foundTiles : undefined,
      });
    } catch {
      appendMessage({ id: generateId('m'), role: 'assistant', content: 'Errore di rete.' });
    } finally {
      setLoading(false);
    }
  }, [messages, loading, file, appendMessage]);

  return (
    <ObsidianAskScreen
      messages={messages}
      input={input}
      onInput={setInput}
      onSend={() => send(input)}
      isLoading={loading}
      attachment={file}
      onAttach={pickFile}
      onRemoveAttachment={() => setFile(null)}
      onBack={onBack}
      onOpenTile={onOpenTile}
      actionColors={actionColors}
      onClear={clearChat}
    />
  );
}
