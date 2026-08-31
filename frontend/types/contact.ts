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

/**
 * IL RUOLO — le due sole voci con cui l'interfaccia parla di un contatto:
 * un individuo, o un insieme di individui.
 *
 * `kind` ne ha cinque perché la tabella nasce prima di questa distinzione
 * (022_flows.sql), e le cinque restano nel database: nessuna migrazione le
 * accorpa, e una riga «Professionista» salvata tempo fa non perde la sua
 * sfumatura solo perché oggi la si guarda da un selettore a due posizioni.
 *
 * La mappatura è quindi ASIMMETRICA di proposito:
 *   • in LETTURA cinque valori si riducono a due (`contactRole`)
 *   • in SCRITTURA due valori ne scelgono uno canonico (`KIND_FOR_ROLE`)
 *
 * Il che vuol dire che riclassificare una riga è una scelta a senso unico: un
 * «Professionista» toccato dal selettore diventa «persona» e non torna indietro.
 * È accettabile — succede solo se qualcuno tocca quella cella — ma è il genere
 * di perdita che va scritta, non scoperta.
 *
 * ⚠️ Questa regola vive QUI e non copiata nelle schermate: la usano la tabella
 * dei contatti, il canvas (per sapere che cosa proporre come organizzazione) e
 * il pannello dell'anagrafica. Tre copie sarebbero divergenti al primo `kind`
 * aggiunto.
 */
export type ContactRole = 'subject' | 'organization';

/** I `kind` che valgono come INSIEME di persone. Tutto il resto è un individuo:
 *  la regola è per esclusione, così un `kind` nuovo non diventa
 *  un'organizzazione per sbaglio. */
export const ORGANIZATION_KINDS: ContactKind[] = ['company', 'institution'];

export const contactRole = (kind: ContactKind | string | null | undefined): ContactRole =>
  ORGANIZATION_KINDS.includes(kind as ContactKind) ? 'organization' : 'subject';

export const isOrganizationKind = (kind: ContactKind | string | null | undefined): boolean =>
  contactRole(kind) === 'organization';

/** Il `kind` che si SCRIVE scegliendo un ruolo. Uno solo per ruolo: gli altri
 *  tre restano raggiungibili solo dai dati già esistenti. */
export const KIND_FOR_ROLE: Record<ContactRole, ContactKind> = {
  subject: 'person',
  organization: 'company',
};

export const ROLE_LABEL: Record<ContactRole, string> = {
  subject: 'Soggetto',
  organization: 'Organizzazione',
};

/** Lo stesso ruolo quando nomina un INSIEME di righe invece di una sola: la
 *  cella di una riga dice che cos'è quella riga, il filtro di barra dice quali
 *  righe restano. È la stessa distinzione che c'è fra un'etichetta e un
 *  sommario, e tenerle entrambe qui evita che una delle due venga scritta a
 *  mano nella schermata che serve. */
export const ROLE_LABEL_PLURAL: Record<ContactRole, string> = {
  subject: 'Soggetti',
  organization: 'Organizzazioni',
};

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
