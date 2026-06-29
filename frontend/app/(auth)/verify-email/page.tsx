'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/primitives';
import { AuthLayout, AuthFoot, AuthLink } from '@/components/auth/obsidian-auth';
import { authApi } from '@/lib/api';

/**
 * /verify-email — landing post-signup quando l'email verification è attiva.
 * Mostra l'indirizzo a cui è stata inviata l'email e un bottone per
 * reinviare il link (con cooldown 60s per evitare spam).
 */
function VerifyEmailInner() {
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
    <AuthLayout title="Controlla l'email">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={{ fontSize: 13, color: 'var(--ob-muted)', margin: 0, lineHeight: 1.55 }}>
          Ti abbiamo inviato un link di conferma{email ? ' a ' : '.'}
          {email && <strong style={{ wordBreak: 'break-all', color: 'var(--ob-text)' }}>{email}</strong>}
          . Clicca il link per attivare l&apos;account e accedere a Gimmick.
        </p>
        <p style={{ fontSize: 12, color: 'var(--ob-subtle)', margin: 0 }}>
          Non hai ricevuto l&apos;email? Controlla nello spam o reinviala.
        </p>
        <Button variant="secondary" onClick={resend} disabled={sending || cooldown > 0 || !email} style={{ width: '100%' }}>
          {sending ? 'Invio…' : cooldown > 0 ? `Reinvia tra ${cooldown}s` : 'Reinvia email di conferma'}
        </Button>
        <AuthFoot><AuthLink href="/login">Torna al login</AuthLink></AuthFoot>
      </div>
    </AuthLayout>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailInner />
    </Suspense>
  );
}
