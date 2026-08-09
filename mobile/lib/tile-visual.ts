/**
 * Gimmick — Sistema visivo dei Tile, versione mobile.
 *
 * Port di `frontend/lib/tile-visual.ts`. Contiene SOLO le costanti e le due
 * regole di traduzione dal dominio ai canali: il rendering sta nei componenti,
 * e i colori — che cambiano col tema — stanno nei token, non qui.
 *
 * ─── I canali, e quali il mobile disegna ─────────────────────────────────────
 *
 * Sul web un Tile è un rettangolo fisso di 150×80 con cinque canali: bordo,
 * badge d'angolo, strip, footer sinistro, footer destro. La card mobile è una
 * riga a tutta larghezza e alta quanto il suo contenuto, quindi due canali
 * cambiano sede e uno non esiste:
 *
 *   web                          mobile
 *   ───────────────────────────  ─────────────────────────────────────────────
 *   badge d'angolo (spigolo)  →  quadratino colorato nel footer
 *   strip (lato interno sx)   →  corsia sinistra, insieme al glifo di status
 *   footer destro (metadato)  →  footer, accanto al badge azione
 *   footer sinistro (status)  →  corsia sinistra (era già lì)
 *   bordo                     →  ASSENTE
 *
 * Il bordo non c'è perché la card mobile non ne ha uno: si stacca dalla pagina
 * per il solo fondo `surface`. Il tratteggio che sul web segnala una scadenza
 * qui non avrebbe niente su cui correre — la scadenza si legge dal badge fiamma
 * e dalla data. Meglio un canale in meno che un bordo inventato per simmetria.
 *
 * ─── Perché il badge di `flow` è un'icona e non la parola "FLOW" ─────────────
 *
 * Sul web il badge del flow è una PAROLA, perché sta fuori dal rettangolo, su
 * uno spigolo dove nessun altro badge arriva. Sul mobile i badge sono sei
 * quadratini di 20dp in fila nel footer: infilarci una parola fra cinque icone
 * romperebbe la colonna. Stesso ruolo, forma diversa — è una scelta di resa,
 * e il canale resta lo stesso.
 */
import type { ActionType } from '@/types';
import type { TileActionKey } from '@/constants/tile-colors';

/**
 * Chiave del canale visivo. NON coincide con `action_type`: `allday` è derivata
 * (`event` + `all_day`) e non esiste nel database.
 *
 *   none      → Note      (appunto, senza tempo)
 *   anytime   → To-do     (da fare, senza data)
 *   deadline  → Due       (scadenza)
 *   allday    → Daily     (evento su giornata intera)   ← derivata
 *   event     → Timing    (evento con fascia oraria)
 *   flow      → Flow      (processo a passi)
 *
 * È `TileActionKey`, che di chiavi ne ha già sei perché alimenta la tavolozza:
 * l'alias esiste perché il nome dica cosa fa — indicizzare una resa, non un
 * dato.
 */
export type TileVisualKey = TileActionKey;

/**
 * Risolve la chiave grafica dal tile. UNICO punto in cui è scritta la regola
 * "event + all_day = allday", che prima viveva copiata nella lista Tiles, nel
 * dettaglio tile e nella cronologia legacy.
 */
export function tileVisualKey(t: { action_type?: ActionType | null; all_day?: boolean | null }): TileVisualKey {
  if (t.action_type === 'event' && t.all_day) return 'allday';
  return (t.action_type as TileVisualKey) ?? 'none';
}

export type TileChannelSpec = {
  /** Nome del glifo Tabler nel badge del footer. `null` = nessun badge. */
  badge: string | null;
  /** Cosa scrive il metadato del footer. */
  meta: 'none' | 'date' | 'time' | 'progress';
  /** Se il tipo ammette la scaletta dei passi nella corsia sinistra. */
  stepper: boolean;
};

/**
 * ⚠️ `stepper: true` su TUTTI i tipi, non solo su `flow`.
 *
 * La sorgente dei passi sono i `tile_subtasks`, che OGNI tile può avere: una
 * checklist sta bene su una nota come su un to-do. Riservarla al solo flow
 * avrebbe fatto sparire l'avanzamento da tutti gli altri tipi senza
 * rimpiazzarlo con niente. La corsia compare solo se dei passi esistono
 * davvero, quindi un tile senza checklist resta muto com'era.
 *
 * ⚠️ `allday` ha `meta: 'date'` e non una ricorrenza: nello schema NON esiste
 * alcun concetto di ricorrenza. `all_day` significa "occupa la giornata
 * intera", non "ogni giorno".
 */
export const TILE_VISUAL: Record<TileVisualKey, TileChannelSpec> = {
  // Il tipo più frequente è l'unico completamente muto: nessun badge, nessun
  // metadato. Si identifica per sottrazione, ed è questo che lascia respirare
  // tutti gli altri.
  none: { badge: null, meta: 'none', stepper: true },
  // ⚠️ Sul web `anytime` NON ha badge: gli basta il bordo solido a distinguerlo
  // da una nota. Qui il bordo non esiste (vedi la nota in cima), quindi senza
  // badge un to-do sarebbe indistinguibile da un appunto — cioè muto quanto il
  // tipo che del silenzio fa la propria identità. La freccia è quella che il
  // mobile mostrava già.
  anytime: { badge: 'IconArrowUp', meta: 'none', stepper: true },
  deadline: { badge: 'IconBolt', meta: 'date', stepper: true },
  allday: { badge: 'IconCalendar', meta: 'date', stepper: true },
  event: { badge: 'IconClock', meta: 'time', stepper: true },
  // Un flow non ha data: non è schedulabile. Al suo posto, nello stesso slot
  // del footer, l'avanzamento — che è l'unica cosa che di un processo si vuole
  // sapere a colpo d'occhio.
  flow: { badge: 'IconRoute', meta: 'progress', stepper: true },
};

// ─── STATUS ──────────────────────────────────────────────────────────────────

/**
 * I cinque status di sistema. Un tile senza `status_id` va letto come `active`,
 * cioè muto.
 */
export type TileStatus = 'active' | 'done' | 'paused' | 'blocked' | 'cancelled';

/**
 * Lo status è una PAROLA nel footer sinistro, non un glifo in corsia.
 *
 * Il mobile lo mostrava come pallino/icona dentro la corsia di sinistra, che
 * nel sistema a canali è il posto dei PASSI: due significati nello stesso
 * spazio, e quando un tile aveva sia status sia checklist si contendevano la
 * corsia. Da qui la parola, che sta nel footer e non compete con niente.
 *
 * `null` = non renderizzare: `active` è lo stato normale e tace.
 */
export const TILE_STATUS_LABEL: Record<TileStatus, string | null> = {
  active: null,
  paused: 'in pausa',
  blocked: 'bloccato',
  done: 'completato',
  cancelled: 'eliminato',
};

// ─── STEPPER ─────────────────────────────────────────────────────────────────

/**
 * Stati di un segmento. Il rosso è riservato a `blocked`: un passo semplicemente
 * non ancora fatto è `pending`, neutro. Regola di lettura che ne discende — se
 * c'è del rosso, qualcosa si è fermato.
 */
export type StepState = 'done' | 'pending' | 'blocked' | 'cancelled';

/**
 * Da voce di checklist a segmento.
 *
 * `state` è una sovrastruttura su `is_done`, non un suo rimpiazzo: quando è
 * nullo — cioè quasi sempre — lo stato lo dice il booleano.
 *
 * ⚠️ Il payload di `GET /api/tiles` porta il solo `is_done` (vedi
 * `Tile.subtasks`), quindi nella LISTA i segmenti sono soltanto `done` e
 * `pending`: il rosso non ha ancora sorgente, esattamente come sul web. Questa
 * funzione è già pronta per il giorno in cui l'avrà.
 */
export function subtaskToStep(s: { is_done: boolean; state?: 'blocked' | 'cancelled' | null }): StepState {
  if (s.state === 'blocked') return 'blocked';
  if (s.state === 'cancelled') return 'cancelled';
  return s.is_done ? 'done' : 'pending';
}

/**
 * Oltre questa soglia i segmenti diventano illeggibili: si mostrano i primi 4
 * più un segmento riassuntivo, e il conteggio completo passa nel metadato del
 * footer ("2 di 9").
 */
export const STEPPER_MAX_SEGMENTS = 5;
