/**
 * Contatti — tipi condivisi.
 *
 * Mirror di `backend/src/types/contact.ts`. Il repo non ha un pacchetto TS in
 * comune, quindi la duplicazione è la scelta pragmatica: se cambi un campo qui,
 * cambialo anche là.
 *
 * Questo file era `types/flow.ts` e conteneva anche `FlowNode`, `FlowGraph` e
 * `FlowHubItem`. Sono andati via col modello dei flow: un flow è un tile con
 * `action_type = 'flow'` e i suoi passi sono `tile_subtasks`. Il contatto invece
 * resta un'entità viva — è referenziato da `tile_subtasks.contact_id`.
 */

export type ContactKind = 'person' | 'company' | 'professional' | 'institution' | 'other';

export interface Contact {
  id: string;
  user_id: string;
  name: string;
  kind: ContactKind;
  phone: string | null;
  email: string | null;
  notes: string | null;
  color: string | null;
  avatar_url: string | null;
  archived_at: string | null;
  /** True for the per-user "self" contact, seeded at signup. UI treats it as
   *  the default node assignment ("ball is on me") and pins it at the top of
   *  contact pickers. Exactly one per user (partial unique index). */
  is_self: boolean;
  created_at: string;
  updated_at: string;
}
