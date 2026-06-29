'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Field, Button } from '@/components/primitives';
import { AuthLayout, AuthField, AuthError, AuthFoot, AuthLink } from '@/components/auth/obsidian-auth';
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

  return (
    <AuthLayout title="Gimmick" subtitle="Crea un nuovo account">
      <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <AuthField label="Email" htmlFor="email" error={errors.email?.message}>
          <Field id="email" type="email" placeholder="nome@esempio.com" invalid={!!errors.email} {...register('email')} />
        </AuthField>
        <AuthField label="Password" htmlFor="password" error={errors.password?.message}>
          <Field id="password" type="password" placeholder="••••••••" invalid={!!errors.password} {...register('password')} />
        </AuthField>
        <AuthField label="Conferma Password" htmlFor="confirmPassword" error={errors.confirmPassword?.message}>
          <Field id="confirmPassword" type="password" placeholder="••••••••" invalid={!!errors.confirmPassword} {...register('confirmPassword')} />
        </AuthField>
        {error && <AuthError>{error}</AuthError>}
        <Button variant="primary" type="submit" disabled={isLoading} style={{ width: '100%' }}>
          {isLoading ? 'Caricamento…' : 'Registrati'}
        </Button>
        <AuthFoot>Hai già un account? <AuthLink href="/login">Accedi</AuthLink></AuthFoot>
      </form>
    </AuthLayout>
  );
}
