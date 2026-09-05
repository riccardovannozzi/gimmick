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

/** Una coppia della tabella `contact_organizations`: X fa parte di Y. */
export type ContactMembership = { member_id: string; org_id: string };

/**
 * LE APPARTENENZE — chi fa parte di che cosa, tutte insieme.
 *
 * ⚠️ Sta in una funzione ESPORTATA, e non ripetuta in ogni schermata che ne ha
 * bisogno, per un motivo che abbiamo già pagato: due `useQuery` con la stessa
 * chiave ma `queryFn` diverse si sovrascrivono a vicenda in cache, e vince
 * l'ultima che gira. Qui una delle due restituiva l'array e l'altra la busta
 * `{ success, data }` che lo contiene — stessa chiave, due forme — e la
 * schermata che riceveva la busta provava a iterarla.
 * Regola: una chiave di cache, una funzione che la riempie.
 *
 * Non filtrata per archiviati: un'appartenenza è una coppia di id e non sa
 * niente dello stato delle due righe. A nascondere gli archiviati pensa chi
 * disegna.
 *
 * Se la richiesta fallisce (tipicamente: la migration 047 non è ancora girata)
 * la funzione SOLLEVA invece di restituire la busta d'errore. È la differenza
 * fra `data` che resta `undefined` — e diventa un array vuoto a valle — e un
 * oggetto d'errore parcheggiato in cache che ogni lettore dovrebbe riconoscere.
 */
export function useContactMemberships() {
  return useQuery({
    queryKey: ['contact-memberships'],
    queryFn: async (): Promise<ContactMembership[]> => {
      const res = await contactsApi.memberships();
      if (!res.success) throw new Error(res.error || 'Errore caricamento appartenenze');
      return (res.data as ContactMembership[]) ?? [];
    },
    staleTime: 60 * 1000,
  });
}

/**
 * `enabled` esiste perché questo hook viene chiamato anche da posti che la
 * rubrica non sempre la usano — la palla dei passi la mostra solo sui tile
 * `flow`. Sta QUI e non nel chiamante di proposito: registrare altrove un
 * `useQuery` sulla stessa chiave con una `queryFn` propria è la trappola
 * descritta nel commento in cima a questo file, e ne esiste già un caso.
 * Le mutazioni restano attive comunque: non dipendono dalla lettura.
 */
export function useContacts(opts?: { archived?: boolean; enabled?: boolean }) {
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
    enabled: opts?.enabled ?? true,
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

  // Stessa cache del canvas: spuntare un'organizzazione qui aggiorna anche la
  // lavagna aperta dietro.
  const membershipsQuery = useContactMemberships();

  const setOrganizations = useMutation({
    mutationFn: async ({ id, orgIds }: { id: string; orgIds: string[] }) =>
      contactsApi.setOrganizations(id, orgIds),
    // Ottimistico: spuntare una casella deve rispondere subito, e in caso di
    // errore si rimette com'era chiedendo al server invece di indovinare.
    onMutate: async ({ id, orgIds }) => {
      await qc.cancelQueries({ queryKey: ['contact-memberships'] });
      const before = qc.getQueryData<ContactMembership[]>(['contact-memberships']);
      qc.setQueryData<ContactMembership[]>(['contact-memberships'], (old) => [
        ...(old ?? []).filter((m) => m.member_id !== id),
        ...orgIds.map((org_id) => ({ member_id: id, org_id })),
      ]);
      return { before };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.before) qc.setQueryData(['contact-memberships'], ctx.before);
    },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['contact-memberships'] }); },
  });

  return {
    contacts: query.data ?? [],
    isLoading: query.isLoading,
    memberships: membershipsQuery.data ?? [],
    setOrganizations,
    create,
    update,
    archive,
    unarchive,
    remove,
  };
}
