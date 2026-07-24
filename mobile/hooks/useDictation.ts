/**
 * Gimmick — Dettatura vocale live on-device (expo-speech-recognition).
 *
 * Equivalente del microfono della tastiera: riconoscimento in tempo reale che
 * scrive nel campo. `expo-speech-recognition` richiede il modulo NATIVO, che
 * esiste solo dopo una nuova build (CNG). Per questo l'import è "difensivo":
 * `require` in try/catch, così se il modulo non è ancora buildato la home NON
 * crasha — `available` resta false e il chiamante mostra un avviso.
 *
 * NB: dopo aver aggiunto la dipendenza serve una nuova dev build
 * (`npx expo prebuild` + run, o EAS): non funziona in Expo Go.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let speech: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  speech = require('expo-speech-recognition');
} catch {
  speech = null;
}

export interface Dictation {
  /** Modulo nativo presente (app ricostruita). Se false, `toggle` avvisa soltanto. */
  available: boolean;
  /** In ascolto (riconoscimento attivo). */
  listening: boolean;
  /** Avvia/ferma la dettatura. `currentText` = testo già presente da preservare. */
  toggle: (currentText: string) => void;
  stop: () => void;
}

export function useDictation({ lang = 'it-IT', onText, onError }: {
  lang?: string;
  /** Testo aggiornato ad ogni risultato (base + trascrizione corrente). */
  onText: (text: string) => void;
  onError?: (message: string) => void;
}): Dictation {
  const [listening, setListening] = useState(false);
  const baseRef = useRef('');
  const available = !!speech;

  // I callback cambiano a ogni render: li teniamo in ref così i listener,
  // registrati una sola volta, leggono sempre l'ultima versione.
  const onTextRef = useRef(onText); onTextRef.current = onText;
  const onErrorRef = useRef(onError); onErrorRef.current = onError;

  useEffect(() => {
    if (!speech) return;
    const mod = speech.ExpoSpeechRecognitionModule;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subResult = mod.addListener('result', (e: any) => {
      const t = e?.results?.[0]?.transcript ?? '';
      const base = baseRef.current;
      onTextRef.current(base ? `${base} ${t}` : t);
    });
    const subEnd = mod.addListener('end', () => setListening(false));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subError = mod.addListener('error', (e: any) => {
      setListening(false);
      onErrorRef.current?.(e?.message || 'Errore riconoscimento vocale');
    });
    return () => { subResult.remove(); subEnd.remove(); subError.remove(); };
  }, []);

  const stop = useCallback(() => {
    try { speech?.ExpoSpeechRecognitionModule.stop(); } catch { /* no-op */ }
    setListening(false);
  }, []);

  const start = useCallback(async (currentText: string) => {
    if (!speech) { onErrorRef.current?.("Ricostruisci l'app per la dettatura vocale"); return; }
    try {
      const perm = await speech.ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm?.granted) { onErrorRef.current?.('Permesso microfono negato'); return; }
      baseRef.current = currentText.trim();
      // Stesso motore nativo della dettatura della tastiera (Google
      // SpeechRecognizer / Apple Speech): stessa sensibilità e capacità.
      // · interimResults + continuous → scrittura live e sessione lunga.
      // · addsPunctuation → punteggiatura automatica come la dettatura di sistema.
      // · requiresOnDeviceRecognition NON forzato: usa il modello migliore
      //   disponibile (server quando c'è rete), per la massima accuratezza.
      speech.ExpoSpeechRecognitionModule.start({
        lang,
        interimResults: true,
        continuous: true,
        addsPunctuation: true,
      });
      setListening(true);
    } catch {
      onErrorRef.current?.('Riconoscimento vocale non disponibile');
    }
  }, [lang]);

  const toggle = useCallback((currentText: string) => {
    if (listening) stop(); else start(currentText);
  }, [listening, start, stop]);

  // Ferma il riconoscimento se lo schermo si smonta mentre è in ascolto.
  useEffect(() => () => { try { speech?.ExpoSpeechRecognitionModule.abort(); } catch { /* no-op */ } }, []);

  return { available, listening, toggle, stop };
}
