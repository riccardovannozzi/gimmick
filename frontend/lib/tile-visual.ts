/**
 * Gimmick — Sistema visivo dei Tile a canali indipendenti.
 *
 * Un Tile si legge senza leggerne il contenuto. Cinque canali, cinque zone del
 * rettangolo 160×90, che non possono collidere fra loro:
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

// ─── LA PALLA ────────────────────────────────────────────────────────────────

/** Di chi è la mossa successiva. Due sole zone, per scelta: «Tocca a me» e
 *  «Tocca a te» sono le due liste che il Cockpit deve produrre. */
export type SubtaskBall = 'mine' | 'theirs';

/**
 * Di chi è la palla su un passo.
 *
 * Vale solo dentro un tile `action_type = 'flow'`: un flusso è un rimpallo di
 * responsabilità fra più soggetti, e solo lì la domanda ha senso. Su una
 * checklist della spesa la palla è sempre di chi l'ha scritta. La funzione resta
 * pura e non lo verifica: a non chiamarla è chi disegna.
 *
 * ─── Le tre risposte, e come sono salvate ────────────────────────────────────
 *
 *   niente                          → tocca a me
 *   is_theirs = true                → tocca a te, ma non dico a chi
 *   contact_id = <qualcuno>         → tocca a te, a quella persona
 *
 * ⚠️ L'ORDINE DEI RAMI È VINCOLANTE, e non è una preferenza: `is_theirs` è la
 * marcatura ESPLICITA dell'utente e vince sul contatto, che è un dato dedotto.
 * Chi ha premuto il pulsante ha detto una cosa; chi ha lasciato un contatto
 * attaccato da una vecchia migrazione non ha detto niente. Invertire i rami
 * significherebbe far scavalcare la seconda alla prima.
 *
 * ⚠️ `contact_id IS NULL` significa «tocca a me» — il default muto. La semantica
 * è dichiarata dalla migration 027 (riga 7, «default-mine semantics»), ma quella
 * frase parlava di `flow_nodes`, che nel frattempo è in via di ritiro. La
 * colonna sui `tile_subtasks` arriva dieci migration dopo, con la 037, che la
 * regola non la ripete: fino a questo commento i subtask l'avevano ereditata per
 * convenzione e mai per iscritto. Adesso è scritta qui.
 *
 * Il contatto «io» (`contacts.is_self`, uno per utente) vale come nessun
 * contatto: un passo assegnato a me stesso tocca a me. Se `selfContactId` non è
 * ancora arrivato — la rubrica si carica in modo asincrono — un contatto
 * qualsiasi conta come «altri»: è il caso maggioritario, e sbagliare per un
 * fotogramma sul proprio contatto è meno grave che mostrare vuota una lista che
 * piena lo è.
 */
export function subtaskBall(
  s: { is_theirs?: boolean | null; contact_id?: string | null },
  selfContactId?: string | null,
): SubtaskBall {
  if (s.is_theirs === true) return 'theirs';
  if (s.contact_id && s.contact_id !== selfContactId) return 'theirs';
  return 'mine';
}

/** La forma minima di passo che le regole qui sotto sanno leggere. */
export type StepRow = {
  id: string;
  is_done?: boolean | null;
  state?: 'blocked' | 'cancelled' | null;
  sort_order?: number | null;
  created_at?: string | null;
  occurred_at?: string | null;
  is_theirs?: boolean | null;
  contact_id?: string | null;
};

/**
 * IL PASSO CORRENTE: il primo che resta da fare.
 *
 * È la riga su cui il Cockpit costruisce tutto — di chi è la palla lo dice il
 * passo corrente, non il tile.
 *
 *   aperto   = `is_done` falso E stato nullo o `blocked`
 *   chiuso   = `is_done` vero
 *   annullato= `cancelled`, e NON CONTA MAI: non è fatto e non è da fare
 *
 * Un passo `blocked` è aperto e può essere il corrente: è fermo, non chiuso, ed
 * è semmai quello che ha più bisogno di essere guardato. Saltarlo nasconderebbe
 * proprio i processi incagliati.
 *
 * ⚠️ L'ORDINAMENTO DEVE ESSERE TOTALE, e non è pedanteria. `sort_order` si
 * ripete: nasce da `max + 1` ma il riordino lo riscrive per indice, e due righe
 * con lo stesso numero esistono. Con il solo `sort_order` l'esito dipenderebbe
 * dall'ordine in cui il database ha restituito le righe, e lo stesso tile
 * mostrerebbe passi diversi a due caricamenti identici. Finora non si vedeva
 * perché nessuno chiedeva IL PRIMO: si disegnava una barra, e due segmenti
 * scambiati fra loro sono invisibili.
 *
 * Da qui i tre criteri: `sort_order`, poi `created_at`, poi `id`. L'ultimo è
 * arbitrario ma unico, ed è quel che rende l'ordine totale davvero.
 *
 * ⚠️ Su un tile CHIUSO non si chiede: i suoi passi non sono da fare, sono
 * neutri. La decisione sta in chi chiama, che il tile ce l'ha — vedi
 * `cockpitLane`.
 */
export function currentStep<T extends StepRow>(steps: T[]): T | null {
  const open = steps.filter((s) => !s.is_done && (s.state == null || s.state === 'blocked'));
  if (open.length === 0) return null;
  return open.slice().sort((a, b) => (
    (a.sort_order ?? 0) - (b.sort_order ?? 0)
    || (a.created_at ?? '').localeCompare(b.created_at ?? '')
    || a.id.localeCompare(b.id)
  ))[0];
}

/**
 * DA QUANDO un passo è fermo lì: quando è avvenuto, e in mancanza quando è nato.
 *
 * ⚠️ MAI `updated_at`, né del passo né del tile. Correggere un refuso in un
 * titolo azzererebbe trenta giorni di attesa, e il numero tornerebbe a zero
 * proprio mentre si guarda la cosa che nessuno tocca da un mese. È il tipo di
 * errore che si nota solo dopo mesi, quando la colonna non ordina più niente.
 *
 * Serve a ORDINARE, non a classificare: non esiste una soglia oltre la quale un
 * passo è «fermo». Sui dati veri il 63% dei passi aperti ha più di venti giorni:
 * qualunque soglia ragionevole finirebbe per marcare quasi tutto, e una corsia
 * che contiene tutto non separa niente.
 */
export function stalenessFrom(s: { occurred_at?: string | null; created_at?: string | null }): string | null {
  return s.occurred_at ?? s.created_at ?? null;
}

// ─── IL COCKPIT ──────────────────────────────────────────────────────────────

/** Le due liste, più i conclusi che stanno dietro un interruttore. */
export type CockpitLane = 'mine' | 'theirs' | 'closed';

/**
 * In quale delle due liste finisce un flow — o se è concluso.
 *
 * `closed` copre due casi diversi che si somigliano da fuori:
 *   • il tile è stato chiuso a mano (`done` / `cancelled`), e allora i suoi
 *     passi rimasti sono NEUTRI: né fatti né da fare. Succede spesso ed è il
 *     motivo per cui esiste questo ramo;
 *   • non resta nessun passo aperto, e allora il flow è finito da sé.
 *
 * Il tile chiuso vince e viene per primo: ha l'ultima parola su quel che
 * contiene, altrimenti un flow archiviato con tre passi aperti dentro
 * continuerebbe a chiedere attenzione dopo che gli è stata tolta.
 *
 * Ogni flow sta in UNA lista sola.
 */
export function cockpitLane(
  opts: { closed: boolean; steps: StepRow[] },
  selfContactId?: string | null,
): CockpitLane {
  if (opts.closed) return 'closed';
  const next = currentStep(opts.steps);
  if (!next) return 'closed';
  return subtaskBall(next, selfContactId);
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
 * 10/6, strip 20, corpi 11/15 — sono tarate su questo.
 *
 * ⚠️ Non è la misura che si vede: è 160×90 perché a valle c'è `TILE_SCALE`.
 *
 * 160×90 è 16:9, e lo è anche l'ingombro che ne esce (128×72): è l'unica misura
 * sotto la precedente che resti proporzionata al vecchio 1.8 (scarto 1.2%)
 * tenendo interi entrambi i rettangoli. Il vincolo che restringe il campo è lo
 * zoom: base = reso ÷ 0.8, quindi il reso dev'essere divisibile per 4 o la base
 * cade sui decimali. Per questo 1.800 esatto non era disponibile — servirebbe
 * 135×75 (base 168.75) — e si è preso il più vicino.
 */
export const TILE_BASE_W = 160;
export const TILE_BASE_H = 90;

/**
 * La scala a cui il tile è MOSTRATO. 0.8 → 128×72, misura standard in canvas,
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
 * scale ridotte il rettangolo resta 160×90 nello spazio del board ma sullo
 * schermo diventa una scheggia.
 *
 * 0.6 viene dalle misure, non dal gusto: il segmento dello stepper è alto 3px e
 * il bordo del badge 1.2px. Sotto 0.6 il segmento scende sotto i 2 px reali e
 * il bordo sotto 0.75, cioè meno di un pixel fisico su schermo non-retina — a
 * quel punto non è più un simbolo attenuato, è sporcizia.
 */
export const TILE_LOD_MIN_SCALE = 0.6;
