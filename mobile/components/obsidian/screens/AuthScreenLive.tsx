/**
 * Gimmick · Obsidian — Auth screen, wired to the auth store.
 *
 * Holds email/password + error state and calls authStore.signIn / signUp.
 * On success, `onAuthed` lets the route navigate away. Social login (Google /
 * Apple) and password recovery remain decorative for now.
 */
import React from 'react';
import { useAuthStore } from '@/store/authStore';
import { ObsidianAuthScreen } from './AuthScreen';

export interface ObsidianAuthScreenLiveProps {
  onAuthed?: () => void;
}

export function ObsidianAuthScreenLive({ onAuthed }: ObsidianAuthScreenLiveProps) {
  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);
  const loading = useAuthStore((s) => s.isLoading);

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const login = React.useCallback(async () => {
    setError(null);
    if (!email.trim() || !password) { setError('Inserisci email e password.'); return; }
    const res = await signIn(email.trim(), password);
    if (res.error) setError(res.error);
    else onAuthed?.();
  }, [email, password, signIn, onAuthed]);

  const register = React.useCallback(async () => {
    setError(null);
    if (!email.trim() || !password) { setError('Inserisci email e password.'); return; }
    const res = await signUp(email.trim(), password);
    if (res.error) { setError(res.error); return; }
    // Dev auto-confirm: try to sign in straight away; if it fails, the account
    // likely needs email verification.
    const signedIn = await signIn(email.trim(), password);
    if (signedIn.error) setError('Account creato. Conferma l\'email, poi accedi.');
    else onAuthed?.();
  }, [email, password, signUp, signIn, onAuthed]);

  return (
    <ObsidianAuthScreen
      email={email}
      password={password}
      onEmail={setEmail}
      onPassword={setPassword}
      onLogin={login}
      onRegister={register}
      loading={loading}
      error={error}
    />
  );
}
