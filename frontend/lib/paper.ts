/**
 * Gimmick · Obsidian — IL FOGLIO.
 *
 * Sceglie il formato di carta per un'area del canvas. La domanda a cui risponde
 * non è «in quale foglio ci sta» ma «qual è il foglio più piccolo in cui ci sta
 * SENZA RIMPICCIOLIRLA»: il tile è progettato per essere letto a una certa
 * dimensione, e un A4 che contiene tutto al 30% è un foglio pieno di tile
 * illeggibili — cioè un foglio inutile.
 *
 * ─── Il cambio di unità ──────────────────────────────────────────────────────
 * Il canvas ragiona in pixel CSS, la carta in millimetri. Il ponte è il
 * riferimento del CSS: 1in = 96px per definizione, quindi 1px = 25.4/96 mm.
 * È lo STESSO rapporto che il browser usa quando impagina per la stampa, ed è
 * per questo che possiamo dichiarare il foglio in millimetri e il contenuto in
 * pixel senza che i due si disallineino: un tile largo 120px è largo 31.75mm
 * sulla carta, punto.
 *
 * Da qui il significato di «scala 1»: il tile esce dalla stampante grande quanto
 * lo vedi a schermo con lo zoom al 100%. Non è un caso fortunato, è il criterio.
 *
 * ─── La regola ───────────────────────────────────────────────────────────────
 *   1. l'orientamento lo detta la forma dell'area (più larga che alta → orizzontale);
 *   2. il formato è il PRIMO della serie A che contiene l'area a scala 1;
 *   3. se non basta neanche l'A0, si usa l'A0 e si rimpicciolisce — è l'unico
 *      caso in cui la scala scende sotto 1, ed è segnalato (`overflow`).
 *
 * Chi forza un formato più piccolo di quello automatico ottiene la stessa
 * riduzione: la geometria è una sola, cambia solo chi l'ha chiesta.
 */

export type PaperFormat = 'A4' | 'A3' | 'A2' | 'A1' | 'A0';
export type PaperOrientation = 'portrait' | 'landscape';

export interface Rect { x: number; y: number; w: number; h: number }
export interface Size { w: number; h: number }

/** ISO 216, serie A, in millimetri e in VERTICALE (lato corto per primo). */
export const PAPER_MM: Record<PaperFormat, Size> = {
  A4: { w: 210, h: 297 },
  A3: { w: 297, h: 420 },
  A2: { w: 420, h: 594 },
  A1: { w: 594, h: 841 },
  A0: { w: 841, h: 1189 },
};

/** Dal più piccolo al più grande: l'ordine in cui si cerca il primo che basta. */
export const PAPER_ORDER: PaperFormat[] = ['A4', 'A3', 'A2', 'A1', 'A0'];

/** Il riferimento del CSS: 1in = 96px. Tutto il resto discende da qui. */
export const PX_PER_MM = 96 / 25.4;
export const MM_PER_PX = 25.4 / 96;

/**
 * Margine bianco su ogni lato. Non è (solo) estetica: quasi nessuna stampante
 * arriva al bordo, e un tile tagliato a metà dall'area non stampabile è un
 * difetto che si scopre a foglio uscito.
 */
export const PAPER_MARGIN_MM = 10;

/**
 * Sotto questa scala il foglio va segnalato come poco leggibile.
 *
 * Il conto: il titolo del tile è `--ob-tile-title` (13px) dentro una card che il
 * sistema rimpicciolisce con `zoom: var(--ob-tile-zoom)` = 0.8, quindi 10.4px
 * effettivi. A grandezza naturale sulla carta sono 2.75mm ≈ 7.8pt — piccolo ma
 * normale per una didascalia. A 0.6 scendono a 4.7pt, che è sotto il minimo
 * tipografico per un testo che qualcuno deve leggere davvero.
 */
export const PAPER_MIN_READABLE_SCALE = 0.6;

/** Tolleranza sul confronto in millimetri: evita che 297.0000001 scarti l'A3. */
const EPS_MM = 0.01;

/** Il formato nell'orientamento richiesto. */
export function orientedMm(format: PaperFormat, orientation: PaperOrientation): Size {
  const p = PAPER_MM[format];
  return orientation === 'landscape' ? { w: p.h, h: p.w } : { w: p.w, h: p.h };
}

/** L'orientamento che la forma dell'area chiede. Il quadrato va in orizzontale. */
export function autoOrientation(area: Rect): PaperOrientation {
  return area.w >= area.h ? 'landscape' : 'portrait';
}

/**
 * Il formato più piccolo che contiene l'area a grandezza naturale.
 * `overflow` = nemmeno l'A0 ce la fa, quindi ci sarà una riduzione.
 */
export function autoFormat(
  area: Rect,
  orientation: PaperOrientation,
  marginMm: number = PAPER_MARGIN_MM,
): { format: PaperFormat; overflow: boolean } {
  const needW = area.w * MM_PER_PX;
  const needH = area.h * MM_PER_PX;
  for (const format of PAPER_ORDER) {
    const p = orientedMm(format, orientation);
    if (needW <= p.w - 2 * marginMm + EPS_MM && needH <= p.h - 2 * marginMm + EPS_MM) {
      return { format, overflow: false };
    }
  }
  return { format: 'A0', overflow: true };
}

export interface PaperPlan {
  format: PaperFormat;
  orientation: PaperOrientation;
  marginMm: number;
  /** Il foglio intero e l'area dentro i margini, in millimetri. */
  pageMm: Size;
  printableMm: Size;
  /** Le stesse due misure in pixel CSS, per la geometria del contenuto. */
  pagePx: Size;
  printablePx: Size;
  /** Da pixel del canvas a pixel di carta. 1 = grandezza naturale. */
  scale: number;
  /** L'area selezionata dopo la scala: quanto occupa davvero sul foglio. */
  contentPx: Size;
  /** Il formato che l'area chiederebbe da sé: serve alla UI per dire «auto». */
  autoFormat: PaperFormat;
  /** L'area non entra a scala 1 nemmeno nell'A0. */
  overflow: boolean;
  /** Sotto la soglia di leggibilità: i tile usciranno troppo piccoli. */
  cramped: boolean;
  /**
   * Il foglio e la sua area stampabile RIPORTATI NEL MONDO DEL CANVAS, centrati
   * sull'area scelta. Servono all'anteprima: è l'unico modo di far vedere prima
   * della stampa quanta carta avanza intorno a quello che hai cerchiato.
   */
  sheet: Rect;
  printable: Rect;
}

export interface PaperOptions {
  /** Formato imposto dall'utente. Assente = quello automatico. */
  format?: PaperFormat | null;
  /** Orientamento imposto. Assente = quello che chiede la forma dell'area. */
  orientation?: PaperOrientation | null;
  marginMm?: number;
}

/**
 * Traduce un'area del canvas in un foglio. Funzione pura: nessun DOM, così la
 * scelta del formato si può ragionare (e correggere) senza aprire una stampa.
 */
export function planPaper(area: Rect, opts: PaperOptions = {}): PaperPlan {
  const marginMm = opts.marginMm ?? PAPER_MARGIN_MM;
  // Un'area degenere (drag di zero pixel) non deve produrre NaN a valle: la
  // trattiamo come un punto largo un pixel e il resto del calcolo regge.
  const safe: Rect = { x: area.x, y: area.y, w: Math.max(1, area.w), h: Math.max(1, area.h) };

  const orientation = opts.orientation ?? autoOrientation(safe);
  const auto = autoFormat(safe, orientation, marginMm);
  const format = opts.format ?? auto.format;

  const pageMm = orientedMm(format, orientation);
  const printableMm: Size = {
    w: Math.max(1, pageMm.w - 2 * marginMm),
    h: Math.max(1, pageMm.h - 2 * marginMm),
  };
  const pagePx: Size = { w: pageMm.w * PX_PER_MM, h: pageMm.h * PX_PER_MM };
  const printablePx: Size = { w: printableMm.w * PX_PER_MM, h: printableMm.h * PX_PER_MM };

  // Mai INGRANDIRE: un solo tile su un A4 andrebbe a otto volte la sua misura e
  // non sarebbe più il tile che hai disegnato — sarebbe un poster di un tile.
  // Il foglio scelto è già il più piccolo disponibile: quello che avanza è
  // carta bianca, ed è la risposta onesta.
  const scale = Math.min(1, printablePx.w / safe.w, printablePx.h / safe.h);

  const contentPx: Size = { w: safe.w * scale, h: safe.h * scale };

  // Il foglio nel mondo del canvas: la stessa carta, misurata in pixel del
  // canvas invece che in millimetri, centrata su ciò che hai cerchiato.
  const cx = safe.x + safe.w / 2;
  const cy = safe.y + safe.h / 2;
  const sheetW = pagePx.w / scale;
  const sheetH = pagePx.h / scale;
  const printW = printablePx.w / scale;
  const printH = printablePx.h / scale;

  return {
    format,
    orientation,
    marginMm,
    pageMm,
    printableMm,
    pagePx,
    printablePx,
    scale,
    contentPx,
    autoFormat: auto.format,
    overflow: auto.overflow && !opts.format,
    cramped: scale < PAPER_MIN_READABLE_SCALE,
    sheet: { x: cx - sheetW / 2, y: cy - sheetH / 2, w: sheetW, h: sheetH },
    printable: { x: cx - printW / 2, y: cy - printH / 2, w: printW, h: printH },
  };
}

/** Il valore per `@page { size: … }`. In millimetri espliciti: nessun dubbio su
 *  quale variante di «A3» intenda il browser. */
export function pageSizeCss(plan: PaperPlan): string {
  return `${plan.pageMm.w}mm ${plan.pageMm.h}mm`;
}

/** Etichetta breve per la UI: «A3 orizzontale». */
export function paperLabel(plan: PaperPlan): string {
  return `${plan.format} ${plan.orientation === 'landscape' ? 'orizzontale' : 'verticale'}`;
}
