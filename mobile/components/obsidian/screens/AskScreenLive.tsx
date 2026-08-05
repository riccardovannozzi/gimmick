/**
 * Gimmick · Obsidian — Ask Gimmick (chat), wired to live data.
 *
 * Holds the conversation state and talks to the backend via chatApi.send
 * (text-only loop). Feeds the presentational ObsidianAskScreen. Voice (Whisper)
 * and the inline tile-result/confirm card are deferred — text chat first.
 */
import React from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { chatApi } from '@/lib/api';
import { toast } from '@/store';
import { generateId } from '@/utils/formatters';
import { ObsidianAskScreen, type AskMessage } from './AskScreen';

/** File scelto e in attesa: resta qui finché non parte col prossimo messaggio. */
type PendingFile = { uri: string; name: string; type: string };

/**
 * Nessun prop: da quando la schermata non ha più la barra in cima non c'è un
 * "indietro" da cablare — ci pensano il tasto di sistema e lo swipe dal bordo.
 */
export function ObsidianAskScreenLive() {
  const [messages, setMessages] = React.useState<AskMessage[]>([]);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [file, setFile] = React.useState<PendingFile | null>(null);

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
    const userMsg: AskMessage = { id: generateId('m'), role: 'user', content: shown };
    const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, userMsg]);
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
      setMessages((prev) => [...prev, { id: generateId('m'), role: 'assistant', content: reply }]);
    } catch {
      setMessages((prev) => [...prev, { id: generateId('m'), role: 'assistant', content: 'Errore di rete.' }]);
    } finally {
      setLoading(false);
    }
  }, [messages, loading, file]);

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
    />
  );
}
