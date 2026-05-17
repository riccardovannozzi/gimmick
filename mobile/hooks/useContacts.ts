/**
 * React-query hook for Contacts — used by the Flow inspector's contact
 * picker. Port of frontend/lib/hooks/useContacts.ts (minus archive/remove,
 * which aren't surfaced in the mobile flow inspector yet).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contactsApi } from '@/lib/api';
import type { Contact, ContactKind } from '@/types';

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

  return {
    contacts: query.data ?? [],
    isLoading: query.isLoading,
    create,
  };
}
