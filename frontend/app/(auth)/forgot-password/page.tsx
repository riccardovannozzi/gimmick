'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { usePixelTheme } from '@/components/pixel';
import { authApi } from '@/lib/api';

const schema = z.object({
  email: z.string().email('Email non valida'),
});
type Form = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const theme = usePixelTheme();
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: Form) => {
    setSending(true);
    const res = await authApi.forgotPassword(data.email);
    setSending(false);
    if (res.success) {
      setSubmitted(true);
      toast.success('Email inviata se l\'account esiste');
    } else {
      toast.error(res.error || 'Errore');
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
            Password dimenticata
          </h1>
          <p style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 11, color: theme.ink3, margin: '6px 0 0' }}>
            Ti invieremo un link per reimpostarla
          </p>
        </div>

        {submitted ? (
          <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 12, color: theme.ink2, margin: 0, lineHeight: 1.55 }}>
              Se l&apos;email è registrata riceverai a breve un link per
              reimpostare la password. Controlla anche nello spam.
            </p>
            <p style={{ textAlign: 'center', fontFamily: 'var(--font-pixel-body)', fontSize: 11, color: theme.ink3, margin: 0 }}>
              <Link href="/login" style={{ color: theme.accent, textDecoration: 'underline' }}>
                Torna al login
              </Link>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label htmlFor="email" style={labelStyle}>Email</label>
              <input
                id="email"
                type="email"
                placeholder="nome@esempio.com"
                style={inputStyle}
                {...register('email')}
              />
              {errors.email && (
                <p style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 11, color: '#E24B4A', margin: '4px 0 0' }}>
                  {errors.email.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={sending}
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
                cursor: sending ? 'not-allowed' : 'pointer',
                opacity: sending ? 0.5 : 1,
                boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
              }}
            >
              {sending ? 'Invio…' : 'Invia link'}
            </button>

            <p style={{ marginTop: 4, textAlign: 'center', fontFamily: 'var(--font-pixel-body)', fontSize: 11, color: theme.ink3 }}>
              <Link href="/login" style={{ color: theme.accent, textDecoration: 'underline' }}>
                Torna al login
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
