'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Field, Button } from '@/components/primitives';
import { AuthLayout, AuthField, AuthFoot, AuthLink } from '@/components/auth/obsidian-auth';
import { authApi } from '@/lib/api';

const schema = z.object({
  email: z.string().email('Email non valida'),
});
type Form = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
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

  return (
    <AuthLayout title="Password dimenticata" subtitle="Ti invieremo un link per reimpostarla">
      {submitted ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ fontSize: 13, color: 'var(--ob-muted)', margin: 0, lineHeight: 1.55 }}>
            Se l&apos;email è registrata riceverai a breve un link per reimpostare la password. Controlla anche nello spam.
          </p>
          <AuthFoot><AuthLink href="/login">Torna al login</AuthLink></AuthFoot>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <AuthField label="Email" htmlFor="email" error={errors.email?.message}>
            <Field id="email" type="email" placeholder="nome@esempio.com" invalid={!!errors.email} {...register('email')} />
          </AuthField>
          <Button variant="primary" type="submit" disabled={sending} style={{ width: '100%' }}>
            {sending ? 'Invio…' : 'Invia link'}
          </Button>
          <AuthFoot><AuthLink href="/login">Torna al login</AuthLink></AuthFoot>
        </form>
      )}
    </AuthLayout>
  );
}
