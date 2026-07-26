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
  /** Annulla la dettatura e azzera gli accumulatori: nessun risultato in
   *  ritardo potrà ripopolare il campo (usato al Salva/svuotamento). */
  reset: () => void;
}

export function useDictation({ lang = 'it-IT', onText, onError }: {
  lang?: string;
  /** Testo aggiornato ad ogni risultato (base + trascrizione corrente). */
  onText: (text: string) => void;
  onError?: (message: string) => void;
}): Dictation {
  const [listening, setListening] = useState(false);
  const baseRef = useRef('');   // testo già presente prima di iniziare la sessione
  const finalRef = useRef('');  // segmenti finalizzati accumulati in questa sessione
  const available = !!speech;

  // I callback cambiano a ogni render: li teniamo in ref così i listener,
  // registrati una sola volta, leggono sempre l'ultima versione.
  const onTextRef = useRef(onText); onTextRef.current = onText;
  const onErrorRef = useRef(onError); onErrorRef.current = onError;

  useEffect(() => {
    if (!speech) return;
    const mod = speech.ExpoSpeechRecognitionModule;
    // Compone: testo di partenza + segmenti finalizzati + segmento interim in
    // corso. Scarta i pezzi vuoti, così un risultato vuoto (tipico allo stop)
    // NON azzera quanto già dettato.
    const compose = (interim: string) => {
      const parts = [baseRef.current, finalRef.current, interim].map((s) => s.trim()).filter(Boolean);
      onTextRef.current(parts.join(' '));
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subResult = mod.addListener('result', (e: any) => {
      const seg = (e?.results?.[0]?.transcript ?? '').trim();
      // In modalità continua ogni segmento riparte da zero: quando è finale lo
      // ACCUMULo (così i segmenti precedenti non si perdono), mentre l'interim
      // è solo l'anteprima del segmento corrente.
      if (e?.isFinal) {
        if (seg) finalRef.current = finalRef.current ? `${finalRef.current} ${seg}` : seg;
        compose('');
      } else {
        compose(seg);
      }
    });
    const subEnd = mod.addListener('end', () => setListening(false));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subError = mod.addListener('error', (e: any) => {
      setListening(false);
      // 'aborted' = annullamento VOLUTO (reset/stop nostro) → non è un errore da
      // mostrare. Idem 'no-speech' (silenzio): non vale un avviso invasivo.
      if (e?.error === 'aborted' || e?.error === 'no-speech') return;
      onErrorRef.current?.(e?.message || 'Errore riconoscimento vocale');
    });
    return () => { subResult.remove(); subEnd.remove(); subError.remove(); };
  }, []);

  const stop = useCallback(() => {
    try { speech?.ExpoSpeechRecognitionModule.stop(); } catch { /* no-op */ }
    setListening(false);
  }, []);

  const reset = useCallback(() => {
    // abort (non stop): annulla senza consegnare un risultato finale, così non
    // arriva un evento in ritardo a ripopolare il campo dopo il Salva.
    try { speech?.ExpoSpeechRecognitionModule.abort(); } catch { /* no-op */ }
    baseRef.current = '';
    finalRef.current = '';
    setListening(false);
  }, []);

  const start = useCallback(async (currentText: string) => {
    if (!speech) { onErrorRef.current?.("Ricostruisci l'app per la dettatura vocale"); return; }
    try {
      const perm = await speech.ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm?.granted) { onErrorRef.current?.('Permesso microfono negato'); return; }
      baseRef.current = currentText.trim();
      finalRef.current = '';
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

  return { available, listening, toggle, stop, reset };
}
