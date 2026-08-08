/**
 * Gimmick · Obsidian — Auth screen, wired to the auth store.
 *
 * Holds email/password + error state and calls authStore.signIn / signUp.
 * On success, `onAuthed` lets the route navigate away. Il recupero password
 * passa dal backend (`/api/auth/forgot-password`); il login social non è
 * ancora implementato e lo dichiara invece di fingere di funzionare.
 */
import React from 'react';
import { useAuthStore } from '@/store/authStore';
import { authApi } from '@/lib/api';
import { ObsidianAuthScreen } from './AuthScreen';

export interface ObsidianAuthScreenLiveProps {
  onAuthed?: () => void;
}

export function ObsidianAuthScreenLive({ onAuthed }: ObsidianAuthScreenLiveProps) {
  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);

  // Stato LOCALE, non l'`isLoading` dello store. Quello lo alzano anche
  // `initialize()` e — prima della correzione — il logout automatico, che
  // precede di un istante la navigazione qui: siccome i campi sono
  // `editable={!loading}`, la schermata si apriva con email e password in sola
  // lettura e il bottone spento. Qui `submitting` copre solo la richiesta che
  // questa schermata ha davvero avviato.
  const [submitting, setSubmitting] = React.useState(false);

  // Al login riuscito la guardia di root smonta questa schermata mentre la
  // callback è ancora in volo: senza questo, l'ultimo `setState` cadrebbe su un
  // componente già smontato.
  const mounted = React.useRef(true);
  React.useEffect(() => () => { mounted.current = false; }, []);

  const login = React.useCallback(async () => {
    setError(null);
    setInfo(null);
    if (!email.trim() || !password) { setError('Inserisci email e password.'); return; }

    setSubmitting(true);
    try {
      const res = await signIn(email.trim(), password);
      if (!mounted.current) return;
      if (res.error) setError(res.error);
      else onAuthed?.();
    } finally {
      if (mounted.current) setSubmitting(false);
    }
  }, [email, password, signIn, onAuthed]);

  const register = React.useCallback(async () => {
    setError(null);
    setInfo(null);
    if (!email.trim() || !password) { setError('Inserisci email e password.'); return; }

    setSubmitting(true);
    try {
      const res = await signUp(email.trim(), password);
      if (!mounted.current) return;
      if (res.error) { setError(res.error); return; }

      // Dev auto-confirm: try to sign in straight away; if it fails, the account
      // likely needs email verification.
      const signedIn = await signIn(email.trim(), password);
      if (!mounted.current) return;
      if (signedIn.error) setInfo('Account creato. Conferma l\'email, poi accedi.');
      else onAuthed?.();
    } finally {
      if (mounted.current) setSubmitting(false);
    }
  }, [email, password, signUp, signIn, onAuthed]);

  const forgot = React.useCallback(async () => {
    setError(null);
    setInfo(null);
    if (!email.trim()) { setError('Scrivi la tua email qui sopra, poi tocca di nuovo.'); return; }

    setSubmitting(true);
    try {
      await authApi.forgotPassword(email.trim());
      if (!mounted.current) return;
      // Il backend risponde 200 anche per email non registrate (anti-enumeration):
      // il messaggio resta volutamente generico.
      setInfo('Se l\'email è registrata, riceverai un link per reimpostare la password.');
    } finally {
      if (mounted.current) setSubmitting(false);
    }
  }, [email]);

  const social = React.useCallback(() => {
    setError(null);
    setInfo('Accesso con Google e Apple non ancora disponibile: usa email e password.');
  }, []);

  return (
    <ObsidianAuthScreen
      email={email}
      password={password}
      onEmail={setEmail}
      onPassword={setPassword}
      onLogin={login}
      onRegister={register}
      onForgot={forgot}
      onSocial={social}
      loading={submitting}
      error={error}
      info={info}
    />
  );
}
