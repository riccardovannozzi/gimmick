/**
 * Contatti — lettura e scrittura via react-query.
 *
 * Consumato dalla modale di gestione (navbar → Contatti) e dal
 * `ContactCombobox`. Il contatto è referenziato da `tile_subtasks.contact_id`.
 */
'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contactsApi } from '@/lib/api';
import type { Contact, ContactKind } from '@/types/contact';

type CreateContactBody = {
  name: string;
  kind?: ContactKind;
  phone?: string;
  email?: string;
  notes?: string;
  color?: string;
  avatar_url?: string;
};

export function useContacts(opts?: { archived?: boolean }) {
  const qc = useQueryClient();
  const archived = opts?.archived ?? false;
  const key = ['contacts', { archived }] as const;

  const query = useQuery({
    queryKey: key,
    queryFn: async (): Promise<Contact[]> => {
      const res = await contactsApi.list({ archived });
      if (!res.success) throw new Error(res.error || 'Errore caricamento contatti');
      return (res.data as Contact[]) ?? [];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['contacts'] });
  };

  const create = useMutation({
    mutationFn: async (body: CreateContactBody) => {
      const res = await contactsApi.create(body);
      return res.data as Contact;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<CreateContactBody> }) => {
      const res = await contactsApi.update(id, updates);
      return res.data as Contact;
    },
    onSuccess: invalidate,
  });

  const archive = useMutation({
    mutationFn: async (id: string) => contactsApi.archive(id),
    onSuccess: invalidate,
  });

  const unarchive = useMutation({
    mutationFn: async (id: string) => contactsApi.unarchive(id),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => contactsApi.remove(id),
    onSuccess: invalidate,
  });

  return {
    contacts: query.data ?? [],
    isLoading: query.isLoading,
    create,
    update,
    archive,
    unarchive,
    remove,
  };
}
