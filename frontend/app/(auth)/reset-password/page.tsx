'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Field, Button } from '@/components/primitives';
import { AuthLayout, AuthField } from '@/components/auth/obsidian-auth';
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
