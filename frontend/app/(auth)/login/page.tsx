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

const loginSchema = z.object({
  email: z.string().email('Email non valida'),
  password: z.string().min(6, 'Password deve avere almeno 6 caratteri'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { signIn, isLoading } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setError(null);
    const result = await signIn(data.email, data.password);

    if (result.error) {
      // Email non confermata → manda alla pagina di verifica così l'utente
      // può cliccare "Reinvia" senza tornare al register.
      if (result.code === 'EMAIL_NOT_CONFIRMED') {
        toast.error('Email non confermata');
        router.push(`/verify-email?email=${encodeURIComponent(data.email)}`);
        return;
      }
      setError(result.error);
      toast.error(result.error);
    } else {
      toast.success('Login effettuato!');
      router.push('/');
    }
  };

  return (
    <AuthLayout title="Gimmick" subtitle="Accedi al tuo account">
      <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <AuthField label="Email" htmlFor="email" error={errors.email?.message}>
          <Field id="email" type="email" placeholder="nome@esempio.com" invalid={!!errors.email} {...register('email')} />
        </AuthField>
        <AuthField
          label="Password"
          htmlFor="password"
          error={errors.password?.message}
          action={<AuthLink href="/forgot-password">Dimenticata?</AuthLink>}
        >
          <Field id="password" type="password" placeholder="••••••••" invalid={!!errors.password} {...register('password')} />
        </AuthField>
        {error && <AuthError>{error}</AuthError>}
        <Button variant="primary" type="submit" disabled={isLoading} style={{ width: '100%' }}>
          {isLoading ? 'Caricamento…' : 'Accedi'}
        </Button>
        <AuthFoot>Non hai un account? <AuthLink href="/register">Registrati</AuthLink></AuthFoot>
      </form>
    </AuthLayout>
  );
}
