/**
 * Gimmick — Geometria della griglia del Kanban.
 *
 * Larghezze delle colonne, altezze delle righe e ordine delle voci. Sta in un
 * modulo a sé perché sono numeri usati in DUE posti che devono per forza dare lo
 * stesso risultato: la riga fissa delle intestazioni e le celle sotto. Finché la
 * misura era scritta nel CSS, le due erano due regole diverse che qualcuno
 * doveva ricordarsi di tenere allineate — e infatti si erano già scostate di due
 * pixel per colonna. Ora la calcola una funzione sola, e le due la chiamano.
 *
 * ─── Le misure ───────────────────────────────────────────────────────────────
 *
 * Il tile è disegnato su 160×90 in tutte le viste, ma quello che occupa è
 * meno: qui i conti si fanno sull'ingombro reale.
 */

/**
 * L'ingombro del tile arriva dal sistema visivo: 128×72, la misura standard di
 * tutta l'app (vedi `TILE_SCALE` in tile-visual.ts).
 *
 * Il Kanban aveva una scala PROPRIA — era l'unica vista a rimpicciolire il tile,
 * quando le altre lo mostravano a grandezza naturale. Ora che 128×72 è lo
 * standard quella scala locale è sparita: restava un secondo fattore che si
 * sarebbe moltiplicato con quello del tile, riducendolo a 102×58.
 */
import { TILE_W, TILE_H } from '@/lib/tile-visual';

/** Distanza fra due tile affiancati. */
export const CELL_GAP = 3;
/** Gronda sopra ogni tile, in cui sborda il badge d'angolo. Sta sulla cella, che
 *  è FUORI dal tile e quindi non si rimpicciolisce con lui. */
export const CELL_BLEED = 9;
/** Padding orizzontale del corpo cella (6+6) più il bordo destro della colonna. */
export const COL_CHROME = 13;
/** Padding verticale del corpo cella (6 sopra, 10 sotto). */
export const ROW_CHROME = 16;
/**
 * ─── Il binario dei nomi di corsia (la prima colonna) ────────────────────────
 *
 * Si adatta al nome più lungo, ma la misura va calcolata UNA VOLTA e data a
 * tutti i binari: sono elementi separati, uno per fascia, e con `width:
 * max-content` ciascuno si dimensionerebbe sul proprio nome — la griglia
 * tornerebbe a disallinearsi riga per riga.
 */
/** Ingombro fisso oltre al testo: padding 10+10, maniglia 11, gap 8, bordo 1.
 *  Erano 68 quando accanto al nome c'era il conteggio dei tile: tolto quello,
 *  spariscono i suoi ~20px e uno dei due gap, e il binario si stringe di 28 —
 *  altrimenti ogni corsia si porterebbe dietro quel vuoto a destra del nome. */
export const RAIL_CHROME = 40;
/** Sotto, la maniglia non ci starebbe nemmeno senza nome. */
export const RAIL_MIN = 60;
/** Oltre, un nome lunghissimo si mangerebbe la board: va a capo e poi in
 *  ellissi, e il nome intero resta nel tooltip. Vale per la misura AUTOMATICA:
 *  trascinando il bordo si va dove si vuole, perché lì la decisione è tua. */
export const RAIL_MAX = 240;
/**
 * La chiave sotto cui è ricordata la larghezza scelta a mano per il binario.
 *
 * Sta nello stesso ripiano delle altezze delle corsie (`size.lane[modalità]`)
 * perché è la colonna DEI NOMI DI CORSIA: cambia con l'asse orizzontale, non con
 * quello verticale, e passando da corsie-status a corsie-data la larghezza buona
 * è un'altra. Il doppio underscore non può collidere con un id di voce — sono
 * UUID o chiavi tipo `action:none`.
 *
 * Effetto collaterale voluto: «Adatta» svuota quel ripiano, quindi rimette anche
 * il binario alla misura calcolata.
 */
export const RAIL_KEY = '__rail';

/** Larghezza di una colonna compressa: resta visibile il solo chevron. */
export const COL_COLLAPSED_W = 40;

/** Larghezza che serve per tenere `slots` tile affiancati. A 128px per tile:
 *  1 → 141 · 2 → 272 · 3 → 403 · 4 → 534. */
export function colWidth(slots: number): number {
  return Math.round(slots * TILE_W + (slots - 1) * CELL_GAP + COL_CHROME);
}

/** Altezza che serve per tenere `rows` file di tile. */
export function rowHeight(rows: number): number {
  return Math.round(rows * (TILE_H + CELL_BLEED) + (rows - 1) * CELL_GAP + ROW_CHROME);
}

/** Un tile solo: sotto, verrebbe tagliato. */
export const MIN_COL_W = colWidth(1);
/** Una fila sola: sotto, una riga vuota non è più un bersaglio di drop. */
export const MIN_ROW_H = rowHeight(1);

/**
 * Oltre quattro tile affiancati la colonna diventa una fascia orizzontale e si
 * perde il senso della board: si smette di allargare e si comincia a impilare.
 */
export const MAX_SLOTS = 4;

/**
 * Quanti tile affiancare in una colonna che ne contiene `n` nella sua cella più
 * piena — la larghezza segue il contenuto, non una misura fissa decisa una volta.
 *
 * `ceil(sqrt(n))` tiene la cella quadrata: 2 tile → 2 affiancati su una fila,
 * 5 → 3 su due file, 10 → 4 su tre. Una colonna vuota resta stretta, e lo spazio
 * che libera va alle colonne che hanno qualcosa da mostrare.
 *
 * Vale finché l'altezza della corsia è LIBERA, cioè finché è la cella a decidere
 * quanto è alta la sua riga. Fissata l'altezza a mano, la scelta non è più
 * libera: le file sono quelle che ci stanno, e il conto lo fa `slotsFor`.
 */
export function autoSlots(n: number): number {
  if (n <= 1) return 1;
  return Math.min(MAX_SLOTS, Math.ceil(Math.sqrt(n)));
}

/**
 * Quante file di tile stanno in una corsia alta `px` — l'inversa di `rowHeight`.
 *
 * Almeno una: sotto `MIN_ROW_H` il gesto non scende, ma il pavimento vale anche
 * se la misura arrivasse da altrove (impostazioni vecchie, una modalità con
 * altre misure).
 */
export function rowsIn(px: number): number {
  return Math.max(1, Math.floor((px - ROW_CHROME + CELL_GAP) / (TILE_H + CELL_BLEED + CELL_GAP)));
}

/**
 * Quanti tile affiancare perché `n` tile stiano in `rows` file.
 *
 * È il gemello di `autoSlots` per le corsie ad altezza FISSATA, e chiude il
 * cerchio fra i due assi: stringendo una colonna i tile vanno a capo e la corsia
 * si alza, quindi abbassando una corsia i tile devono allargarsi e la colonna si
 * allarga. Prima l'andata c'era e il ritorno no — la corsia si limitava a
 * tagliare i tile in eccesso e a farli scorrere dentro la cella.
 *
 * Il tetto resta `MAX_SLOTS`: schiacciando una corsia a una fila, una colonna con
 * venticinque tile chiederebbe venticinque posti affiancati, cioè una fascia
 * orizzontale lunga tremila pixel. Oltre il quarto posto si smette di allargare
 * e quello che avanza torna a scorrere nella cella, che è il comportamento che
 * la corsia fissata ha sempre avuto.
 */
export function slotsFor(n: number, rows: number): number {
  if (n <= 1) return 1;
  return Math.min(MAX_SLOTS, Math.ceil(n / rows));
}

/**
 * Rimette le voci nell'ordine deciso a mano.
 *
 * ⚠️ È una PERMUTAZIONE DEI SOLI ID CONOSCIUTI, non un ordinamento generale: le
 * voci che nell'elenco salvato non compaiono restano esattamente dove sono. Serve
 * per l'asse DATA, dove la finestra dei giorni si allarga da sola: un ordinamento
 * che spinge in fondo quello che non conosce avrebbe preso i giorni nuovi e li
 * avrebbe ammucchiati alla fine, staccandoli dal loro posto nel calendario.
 */
export function applyOrder<T extends { id: string }>(items: T[], order?: string[]): T[] {
  if (!order?.length) return items;
  const rank = new Map(order.map((id, i) => [id, i]));
  // Le posizioni occupate da voci note: solo queste vengono rimescolate.
  const slots: number[] = [];
  const known: T[] = [];
  items.forEach((it, i) => {
    if (rank.has(it.id)) { slots.push(i); known.push(it); }
  });
  if (known.length < 2) return items;
  known.sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
  const out = [...items];
  slots.forEach((pos, i) => { out[pos] = known[i]; });
  return out;
}
