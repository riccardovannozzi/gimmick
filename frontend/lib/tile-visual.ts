/**
 * Gimmick — Sistema visivo dei Tile a canali indipendenti.
 *
 * Un Tile si legge senza leggerne il contenuto. Cinque canali, cinque zone del
 * rettangolo 150×80, che non possono collidere fra loro:
 *
 *   bordo           perimetro                    tipo, famiglia "senza tempo"
 *   badge d'angolo  spigoli superiori (esterni)  tipo, famiglia "con tempo"
 *   strip           lato interno sinistro        avanzamento (stepper)
 *   footer sinistro base a sinistra              status, testuale
 *   footer destro   base a destra                metadato
 *
 * Questo file contiene SOLO le costanti. Il rendering sta nei componenti.
 *
 * ─── Perché le chiavi si chiamano così ───────────────────────────────────────
 *
 * Nel progetto convivono già due vocabolari per la stessa cosa: i valori
 * memorizzati (`none`, `anytime`, `deadline`, `event`) e le etichette che
 * l'utente vede (Note, To-do, Due, Daily, Timing). Indicizzare questa mappa su
 * un terzo insieme di nomi avrebbe creato un dialetto in più da tenere allineato
 * a mano. Le chiavi sono quindi quelle del CODICE, con la corrispondenza in
 * chiaro qui sotto.
 *
 * ─── Il nodo: cinque chiavi grafiche, quattro valori memorizzati ─────────────
 *
 * `daily` e `timing` NON sono due action_type: sono lo stesso `event`,
 * distinto dal flag booleano `all_day`. La chiave grafica `allday` è derivata a
 * tempo di render — è una convenzione che il frontend applica già per i colori
 * (`DEFAULT_ACTION_COLORS` ha sei chiavi) e che finora era ricopiata a mano
 * in tre punti diversi (CanvasBoard, StagingPanel ×2). `tileVisualKey()` la
 * centralizza.
 *
 * `flow` è invece il quinto valore MEMORIZZATO, introdotto insieme alla terza
 * colonna di CHRONO: sei chiavi grafiche su cinque valori in tabella.
 */
import type { ActionType } from '@/types';

/**
 * Chiave del canale visivo. Non coincide con `action_type`: `allday` è derivata.
 *
 *   none      → Note      (appunto, senza tempo)
 *   anytime   → To-do     (da fare, senza data)
 *   deadline  → Due       (scadenza)
 *   allday    → Daily     (evento su giornata intera)   ← derivata: event + all_day
 *   event     → Timing    (evento con fascia oraria)
 *   flow      → Flow      (processo a passi)
 *
 * Coincide con `ActionType`, che ospita già la chiave derivata `allday`: l'alias
 * resta perché il nome dice cosa fa — indicizzare una resa, non un dato.
 */
export type TileVisualKey = ActionType;

/**
 * Risolve la chiave grafica dal tile. Unico punto in cui la regola
 * "event + all_day = allday" è scritta.
 */
export function tileVisualKey(t: { action_type?: ActionType | null; all_day?: boolean | null }): TileVisualKey {
  if (t.action_type === 'event' && t.all_day) return 'allday';
  return (t.action_type as TileVisualKey) ?? 'none';
}

export type TileChannelSpec = {
  border: 'none' | 'solid' | 'dashed';
  badge: null | { position: 'left' | 'right'; kind: 'icon' | 'word'; value: string };
  meta: 'none' | 'date' | 'time' | 'recurrence' | 'progress';
  stepper: boolean;
};

/**
 * ⚠️ `allday` diverge dalla specifica originale su due campi, e la divergenza è
 * un dato mancante, non una scelta di gusto:
 *
 *   meta:    'date' e non 'recurrence' — nello schema NON esiste alcun concetto
 *            di ricorrenza (nessun rrule, nessuna tabella di occorrenze).
 *            `all_day` significa "occupa la giornata intera", non "ogni giorno".
 *            Un metadato "ogni giorno" sarebbe inventato; la data del giorno no.
 *
 * ⚠️ `stepper: true` su TUTTI i tipi, non solo su `flow`.
 *
 * La specifica lo dava al solo flow (e a daily, per contare le occorrenze di una
 * ricorrenza che non esiste). Ma la sorgente dei passi non è più `flow_nodes`:
 * sono i `tile_subtasks`, che OGNI tile può avere — 87 righe su 27 tile nei dati
 * reali, in larga parte note e to-do. Lasciandolo al solo flow, montare questo
 * componente avrebbe fatto sparire la barra di avanzamento dalle colonne Notes e
 * Todo senza rimpiazzarla con niente.
 *
 * Non è un'estensione arbitraria: è la conseguenza della decisione «le LIST su
 * tutti i tipi di tile». E non rende `note` meno muto — la strip è il canale
 * dell'AVANZAMENTO, non del tipo, e compare solo se dei passi esistono davvero.
 */
export const TILE_VISUAL: Record<TileVisualKey, TileChannelSpec> = {
  // Il tipo più frequente (106 tile) è l'unico completamente muto: nessun bordo,
  // nessun badge, nessun metadato. Si identifica per sottrazione, e questo è ciò
  // che lascia respirare tutti gli altri.
  none:     { border: 'none',   badge: null,                                                    meta: 'none',     stepper: true },
  anytime:  { border: 'solid',  badge: null,                                                    meta: 'none',     stepper: true },
  // Ridondanza voluta: il tratteggio si legge da lontano e in miniatura, il
  // badge da vicino.
  deadline: { border: 'dashed', badge: { position: 'right', kind: 'icon', value: 'flame' },      meta: 'date',     stepper: true },
  allday:   { border: 'none',   badge: { position: 'right', kind: 'icon', value: 'calendar-month' }, meta: 'date', stepper: true },
  event:    { border: 'none',   badge: { position: 'right', kind: 'icon', value: 'clock' },      meta: 'time',     stepper: true },
  // Badge a destra come tutti gli altri: allineati sullo stesso spigolo i badge
  // diventano una colonna di segnali invece di due punti che ballano da lati
  // opposti. A sinistra collideva anche con la strip, che è il lato dei passi.
  flow:     { border: 'none',   badge: { position: 'right', kind: 'word', value: 'FLOW' },       meta: 'progress', stepper: true  },
};

// ─── STATUS ──────────────────────────────────────────────────────────────────

/**
 * I cinque status di sistema, verificati sul database (tabella `statuses`,
 * category='system'). 26 tile su 585 non hanno `status_id`: vanno letti come
 * `active`, cioè muti.
 */
export type TileStatus = 'active' | 'done' | 'paused' | 'blocked' | 'cancelled';

/** `null` = non renderizzare l'etichetta. `active` è lo stato normale e tace. */
export const TILE_STATUS_LABEL: Record<TileStatus, string | null> = {
  active:    null,
  paused:    'in pausa',
  blocked:   'bloccato',
  done:      'completato',
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
 * Fonte dei passi: `tile_subtasks`, la checklist che ogni tile ha già.
 * NON `flow_nodes` — quella tabella è in via di ritiro (i beat diventano
 * subtask), e costruirci sopra significherebbe appoggiarsi al tavolo che stiamo
 * smontando.
 *
 * `state` VINCE su `is_done`, e non è una gerarchia arbitraria: è una
 * sovrastruttura sul booleano, che copre i due casi che «fatto sì/no» non sa
 * dire. Un passo bloccato non è "non ancora fatto": è fermo, e la differenza è
 * tutto il punto del segmento rosso.
 *
 * ⚠️ Questa funzione è l'UNICO posto in cui la regola è scritta. Le quattro
 * viste che disegnano una card — Kanban, Chrono, Staging, Canvas — passano di
 * qui: ognuna aveva la sua copia di `is_done ? 'done' : 'pending'`, e quelle
 * copie sono il motivo per cui il rosso non si è mai acceso in nessuna.
 */
export function subtaskToStep(s: { is_done?: boolean | null; state?: 'blocked' | 'cancelled' | null }): StepState {
  return s.state ?? (s.is_done ? 'done' : 'pending');
}

/**
 * Mappa TRANSITORIA, viva solo durante la migrazione dei 72 beat in subtask.
 *
 * I valori sono quelli REALI di `flow_nodes.state` — `active`, `wait`, `done`,
 * `undo`, `stop` — non `mine`/`theirs`/`blocked`/`cancelled`, che appartengono
 * al modello precedente alla migration 025. "Di chi è la palla" oggi non è uno
 * stato: si deriva da `contacts.is_self` attraverso `contact_id`.
 *
 * Serve a decidere cosa fare delle tre righe (`undo` ×2, `stop` ×1) che portano
 * un'informazione che `is_done` non sa contenere. Dopo la migrazione si elimina.
 */
export const FLOW_NODE_TO_STEP: Record<'active' | 'wait' | 'done' | 'undo' | 'stop', StepState> = {
  done:   'done',
  active: 'pending',
  wait:   'pending',
  stop:   'blocked',
  undo:   'cancelled',
};

/**
 * Quanti segmenti stanno nella strip prima di doverli riassumere.
 *
 * Il numero viene dalla GEOMETRIA, non dal gusto: la strip è alta quanto il tile
 * (80) e ogni segmento occupa 3px più 4 di stacco. Dieci segmenti fanno
 * 10×3 + 9×4 = 66px e lasciano 7px di respiro sopra e sotto — la colonna si
 * riempie tutta senza arrivare agli angoli arrotondati. Undici la porterebbero a
 * 73, dodici a 80: attaccati al bordo.
 *
 * ⚠️ Era 5, cioè mezza colonna. Una lista da otto voci veniva riassunta in
 * «4 + altri» mentre lo spazio per mostrarle tutte c'era, e la strip diceva
 * "tante" là dove poteva dire quante. Oltre il decimo si mostrano i primi 9 più
 * un segmento riassuntivo, e il conteggio esatto resta nel metadato del footer
 * ("2 di 14").
 */
export const STEPPER_MAX_SEGMENTS = 10;

// ─── MISURE ──────────────────────────────────────────────────────────────────

/**
 * Il rettangolo su cui il tile è DISEGNATO. Tutte le misure interne — padding
 * 10, strip 20, corpi 11/12 — sono tarate su questo, ed è il 150×80 di cui parla
 * l'intestazione di questo file.
 */
export const TILE_BASE_W = 150;
export const TILE_BASE_H = 80;

/**
 * La scala a cui il tile è MOSTRATO. 0.8 → 120×64, misura standard in canvas,
 * staging, colonne di CHRONO (Notes/Todo/Flow) e Kanban.
 *
 * ⚠️ Il gemello di questo numero è il token `--ob-tile-zoom` in app/obsidian.css,
 * che è quello che riduce davvero il tile. Questo serve a chi deve fare i conti
 * in JavaScript — il canvas, che posiziona i tile in geometria SVG e non può
 * leggere un token CSS. Sono le uniche due dichiarazioni: cambiarne una sola
 * sfaserebbe le posizioni del canvas dal disegno dei tile.
 */
export const TILE_SCALE = 0.8;

/** Quanto un tile OCCUPA davvero: è questo che serve a chi calcola colonne. */
export const TILE_W = TILE_BASE_W * TILE_SCALE;
export const TILE_H = TILE_BASE_H * TILE_SCALE;

// ─── LIVELLO DI DETTAGLIO ────────────────────────────────────────────────────

/**
 * Scala sotto la quale badge e segmenti smettono di essere leggibili e vanno
 * spenti, lasciando solo i canali che sopravvivono in miniatura: fondo, colore
 * e bordo.
 *
 * ⚠️ La soglia NON riguarda il Panopticon, come si potrebbe pensare: quella
 * vista non disegna Tile: disegna nodi astratti di un grafo (`<rect>` di pochi
 * pixel con un layout seminato). Non c'è nessun badge da nascondere perché non
 * c'è nessuna card.
 *
 * Il posto dove il problema esiste davvero è il CANVAS, che ha uno zoom: a
 * scale ridotte il rettangolo resta 150×80 nello spazio del board ma sullo
 * schermo diventa una scheggia.
 *
 * 0.6 viene dalle misure, non dal gusto: il segmento dello stepper è alto 3px e
 * il bordo del badge 1.2px. Sotto 0.6 il segmento scende sotto i 2 px reali e
 * il bordo sotto 0.75, cioè meno di un pixel fisico su schermo non-retina — a
 * quel punto non è più un simbolo attenuato, è sporcizia.
 */
export const TILE_LOD_MIN_SCALE = 0.6;
