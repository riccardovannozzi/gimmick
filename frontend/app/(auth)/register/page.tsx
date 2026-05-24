'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { usePixelTheme } from '@/components/pixel';
import { useAuthStore } from '@/store/auth-store';

const registerSchema = z.object({
  email: z.string().email('Email non valida'),
  password: z.string().min(6, 'Password deve avere almeno 6 caratteri'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Le password non corrispondono',
  path: ['confirmPassword'],
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const theme = usePixelTheme();
  const router = useRouter();
  const { signUp, isLoading } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterForm) => {
    setError(null);
    const result = await signUp(data.email, data.password);

    if (result.error) {
      setError(result.error);
      toast.error(result.error);
      return;
    }

    if (result.requiresEmailVerification) {
      // In produzione: l'utente deve confermare via email prima di poter loggare.
      toast.success('Email di conferma inviata');
      router.push(`/verify-email?email=${encodeURIComponent(data.email)}`);
    } else {
      // Auto-confirm attivo (dev): siamo già loggati, vai al welcome wizard.
      toast.success('Registrazione completata!');
      router.push('/welcome');
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
  const errorStyle: React.CSSProperties = {
    fontFamily: 'var(--font-pixel-body)',
    fontSize: 11,
    color: '#E24B4A',
    margin: '4px 0 0',
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
              fontSize: 20,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: theme.ink,
              margin: 0,
            }}
          >
            Gimmick
          </h1>
          <p style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 11, color: theme.ink3, margin: '6px 0 0' }}>
            Crea un nuovo account
          </p>
        </div>

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
            {errors.email && <p style={errorStyle}>{errors.email.message}</p>}
          </div>

          <div>
            <label htmlFor="password" style={labelStyle}>Password</label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              style={inputStyle}
              {...register('password')}
            />
            {errors.password && <p style={errorStyle}>{errors.password.message}</p>}
          </div>

          <div>
            <label htmlFor="confirmPassword" style={labelStyle}>Conferma Password</label>
            <input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              style={inputStyle}
              {...register('confirmPassword')}
            />
            {errors.confirmPassword && <p style={errorStyle}>{errors.confirmPassword.message}</p>}
          </div>

          {error && (
            <p style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 11, color: '#E24B4A', textAlign: 'center', margin: 0 }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
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
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.5 : 1,
              boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
            }}
          >
            {isLoading ? 'Caricamento...' : 'Registrati'}
          </button>

          <p style={{ marginTop: 4, textAlign: 'center', fontFamily: 'var(--font-pixel-body)', fontSize: 11, color: theme.ink3 }}>
            Hai già un account?{' '}
            <Link href="/login" style={{ color: theme.accent, textDecoration: 'underline' }}>
              Accedi
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
