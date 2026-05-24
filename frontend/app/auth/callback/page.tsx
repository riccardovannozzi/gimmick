'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { authApi } from '@/lib/api';
import { usePixelTheme } from '@/components/pixel';

/**
 * /auth/callback — bridge per i link che Supabase manda via email.
 * Riceve `?token_hash=...&type=signup|recovery|email_change`, lo gira al
 * backend via `/api/auth/confirm`, e in base al `type` reindirizza:
 *   - signup → /welcome (utente confermato, atterra nell'onboarding)
 *   - recovery → /reset-password (utente loggato temporaneamente, può cambiare password)
 *   - email_change → /
 *
 * Il backend già imposta i token via setTokens dentro confirmSignup, quindi
 * a valle di questa pagina l'utente è autenticato.
 */
function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const theme = usePixelTheme();
  const [error, setError] = useState<string | null>(null);
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    const token_hash = params.get('token_hash');
    const type = (params.get('type') || 'signup') as 'signup' | 'recovery' | 'email_change';

    if (!token_hash) {
      setError('Link non valido o scaduto. Riprova dalla pagina di login.');
      return;
    }

    (async () => {
      const res = await authApi.confirmSignup(token_hash, type);
      if (!res.success) {
        setError(res.error || 'Verifica fallita');
        toast.error(res.error || 'Verifica fallita');
        return;
      }
      if (type === 'recovery') {
        toast.success('Verifica completata: imposta una nuova password');
        router.replace('/reset-password');
      } else if (type === 'email_change') {
        toast.success('Email aggiornata');
        router.replace('/');
      } else {
        toast.success('Email confermata');
        router.replace('/welcome');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        background: theme.bg1,
        padding: 16,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 384,
          background: theme.surface,
          border: `2px solid ${theme.border}`,
          boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
          padding: 24,
          textAlign: 'center',
        }}
      >
        {error ? (
          <>
            <h1
              style={{
                fontFamily: 'var(--font-pixel-head)',
                fontSize: 14,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#E24B4A',
                margin: '0 0 8px',
              }}
            >
              Errore
            </h1>
            <p style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 12, color: theme.ink2, margin: 0 }}>
              {error}
            </p>
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="px-press"
              style={{
                marginTop: 16,
                padding: '8px 14px',
                background: theme.accent,
                color: theme.onAccent,
                border: `2px solid ${theme.border}`,
                fontFamily: 'var(--font-pixel-head)',
                fontSize: 10,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
              }}
            >
              Vai al login
            </button>
          </>
        ) : (
          <>
            <h1
              style={{
                fontFamily: 'var(--font-pixel-head)',
                fontSize: 14,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: theme.ink,
                margin: '0 0 8px',
              }}
            >
              Verifica in corso
            </h1>
            <p style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 12, color: theme.ink3, margin: 0 }}>
              Un momento…
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense fallback={null}>
      <CallbackInner />
    </Suspense>
  );
}
