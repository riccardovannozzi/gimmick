/**
 * Contatti — tipi condivisi.
 *
 * Mirror di `frontend/types/contact.ts`. Il repo non ha un pacchetto TS in
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
  /** True per il contatto "io" di ciascun utente, creato al signup. È il
   *  soggetto predefinito di un passo ("la palla è mia") e va in cima ai
   *  selettori. Esattamente uno per utente (indice unico parziale). */
  is_self: boolean;
  created_at: string;
  updated_at: string;
}
