/**
 * Gimmick · Obsidian — Ricette tipografiche condivise.
 *
 * Qui vive SOLO ciò che il codice fa davvero e in modo concorde, dedotto dagli
 * usi reali. Non è il posto dove scrivere una scala aspirazionale: quella era
 * `OBSIDIAN_TYPOGRAPHY`, rimossa perché dichiarava valori che nessun componente
 * usava (vedi la nota in `./obsidian.ts`).
 */
import type { PixelTheme } from '../pixel-theme';

/**
 * Scala tipografica canonica — mirror di `--ob-text-*` / `--ob-weight-*` /
 * `--ob-leading-*` (app/obsidian.css). Stessi valori, in numeri.
 *
 * Perché numeri e non stringhe `var(...)`: negli stili inline di React un numero
 * è più sicuro. `fontSize: 13` diventa `13px` da solo, mentre `'var(--ob-text-control)'`
 * è una stringa opaca che TypeScript non può controllare, che non si può usare in
 * aritmetica (`size * 0.85`) e che fallisce silenziosamente se il token non esiste
 * o non è in scope — per esempio dentro un `foreignObject` SVG o in un portale
 * montato fuori dal contenitore tematizzato. Nei CSS invece si usa `var()`, che lì
 * è la forma naturale ed è ispezionabile dal browser.
 *
 * I nomi dicono il RUOLO, non la misura.
 */

/** Corpi (px). */
export const OB_TEXT = {
  /** Etichetta di sezione, mono e maiuscola. */
  eyebrow: 8,
  /** Micro-etichette e contatori. */
  micro: 9,
  /** Dati di servizio: date, dimensioni, sottotitoli, conteggi. */
  meta: 11,
  /** Testo dentro una tile. */
  card: 12,
  /** Controlli: bottoni, campi, righe di tabella, sidebar. */
  control: 13,
  /** Titolo di vista, di modale, di riga impostazioni. */
  title: 16,
} as const;

/** Pesi. Tre, nessun altro: il 300 e il 500 sono stati riassorbiti. */
export const OB_WEIGHT = {
  body: 400,
  emphasis: 600,
  /** Il 700 delle etichette monospaziate. */
  mono: 700,
} as const;

/**
 * Interlinee. `none` non è un'interlinea ma una neutralizzazione: serve a badge,
 * chip ed etichette a riga singola che devono combaciare col contenitore.
 */
export const OB_LEADING = {
  text: 1.5,
  tight: 1.3,
  none: 1,
} as const;

export type ObTextKey = keyof typeof OB_TEXT;
export type ObWeightKey = keyof typeof OB_WEIGHT;
export type ObLeadingKey = keyof typeof OB_LEADING;

/** I valori ammessi, utili per tipizzare una prop che accetta solo la scala. */
export type ObTextSize = (typeof OB_TEXT)[ObTextKey];
export type ObWeight = (typeof OB_WEIGHT)[ObWeightKey];
export type ObLeading = (typeof OB_LEADING)[ObLeadingKey];

/**
 * Eyebrow di sezione — l'etichettina maiuscola sopra un campo (TITOLO, AZIONE,
 * TAG, DATA E ORARIO…). Mono, corpo minuscolo, grassetto, spaziata e tenue:
 * deve leggersi come targhetta e sparire finché non la cerchi.
 *
 * Non è una convenzione inventata qui: era già scritta identica, in modo
 * indipendente, in TileSidebar, GroupSidebar, EdgeSidebar e TextSidebar — ed è
 * il canone tipografico più solido dell'app (`0.08em` compare 45 volte, senza
 * rivali). L'unica dissenziente era MultiTileSidebar (9px, peso assente).
 *
 * Restituisce SOLO le sei proprietà tipografiche. Il layout (display,
 * line-height di blocco, margini) lo aggiunge chi chiama, perché varia:
 * TileSidebar la usa come blocco con margine, GroupSidebar dentro una riga
 * flex. Fondere le due cose obbligherebbe una delle due a disfare l'altra.
 *
 * ⚠️ Le etichette maiuscole dichiarate nei CSS di view sono un'altra famiglia,
 * consolidata su `0.13em`, e restano separate da questa: `0.08em` qui è il
 * canone degli eyebrow inline. Vanno unificate solo se si decide quale dei due
 * tracking vince — per questo il letter-spacing resta l'unico valore letterale
 * rimasto in questa ricetta.
 */
export function obLabel(theme: PixelTheme): React.CSSProperties {
  return {
    fontFamily: 'var(--ob-font-mono)',
    fontSize: OB_TEXT.eyebrow,
    fontWeight: OB_WEIGHT.mono,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: theme.ink3,
  };
}
