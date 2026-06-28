'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { usePixelTheme } from '@/components/pixel';
import { Field, Button } from '@/components/primitives';
import { AuthLayout, AuthField } from '@/components/auth/obsidian-auth';
import { isObsidianShellEnabled } from '@/lib/feature-flags';
import { authApi, getAccessToken } from '@/lib/api';

const schema = z.object({
  new_password: z.string().min(6, 'Almeno 6 caratteri'),
  confirm: z.string().min(6, 'Conferma la password'),
}).refine((d) => d.new_password === d.confirm, {
  message: 'Le password non coincidono',
  path: ['confirm'],
});
type Form = z.infer<typeof schema>;

/**
 * /reset-password — secondo step del flow password recovery. Si arriva qui
 * dal /auth/callback con una session valida appena ottenuta via verifyOtp.
 * Leggiamo l'access_token dai token salvati dal callback e lo passiamo al
 * backend per chiamare auth.updateUser({ password }).
 */
export default function ResetPasswordPage() {
  const theme = usePixelTheme();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [missingToken, setMissingToken] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  useEffect(() => {
    // L'utente dovrebbe arrivare qui appena dopo /auth/callback con i token
    // già impostati. Se per qualche motivo non ci sono token in memoria,
    // l'utente ha aperto la pagina direttamente: rimandiamolo a forgot.
    if (!getAccessToken()) setMissingToken(true);
  }, []);

  const onSubmit = async (data: Form) => {
    const token = getAccessToken();
    if (!token) {
      setMissingToken(true);
      return;
    }
    setSubmitting(true);
    const res = await authApi.resetPassword(token, data.new_password);
    setSubmitting(false);
    if (res.success) {
      toast.success('Password aggiornata. Effettua il login.');
      router.push('/login');
    } else {
      toast.error(res.error || 'Errore nel reset');
    }
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-pixel-head)',
    fontSize: 9,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: theme.ink3,
    display: 'block',
    marginBottom: 4,
  };
  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: theme.surfaceVariant,
    border: `2px solid ${theme.border}`,
    padding: '8px 10px',
    color: theme.ink,
    fontFamily: 'var(--font-pixel-body)',
    fontSize: 12,
    outline: 'none',
  };

  if (isObsidianShellEnabled()) {
    return (
      <AuthLayout title="Nuova password">
        {missingToken ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontSize: 13, color: 'var(--ob-muted)', margin: 0, lineHeight: 1.55 }}>
              Il link di reset non è più valido o è già stato utilizzato. Richiedine uno nuovo.
            </p>
            <Button variant="primary" onClick={() => router.push('/forgot-password')} style={{ width: '100%' }}>
              Richiedi nuovo link
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <AuthField label="Nuova password" htmlFor="new_password" error={errors.new_password?.message}>
              <Field id="new_password" type="password" placeholder="••••••••" invalid={!!errors.new_password} {...register('new_password')} />
            </AuthField>
            <AuthField label="Conferma password" htmlFor="confirm" error={errors.confirm?.message}>
              <Field id="confirm" type="password" placeholder="••••••••" invalid={!!errors.confirm} {...register('confirm')} />
            </AuthField>
            <Button variant="primary" type="submit" disabled={submitting} style={{ width: '100%' }}>
              {submitting ? 'Salvataggio…' : 'Aggiorna password'}
            </Button>
          </form>
        )}
      </AuthLayout>
    );
  }

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
            Nuova password
          </h1>
        </div>

        {missingToken ? (
          <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 12, color: theme.ink2, margin: 0, lineHeight: 1.55 }}>
              Il link di reset non è più valido o è già stato utilizzato.
              Richiedine uno nuovo.
            </p>
            <button
              type="button"
              onClick={() => router.push('/forgot-password')}
              className="px-press"
              style={{
                padding: '8px 12px',
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
              Richiedi nuovo link
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label htmlFor="new_password" style={labelStyle}>Nuova password</label>
              <input
                id="new_password"
                type="password"
                placeholder="••••••••"
                style={inputStyle}
                {...register('new_password')}
              />
              {errors.new_password && (
                <p style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 11, color: '#E24B4A', margin: '4px 0 0' }}>
                  {errors.new_password.message}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="confirm" style={labelStyle}>Conferma password</label>
              <input
                id="confirm"
                type="password"
                placeholder="••••••••"
                style={inputStyle}
                {...register('confirm')}
              />
              {errors.confirm && (
                <p style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 11, color: '#E24B4A', margin: '4px 0 0' }}>
                  {errors.confirm.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="px-press"
              style={{
                width: '100%',
                padding: '0 12px',
                height: 32,
                background: theme.accent,
                color: theme.onAccent,
                border: `2px solid ${theme.border}`,
                fontFamily: 'var(--font-pixel-head)',
                fontSize: 10,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.5 : 1,
                boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
              }}
            >
              {submitting ? 'Salvataggio…' : 'Aggiorna password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
