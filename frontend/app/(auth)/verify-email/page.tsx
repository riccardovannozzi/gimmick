'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { usePixelTheme } from '@/components/pixel';
import { authApi } from '@/lib/api';

/**
 * /verify-email — landing post-signup quando l'email verification è attiva.
 * Mostra l'indirizzo a cui è stata inviata l'email e un bottone per
 * reinviare il link (con cooldown 60s per evitare spam).
 */
function VerifyEmailInner() {
  const theme = usePixelTheme();
  const params = useSearchParams();
  const email = params.get('email') || '';

  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const resend = async () => {
    if (!email) return;
    setSending(true);
    const res = await authApi.resendVerification(email);
    setSending(false);
    if (res.success) {
      toast.success('Email reinviata');
      setCooldown(60);
      const t = setInterval(() => {
        setCooldown((c) => {
          if (c <= 1) { clearInterval(t); return 0; }
          return c - 1;
        });
      }, 1000);
    } else {
      toast.error(res.error || 'Impossibile inviare ora');
    }
  };

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
          maxWidth: 420,
          background: theme.surface,
          border: `2px solid ${theme.border}`,
          boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
          color: theme.ink,
        }}
      >
        <div style={{ padding: '20px 16px 16px', background: theme.surfaceVariant, borderBottom: `2px solid ${theme.border}`, textAlign: 'center' }}>
          <h1
            style={{
              fontFamily: 'var(--font-pixel-head)',
              fontSize: 16,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: theme.ink,
              margin: 0,
            }}
          >
            Controlla l&apos;email
          </h1>
        </div>

        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 12, color: theme.ink2, margin: 0, lineHeight: 1.55 }}>
            Ti abbiamo inviato un link di conferma{email ? ' a ' : '.'}
            {email && (
              <strong style={{ wordBreak: 'break-all', color: theme.ink }}>{email}</strong>
            )}
            . Clicca il link per attivare l&apos;account e accedere a Gimmick.
          </p>

          <p style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 11, color: theme.ink3, margin: 0 }}>
            Non hai ricevuto l&apos;email? Controlla nello spam o reinviala.
          </p>

          <button
            type="button"
            onClick={resend}
            disabled={sending || cooldown > 0 || !email}
            className="px-press"
            style={{
              padding: '8px 12px',
              background: theme.surfaceVariant,
              color: theme.ink,
              border: `2px solid ${theme.border}`,
              fontFamily: 'var(--font-pixel-head)',
              fontSize: 10,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: sending || cooldown > 0 || !email ? 'not-allowed' : 'pointer',
              opacity: sending || cooldown > 0 || !email ? 0.5 : 1,
            }}
          >
            {sending
              ? 'Invio…'
              : cooldown > 0
                ? `Reinvia tra ${cooldown}s`
                : 'Reinvia email di conferma'}
          </button>

          <p style={{ marginTop: 4, textAlign: 'center', fontFamily: 'var(--font-pixel-body)', fontSize: 11, color: theme.ink3 }}>
            <Link href="/login" style={{ color: theme.accent, textDecoration: 'underline' }}>
              Torna al login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailInner />
    </Suspense>
  );
}
