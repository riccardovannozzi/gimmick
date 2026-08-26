'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';
// Serve a rendere la card React dentro il `<foreignObject>`. Import statico e
// non `require()` dentro l'effect: il bundle è lo stesso, la regola no.
import { renderToString } from 'react-dom/server';
import * as d3 from 'd3';
import type { Tile, SparkType } from '@/types';
import { useActionColors } from '@/store/action-colors-store';
import { useStatuses } from '@/store/statuses-store';
import { useTypeIcons } from '@/store/type-icons-store';
import { readableOn } from '@/lib/palette';
import { usePixelTheme } from '@/components/pixel';
// `Tile` è già il tipo di dominio importato qui sopra: la card si chiama
// `TileCard` per non coprirlo.
import { Tile as TileCard } from '@/components/tiles/Tile';
import { tileVisualKey, subtaskToStep, TILE_VISUAL, TILE_LOD_MIN_SCALE, TILE_W, TILE_H, type StepState, type TileStatus } from '@/lib/tile-visual';
import type { ActionType } from '@/types';
import { IconChevronsDown, IconFlag, IconCircle, IconUser } from '@tabler/icons-react';
import { TextEditor, BOX_FONT_SIZE } from './TextEditor';
import { OB_TEXT, OB_WEIGHT } from '@/lib/theme/ob-typography';

/** Vista (pan + zoom) persistita per canvas: `canvas_view_<tagId>`. */
const VIEW_LS_PREFIX = 'canvas_view_';
function loadView(key: string | undefined): d3.ZoomTransform | null {
  if (!key) return null;
  try {
    const raw = localStorage.getItem(VIEW_LS_PREFIX + key);
    if (!raw) return null;
    const v = JSON.parse(raw) as { k?: unknown; x?: unknown; y?: unknown };
    const { k, x, y } = v;
    if (typeof k !== 'number' || typeof x !== 'number' || typeof y !== 'number') return null;
    if (!Number.isFinite(k) || !Number.isFinite(x) || !Number.isFinite(y) || k <= 0) return null;
    return d3.zoomIdentity.translate(x, y).scale(k);
  } catch {
    return null;
  }
}
function saveView(key: string | undefined, t: d3.ZoomTransform) {
  if (!key) return;
  try {
    localStorage.setItem(VIEW_LS_PREFIX + key, JSON.stringify({ k: t.k, x: t.x, y: t.y }));
  } catch { /* quota/privacy mode: la vista semplicemente non si ricorda */ }
}

/**
 * ⚠️ `TILE_W`/`TILE_H` arrivano da lib/tile-visual (128×72) e NON sono
 * dichiarati qui. È l'ingombro che il tile occupa davvero: il
 * rettangolo di presa, l'anello di selezione e gli agganci degli edge devono
 * combaciare col disegno, e il disegno è scalato da `--ob-tile-zoom`.
 * Le posizioni salvate non cambiano: i tile restano dove sono, più piccoli.
 */
/**
 * Gronda del riquadro che ospita la card.
 *
 * Il badge d'angolo sborda di 8px sopra il bordo superiore, per costruzione. Un
 * `<foreignObject>` RITAGLIA il proprio contenuto al proprio rettangolo, quindi
 * se lo dimensionassimo 128×72 il badge verrebbe tagliato a metà. Il riquadro è
 * perciò più grande su tutti i lati e la card viene rimessa in posizione con un
 * margine interno di pari valore: il tile resta 128×72 e allineato alla griglia,
 * cambia solo la finestra in cui è disegnato.
 */
/**
 * GRIGLIA DI RIFERIMENTO — passo nel mondo del canvas e passo minimo sullo
 * schermo.
 *
 * 22px è lo stesso passo di `.ob-dotgrid` (obsidian-primitives.css), la utility
 * che vestono già la board del Kanban e la lavagna della vista canvas: a scala 1
 * la griglia del canvas D3 è identica alle altre, non un secondo reticolo simile.
 *
 * Il passo però è nel MONDO, non sullo schermo: i puntini restano ancorati ai
 * tile mentre si trascina e si zooma, altrimenti sarebbero una carta da parati
 * dietro un vetro e non un riferimento. Rimpicciolendo, però, un passo fisso si
 * infittisce fino a diventare rumore — sotto 0.3 di zoom cadrebbero a 6.6px
 * l'uno dall'altro. Quindi il passo RADDOPPIA finché sullo schermo non torna
 * almeno `DOT_MIN_SCREEN`: la griglia si dirada invece di impastarsi, e i
 * puntini che restano sono un sottoinsieme di quelli di prima — cioè cadono
 * ancora sugli stessi punti del mondo.
 *
 * ⚠️ ESPORTATO perché il riordino (`lib/canvas-tidy.ts`, comando «Ordina» della
 * topbar) posa gli oggetti su QUESTA griglia e non su una sua. Una seconda
 * costante da 22 scritta altrove sarebbe rimasta indietro al primo ritocco, e
 * gli oggetti si sarebbero allineati a puntini che non si vedono.
 */
export const DOT_STEP = 22;
const DOT_MIN_SCREEN = 14;

const TILE_BLEED = 12;
const TILE_GAP = 8;
const OFFSET_X = 24;
const OFFSET_Y = 24;
const PORT_R = 5;
/**
 * Gronda del riquadro di un gruppo attorno ai suoi membri, e altezza della
 * fascia con l'etichetta sopra il bordo.
 *
 * ⚠️ ESPORTATE perché il riordino (`lib/canvas-tidy.ts`) deve sapere quanto
 * spazio si prende un gruppo OLTRE i suoi tile: senza, due gruppi vicini
 * finivano con le scatole a due pixel e l'etichetta di uno cadeva sulla riga
 * dell'altro.
 */
export const GROUP_PAD = 12;
export const LABEL_H = 20;

/** I box (testo/immagine) viaggiano con un id PREFISSATO ovunque convivano con
 *  i tile: endpoint degli edge, multi-selezione e — da ora — membri dei gruppi.
 *  Un id nudo è sempre un tile. */
const BOX_ID_PREFIX = 'tb:';
const isBoxId = (id: string) => id.startsWith(BOX_ID_PREFIX);
const boxIdOf = (id: string) => id.slice(BOX_ID_PREFIX.length);

/**
 * Quali box possono stare dentro un gruppo: TESTO, IMMAGINE e SOGGETTO,
 * esattamente come un tile — stessa cattura col contorno, stesso drop
 * trascinandoli dentro, stesso «sfila» per uscirne.
 *
 * Il soggetto è entrato quando `boxExtent` ha imparato a misurare la scritta
 * che gli esce dal riquadro: prima restava fuori perché il gruppo si
 * auto-dimensiona sui rettangoli dei membri, e un rettangolo che non teneva
 * conto della denominazione avrebbe tagliato il nome della persona proprio nel
 * momento in cui la si mette in un gruppo per dire di chi è quella zona.
 *
 * Fuori restano i MARCATORI, e ormai per una ragione sola: nessuno l'ha
 * chiesto. La geometria non è più un ostacolo — `boxExtent` misura anche la
 * loro didascalia — quindi aggiungerli è una parola qui.
 *
 * Esportato perché la stessa domanda se la fanno la lavagna (contorno e drop) e
 * la pagina (voce «Crea gruppo» sulla selezione): con due liste separate una
 * delle due sarebbe rimasta indietro al primo tipo di box aggiunto.
 */
export const isGroupableBox = (tb: { type: string }) =>
  tb.type === 'text' || tb.type === 'image' || tb.type === 'subject';

export interface CanvasNode { id: string; title: string; actionType: string; statusShape?: string; statusName?: string; isCompleted?: boolean; typeIcon?: string; typeColor?: string; startAt?: string; endAt?: string; allDay?: boolean; subtasks?: Tile['subtasks']; /** Tipi degli spark allegati → pallini nel footer della card. */ sparks?: SparkType[]; /** In FOCUS: cornice rossa tratteggiata intorno alla card (migration 045). */ isFocused?: boolean; x: number; y: number; }
export type PortKey = 'top' | 'right' | 'bottom' | 'left';
// port format: "top"|"right"|"bottom"|"left" for tile, "g:top"|"g:right"|"g:bottom"|"g:left" for group
export interface CanvasEdge {
  id: string;
  source_id: string;
  target_id: string;
  source_port?: string;
  target_port?: string;
  /** Stile opzionale dell'edge (editabile dalla EdgeSidebar). */
  color?: string | null;
  lineStyle?: 'solid' | 'dashed' | 'dotted' | null;
  lineWidth?: number | null;
  /** Testo mostrato al centro dell'edge. */
  label?: string | null;
  /**
   * Verso della freccia. A è `source_id`, B è `target_id` — cioè l'ordine in
   * cui il collegamento è stato tirato. Assente/null = nessuna freccia, che è
   * l'aspetto storico e resta il default.
   */
  arrow?: EdgeArrow | null;
  /** Misura della punta, 1..4. Assente = `ARROW_SIZE_DEFAULT`. */
  arrowSize?: number | null;
  /** Come si dispone l'etichetta rispetto alla linea. Assente = 'center'. */
  labelAlign?: EdgeLabelAlign | null;
}

/** A→B, B→A, A↔B. L'assenza (null) è il quarto stato e non sta qui. */
export type EdgeArrow = 'forward' | 'backward' | 'both';

/**
 * Lunghezza della punta per ciascuno dei quattro scatti, in px di lavagna.
 *
 * Non è una scala lineare: a punte piccole un pixel si vede, a punte grandi no,
 * quindi i passi si allargano man mano. Il primo scatto è il 7 che la punta
 * aveva prima di questo controllo, così "piccola" resta l'aspetto di partenza.
 */
export const ARROW_HEAD = [7, 11, 15, 20] as const;
/** Lo scatto usato quando l'edge non ne ha uno suo. */
export const ARROW_SIZE_DEFAULT = 2;

/**
 * Disposizione dell'etichetta di un collegamento.
 *
 *   center      ruotata lungo l'edge, centrata sulla linea — la pillola la
 *               interrompe, ed è il modo in cui l'etichetta si legge come
 *               PARTE del collegamento invece che come un cartellino appoggiato
 *   above       ruotata lungo l'edge ma spostata di lato: la linea resta intera
 *   horizontal  sempre dritta, qualunque sia l'inclinazione dell'edge
 */
export type EdgeLabelAlign = 'center' | 'above' | 'horizontal';
export const EDGE_LABEL_ALIGN_DEFAULT: EdgeLabelAlign = 'center';

/** Interlinea dell'etichetta quando va a capo. */
const LABEL_LINE_H = Math.round(OB_TEXT.meta * 1.3);
/**
 * Sotto questa soglia mandare a capo non aiuta più: su un collegamento cortissimo
 * l'etichetta diventerebbe una colonna di due lettere per riga, che è meno
 * leggibile del testo che sborda. A quel punto sbordare è il male minore.
 */
const LABEL_MIN_CHARS = 8;
/** Respiro orizzontale della pillola, 5 per lato più un paio di margine. */
const LABEL_PAD = 12;

/**
 * Manda a capo l'etichetta di un collegamento in righe da al massimo `max`
 * caratteri, spezzando fra le PAROLE.
 *
 * Contare i caratteri e non i pixel è esatto, non approssimato: l'etichetta è
 * scritta in monospaziato (`labelFont`), quindi ogni carattere occupa la stessa
 * larghezza e una misura sola del testo intero le dà tutte.
 *
 * Una parola più lunga della riga viene spezzata a forza: lasciarla intera
 * significherebbe che una singola parola lunga vanifica tutto l'a capo.
 */
function wrapLabel(text: string, max: number): string[] {
  const words = text.split(/s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (w.length > max) {
      if (cur) { lines.push(cur); cur = ''; }
      for (let i = 0; i < w.length; i += max) lines.push(w.slice(i, i + max));
      cur = lines.pop() ?? '';
      continue;
    }
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= max) cur = next;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [text];
}

/**
 * Stacco fra l'aggancio e il VERTICE della punta.
 *
 * Con la punta appoggiata sull'aggancio finiva sopra il pallino (r 3) e sul
 * bordo del nodo, e i tre segni si leggevano come una macchia sola.
 *
 * Il conto: 3 di raggio del pallino + 6 di ARIA PULITA = 9. È l'aria che si
 * misura, non lo stacco — cambiando il raggio del pallino va rifatto questo
 * numero, o i sei pixel diventano altro. La freccia PUNTA al nodo invece di
 * toccarlo, che è anche il modo in cui si capisce dove finisce.
 *
 * ⚠️ Accorcia anche la linea VISIBILE, non solo la punta: la linea arriva
 * all'aggancio, e senza il taglio sbucherebbe oltre il vertice come uno spillo.
 * L'alone di selezione e la corsia invisibile del click restano interi — quelli
 * sono superficie di interazione, non disegno.
 */
const ARROW_GAP = 9;

/**
 * INNESTO — quanto un oggetto deve stare fermo sopra un edge prima che l'edge
 * si offra di spezzarsi.
 *
 * L'attesa è la sostanza del gesto, non un ritardo tecnico: attraversare un
 * collegamento mentre si trascina qualcosa dall'altra parte della lavagna è
 * normalissimo, e senza una soglia di tempo ogni passaggio spezzerebbe quello
 * che tocca. Mezzo secondo distingue il passare dal fermarsi lì.
 */
const SPLIT_DWELL = 500;

/**
 * Disegna un marcatore — disco pieno e glifo al centro — dentro un gruppo SVG.
 *
 * Sta fuori dal ciclo di disegno perché lo usano in DUE: il marcatore posato e
 * il suo ghost, che deve essere lo stesso oggetto e non una sua imitazione —
 * altrimenti quello che si vede sotto il cursore non è quello che si posa.
 *
 * Prende il nodo DOM e non la selezione: i due punti di chiamata hanno selezioni
 * con dati diversi, e farle combaciare nei generici di D3 sarebbe stato un
 * costo di tipi senza alcun ritorno.
 */
function paintMarker(node: SVGGElement, kind: MarkerKind, w: number, h: number) {
  const spec = MARKER_SPEC[kind];
  const g = d3.select(node);
  if (!spec.Glyph) {
    paintMarkerX(g, spec.color, w, h);
    return;
  }
  g.append('circle')
    .attr('cx', w / 2).attr('cy', h / 2).attr('r', Math.min(w, h) / 2)
    .style('fill', spec.color)
    .style('stroke', 'none');
  // Il glifo è un'icona vera, quindi passa da `foreignObject` +
  // `renderToString` — la stessa tecnica con cui la board monta la card del
  // tile. Disegnarne il tracciato a mano avrebbe voluto dire tenere quattro
  // copie di path allineate alla libreria.
  const GS = Math.round(Math.min(w, h) * 0.5);
  const fo = g.append('foreignObject')
    .attr('x', (w - GS) / 2).attr('y', (h - GS) / 2)
    .attr('width', GS).attr('height', GS)
    .style('pointer-events', 'none')
    .style('overflow', 'visible');
  const host = document.createElement('div');
  // `color` e non `fill`: le icone Tabler tracciano con `currentColor`,
  // quindi basta dare il colore al contenitore.
  host.style.cssText = `width:${GS}px;height:${GS}px;display:flex;align-items:center;justify-content:center;color:var(--ob-marker-ink);`;
  try {
    host.innerHTML = renderToString(React.createElement(spec.Glyph, { size: GS, stroke: 2 }));
  } catch {
    // Un glifo che non si renderizza non deve togliere il marcatore: il disco
    // resta, e con lui posizione, aggancio e menu contestuale.
  }
  (fo.node() as SVGForeignObjectElement)?.appendChild(host);
}

/**
 * Spessore del tratto della X, in frazione del lato: a `MARKER_SIZE` (36) fa 4.
 *
 * È il numero che decide se il marcatore nudo si vede. Un disco pieno mette in
 * campo tutta la sua area di colore; una X ne mette in campo si e no un sesto,
 * quindi il tratto deve reggere da solo. Il 4 è il doppio del filo da 2 con cui
 * i marcatori erano nati ad anello — quello sparve su una lavagna piena, e
 * questa è la stessa trappola vista da un'altra angolazione.
 * ⚠️ Frazione e non pixel: il badge nei pannelli disegna la stessa X a 16, 18 e
 * 22px, e deve avere lo stesso PESO, non lo stesso spessore.
 */
const MARKER_X_STROKE = 0.12;

/**
 * La X del marcatore nudo: due linee da angolo a angolo del riquadro.
 *
 * Tracciata a mano e non presa da Tabler per una ragione di misura: un'icona
 * porta il suo margine interno, e a piena misura la X ne riempirebbe due terzi
 * — accanto ai dischi degli altri tre sembrerebbe un marcatore più piccolo,
 * mentre è lo stesso oggetto con un'altra faccia.
 */
function paintMarkerX(g: d3.Selection<SVGGElement, unknown, null, undefined>, color: string, w: number, h: number) {
  const sw = Math.max(2, Math.round(Math.min(w, h) * MARKER_X_STROKE));
  // I cappucci tondi sporgono di mezzo tratto oltre l'estremo: partendo da
  // `sw / 2` la X resta esattamente dentro il riquadro, che è quello su cui
  // ragionano porte degli edge, contorni dei gruppi e selezione.
  const p = sw / 2;
  const x = g.append('g')
    // `.style()` e non `.attr()`: il colore è una custom property, e un
    // attributo di presentazione SVG non risolve `var()`.
    .style('stroke', color)
    .style('stroke-width', sw)
    .style('stroke-linecap', 'round');
  x.append('line').attr('x1', p).attr('y1', p).attr('x2', w - p).attr('y2', h - p);
  x.append('line').attr('x1', w - p).attr('y1', p).attr('x2', p).attr('y2', h - p);
}

/**
 * L'anteprima di un marcatore nei pannelli: lo stesso segno che finisce sulla
 * lavagna, in piccolo.
 *
 * Vive qui, accanto a `MARKER_SPEC` e a `paintMarkerX`, e non nel pannello che
 * per primo ne ha avuto bisogno: la topbar e la sidebar del marcatore ne
 * tenevano una copia a testa, e al primo marcatore che smette di essere un
 * disco col glifo dentro — è appena successo allo stop — due copie su tre
 * sarebbero rimaste indietro.
 */
export function MarkerBadge({ kind, size = 22 }: { kind: MarkerKind; size?: number }) {
  const { color, Glyph } = MARKER_SPEC[kind];
  if (!Glyph) {
    const sw = Math.max(1.5, size * MARKER_X_STROKE);
    const p = sw / 2;
    return (
      <svg
        width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden
        style={{ flexShrink: 0, display: 'block', stroke: color, strokeWidth: sw, strokeLinecap: 'round' }}
      >
        <line x1={p} y1={p} x2={size - p} y2={size - p} />
        <line x1={size - p} y1={p} x2={p} y2={size - p} />
      </svg>
    );
  }
  return (
    <span
      style={{
        width: size, height: size, borderRadius: '50%',
        background: color, color: 'var(--ob-marker-ink)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Glyph size={Math.round(size * 0.55)} stroke={2} />
    </span>
  );
}

/**
 * La DIDASCALIA sotto un oggetto piccolo — il marcatore e il soggetto.
 *
 * Sta in un `foreignObject` e non in un `<text>` perché deve andare a capo da
 * sola su piu' righe e fermarsi alla terza: l'SVG non manda a capo, e farlo a
 * mano avrebbe voluto dire misurare le parole una per una con una font-metric
 * scritta a occhio (è la stessa ragione per cui il titolo dell'immagine, che
 * sta su UNA riga, se la cava invece con un `<text>` troncato a caratteri).
 *
 * `pointer-events:none` su tutto: la didascalia è una scritta appoggiata alla
 * lavagna, non una parte cliccabile dell'oggetto. Senza, il testo avrebbe
 * rubato il click di selezione e il trascinamento a un oggetto largo 36px.
 *
 * NON viene chiamata dal ghost: l'anteprima mostra dove finisce il disco, e un
 * oggetto appena posato la didascalia non ce l'ha ancora.
 */
function paintBoxLabel(node: SVGGElement, text: string, w: number, h: number, ink: string) {
  const fo = d3.select(node).append('foreignObject')
    .attr('x', (w - BOX_LABEL_W) / 2)
    .attr('y', h + BOX_LABEL_GAP)
    .attr('width', BOX_LABEL_W)
    .attr('height', BOX_LABEL_LH * BOX_LABEL_LINES)
    .style('pointer-events', 'none')
    .style('overflow', 'visible');
  const host = document.createElement('div');
  // `textContent` e non `innerHTML`: è testo digitato dall'utente, e qui finisce
  // dentro il DOM della lavagna.
  host.textContent = text;
  // `-webkit-line-clamp` è la sola cosa che tronca CON i puntini a fine terza
  // riga; `pre-wrap` fa contare anche gli a-capo battuti a mano, che è quello
  // che ci si aspetta da un campo multiriga.
  host.style.cssText = [
    'width:100%',
    `font-family:var(--ob-font-sans)`,
    `font-size:${BOX_LABEL_FS}px`,
    `line-height:${BOX_LABEL_LH}px`,
    `font-weight:${OB_WEIGHT.emphasis}`,
    `color:${ink}`,
    'text-align:center',
    'white-space:pre-wrap',
    'overflow-wrap:anywhere',
    'display:-webkit-box',
    '-webkit-box-orient:vertical',
    `-webkit-line-clamp:${BOX_LABEL_LINES}`,
    `line-clamp:${BOX_LABEL_LINES}`,
    'overflow:hidden',
  ].join(';');
  (fo.node() as SVGForeignObjectElement)?.appendChild(host);
}

/**
 * Il SOGGETTO disegnato: un disco di superficie con la hairline dei tile e la
 * figura di una persona dentro.
 *
 * Deliberatamente DIVERSO dal marcatore, che è un disco pieno di colore. I
 * marcatori sono quattro simboli di un vocabolario chiuso e il colore è la loro
 * forma; un soggetto è uno solo, se ne posano molti e non c'è nessuna scala di
 * colori da leggerci dentro. Tingerli avrebbe fatto credere a cinque marcatori.
 *
 * Stesso mestiere di `paintMarker` (foreignObject + `renderToString`): il glifo
 * è un'icona vera, e ridisegnarne il tracciato a mano avrebbe voluto dire
 * tenerne una copia allineata alla libreria.
 */
function paintSubject(node: SVGGElement, w: number, h: number) {
  const g = d3.select(node);
  g.append('circle')
    .attr('cx', w / 2).attr('cy', h / 2).attr('r', Math.min(w, h) / 2 - 0.75)
    .style('fill', 'var(--ob-surface-2)')
    .style('stroke', 'var(--ob-line-2)')
    .style('stroke-width', 1.5);
  const GS = Math.round(Math.min(w, h) * 0.52);
  const fo = g.append('foreignObject')
    .attr('x', (w - GS) / 2).attr('y', (h - GS) / 2)
    .attr('width', GS).attr('height', GS)
    .style('pointer-events', 'none')
    .style('overflow', 'visible');
  const host = document.createElement('div');
  host.style.cssText = `width:${GS}px;height:${GS}px;display:flex;align-items:center;justify-content:center;color:var(--ob-muted);`;
  try {
    host.innerHTML = renderToString(React.createElement(IconUser, { size: GS, stroke: 1.8 }));
  } catch {
    // Un glifo che non si renderizza non deve togliere il soggetto: il disco
    // resta, e con lui posizione, aggancio e menu contestuale.
  }
  (fo.node() as SVGForeignObjectElement)?.appendChild(host);
}

/**
 * Quante righe occuperà una didascalia. È una STIMA, e non può essere altro: le
 * righe vere le decide il browser mandando a capo il testo dentro un
 * `foreignObject`, e chi misura qui — il riquadro del gruppo — deve saperlo
 * PRIMA che il disegno esista.
 *
 * La metrica è la stessa del titolo dell'immagine (`CAPTION_FS * 0.55` per
 * carattere): approssimativa, ma sbaglia per eccesso su un testo fitto, che è
 * il verso giusto — meglio un gruppo un filo più alto del necessario che uno
 * che taglia l'ultima riga di un nome.
 */
const boxLabelLines = (text: string) => {
  // I caratteri per riga si contano DENTRO la funzione e non a modulo: le
  // costanti della didascalia sono dichiarate più in basso, e leggerle qui in
  // fase di valutazione le troverebbe ancora nella loro zona morta.
  const perLine = Math.max(4, Math.floor(BOX_LABEL_W / (BOX_LABEL_FS * 0.55)));
  const rows = text.split('\n').reduce((n, line) => n + Math.max(1, Math.ceil(line.length / perLine)), 0);
  return Math.min(BOX_LABEL_LINES, Math.max(1, rows));
};

/**
 * L'INGOMBRO VERO di un box: il suo riquadro più la scritta che ne esce.
 *
 * Serve a una cosa sola, ma delicata: il riquadro di un gruppo si auto-dimensiona
 * sui rettangoli dei suoi membri, e `x/y/w/h` — che è quello che sta sulla riga —
 * descrive solo la scatola disegnata. Le scritte stanno FUORI da quella scatola:
 * il titolo di un'immagine sopra il bordo, la didascalia di marcatori e soggetti
 * sotto, e larga quanto un TILE, cioè molto più del disco da 36–44 px a cui
 * appartiene. Misurare la sola scatola voleva dire tagliare proprio il nome della
 * persona che si è appena messa nel gruppo per dire di chi è quella zona.
 */
const boxExtent = (tb: CanvasBox) => {
  if (tb.type === 'image') {
    // Il titolo dell'immagine sta SOPRA il bordo, su una riga sola e troncato a
    // caratteri dal disegno: l'ingombro comincia più in alto, non più in basso.
    const cap = tb.content.showTitle && (tb.content.title || '').trim() ? CAPTION_H : 0;
    return { x: tb.x, y: tb.y - cap, w: tb.w, h: tb.h + cap };
  }
  const caption = tb.type === 'subject'
    ? (tb.content.name || '')
    : tb.type === 'marker' ? (tb.content.label || '') : '';
  const text = caption.trim();
  if (!text) return { x: tb.x, y: tb.y, w: tb.w, h: tb.h };
  // La didascalia è CENTRATA sul box e larga quanto un tile: su un disco da 44
  // sborda di una quarantina di pixel per lato.
  const w = Math.max(tb.w, BOX_LABEL_W);
  return {
    x: tb.x + (tb.w - w) / 2,
    y: tb.y,
    w,
    h: tb.h + BOX_LABEL_GAP + boxLabelLines(text) * BOX_LABEL_LH,
  };
};

/** Opacità del ghost: si deve vedere COSA si sta posando e ANCHE cosa c'è
 *  sotto — se copre l'edge che si sta per innestare, non serve a niente. */
const GHOST_OPACITY = 0.55;

/** Distanza di un punto da un SEGMENTO (non dalla retta che lo contiene). */
function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  // Il parametro proiettato, tenuto dentro il segmento: fuori dai capi la
  // distanza è quella dal capo. Sulla retta infinita, il prolungamento
  // immaginario di un edge corto avrebbe armato l'innesto a mezza lavagna.
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/**
 * Colore di un collegamento che non ne ha uno scelto.
 *
 * È `grayLight1` della GIMMICK_PALETTE, quindi non è un grigio inventato qui:
 * è una delle quaranta caselle che il picker offre, e sceglierlo a mano dà
 * esattamente questo. Il default era `theme.border` — la hairline dei
 * contorni — che cambia col tema ed è tarata per DELIMITARE una superficie,
 * non per tracciare un segno che deve leggersi da solo sulla lavagna.
 *
 * ⚠️ Fisso nei due temi, come il rosso dell'azione distruttiva: un
 * collegamento senza colore è un segno neutro, non un elemento di chrome che
 * segue il fondo.
 */
const EDGE_COLOR_DEFAULT = '#CCCCCC';
export type GroupBorderStyle = 'solid' | 'dashed' | 'dotted';
export interface GroupBounds { x: number; y: number; w: number; h: number }
export interface CanvasGroup {
  id: string;
  label: string;
  /** Membri del gruppo: id nudo = tile, `tb:<id>` = box immagine. Le immagini
   *  entrano nei gruppi esattamente come i tile (contorno, drag dentro, il
   *  gruppo che le trascina con sé); i box di TESTO restano fuori. */
  nodeIds: string[];
  /** Stile opzionale: sfondo, colore/spessore/tipologia del bordo. */
  bgColor?: string | null;
  borderColor?: string | null;
  borderWidth?: number | null;
  borderStyle?: GroupBorderStyle | null;
  /** Dimensione manuale (resize via maniglie). Il box del gruppo è l'UNIONE di
   *  questo rettangolo e del bounding box dei tile → il gruppo li contiene
   *  sempre. NULL/assente → auto-fit sui soli tile. Coord. contenuto (come il
   *  ritorno di getGroupBounds, senza la fascia LABEL_H). */
  bounds?: GroupBounds | null;
}
// Polymorphic canvas box: shared geometry (x/y/w/h) + per-type content payload.
//   type 'text'  → content = { html: string; bgColor?: string; fontSize?: number }
//   type 'image' → content = { src: string; alt?: string; title?, notes?, showTitle? }
export type CanvasBoxTextContent = { html: string; bgColor?: string | null; fontSize?: number };
/** `title` e `notes` (HTML dell'editor) sono i campi editabili dalla
 *  ImageSidebar. `showTitle` decide se il titolo compare come didascalia sul
 *  canvas: il titolo esiste comunque, il flag riguarda solo il vederlo. */
export type CanvasBoxImageContent = {
  src: string;
  alt?: string;
  title?: string;
  notes?: string;
  showTitle?: boolean;
};
/**
 * MARCATORI — i punti notevoli di un percorso disegnato sulla lavagna.
 *
 * Sono box a tutti gli effetti, non un'entità nuova: così si trascinano, si
 * eliminano, si copiano, entrano nei gruppi e fanno da capo a un edge senza
 * che una riga di quel codice sappia della loro esistenza. Quello che cambia è
 * solo il disegno — un disco invece di un rettangolo.
 */
export type MarkerKind = 'start' | 'stop' | 'goal' | 'milestone';

/**
 * BANDIERA A SCACCHI — il glifo dell'ARRIVO.
 *
 * Disegnata qui perché Tabler non ce l'ha: della bandiera ha trenta varianti
 * (con la spunta, con la stella, col fulmine, col bitcoin) e nessuna a scacchi.
 * È l'unico simbolo del file che non viene dalla libreria.
 *
 * È PIENA e non tracciata come le altre icone, e non è una svista: una
 * scacchiera è fatta di AREE, non di linee — a contorno resterebbe una griglia,
 * cioè il disegno di una finestra. Le caselle "vuote" non sono bianche ma
 * TRASPARENTI, e lasciano vedere il disco verde sotto: è così che il secondo
 * colore della scacchiera arriva gratis, senza che il glifo debba sapere su che
 * cosa è posato — vale identico dentro il disco della lavagna e dentro quello
 * dei pannelli.
 *
 * Il contorno del telo però serve: con tre sole caselle piene su sei, senza un
 * perimetro si leggerebbero tre quadrati sparsi invece di un telo diviso a
 * scacchi. Sei caselle e non le dodici di una bandiera vera perché il glifo
 * rende 18px sulla lavagna: a quella misura una scacchiera fitta diventa
 * grigio.
 *
 * Le proporzioni sono quelle di `IconFlag` — asta a sinistra che scende sotto
 * il telo — perché start e goal sono due bandiere e devono sembrare parenti.
 * Il disegno riempie il riquadro molto più di un'icona Tabler (che si tiene i
 * suoi margini): a questa misura ogni decimo di scala è mezza casella.
 * `stroke` è accettato e ignorato — il peso di questo segno sta nelle aree.
 */
function IconCheckeredFlag({ size = 24 }: { size?: number; stroke?: number }) {
  /** Telo 18×12 diviso in 3×2 caselle da 6: piene quelle a parità pari,
   *  partendo dall'angolo attaccato all'asta. */
  const cells = [[0, 0], [2, 0], [1, 1]];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="1.6" y="2" width="2.4" height="20" rx="1.2" />
      <rect x="4" y="2.4" width="18" height="12" fill="none" stroke="currentColor" strokeWidth="1.4" />
      {cells.map(([c, r]) => (
        <rect key={`${c}-${r}`} x={4 + c * 6} y={2.4 + r * 6} width="6" height="6" />
      ))}
    </svg>
  );
}

/**
 * I quattro marcatori: colore e glifo di ciascuno.
 *
 * Il colore arriva dai token `--ob-marker-*`, non da valori scritti qui: tre dei
 * quattro sono alias di token semantici già esistenti (errore, successo,
 * inchiostro) e seguono il tema da soli. Per questo il colore si posa con
 * `.style()` e non con `.attr()` — un attributo di presentazione SVG non
 * risolve le custom properties.
 */
export const MARKER_SPEC: Record<MarkerKind, {
  color: string;
  label: string;
  /**
   * Il glifo dentro il disco: un'icona Tabler o un disegno nostro, purché si
   * monti allo stesso modo — chi disegna non deve sapere quale dei due sta
   * montando (vedi `IconCheckeredFlag`).
   *
   * `null` = marcatore NUDO: niente disco e niente glifo, il segno stesso è il
   * marcatore, tracciato a mano a piena misura nel colore. Oggi solo lo stop,
   * che è una X. Il `null` non è un buco: è il discriminante, e TypeScript
   * obbliga a gestirlo tutte e due le volte che si disegna un marcatore
   * (`paintMarker` sulla lavagna, `MarkerBadge` nei pannelli).
   */
  Glyph: React.ComponentType<{ size?: number; stroke?: number }> | null;
}> = {
  start: { color: 'var(--ob-marker-start)', label: 'Start', Glyph: IconFlag },
  stop: { color: 'var(--ob-marker-stop)', label: 'Stop', Glyph: null },
  goal: { color: 'var(--ob-marker-goal)', label: 'Goal', Glyph: IconCheckeredFlag },
  milestone: { color: 'var(--ob-marker-milestone)', label: 'Milestone', Glyph: IconCircle },
};
/** L'ordine in cui compaiono nel menu dello strumento. */
export const MARKER_KINDS: MarkerKind[] = ['start', 'stop', 'goal', 'milestone'];
/**
 * I nomi VECCHI di un marcatore, e in cosa vanno letti oggi.
 *
 * Le righe già posate portano il nome che avevano quando sono state salvate: il
 * codice cambia con un deploy, il database no. La migrazione 044 li riscrive,
 * ma questa tabella resta comunque la rete di sicurezza — senza, un marcatore
 * salvato prima del rename ricadrebbe sul tipo di ripiego e cambierebbe faccia
 * da solo, che è il modo peggiore di accorgersi che una migrazione non è girata.
 */
const MARKER_LEGACY: Record<string, MarkerKind> = { end: 'stop', node: 'milestone' };
/**
 * Il `kind` scritto sulla riga → il tipo con cui va disegnato. Passa dai nomi
 * vecchi e ripiega su `milestone` se il valore non dice niente.
 *
 * Esportata perché la lavagna e la sidebar devono leggere lo STESSO marcatore:
 * due letture separate potevano mostrare un disco verde sul canvas e la scritta
 * «Milestone» nel pannello.
 */
export function resolveMarkerKind(raw: string | undefined | null): MarkerKind {
  const k = raw ? (MARKER_LEGACY[raw] ?? raw) : undefined;
  return (k && k in MARKER_SPEC ? k : 'milestone') as MarkerKind;
}
/**
 * `label` è la DIDASCALIA del marcatore: un testo libero su piu' righe che si
 * scrive dalla MarkerSidebar e compare sulla lavagna sotto il disco. È
 * facoltativa — senza, il marcatore resta il solo disco di prima.
 */
export type CanvasBoxMarkerContent = { kind: MarkerKind; label?: string };
/**
 * Lato del riquadro di un marcatore. Quadrato, quindi è anche il diametro.
 *
 * ⚠️ Vale per i marcatori NUOVI: la misura di quelli già posati sta in `w`/`h`
 * sulla riga, come per ogni altro box, e non cambia da sola. In coda alla
 * migrazione 044 c'è la UPDATE che riallinea quelli esistenti.
 */
export const MARKER_SIZE = 36;
/**
 * Quanto vicino deve passare la linea perché conti come intercettata: il RAGGIO
 * DEL CERCHIO INSCRITTO nell'oggetto trascinato, cioè l'oggetto la deve TOCCARE
 * col proprio corpo. Una soglia più larga armerebbe l'innesto con l'oggetto
 * ancora visibilmente staccato dalla linea.
 *
 * Era una costante — mezzo marcatore, 18 — perché innestare sapeva farlo solo
 * lui. Adesso lo fa anche un TILE, che è 128×72: con 18 fissi la linea avrebbe
 * dovuto passare quasi esattamente per il suo centro, cioè un innesto che
 * riesce per caso. Dedotta dalla misura dell'oggetto la regola resta UNA («posa
 * l'oggetto sulla linea») e per il marcatore non cambia niente: min(36,36)/2 fa
 * ancora 18.
 */
const splitHit = (w: number, h: number) => Math.min(w, h) / 2;
/**
 * LA DIDASCALIA DI UN OGGETTO PICCOLO — quanto puo' occupare.
 *
 * Larga quanto un TILE e non quanto il disco: il disco è 36px, e una frase
 * incolonnata dentro 36px diventa una scala di parole. Prendere la misura del
 * tile la fa incolonnare come tutto il resto della lavagna — e siccome
 * `TILE_W` arriva da `lib/tile-visual`, se un giorno il tile cambia taglia la
 * didascalia lo segue senza che nessuno debba ricordarsene.
 *
 * Tre righe è un TETTO, non un'altezza fissa: una riga occupa una riga. Oltre
 * la terza il testo viene troncato con i puntini — la lavagna è fatta di
 * oggetti che si guardano, non di paragrafi che si leggono, e un marcatore che
 * cresce a piacere si porta dietro quello che ha sotto.
 */
export const BOX_LABEL_W = TILE_W;
export const BOX_LABEL_LINES = 3;
const BOX_LABEL_FS = 10;
const BOX_LABEL_LH = 13;
/** Stacco fra il bordo basso del disco e la prima riga. */
const BOX_LABEL_GAP = 5;

/**
 * IL SOGGETTO — la persona a cui una parte della lavagna fa capo.
 *
 * Tutti e quattro i campi sono facoltativi, `name` compreso: un soggetto si
 * posa prima di sapere come si chiama, e un box che rifiuta di esistere finché
 * non gli si dà un nome costringe a inventarlo. Senza nome resta un'icona
 * anonima, che è esattamente ciò che si sta dicendo.
 *
 * ⚠️ Non è un `Contact`. La rubrica (`contacts`) è una riga condivisa e
 * referenziata dai passi dei flow; questo è un segno su UNA lavagna, che vive e
 * muore con lei. Vedi la nota sulla migrazione 046.
 */
export type CanvasBoxSubjectContent = { name?: string; email?: string; phone?: string; notes?: string };
/**
 * Lato del riquadro di un soggetto. Quadrato, come il marcatore, e appena più
 * grande: dentro non c'è un simbolo astratto ma una figura, che a 36px si
 * chiude su se stessa.
 */
export const SUBJECT_SIZE = 44;

export type CanvasBox =
  | { id: string; type: 'text'; content: CanvasBoxTextContent; x: number; y: number; w: number; h: number }
  | { id: string; type: 'image'; content: CanvasBoxImageContent; x: number; y: number; w: number; h: number }
  | { id: string; type: 'marker'; content: CanvasBoxMarkerContent; x: number; y: number; w: number; h: number }
  | { id: string; type: 'subject'; content: CanvasBoxSubjectContent; x: number; y: number; w: number; h: number };
// Backward-compat alias (kept until all consumers are migrated).
export type CanvasTextBox = CanvasBox;

const TB_MIN_W = 100;
const TB_MIN_H = 40;
const TB_PAD = 8;

/** Titolo dell'immagine mostrato sul canvas: sta FUORI dal box, appoggiato
 *  sopra il bordo e allineato a sinistra (come l'etichetta di un gruppo).
 *  `CAPTION_H` è lo spazio che occupa: serve ai gruppi per non tagliarlo. */
const CAPTION_H = 16;
const CAPTION_FS = 10;

const PORTS = [
  { key: 'top', cx: TILE_W / 2, cy: 0 },
  { key: 'right', cx: TILE_W, cy: TILE_H / 2 },
  { key: 'bottom', cx: TILE_W / 2, cy: TILE_H },
  { key: 'left', cx: 0, cy: TILE_H / 2 },
];

interface CanvasBoardProps {
  tiles: Tile[];
  layout: { tile_id: string; x: number; y: number }[];
  edges: CanvasEdge[];
  groups: CanvasGroup[];
  textBoxes: CanvasTextBox[];
  moveEnabled: boolean;
  linkEnabled: boolean;
  textMode: boolean;
  tileMode: boolean;
  onAddTileAt: (x: number, y: number) => void;
  onPositionChange: (positions: { tile_id: string; x: number; y: number }[]) => void;
  onAddEdge: (source_id: string, target_id: string, source_port?: string, target_port?: string) => void;
  onDeleteEdge: (id: string) => void;
  /**
   * Spezza un edge e ci infila in mezzo un oggetto: A→B diventa A→X e X→B.
   * Assente il callback, l'innesto non si arma nemmeno.
   */
  onSplitEdge?: (edgeId: string, nodeId: string) => void;
  onEdgeContextMenu: (e: { x: number; y: number; edgeId: string }) => void;
  onTileContextMenu: (e: { x: number; y: number; tileId: string; inGroup: boolean }) => void;
  onTileClick: (tileId: string) => void;
  onGroupsChange: (groups: CanvasGroup[]) => void;
  onAddTextBox: (x: number, y: number, w: number, h: number) => void;
  onUpdateTextBox: (id: string, updates: { type?: 'text' | 'image'; content?: CanvasBoxTextContent | CanvasBoxImageContent; x?: number; y?: number; w?: number; h?: number }) => void;
  /** `inGroup`: il box è membro di un gruppo (solo le immagini possono esserlo)
   *  → il parent mostra la voce "Ungroup", come per i tile. */
  onTextBoxContextMenu: (e: { x: number; y: number; textBoxId: string; inGroup: boolean }) => void;
  /** Image mode: when true, drag on empty canvas draws a rectangle, then a file
      picker opens; the picked image fills the rectangle. */
  imageMode?: boolean;
  /** Armato con un tipo di marcatore: il prossimo click sulla lavagna lo posa. */
  markerMode?: MarkerKind | null;
  /** SOGGETTO armato: il prossimo click sulla lavagna posa una persona. */
  subjectMode?: boolean;
  /**
   * Posa un oggetto. `splitEdgeId` arriva valorizzato quando l'oggetto è stato
   * lasciato su un edge armato: chi lo riceve deve prima crearlo e poi spezzare
   * quell'edge attorno a lui — l'id vero dell'oggetto esiste solo dopo la
   * creazione, quindi l'innesto non può essere deciso qui.
   */
  onAddMarkerAt?: (x: number, y: number, kind: MarkerKind, splitEdgeId?: string) => void;
  /** Posa un soggetto. Nessun `splitEdgeId`: un soggetto non innesta — vedi la
   *  nota su `currentPlacing`. */
  onAddSubjectAt?: (x: number, y: number) => void;
  onAddImageBox?: (file: File, x: number, y: number, w: number, h: number) => void;
  /** Modalità "Raggruppa a contorno": il drag sullo sfondo disegna un rettangolo
   *  SENZA bisogno di modificatori e gli elementi catturati formano subito un
   *  gruppo. Sinistra→destra cattura quelli INTERAMENTE contenuti;
   *  destra→sinistra anche quelli solo INTERSECATI dal contorno. */
  selectMode?: boolean;
  /** Chiamata a fine contorno (modalità Raggruppa) con gli id catturati (≥2):
   *  id nudo = tile, `tb:<id>` = immagine. Il parent crea il CanvasGroup. I box
   *  di TESTO non entrano nei gruppi. */
  onGroupTiles?: (memberIds: string[]) => void;
  /** Modalità "Foglio": il drag sullo sfondo cerchia l'area da stampare. Stesso
   *  gesto del contorno, altro esito — il parent apre il pannello del PDF. */
  pdfMode?: boolean;
  onPdfArea?: (area: { x: number; y: number; w: number; h: number }) => void;
  /** Anteprima del foglio scelto, in coordinate canvas: il rettangolo di carta e
   *  l'area dentro i margini. Tutto ciò che resta fuori viene velato — è l'unico
   *  modo di far vedere PRIMA della stampa cosa entra e cosa viene tagliato. */
  pdfPreview?: { sheet: GroupBounds; printable: GroupBounds } | null;
  /** Il parent prende qui la radice della board (SVG + overlay) per clonarla in
   *  stampa. Stesso schema di `screenToLocalRef`. */
  boardRootRef?: React.RefObject<HTMLDivElement | null>;
  /** Tasto destro sulla zona del gruppo SENZA tile (sfondo/etichetta): il parent
   *  apre il menu del gruppo (Rinomina / Elimina). */
  onGroupContextMenu?: (e: { x: number; y: number; groupId: string }) => void;
  /** Click sinistro sulla zona del gruppo SENZA tile: il parent seleziona il
   *  gruppo (evidenzia i punti di aggancio + mostra i dati nella sidebar). */
  onGroupClick?: (groupId: string) => void;
  /** Id del gruppo selezionato: ne evidenzia il contorno (obsidian). */
  selectedGroupId?: string | null;
  /** Click sinistro su un edge → il parent lo seleziona e apre la EdgeSidebar. */
  onEdgeClick?: (edgeId: string) => void;
  /** Id dell'edge selezionato: ne evidenzia la linea (alone). */
  selectedEdgeId?: string | null;
  /** Id del tile selezionato con click singolo: mostra il contorno obsidian e
   *  sopprime i suoi punti di aggancio (che restano solo in hover sui non-selezionati). */
  selectedTileId?: string | null;
  /** Id del box (testo/immagine) selezionato con click singolo → contorno obsidian. */
  selectedTextBoxId?: string | null;
  /** Click singolo su un box → il parent lo seleziona (solo contorno, niente menu). */
  onTextBoxClick?: (id: string) => void;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[], screenBbox: { x: number; y: number; w: number; h: number } | null) => void;
  fitTrigger: number;
  zoom100Trigger?: number;
  /** Optional ref the parent passes in; CanvasBoard sets `.current` to a
   *  function that converts viewport (clientX/Y) coords to canvas-local
   *  coords using the live zoom/pan transform. Useful for drops from outside
   *  the canvas (e.g. the staging panel) to land under the cursor. */
  screenToLocalRef?: React.RefObject<((clientX: number, clientY: number) => { x: number; y: number }) | null>;
  /** Tested at the end of every tile drag — if it returns true, the tile(s)
   *  were dropped over the staging panel and should be removed from the
   *  canvas instead of having their new position saved. */
  isOverStaging?: (clientX: number, clientY: number) => boolean;
  /** Called when a tile drag ends over the staging zone (isOverStaging
   *  returned true). Receives the dragged tile id(s) so the parent can drop
   *  their canvas_layout entries. */
  onTilesRemovedFromCanvas?: (ids: string[]) => void;
  /** Continuous drag callback — fires on every pointer move while a tile
   *  is being dragged. Used by the parent to highlight the staging panel
   *  when the cursor is over it. */
  onTileDragMove?: (clientX: number, clientY: number) => void;
  /** Drag ended — always fires (regardless of drop target). Used to reset
   *  any drag-state UI the parent maintains (e.g. staging highlight). */
  onTileDragEnd?: () => void;
  /** Identifica QUESTO canvas (in pratica l'id del tag) ai fini della vista
   *  persistita: pan e zoom vengono salvati e ripristinati per chiave, così
   *  ogni canvas riapre esattamente dove lo si era lasciato. Senza chiave la
   *  persistenza è disattivata e la vista parte dall'origine. */
  viewKey?: string;
}

export const CanvasBoard = React.memo(function CanvasBoard({
  tiles, layout, edges, groups, textBoxes,
  moveEnabled, linkEnabled, textMode, tileMode, imageMode, selectMode, onAddTileAt,
  onPositionChange, onAddEdge, onDeleteEdge, onSplitEdge,
  onEdgeContextMenu, onTileContextMenu, onTileClick,
  onGroupsChange, onAddTextBox, onUpdateTextBox, onTextBoxContextMenu, onAddImageBox,
  onGroupTiles, onGroupContextMenu, onGroupClick, selectedGroupId, selectedTileId,
  pdfMode, onPdfArea, pdfPreview, boardRootRef, markerMode, onAddMarkerAt, subjectMode, onAddSubjectAt,
  onEdgeClick, selectedEdgeId,
  selectedTextBoxId, onTextBoxClick,
  selectedIds, onSelectionChange,
  fitTrigger, zoom100Trigger,
  screenToLocalRef,
  isOverStaging, onTilesRemovedFromCanvas,
  onTileDragMove, onTileDragEnd,
  viewKey,
}: CanvasBoardProps) {
  const theme = usePixelTheme();
  /**
   * Colore di OGNI selezione sulla lavagna: contorni di tile, box, immagini e
   * gruppi, maniglie di ridimensionamento, alone dei collegamenti.
   *
   * Era `accentSoft`, descritto come "viola scuro invece del lavanda acceso".
   * Vale in SCURO, dove quel token è #2e2747; in CHIARO è #efeafb, cioè un
   * lavanda quasi bianco — è una velatura di FONDO (la usano i tab attivi), non
   * un colore da tratto. Su lavagna bianca il contorno di selezione rendeva
   * 1.18:1, praticamente invisibile, e in scuro sul #161616 non andava meglio
   * (1.29:1). Il token era stato scelto guardando un tema solo.
   *
   * Con l'accent pieno: 4.9:1 in chiaro, 7.7:1 in scuro.
   *
   * ⚠️ Cade così la distinzione fra selezione e affordance d'azione (porte,
   * linea temporanea, marquee), che erano già sull'accent pieno. Era una
   * distinzione costruita su un colore che non si vedeva: se la si rivuole, va
   * fatta su spessore o opacità, non sulla tinta.
   */
  const selAccent = theme.accent;
  // Obsidian: card/box arrotondati + hairline 1px + font Geist. Costanti riusate
  // nel codice D3 sotto.
  const RX = 5;         // card / group / clip corner radius (tile + gruppi + box)
  const RX_SEL = 8;     // selection ring radius
  const SW = 1;         // card hairline stroke width
  const labelFont = 'var(--ob-font-mono), ui-monospace, monospace';
  const svgRef = useRef<SVGSVGElement>(null);
  // La radice della board serve QUI (ci vive la griglia di puntini) e al parent
  // (che la clona per la stampa): un ref di callback li serve entrambi senza
  // obbligare chi non stampa a passarne uno.
  const rootRef = useRef<HTMLDivElement | null>(null);
  const setRoot = useCallback((el: HTMLDivElement | null) => {
    rootRef.current = el;
    if (boardRootRef) boardRootRef.current = el;
  }, [boardRootRef]);
  // HTML overlay refs — host TipTap editors at fixed canvas coordinates.
  // overlayInnerRef gets a CSS transform that mirrors the D3 zoom/pan, so
  // editors stay glued to their D3-drawn box frames without React re-renders.
  const overlayRef = useRef<HTMLDivElement>(null);
  const overlayInnerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const zoomTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  // Chiave del canvas attualmente montato. Il grande effect di disegno gira a
  // ogni render: solo quando questa cambia (primo montaggio o passaggio a un
  // altro tag) la vista va ricaricata da localStorage invece di riusare quella
  // in memoria. `false` = nessun canvas ancora agganciato.
  const viewKeyRef = useRef<string | undefined | false>(false);
  const viewKeyPropRef = useRef<string | undefined>(viewKey); viewKeyPropRef.current = viewKey;
  const nodesRef = useRef<CanvasNode[]>([]);
  const groupsRef = useRef(groups); groupsRef.current = groups;
  const actionColors = useActionColors();
  const { statuses: allStatuses } = useStatuses();
  const typeIcons = useTypeIcons((s) => s.icons);
  const typeTileIcons = useTypeIcons((s) => s.tileIcons);
  const moveRef = useRef(moveEnabled); moveRef.current = moveEnabled;
  const linkRef = useRef(linkEnabled); linkRef.current = linkEnabled;
  const textModeRef = useRef(textMode); textModeRef.current = textMode;
  const tileModeRef = useRef(tileMode); tileModeRef.current = tileMode;
  const imageModeRef = useRef(imageMode); imageModeRef.current = imageMode;
  const selectModeRef = useRef(selectMode); selectModeRef.current = selectMode;
  const pdfModeRef = useRef(pdfMode); pdfModeRef.current = pdfMode;
  const markerModeRef = useRef(markerMode); markerModeRef.current = markerMode;
  const onAddMarkerAtRef = useRef(onAddMarkerAt); onAddMarkerAtRef.current = onAddMarkerAt;
  const subjectModeRef = useRef(subjectMode); subjectModeRef.current = subjectMode;
  const onAddSubjectAtRef = useRef(onAddSubjectAt); onAddSubjectAtRef.current = onAddSubjectAt;
  const onPdfAreaRef = useRef(onPdfArea); onPdfAreaRef.current = onPdfArea;
  const pdfPreviewRef = useRef(pdfPreview); pdfPreviewRef.current = pdfPreview;
  /** Come drawGroupsRef: ridisegna SOLO l'anteprima del foglio quando cambia il
   *  formato, senza ricostruire l'intero SVG a ogni click sul pannello. */
  const drawPdfPreviewRef = useRef<(() => void) | null>(null);
  const onGroupTilesRef = useRef(onGroupTiles); onGroupTilesRef.current = onGroupTiles;
  const onGroupContextMenuRef = useRef(onGroupContextMenu); onGroupContextMenuRef.current = onGroupContextMenu;
  const onGroupClickRef = useRef(onGroupClick); onGroupClickRef.current = onGroupClick;
  const selectedGroupIdRef = useRef(selectedGroupId); selectedGroupIdRef.current = selectedGroupId;
  const selectedTileIdRef = useRef(selectedTileId); selectedTileIdRef.current = selectedTileId;
  const selectedTextBoxIdRef = useRef(selectedTextBoxId); selectedTextBoxIdRef.current = selectedTextBoxId;
  const onTextBoxClickRef = useRef(onTextBoxClick); onTextBoxClickRef.current = onTextBoxClick;
  // Ref al drawGroups corrente: permette a un effect di ridisegnare SOLO i gruppi
  // quando cambia la selezione del gruppo, senza ricostruire tutto l'SVG.
  const drawGroupsRef = useRef<(() => void) | null>(null);
  const drawEdgesRef = useRef<(() => void) | null>(null);
  const onAddImageBoxRef = useRef(onAddImageBox); onAddImageBoxRef.current = onAddImageBox;

  // Refs for callbacks to avoid re-render of the entire SVG
  const onTileClickRef = useRef(onTileClick); onTileClickRef.current = onTileClick;
  const onTileContextMenuRef = useRef(onTileContextMenu); onTileContextMenuRef.current = onTileContextMenu;
  const onEdgeContextMenuRef = useRef(onEdgeContextMenu); onEdgeContextMenuRef.current = onEdgeContextMenu;
  const onEdgeClickRef = useRef(onEdgeClick); onEdgeClickRef.current = onEdgeClick;
  const selectedEdgeIdRef = useRef(selectedEdgeId); selectedEdgeIdRef.current = selectedEdgeId;

  /**
   * C'è qualcosa di selezionato, di qualunque tipo?
   *
   * Esiste come funzione perché la domanda si faceva a mano, elencando i tipi
   * uno per uno — e l'elenco si era già sfasato: mancavano gli EDGE, quindi con
   * un solo collegamento selezionato il clic sul vuoto usciva subito e non
   * deselezionava niente. Un tipo nuovo di oggetto selezionabile va aggiunto
   * qui e da nessun'altra parte.
   */
  const hasAnySelection = useCallback(() => (
    selectedIdsRef.current.length > 0
    || !!selectedGroupIdRef.current
    || !!selectedTileIdRef.current
    || !!selectedTextBoxIdRef.current
    || !!selectedEdgeIdRef.current
  ), []);
  const onTextBoxContextMenuRef = useRef(onTextBoxContextMenu); onTextBoxContextMenuRef.current = onTextBoxContextMenu;
  const onAddTileAtRef = useRef(onAddTileAt); onAddTileAtRef.current = onAddTileAt;
  const onPositionChangeRef = useRef(onPositionChange); onPositionChangeRef.current = onPositionChange;
  const onGroupsChangeRef = useRef(onGroupsChange); onGroupsChangeRef.current = onGroupsChange;
  const onAddEdgeRef = useRef(onAddEdge); onAddEdgeRef.current = onAddEdge;
  const onDeleteEdgeRef = useRef(onDeleteEdge); onDeleteEdgeRef.current = onDeleteEdge;
  const onSplitEdgeRef = useRef(onSplitEdge); onSplitEdgeRef.current = onSplitEdge;
  const onAddTextBoxRef = useRef(onAddTextBox); onAddTextBoxRef.current = onAddTextBox;
  const onUpdateTextBoxRef = useRef(onUpdateTextBox); onUpdateTextBoxRef.current = onUpdateTextBox;
  const onSelectionChangeRef = useRef(onSelectionChange); onSelectionChangeRef.current = onSelectionChange;
  const isOverStagingRef = useRef(isOverStaging); isOverStagingRef.current = isOverStaging;
  const onTilesRemovedFromCanvasRef = useRef(onTilesRemovedFromCanvas); onTilesRemovedFromCanvasRef.current = onTilesRemovedFromCanvas;
  const onTileDragMoveRef = useRef(onTileDragMove); onTileDragMoveRef.current = onTileDragMove;
  const onTileDragEndRef = useRef(onTileDragEnd); onTileDragEndRef.current = onTileDragEnd;
  const selectedIdsRef = useRef<string[]>(selectedIds || []); selectedIdsRef.current = selectedIds || [];

  // Text box in editing (inserimento testo). Di default un text box è in
  // modalità "sposta" (overlay non interattivo → il gruppo D3 gestisce il
  // drag); il doppio click entra in editing, il click esterno/Esc esce.
  const [editingBoxId, setEditingBoxId] = useState<string | null>(null);
  const setEditingBoxIdRef = useRef(setEditingBoxId); setEditingBoxIdRef.current = setEditingBoxId;

  // Publish a viewport→canvas-local coordinate converter to the parent (used
  // for staging-panel drops). The function reads zoomTransformRef on every
  // call, so it always reflects the latest pan/zoom.
  useEffect(() => {
    if (!screenToLocalRef) return;
    screenToLocalRef.current = (clientX, clientY) => {
      const svg = svgRef.current;
      const t = zoomTransformRef.current;
      if (!svg) return { x: clientX, y: clientY };
      const r = svg.getBoundingClientRect();
      return {
        x: (clientX - r.left - t.x) / t.k,
        y: (clientY - r.top - t.y) / t.k,
      };
    };
    return () => {
      if (screenToLocalRef) screenToLocalRef.current = null;
    };
  }, [screenToLocalRef]);

  // Click esterno / Esc → esce dall'editing del text box. Il click DENTRO il
  // box in editing o sulla bubble-menu di TipTap non deve chiudere.
  useEffect(() => {
    if (!editingBoxId) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (t.closest?.('.tiptap-bubble')) return;
      if (t.closest?.(`[data-box-id="${editingBoxId}"]`)) return;
      setEditingBoxId(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setEditingBoxId(null); };
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [editingBoxId]);

  // Auto-editing per un text box appena creato: entra in inserimento solo se il
  // box è NUOVO e VUOTO (contenuto ancora da scrivere). Al reload i box salvati
  // hanno già del testo → restano in modalità "sposta" (cursore move), non in
  // inserimento. Evita anche di dover fare doppio click dopo aver disegnato una
  // casella nuova.
  /**
   * Box di testo il cui contenuto NON ci sta: id → altezza che servirebbe.
   * Assente = il testo entra. Lo riempie `TextEditor` misurando il proprio DOM
   * di ProseMirror; qui serve solo a decidere se mostrare il badge.
   */
  const [boxOverflow, setBoxOverflow] = useState<Record<string, number>>({});

  /** Registra la misura di un box, senza rirenderizzare se non è cambiata. */
  const reportBoxMeasure = useCallback((id: string, m: { overflowing: boolean; contentHeight: number }) => {
    setBoxOverflow((prev) => {
      const cur = prev[id];
      const next = m.overflowing ? Math.ceil(m.contentHeight) : undefined;
      // Il confronto NON è un'ottimizzazione: la misura si riporta anche a ogni
      // ridisegno, e senza questa uscita lo stato si riscriverebbe identico in
      // un ciclo continuo di render.
      if (cur === next) return prev;
      const copy = { ...prev };
      if (next === undefined) delete copy[id]; else copy[id] = next;
      return copy;
    });
  }, []);

  /**
   * Porta il box all'altezza che serve a mostrare tutto il testo.
   *
   * Cresce solo verso il BASSO — `y` non si tocca — perché il box è ancorato
   * dove l'hai messo: alzarne il bordo superiore lo farebbe scappare da sotto
   * il puntatore e scavalcare quello che ha sopra.
   */
  const expandBoxToFit = useCallback((tb: CanvasTextBox, contentH: number) => {
    const h = Math.ceil(contentH) + 2 * TB_PAD;
    if (h <= tb.h) return;
    // ⚠️ NON scrivere anche `tb.h = h` qui, per quanto sembri prudente.
    //
    // `tb` è l'oggetto che sta DENTRO la cache di React Query: `textBoxes` è
    // `boxesData.data` senza copie. Chi riceve questo aggiornamento fa
    // `{ ...tb, ...updates }` e riscrive la cache — ma React Query ha
    // `structuralSharing` attivo per default, quindi confronta il risultato
    // con quello di prima e, se è profondamente uguale, RESTITUISCE IL
    // VECCHIO RIFERIMENTO. Mutando qui, l'oggetto in cache ha già l'altezza
    // nuova: il confronto non trova differenze, l'identità non cambia, il
    // `useMemo` a monte non ricalcola e il componente non si ridisegna mai.
    // La cornice e il testo restavano fermi finché non li smuoveva altro.
    onUpdateTextBoxRef.current(tb.id, { h });
  }, []);

  const knownTextBoxIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const known = knownTextBoxIdsRef.current;
    for (const b of textBoxes) {
      if (b.type !== 'text') continue;
      if (!known.has(b.id)) {
        known.add(b.id);
        const html = (b as { content?: { html?: string } }).content?.html ?? '';
        const isEmpty = html.replace(/<[^>]*>/g, '').trim() === '';
        if (isEmpty) setEditingBoxId(b.id);
      }
    }
    // Pulisce gli id spariti così un eventuale riuso non resti "già noto".
    const alive = new Set(textBoxes.map((b) => b.id));
    for (const id of known) if (!alive.has(id)) known.delete(id);
  }, [textBoxes]);

  // Pending HTML save timers per text box — debounce TipTap onUpdate calls.
  const editorSaveTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => () => {
    editorSaveTimersRef.current.forEach((t) => clearTimeout(t));
    editorSaveTimersRef.current.clear();
  }, []);

  // Link drag state
  const linkSrc = useRef<{ id: string; px: number; py: number; port: string } | null>(null);
  const dropTarget = useRef<{ nodeId: string; groupId?: string; port?: string } | null>(null);

  const getColor = useCallback((at: string) => (actionColors as Record<string, string>)[at] || actionColors.none || theme.ink3, [actionColors]);

  const buildNodes = useCallback((): CanvasNode[] => {
    const pm = new Map(layout.map((p) => [p.tile_id, p]));
    const currentPosMap = new Map(nodesRef.current.map((n) => [n.id, { x: n.x, y: n.y }]));
    return tiles.map((t, i) => {
      const cur = currentPosMap.get(t.id);
      const s = pm.get(t.id);
      // Priority: DB layout > in-memory (drag) > default column
      // If DB has a position, use it. In-memory is only a fallback (e.g. for freshly created tiles not yet persisted).
      const x = s?.x ?? cur?.x ?? OFFSET_X;
      const y = s?.y ?? cur?.y ?? (OFFSET_Y + i * (TILE_H + TILE_GAP));
      // Resolve status shape (lookup against all statuses — system + custom).
      // status_id is now the single source of truth for "done"; the visual
      // treatment for completed tiles comes from the system 'done' row.
      let shape = 'solid';
      let statusName: string | undefined;
      if (t.status_id) {
        const st = allStatuses.find((s) => s.id === t.status_id);
        if (st) { shape = st.shape; statusName = st.name; }
      } else {
        // Fallback per tile legacy senza status_id: forma dello status linkato
        // all'action_type. Inline su `allStatuses` (stabile) invece di
        // `getActionTypeShape`, che useStatuses ricrea ad ogni render e faceva
        // cambiare identità a buildNodes → render → ricostruzione continua
        // dell'SVG (che rompeva i click "dopo un po'").
        const linked = allStatuses.find((s) => s.action_type === (t.action_type || 'none'));
        shape = linked?.shape || 'solid';
      }
      // Type icon
      const tiId = typeTileIcons[t.id];
      const ti = tiId ? typeIcons.find((ic) => ic.id === tiId) : null;
      // Treat ALL DAY tiles as the 'allday' virtual action_type so colors/borders
      // resolve against the ALL DAY palette (not the TIMED one used for plain event).
      const resolvedActionType = (t.all_day && t.action_type === 'event') ? 'allday' : (t.action_type || 'none');
      return { id: t.id, title: t.title || 'Senza titolo', actionType: resolvedActionType, statusShape: shape, statusName, isCompleted: !!t.is_completed, typeIcon: ti?.icon, typeColor: ti?.color, startAt: t.start_at, endAt: t.end_at, allDay: t.all_day, subtasks: t.subtasks, sparks: (t.sparks ?? []).map((sp) => sp.type), isFocused: !!t.is_focused, x, y };
    });
  }, [tiles, layout, allStatuses, typeIcons, typeTileIcons]);

  /** Box (testo e immagini) membri del gruppo, nell'ordine in cui compaiono. */
  const getGroupBoxes = (g: CanvasGroup, tbs: CanvasBox[]) =>
    g.nodeIds
      .filter(isBoxId)
      .map((id) => tbs.find((tb) => tb.id === boxIdOf(id)))
      .filter((tb): tb is CanvasBox => !!tb);

  /** Rettangoli di TUTTI i membri (tile + box): è su questi che il gruppo
   *  si auto-dimensiona. Non è `x/y/w/h` della riga ma l'ingombro VERO, scritte
   *  comprese — vedi `boxExtent`. */
  const getGroupRects = (g: CanvasGroup, ns: CanvasNode[], tbs: CanvasBox[]) => [
    ...ns.filter((n) => g.nodeIds.includes(n.id)).map((n) => ({ x: n.x, y: n.y, w: TILE_W, h: TILE_H })),
    ...getGroupBoxes(g, tbs).map(boxExtent),
  ];

  const getGroupBounds = (g: CanvasGroup, ns: CanvasNode[]) => {
    const gn = getGroupRects(g, ns, textBoxes);
    if (!gn.length) return null;
    const ax = Math.min(...gn.map((n) => n.x)) - GROUP_PAD;
    const ay = Math.min(...gn.map((n) => n.y)) - GROUP_PAD;
    const aw = Math.max(...gn.map((n) => n.x + n.w)) + GROUP_PAD - ax;
    const ah = Math.max(...gn.map((n) => n.y + n.h)) + GROUP_PAD - ay;
    // Senza dimensione manuale: auto-fit sul contenuto.
    if (!g.bounds) return { x: ax, y: ay, w: aw, h: ah };
    // Con dimensione manuale: UNIONE col box del contenuto, così il gruppo
    // continua a contenerlo anche se le maniglie lo rimpiccioliscono sotto.
    const x = Math.min(ax, g.bounds.x);
    const y = Math.min(ay, g.bounds.y);
    const r = Math.max(ax + aw, g.bounds.x + g.bounds.w);
    const b = Math.max(ay + ah, g.bounds.y + g.bounds.h);
    return { x, y, w: r - x, h: b - y };
  };

  // Hit-test result: nodeId to connect to + optional groupId for highlight
  // preferGroup: when true, containers take priority over tiles inside them
  interface HitResult { nodeId: string; groupId?: string; }
  const hitTest = useCallback((bx: number, by: number, excludeId: string, preferGroup = false): HitResult | null => {
    const ns = nodesRef.current;
    const gs = groupsRef.current;
    const TOL = 8;

    let sourceGroupId: string | null = null;
    gs.forEach((g) => { if (g.nodeIds.includes(excludeId)) sourceGroupId = g.id; });

    // Group check
    const findGroup = (): HitResult | null => {
      for (const g of gs) {
        if (g.id === sourceGroupId) continue;
        const b = getGroupBounds(g, ns);
        if (!b) continue;
        if (bx >= b.x - TOL && bx <= b.x + b.w + TOL && by >= b.y - LABEL_H - TOL && by <= b.y + b.h + TOL) {
          // Ancora dell'edge: un membro QUALSIASI del gruppo (tile o immagine) —
          // un gruppo di soli box resta comunque collegabile.
          const first = ns.find((n) => g.nodeIds.includes(n.id) && n.id !== excludeId);
          if (first) return { nodeId: first.id, groupId: g.id };
          const firstBox = getGroupBoxes(g, textBoxes).find((tb) => `${BOX_ID_PREFIX}${tb.id}` !== excludeId);
          if (firstBox) return { nodeId: `${BOX_ID_PREFIX}${firstBox.id}`, groupId: g.id };
        }
      }
      return null;
    };

    // Tile check (ungrouped tiles only when preferGroup, ALL tiles otherwise)
    const findTile = (): HitResult | null => {
      const groupedIds = preferGroup ? new Set(gs.flatMap((g) => g.nodeIds)) : new Set<string>();
      const tile = ns.find((n) => n.id !== excludeId && !groupedIds.has(n.id) && bx >= n.x && bx <= n.x + TILE_W && by >= n.y && by <= n.y + TILE_H);
      if (tile) return { nodeId: tile.id };
      return null;
    };

    // Text box check
    const findTextBox = (): HitResult | null => {
      for (const tb of textBoxes) {
        const tbId = `tb:${tb.id}`;
        if (tbId === excludeId) continue;
        if (bx >= tb.x && bx <= tb.x + tb.w && by >= tb.y && by <= tb.y + tb.h) {
          return { nodeId: tbId };
        }
      }
      return null;
    };

    if (preferGroup) {
      return findGroup() || findTile() || findTextBox();
    } else {
      const tile = ns.find((n) => n.id !== excludeId && bx >= n.x && bx <= n.x + TILE_W && by >= n.y && by <= n.y + TILE_H);
      if (tile) return { nodeId: tile.id };
      return findTextBox() || findGroup();
    }
  }, [textBoxes]);


  const render = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const d3svg = d3.select(svg);
    d3svg.selectAll('*').remove();

    // Bordo standard dei tile (token `--ob-tile-border`). Serve risolto in un
    // colore concreto e non come `var(...)`: lo stroke del tile viene
    // riassegnato via `attr` (evidenziazione drop-target, reset dopo il drag) e
    // uno `style` inline vincerebbe su quelle riassegnazioni, bloccando gli
    // stati. Il fill invece resta su `style` perché nessuno lo riassegna.
    const tileBorder =
      getComputedStyle(document.documentElement).getPropertyValue('--ob-tile-border').trim()
      || theme.border;

    // Forward-declared so the zoom handler (registered before the function body
    // is reachable) can safely call it without hitting a TDZ on transform restore.
    let computeSelectionScreenBbox: () => { x: number; y: number; w: number; h: number } | null = () => null;

    /**
     * LIVELLO DI DETTAGLIO — sotto una certa scala il badge e i segmenti dei
     * passi smettono di essere simboli e diventano sporcizia: il segmento è
     * alto 3px e il bordo del badge 1.2px, quindi sotto 0.6 scendono sotto il
     * pixel fisico. Si spengono, e restano i canali che sopravvivono in
     * miniatura: fondo, colore e bordo.
     *
     * È una classe sul contenitore, non un ridisegno: lo zoom scorre a 60fps e
     * rifare la grafica di ogni tile a ogni frame della rotella non è
     * sostenibile. La regola sta in `obsidian-canvas.css`.
     */
    const applyLod = (k: number) => {
      svg.classList.toggle('ob-canvas-svg--lod', k < TILE_LOD_MIN_SCALE);
    };

    /**
     * La griglia segue pan e zoom. Non è disegnata nell'SVG ma è lo SFONDO CSS
     * della radice: un `background-image` ripetuto costa al compositore quanto
     * un colore pieno, mentre migliaia di `<circle>` nel DOM costerebbero a ogni
     * frame della rotella. Qui per frame si scrivono due proprietà.
     *
     * Il diametro del puntino resta quello dichiarato in `.ob-dotgrid` e NON
     * scala: cambia solo la spaziatura. È il comportamento delle lavagne
     * infinite — il riferimento si allarga, il segno resta un segno.
     */
    const applyDots = (t: d3.ZoomTransform) => {
      const el = rootRef.current;
      if (!el) return;
      let step = DOT_STEP;
      while (step * t.k < DOT_MIN_SCREEN) step *= 2;
      const size = step * t.k;
      el.style.backgroundSize = `${size}px ${size}px`;
      el.style.backgroundPosition = `${t.x}px ${t.y}px`;
    };

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 2])
      .filter((ev) => {
        if ((textModeRef.current || tileModeRef.current || imageModeRef.current || selectModeRef.current || pdfModeRef.current || markerModeRef.current || subjectModeRef.current) && ev.type === 'mousedown') return false; // con un modo armato il trascinamento posa, non sposta la vista
        return ev.type === 'wheel' || ev.type?.startsWith('touch') || (ev.type === 'mousedown' && ev.button === 0 && !ev.shiftKey && !ev.ctrlKey && !ev.metaKey && ev.target === svg);
      })
      .on('zoom', (ev) => {
        zoomTransformRef.current = ev.transform;
        board.attr('transform', ev.transform);
        applyLod(ev.transform.k);
        applyDots(ev.transform);
        // Mirror the SVG transform on the HTML overlay so TipTap editors stay
        // glued to their D3-drawn box frames during pan/zoom — without forcing
        // a React re-render of the editor list.
        if (overlayInnerRef.current) {
          overlayInnerRef.current.style.transform = `translate(${ev.transform.x}px,${ev.transform.y}px) scale(${ev.transform.k})`;
        }
        // Reposition floating menu only on user-driven pan/zoom — programmatic
        // transform restore (which fires every render) has no sourceEvent and
        // would otherwise loop with the parent's setSelectionBbox.
        if (ev.sourceEvent && selectedIdsRef.current.length > 0) {
          onSelectionChangeRef.current?.(selectedIdsRef.current, computeSelectionScreenBbox());
        }
      })
      // Fine di ogni pan/zoom → la vista viene persistita. Sull'`end` e non sullo
      // `zoom` per non scrivere su localStorage a ogni frame della rotella. Vale
      // anche per Fit e 100%, che sono a tutti gli effetti l'ultima vista scelta.
      .on('end', () => {
        saveView(viewKeyPropRef.current, zoomTransformRef.current);
      });
    d3svg.call(zoom);
    zoomRef.current = zoom;

    const board = d3.select(svg).append('g');

    // Ripristino della vista. Questo effect rigira a ogni cambio di dati: in quel
    // caso la vista giusta è quella già in memoria. Solo al primo montaggio o
    // quando si passa a un altro canvas si rilegge quella persistita.
    if (viewKeyRef.current !== viewKey) {
      viewKeyRef.current = viewKey;
      zoomTransformRef.current = loadView(viewKey) ?? d3.zoomIdentity;
    }
    if (zoomTransformRef.current !== d3.zoomIdentity) {
      d3svg.call(zoom.transform as any, zoomTransformRef.current);
    }
    // Anche il ripristino della vista salvata deve rispettare la soglia: senza,
    // riaprendo un canvas lasciato a scala 0.4 i badge tornerebbero accesi
    // finché non tocchi la rotella.
    applyLod(zoomTransformRef.current.k);
    applyDots(zoomTransformRef.current);
    const boardNode = board.node()!;
    const nodes = buildNodes();
    nodesRef.current = nodes;

    // ── Compute screen-space bbox for current selection (tiles + text boxes) ──
    computeSelectionScreenBbox = (): { x: number; y: number; w: number; h: number } | null => {
      const ids = selectedIdsRef.current;
      if (!ids.length || !svgRef.current) return null;
      const idSet = new Set(ids);
      const sel = nodes.filter((n) => idSet.has(n.id));
      const selTbs = textBoxes.filter((tb) => idSet.has(`tb:${tb.id}`));
      if (sel.length + selTbs.length === 0) return null;
      const xs1 = [...sel.map((n) => n.x), ...selTbs.map((tb) => tb.x)];
      const ys1 = [...sel.map((n) => n.y), ...selTbs.map((tb) => tb.y)];
      const xs2 = [...sel.map((n) => n.x + TILE_W), ...selTbs.map((tb) => tb.x + tb.w)];
      const ys2 = [...sel.map((n) => n.y + TILE_H), ...selTbs.map((tb) => tb.y + tb.h)];
      const x1 = Math.min(...xs1), y1 = Math.min(...ys1);
      const x2 = Math.max(...xs2), y2 = Math.max(...ys2);
      const t = zoomTransformRef.current;
      const r = svgRef.current.getBoundingClientRect();
      return {
        x: r.left + t.x + x1 * t.k,
        y: r.top + t.y + y1 * t.k,
        w: (x2 - x1) * t.k,
        h: (y2 - y1) * t.k,
      };
    };

    // ── Selection rect (marquee) ──
    // Si attiva con ctrl/cmd/shift + drag OPPURE con la modalità "Seleziona"
    // (pulsante toolbar) senza modificatori. Direzione del gesto (stile CAD):
    //   • sinistra→destra  → "window": seleziona SOLO i tile INTERAMENTE
    //     contenuti nel rettangolo (tratto continuo).
    //   • destra→sinistra  → "crossing": seleziona ANCHE i tile solo
    //     INTERSECATI dal rettangolo (tratto tratteggiato).
    const selRect = board.append('rect').attr('class', 'ob-canvas-marquee').attr('fill', theme.accent).attr('fill-opacity', 0.1).attr('stroke', theme.accent).attr('stroke-width', 2).attr('opacity', 0);
    let selStart: [number, number] | null = null;
    const isSelectModifier = (e: MouseEvent) => e.ctrlKey || e.metaKey || e.shiftKey;
    d3svg.on('mousedown.sel', (e: MouseEvent) => {
      if ((!isSelectModifier(e) && !selectModeRef.current && !pdfModeRef.current) || e.button || e.target !== svg) return;
      e.preventDefault();
      selStart = d3.pointer(e, boardNode) as [number, number];
      // Sopra tutto, velo del foglio compreso: ridisegnare l'area con la vecchia
      // anteprima davanti vorrebbe dire trascinare un contorno smorzato dalla
      // scelta che stai per sostituire.
      selRect.raise();
      selRect.attr('x', selStart[0]).attr('y', selStart[1]).attr('width', 0).attr('height', 0)
        .attr('stroke-dasharray', null).attr('opacity', 1);
    });
    d3svg.on('mousemove.sel', (e: MouseEvent) => {
      if (!selStart) return;
      const [mx, my] = d3.pointer(e, boardNode);
      const crossing = mx < selStart[0]; // destra→sinistra = intersezione
      selRect.attr('x', Math.min(selStart[0], mx)).attr('y', Math.min(selStart[1], my))
        .attr('width', Math.abs(mx - selStart[0])).attr('height', Math.abs(my - selStart[1]))
        .attr('stroke-dasharray', crossing ? '4,3' : null);
    });
    d3svg.on('mouseup.sel', (e: MouseEvent) => {
      if (!selStart) return;
      const [mx, my] = d3.pointer(e, boardNode);
      const crossing = mx < selStart[0]; // direzione del gesto (usa le coord grezze)
      const [x1, y1] = [Math.min(selStart[0], mx), Math.min(selStart[1], my)];
      const [x2, y2] = [Math.max(selStart[0], mx), Math.max(selStart[1], my)];
      selStart = null; selRect.attr('opacity', 0);
      if (x2 - x1 < 20 || y2 - y1 < 20) return;
      // Modalità "Foglio": il contorno delimita l'area da stampare, non seleziona
      // niente. Il verso del gesto qui non conta — un foglio non ha un dentro e
      // un toccato, ha solo un bordo.
      if (pdfModeRef.current) {
        onPdfAreaRef.current?.({ x: x1, y: y1, w: x2 - x1, h: y2 - y1 });
        return;
      }
      // window (L→R): rettangolo del tile TUTTO dentro. crossing (R→L): basta
      // che il rettangolo del tile TOCCHI il contorno (overlap dei bbox).
      const hit = (bx: number, by: number, bw: number, bh: number) =>
        crossing
          ? (bx < x2 && bx + bw > x1 && by < y2 && by + bh > y1)
          : (bx >= x1 && by >= y1 && bx + bw <= x2 && by + bh <= y2);
      const insideTiles = nodes.filter((n) => hit(n.x, n.y, TILE_W, TILE_H));
      // Modalità "Group" (pulsante toolbar): ogni contorno valido chiude
      // l'operazione — il parent disattiva il pulsante. Entrano nel gruppo i
      // tile E i box catturati (≥2 in tutto, guardia lato parent), esclusi i
      // marcatori — vedi `isGroupableBox`.
      if (selectModeRef.current) {
        const insideBoxes = textBoxes.filter((tb) => isGroupableBox(tb) && hit(tb.x, tb.y, tb.w, tb.h));
        onGroupTilesRef.current?.([
          ...insideTiles.map((n) => n.id),
          ...insideBoxes.map((tb) => `${BOX_ID_PREFIX}${tb.id}`),
        ]);
        return;
      }
      const insideTbs = textBoxes.filter((tb) => hit(tb.x, tb.y, tb.w, tb.h));
      if (insideTiles.length + insideTbs.length < 1) return;
      const ids = [...insideTiles.map((n) => n.id), ...insideTbs.map((tb) => `tb:${tb.id}`)];
      selectedIdsRef.current = ids;
      onSelectionChangeRef.current?.(ids, computeSelectionScreenBbox());
    });

    // Clic semplice sul vuoto → azzera QUALUNQUE selezione: tile, multi-
    // selezione, gruppi, box di testo, immagini e collegamenti. Il parent le
    // spegne tutte in `handleSelectionChange`, quindi basta chiamarlo con una
    // selezione vuota. `e.target !== svg` è ciò che distingue il vuoto: un
    // clic su un oggetto ha come bersaglio l'oggetto, e quelli fermano comunque
    // la propagazione.
    d3svg.on('click.clearsel', (e: MouseEvent) => {
      if (e.target !== svg) return;
      if (isSelectModifier(e)) return;
      if (textModeRef.current || tileModeRef.current || imageModeRef.current || pdfModeRef.current || markerModeRef.current || subjectModeRef.current) return;
      if (!hasAnySelection()) return;
      selectedIdsRef.current = [];
      // onSelectionChange([]) azzera lato parent selezione tile/gruppo/box.
      onSelectionChangeRef.current?.([], null);
    });

    // ── Temp line for link drag ──
    const tempLine = board.append('line').attr('class', 'ob-canvas-templine').attr('stroke', theme.accent).attr('stroke-width', 2).attr('stroke-dasharray', '6,3').attr('opacity', 0);

    // ── Common link drag handlers ──
    const startLink = (sourceId: string, px: number, py: number, port: string, ev: any) => {
      ev.sourceEvent.stopPropagation();
      linkSrc.current = { id: sourceId, px, py, port };
      dropTarget.current = null;
      tempLine.attr('x1', px).attr('y1', py).attr('x2', px).attr('y2', py).attr('opacity', 1);
    };
    // Find closest port on a target node or group. Returns "top"|"right"... for tile, "g:top"|"g:right"... for group
    const findClosestPort = (mx: number, my: number, targetId: string, groupId?: string): string => {
      if (groupId) {
        const grp = groupsRef.current.find((g) => g.id === groupId);
        if (grp) {
          const b = getGroupBounds(grp, nodes);
          if (b) {
            const gPts = [
              { key: 'g:top', x: b.x + b.w / 2, y: b.y - LABEL_H },
              { key: 'g:right', x: b.x + b.w, y: b.y + (b.h - LABEL_H) / 2 },
              { key: 'g:bottom', x: b.x + b.w / 2, y: b.y + b.h },
              { key: 'g:left', x: b.x, y: b.y + (b.h - LABEL_H) / 2 },
            ];
            let best = gPts[0], bestDist = Infinity;
            gPts.forEach((p) => { const d = (mx - p.x) ** 2 + (my - p.y) ** 2; if (d < bestDist) { bestDist = d; best = p; } });
            return best.key;
          }
        }
      }
      const nd = nodes.find((n) => n.id === targetId);
      if (nd) {
        const tPts = PORTS.map((p) => ({ key: p.key, x: nd.x + p.cx, y: nd.y + p.cy }));
        let best = tPts[0], bestDist = Infinity;
        tPts.forEach((p) => { const d = (mx - p.x) ** 2 + (my - p.y) ** 2; if (d < bestDist) { bestDist = d; best = p; } });
        return best.key;
      }
      return 'right';
    };

    const dragLink = (ev: any) => {
      if (!linkSrc.current) return;
      const [mx, my] = d3.pointer(ev.sourceEvent, boardNode);
      tempLine.attr('x2', mx).attr('y2', my);
      const fromGroup = linkSrc.current.port.startsWith('g:');
      const hit = hitTest(mx, my, linkSrc.current.id, fromGroup);
      if (hit) {
        const tp = findClosestPort(mx, my, hit.nodeId, hit.groupId);
        dropTarget.current = { ...hit, port: tp };
      } else {
        dropTarget.current = null;
      }
      // Reset all highlights
      // Il bordo del tile ora lo disegna la card (HTML): il rettangolo di presa
      // torna semplicemente senza contorno.
      nodeGrps.select('.tile-bg').attr('stroke', 'none').attr('stroke-width', 0);
      groupsBg.selectAll<SVGRectElement, unknown>('rect').each(function () {
        const r = d3.select(this);
        r.attr('stroke', r.attr('data-base-stroke') || 'none')
         .attr('stroke-width', r.attr('data-base-sw') || 0)
         .attr('stroke-dasharray', r.attr('data-base-dash') || null);
      });
      // Highlight target
      if (dropTarget.current) {
        if (dropTarget.current.groupId) {
          groupsBg.selectAll('g').each(function (_, i) {
            const grp = groupsRef.current[i];
            if (grp && grp.id === dropTarget.current!.groupId) {
              d3.select(this as SVGGElement).select('rect').attr('stroke', theme.accent).attr('stroke-width', 2.5);
            }
          });
        } else {
          nodeGrps.filter((d: any) => d.id === dropTarget.current!.nodeId).select('.tile-bg').attr('stroke', theme.accent).attr('stroke-width', 2.5);
        }
      }
    };
    const endLink = () => {
      tempLine.attr('opacity', 0);
      // Il bordo del tile ora lo disegna la card (HTML): il rettangolo di presa
      // torna semplicemente senza contorno.
      nodeGrps.select('.tile-bg').attr('stroke', 'none').attr('stroke-width', 0);
      groupsBg.selectAll<SVGRectElement, unknown>('rect').each(function () {
        const r = d3.select(this);
        r.attr('stroke', r.attr('data-base-stroke') || 'none')
         .attr('stroke-width', r.attr('data-base-sw') || 0)
         .attr('stroke-dasharray', r.attr('data-base-dash') || null);
      });
      if (!linkSrc.current) return;
      const sid = linkSrc.current.id;
      const sp = linkSrc.current.port;
      linkSrc.current = null;
      if (dropTarget.current && dropTarget.current.nodeId !== sid) {
        onAddEdgeRef.current(sid, dropTarget.current.nodeId, sp, dropTarget.current.port);
      }
      dropTarget.current = null;
    };

    // ── Draw groups (bg) ──
    const groupsBg = board.append('g').attr('class', 'gbg');
    const drawGroups = () => {
      groupsBg.selectAll('*').remove();
      // Click / tasto destro sulla zona del gruppo (sfondo o etichetta, dove NON
      // ci sono tile) → menu del gruppo (Rinomina / Elimina) gestito dal parent.
      const openGroupMenu = (ev: MouseEvent, id: string) => {
        onGroupContextMenuRef.current?.({ x: ev.clientX, y: ev.clientY, groupId: id });
      };
      groupsRef.current.forEach((grp) => {
        const b = getGroupBounds(grp, nodes);
        if (!b) return;
        const isSel = grp.id === selectedGroupIdRef.current;
        // Stile per-gruppo (sfondo/bordo). In selezione il bordo passa all'accento
        // (mantenendo spessore/tipologia) per rendere evidente la selezione.
        // Senza un colore scelto, il fondo è `--ob-group-bg`: a metà fra la
        // lavagna e le sponde. Era `theme.surface`, che da quando l'area di
        // lavoro è bianca coincide con la lavagna — il gruppo spariva.
        // ⚠️ Arriva come CSS var, quindi va posato con `.style()` e non con
        // `.attr()`: un attributo di presentazione SVG non risolve le custom
        // properties, e il rettangolo resterebbe senza riempimento.
        const gBg = grp.bgColor || 'var(--ob-group-bg)';
        // Un gruppo nasce CON la sua hairline. Il default era 0, cioè nessun
        // contorno: il rettangolo si reggeva sul solo fondo, e su una lavagna
        // bianca quel fondo vale un contrasto di 1.06 — il gruppo c'era e non si
        // vedeva. Ogni altro contenitore del sistema (tile, card, menu) ha il suo
        // contorno; questo non aveva ragione di essere l'eccezione.
        // `??` e non `||`: uno zero SCELTO resta zero, è chi non ha mai deciso
        // che prende la hairline.
        const gBw = grp.borderWidth ?? 1;
        const gStroke = isSel ? selAccent : (gBw > 0 ? (grp.borderColor || theme.border) : 'none');
        const gStrokeW = isSel ? Math.max(1.5, gBw) : gBw;
        const dashFor = (style: string | null | undefined, w: number): string | null => {
          if (style === 'dashed') return `${Math.max(4, w * 3)},${Math.max(3, w * 2)}`;
          if (style === 'dotted') return `${Math.max(1, w)},${Math.max(3, w * 2)}`;
          return null;
        };
        const gDash = dashFor(grp.borderStyle, gStrokeW);
        const gw = groupsBg.append('g');
        gw.append('rect').attr('x', b.x).attr('y', b.y - LABEL_H).attr('width', b.w).attr('height', b.h + LABEL_H).attr('rx', RX)
          .style('fill', gBg)
          .attr('stroke', gStroke).attr('stroke-width', gStrokeW)
          .attr('stroke-dasharray', gDash)
          .attr('stroke-linecap', grp.borderStyle === 'dotted' ? 'round' : 'butt')
          // Stile base memorizzato: il link-drag evidenzia temporaneamente il
          // bordo del gruppo target e poi lo ripristina da questi attributi.
          .attr('data-base-stroke', gStroke).attr('data-base-sw', gStrokeW).attr('data-base-dash', gDash || '')
          .style('cursor', moveRef.current ? 'grab' : 'default')
          // Click sinistro → seleziona il gruppo (sidebar + punti di aggancio).
          .on('click', (ev: MouseEvent) => { ev.stopPropagation(); onGroupClickRef.current?.(grp.id); })
          // Tasto destro → menu del gruppo (Rinomina / Elimina).
          .on('contextmenu', (ev: MouseEvent) => { ev.preventDefault(); ev.stopPropagation(); openGroupMenu(ev, grp.id); })
          .call((() => {
            let prev: [number, number] | null = null;
            // Immagini membri: si spostano col gruppo come i tile. Risolte allo
            // start (non alla costruzione) così un'immagine appena entrata nel
            // gruppo viene comunque trascinata.
            let mBoxes: CanvasBox[] = [];
            return d3.drag<SVGRectElement, unknown>().filter(() => moveRef.current)
              // Come per tile e box: senza tolleranza il click che seleziona il
              // gruppo (e apre la sua sidebar) viene soppresso da D3 al primo
              // pixel di tremolio.
              .clickDistance(12)
              .on('start', (ev) => {
                prev = d3.pointer(ev.sourceEvent, boardNode) as [number, number];
                mBoxes = getGroupBoxes(grp, textBoxes);
              })
              .on('drag', (ev) => {
                const cur = d3.pointer(ev.sourceEvent, boardNode) as [number, number];
                if (!prev) { prev = cur; return; }
                const dx = cur[0] - prev[0], dy = cur[1] - prev[1];
                prev = cur;
                grp.nodeIds.forEach((id) => { const n = nodes.find((nn) => nn.id === id); if (n) { n.x += dx; n.y += dy; } });
                // La dimensione manuale è in coord assolute: trasla anche lei col
                // gruppo, altrimenti resterebbe ancorata alla posizione precedente.
                if (grp.bounds) grp.bounds = { ...grp.bounds, x: grp.bounds.x + dx, y: grp.bounds.y + dy };
                nodeGrps.filter((d: any) => grp.nodeIds.includes(d.id)).attr('transform', (d: any) => `translate(${d.x},${d.y})`);
                if (mBoxes.length) {
                  const ids = new Set(mBoxes.map((tb) => tb.id));
                  for (const tb of mBoxes) { tb.x += dx; tb.y += dy; }
                  tbG.selectAll<SVGGElement, unknown>('g.tb-node').each(function () {
                    const id = (this as SVGGElement).getAttribute('data-tb-id');
                    if (!id || !ids.has(id)) return;
                    const tb = mBoxes.find((t) => t.id === id);
                    if (tb) { d3.select(this).attr('transform', `translate(${tb.x},${tb.y})`); syncOverlayBox(tb); }
                  });
                }
                drawEdges(); drawGroups();
              })
              .on('end', () => {
                prev = null;
                onPositionChangeRef.current(nodes.map((n) => ({ tile_id: n.id, x: n.x, y: n.y })));
                for (const tb of mBoxes) onUpdateTextBoxRef.current(tb.id, { x: tb.x, y: tb.y });
                mBoxes = [];
                // Persiste anche la dimensione manuale traslata (se presente).
                if (grp.bounds) onGroupsChangeRef.current?.(groupsRef.current.map((gg) => ({ ...gg })));
              });
          })());
        // Nome leggibile sullo sfondo del gruppo: chiaro su scuro e viceversa.
        // Senza sfondo scelto prende l'inchiostro pieno — lo STESSO dei titoli
        // dei tile. Era `ink3` (#9a96a4 sul chiaro): un grigio che sulla lavagna
        // vale un contrasto di 2.4:1, cioè un nome che c'è e non si legge. Un
        // gruppo è il titolo di una regione del canvas, non una nota a margine.
        // Selezionato passa all'accento, come ogni altra cosa selezionata.
        const gLabelColor = grp.bgColor ? readableOn(grp.bgColor) : (isSel ? selAccent : theme.ink);
        gw.append('text').attr('x', b.x + 8).attr('y', b.y - LABEL_H + 14).attr('fill', gLabelColor).attr('font-size', OB_TEXT.meta).attr('font-weight', isSel ? OB_WEIGHT.emphasis : OB_WEIGHT.body)
          .text(grp.label || 'Gruppo').style('cursor', 'pointer')
          .on('click', (ev: MouseEvent) => { ev.stopPropagation(); onGroupClickRef.current?.(grp.id); })
          .on('contextmenu', (ev: MouseEvent) => { ev.preventDefault(); ev.stopPropagation(); openGroupMenu(ev, grp.id); });
        // Group ports
        const gPorts: { key: PortKey; cx: number; cy: number }[] = [
          { key: 'top', cx: b.x + b.w / 2, cy: b.y - LABEL_H },
          { key: 'right', cx: b.x + b.w, cy: b.y + (b.h - LABEL_H) / 2 },
          { key: 'bottom', cx: b.x + b.w / 2, cy: b.y + b.h },
          { key: 'left', cx: b.x, cy: b.y + (b.h - LABEL_H) / 2 },
        ];
        const gPcs: { pc: d3.Selection<SVGCircleElement, unknown, null, undefined>; cx: number; cy: number }[] = [];
        gPorts.forEach(({ key: pk, cx, cy }) => {
          // Punti di aggancio: NON evidenziati alla selezione (contorno obsidian).
          const pc = gw.append('circle').attr('class', 'g-port').attr('cx', cx).attr('cy', cy).attr('r', PORT_R + 1).attr('fill', theme.accent).attr('stroke', theme.bg1).attr('stroke-width', 2).attr('opacity', 0).style('pointer-events', 'none');
          gPcs.push({ pc, cx, cy });
          const ha = gw.append('circle').attr('cx', cx).attr('cy', cy).attr('r', 14).attr('fill', 'rgba(0,0,0,0.001)').style('cursor', 'crosshair');
          ha.call(d3.drag<SVGCircleElement, unknown>().filter(() => linkRef.current)
            // L'edge del gruppo è ancorato a un suo membro: il primo tile, o —
            // se il gruppo non ne ha — il primo box.
            .on('start', (ev) => {
              const fn = nodes.find((n) => grp.nodeIds.includes(n.id));
              const fb = fn ? null : getGroupBoxes(grp, textBoxes)[0];
              const anchor = fn ? fn.id : (fb ? `${BOX_ID_PREFIX}${fb.id}` : null);
              if (anchor) startLink(anchor, cx, cy, `g:${pk}`, ev);
              pc.attr('opacity', 1);
            })
            .on('drag', dragLink)
            .on('end', () => { endLink(); gPcs.forEach((p) => p.pc.attr('opacity', 0)); }) as any);
        });
        // In hover mostra SOLO il punto di aggancio più vicino al cursore (non tutti
        // e 4): meno "disturbante". Escluso in selezione o durante un link attivo.
        gw.on('mousemove.ports', (ev: MouseEvent) => {
          if (!linkRef.current || linkSrc.current || selectedGroupIdRef.current === grp.id) return;
          const [mx, my] = d3.pointer(ev, boardNode);
          let best: typeof gPcs[number] | null = null, bestDist = Infinity;
          for (const p of gPcs) { const dd = (mx - p.cx) ** 2 + (my - p.cy) ** 2; if (dd < bestDist) { bestDist = dd; best = p; } }
          gPcs.forEach((p) => p.pc.attr('opacity', p === best ? 1 : 0));
        });
        gw.on('mouseleave.ports', () => { if (!linkSrc.current) gPcs.forEach((p) => p.pc.attr('opacity', 0)); });

        // Maniglie di RIDIMENSIONAMENTO (solo se il gruppo è selezionato): come
        // per i text box, permettono di estendere il gruppo oltre l'auto-fit sui
        // tile. Il box del gruppo è l'UNIONE di grp.bounds e del bbox dei tile
        // (getGroupBounds), quindi una maniglia non può mai rimpicciolirlo sotto
        // il contenuto: si "aggancia" al bordo dei tile.
        if (isSel) {
          const HS = 8;                  // lato maniglia
          const GMINW = 40, GMINH = 40;  // dimensione minima del box manuale
          // Rettangolo visivo del gruppo (include la fascia label in alto).
          const rx = b.x, ry = b.y - LABEL_H, rw = b.w, rh = b.h + LABEL_H;
          const gHandles: { hx: number; hy: number; cursor: string; edge: string }[] = [
            { hx: rx,          hy: ry,          cursor: 'nwse-resize', edge: 'tl' },
            { hx: rx + rw / 2, hy: ry,          cursor: 'ns-resize',   edge: 't' },
            { hx: rx + rw,     hy: ry,          cursor: 'nesw-resize', edge: 'tr' },
            { hx: rx + rw,     hy: ry + rh / 2, cursor: 'ew-resize',   edge: 'r' },
            { hx: rx + rw,     hy: ry + rh,     cursor: 'nwse-resize', edge: 'br' },
            { hx: rx + rw / 2, hy: ry + rh,     cursor: 'ns-resize',   edge: 'b' },
            { hx: rx,          hy: ry + rh,     cursor: 'nesw-resize', edge: 'bl' },
            { hx: rx,          hy: ry + rh / 2, cursor: 'ew-resize',   edge: 'l' },
          ];
          let rs: { mx: number; my: number; x: number; y: number; w: number; h: number } | null = null;
          gHandles.forEach(({ hx, hy, cursor, edge }) => {
            gw.append('rect').attr('class', 'g-resize')
              .attr('x', hx - HS / 2).attr('y', hy - HS / 2).attr('width', HS).attr('height', HS).attr('rx', 2)
              .attr('fill', selAccent).attr('stroke', theme.ink3).attr('stroke-width', 1)
              .style('cursor', cursor)
              .call(d3.drag<SVGRectElement, unknown>()
                .on('start', (ev) => {
                  ev.sourceEvent.stopPropagation();
                  // Parte dal box VISIBILE corrente (unione), che diventa la base
                  // manuale editabile: così il trascinamento segue ciò che si vede.
                  const cur = getGroupBounds(grp, nodes)!;
                  const [mx, my] = d3.pointer(ev.sourceEvent, boardNode);
                  rs = { mx, my, x: cur.x, y: cur.y, w: cur.w, h: cur.h };
                  grp.bounds = { x: cur.x, y: cur.y, w: cur.w, h: cur.h };
                })
                .on('drag', (ev) => {
                  if (!rs) return;
                  const [mx, my] = d3.pointer(ev.sourceEvent, boardNode);
                  const dx = mx - rs.mx, dy = my - rs.my;
                  let nx = rs.x, ny = rs.y, nw = rs.w, nh = rs.h;
                  if (edge.includes('r')) nw = rs.w + dx;
                  if (edge.includes('b')) nh = rs.h + dy;
                  if (edge.includes('l')) { nx = rs.x + dx; nw = rs.w - dx; }
                  if (edge.includes('t')) { ny = rs.y + dy; nh = rs.h - dy; }
                  if (nw < GMINW) { if (edge.includes('l')) nx = rs.x + rs.w - GMINW; nw = GMINW; }
                  if (nh < GMINH) { if (edge.includes('t')) ny = rs.y + rs.h - GMINH; nh = GMINH; }
                  grp.bounds = { x: nx, y: ny, w: nw, h: nh };
                  drawGroups();
                })
                .on('end', () => {
                  rs = null;
                  onGroupsChangeRef.current?.(groupsRef.current.map((gg) => ({ ...gg })));
                }) as any);
          });
        }
      });
    };
    drawGroupsRef.current = drawGroups;

    // ── Draw edges ──
    const edgesG = board.append('g');
    // Get all ports for an endpoint (tile, group, or textbox)
    const getEndpointPorts = (nodeId: string, port: string | undefined): { x: number; y: number }[] => {
      // Group ports — PRIMA dei box: l'ancora di un gruppo può essere un tile o
      // un'immagine, e con la porta `g:` è il gruppo a dettare i punti.
      if (port && port.startsWith('g:')) {
        const grp = groupsRef.current.find((g) => g.nodeIds.includes(nodeId));
        if (grp) {
          const b = getGroupBounds(grp, nodes);
          if (b) return [
            { x: b.x + b.w / 2, y: b.y - LABEL_H },
            { x: b.x + b.w, y: b.y + (b.h - LABEL_H) / 2 },
            { x: b.x + b.w / 2, y: b.y + b.h },
            { x: b.x, y: b.y + (b.h - LABEL_H) / 2 },
          ];
        }
      }
      // Text box ports
      if (nodeId.startsWith('tb:') || (port && port.startsWith('t:'))) {
        const tbId = nodeId.startsWith('tb:') ? nodeId.slice(3) : nodeId;
        const tb = textBoxes.find((t) => t.id === tbId);
        if (tb) {
          return [
            { x: tb.x + tb.w / 2, y: tb.y },
            { x: tb.x + tb.w, y: tb.y + tb.h / 2 },
            { x: tb.x + tb.w / 2, y: tb.y + tb.h },
            { x: tb.x, y: tb.y + tb.h / 2 },
          ];
        }
      }
      // Tile ports
      const nd = nodes.find((n) => n.id === nodeId);
      if (nd) return PORTS.map((p) => ({ x: nd.x + p.cx, y: nd.y + p.cy }));
      return [];
    };

    // Find best pair of ports between two endpoints
    const findBestPorts = (sId: string, tId: string, sp: string | undefined, tp: string | undefined): { sx: number; sy: number; tx: number; ty: number } => {
      const sPorts = getEndpointPorts(sId, sp);
      const tPorts = getEndpointPorts(tId, tp);
      let bestDist = Infinity, best = { sx: 0, sy: 0, tx: 0, ty: 0 };
      for (const s of sPorts) {
        for (const t of tPorts) {
          const d = (s.x - t.x) ** 2 + (s.y - t.y) ** 2;
          if (d < bestDist) { bestDist = d; best = { sx: s.x, sy: s.y, tx: t.x, ty: t.y }; }
        }
      }
      return best;
    };

    // Dasharray dell'edge in base alla tipologia linea (default = dashed, come
    // l'aspetto storico degli edge).
    const edgeDash = (style: string | null | undefined, w: number): string | null => {
      if (style === 'solid') return null;
      if (style === 'dotted') return `${Math.max(1, w)},${Math.max(3, w * 2)}`;
      return `${Math.max(4, w * 3)},${Math.max(3, w * 2)}`;
    };
    /**
     * Dove passa ogni edge DISEGNATO, in coordinate della lavagna.
     *
     * La riempie `drawEdges` mentre disegna, e la legge la sonda dell'innesto.
     * Rifare il conto nella sonda avrebbe voluto dire ricopiare le guardie sugli
     * estremi mancanti e la scelta delle porte: due calcoli da tenere allineati
     * per sempre, e la possibilità di innestare su un edge che sullo schermo non
     * c'è.
     */
    const edgeGeom = new Map<string, { x1: number; y1: number; x2: number; y2: number; s: string; t: string }>();
    // Stato del gesto d'innesto. Variabili di chiusura e non ref: vivono quanto
    // un trascinamento, e un ridisegno dell'intera board lo interrompe comunque.
    let splitArmedId: string | null = null;   // edge acceso: al rilascio si spezza
    let splitHoverId: string | null = null;   // edge attualmente sotto l'oggetto
    let splitTimer: ReturnType<typeof setTimeout> | null = null;

    /** Spegne tutto e restituisce l'edge che era armato, se c'era. */
    const clearSplit = (): string | null => {
      if (splitTimer) { clearTimeout(splitTimer); splitTimer = null; }
      const wasArmed = splitArmedId;
      splitArmedId = null; splitHoverId = null;
      return wasArmed;
    };

    /**
     * Sonda: l'oggetto trascinato sta sopra un edge? Se ci resta, lo arma.
     *
     * `cx`/`cy` sono il CENTRO dell'oggetto e `w`/`h` il suo ingombro: da lì
     * esce la soglia (vedi `splitHit`), che quindi vale per un marcatore da 36
     * come per un tile da 128×72 senza due regole diverse.
     *
     * Gli edge di cui l'oggetto è già un capo sono esclusi: non si può spezzare
     * il collegamento che parte da sé.
     */
    const probeSplit = (cx: number, cy: number, selfId: string, w: number, h: number) => {
      const reach = splitHit(w, h);
      let hit: string | null = null;
      for (const [id, ge] of edgeGeom) {
        if (ge.s === selfId || ge.t === selfId) continue;
        if (distToSegment(cx, cy, ge.x1, ge.y1, ge.x2, ge.y2) <= reach) { hit = id; break; }
      }
      if (hit === splitHoverId) return;   // stesso stato: l'attesa in corso prosegue
      const wasArmed = clearSplit();
      splitHoverId = hit;
      if (wasArmed) drawEdges();          // si è usciti da un edge già acceso: spegnilo
      if (!hit) return;
      splitTimer = setTimeout(() => {
        splitArmedId = hit;
        // Il ridisegno va chiesto QUI: se l'oggetto è fermo non arrivano altri
        // mousemove, e senza questo l'edge si accenderebbe solo al movimento
        // successivo — cioè proprio quando si è smesso di aspettare.
        drawEdges();
      }, SPLIT_DWELL);
    };

    const drawEdges = () => {
      edgesG.selectAll('*').remove();
      edgeGeom.clear();
      edges.forEach((edge) => {
        // Check endpoints exist (could be tile or textbox)
        const sIsTb = edge.source_id.startsWith('tb:');
        const tIsTb = edge.target_id.startsWith('tb:');
        const s = sIsTb ? null : nodes.find((n) => n.id === edge.source_id);
        const t = tIsTb ? null : nodes.find((n) => n.id === edge.target_id);
        const sTb = sIsTb ? textBoxes.find((tb) => `tb:${tb.id}` === edge.source_id) : null;
        const tTb = tIsTb ? textBoxes.find((tb) => `tb:${tb.id}` === edge.target_id) : null;
        if (!s && !sTb) return;
        if (!t && !tTb) return;

        const { sx: x1, sy: y1, tx: x2, ty: y2 } = findBestPorts(edge.source_id, edge.target_id, edge.source_port, edge.target_port);
        edgeGeom.set(edge.id, { x1, y1, x2, y2, s: edge.source_id, t: edge.target_id });

        const sColor = s ? getColor(s.actionType) : theme.border;
        const tColor = t ? getColor(t.actionType) : theme.border;
        const selIds = selectedIdsRef.current;
        const isMultiSel = selIds.length >= 2 && selIds.includes(edge.source_id) && selIds.includes(edge.target_id);
        const isEdgeSel = selectedEdgeIdRef.current === edge.id;
        // Stile editabile (EdgeSidebar): colore / spessore / tipologia linea.
        // Default = look storico (neutro, tratteggiato, sottile).
        const edgeColor = edge.color || EDGE_COLOR_DEFAULT;
        const edgeWidth = edge.lineWidth ?? 1.5;
        // ARMATO PER L'INNESTO: la linea si accende come una selezione. È la
        // sola cosa che dice «se molli qui, questo edge si spezza» — senza,
        // l'attesa di mezzo secondo sarebbe indistinguibile da un ritardo.
        const isSplitArmed = splitArmedId === edge.id;
        const baseStroke = isMultiSel || isSplitArmed ? selAccent : edgeColor;
        const baseWidth = isSplitArmed ? Math.max(edgeWidth, 3) : isMultiSel ? Math.max(edgeWidth, 2.5) : edgeWidth;
        const baseDash = edgeDash(edge.lineStyle, baseWidth);
        // Geometria della freccia, che serve già alla linea: dove c'è una punta
        // la linea visibile si ferma prima.
        const aStep = Math.min(4, Math.max(1, Math.round(edge.arrowSize ?? ARROW_SIZE_DEFAULT)));
        // La misura la sceglie l'utente; il pavimento legato allo spessore resta
        // perché su una linea da 4px la punta più piccola sarebbe larga quanto
        // la linea e si leggerebbe come un ispessimento, non come una freccia.
        const ah = Math.max(ARROW_HEAD[aStep - 1], baseWidth * 3);
        const aw = ah * 0.62;
        const edx = x2 - x1, edy = y2 - y1;
        const elen = Math.hypot(edx, edy) || 1;
        const ux = edx / elen, uy = edy / elen;              // verso A→B
        const headAtB = edge.arrow === 'forward' || edge.arrow === 'both';
        const headAtA = edge.arrow === 'backward' || edge.arrow === 'both';
        // Estremi della linea visibile: arretrati di ARROW_GAP dove c'è la punta.
        const lx1 = headAtA ? x1 + ux * ARROW_GAP : x1;
        const ly1 = headAtA ? y1 + uy * ARROW_GAP : y1;
        const lx2 = headAtB ? x2 - ux * ARROW_GAP : x2;
        const ly2 = headAtB ? y2 - uy * ARROW_GAP : y2;
        const g = edgesG.append('g').attr('class', 'edge-node').attr('data-source', edge.source_id).attr('data-target', edge.target_id);
        // Alone di selezione (edge selezionato singolarmente → EdgeSidebar).
        if (isEdgeSel) {
          g.append('line').attr('x1', x1).attr('y1', y1).attr('x2', x2).attr('y2', y2)
            .attr('stroke', selAccent).attr('stroke-width', baseWidth + 6).attr('stroke-opacity', 0.9)
            .attr('stroke-linecap', 'round').style('pointer-events', 'none');
        }
        g.append('line').attr('x1', x1).attr('y1', y1).attr('x2', x2).attr('y2', y2).attr('stroke', 'transparent').attr('stroke-width', 12).style('cursor', 'pointer');
        const vl = g.append('line').attr('class', 'edge-visible').attr('x1', lx1).attr('y1', ly1).attr('x2', lx2).attr('y2', ly2)
          .attr('stroke', baseStroke).attr('stroke-width', baseWidth).attr('stroke-dasharray', baseDash)
          .attr('stroke-linecap', edge.lineStyle === 'dotted' ? 'round' : 'butt').style('pointer-events', 'none');
        // Anchor dots at port positions
        g.append('circle').attr('cx', x1).attr('cy', y1).attr('r', 3).attr('fill', sColor).style('pointer-events', 'none');
        g.append('circle').attr('cx', x2).attr('cy', y2).attr('r', 3).attr('fill', tColor).style('pointer-events', 'none');
        // ── PUNTE ──────────────────────────────────────────────────────────
        // Triangoli disegnati a mano e non `<marker>`: un marker SVG per
        // ereditare il colore della linea vorrebbe `context-stroke`, che non è
        // ovunque, e altrimenti servirebbe un marker per ogni colore della
        // palette — 40 definizioni da tenere allineate a tinta, spessore e
        // stato di selezione. Qui il colore è già in mano (`baseStroke`).
        //
        // La punta ha il VERTICE sull'aggancio e cresce all'indietro lungo la
        // linea, così resta ancorata al bordo del nodo come il pallino che
        // copre. Misura legata allo spessore: una linea da 4 con la punta di
        // una da 1 sembrerebbe spuntata.
        if (edge.arrow) {
          // Vertice sull'estremo ARRETRATO, non sull'aggancio: è lo stesso punto
          // in cui si ferma la linea, quindi punta e linea combaciano.
          const head = (px: number, py: number, sx: number, sy: number) => {
            const bx = px - sx * ah, by = py - sy * ah;  // centro della base
            const nx = -sy, ny = sx;                     // perpendicolare
            g.append('path')
              .attr('d', `M${px},${py} L${bx + nx * aw},${by + ny * aw} L${bx - nx * aw},${by - ny * aw} Z`)
              .attr('fill', baseStroke)
              .style('pointer-events', 'none');
          };
          if (headAtB) head(lx2, ly2, ux, uy);
          if (headAtA) head(lx1, ly1, -ux, -uy);
        }

        // ── ETICHETTA ──────────────────────────────────────────────────────
        // Tre disposizioni, una sola costruzione: un gruppo posato sul punto di
        // mezzo, ruotato o no, con dentro testo e pillola disegnati attorno
        // all'origine. Ruotare il GRUPPO invece del testo permette di misurare
        // il riquadro nel sistema di riferimento già inclinato — `getBBox()`
        // restituisce le coordinate locali — e la pillola combacia da sola.
        // Calcolarla in coordinate schermo avrebbe voluto dire ruotare a mano i
        // quattro angoli e prenderne il contenitore, che su testo inclinato è
        // sempre più largo del testo.
        if (edge.label) {
          const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
          const align = edge.labelAlign ?? EDGE_LABEL_ALIGN_DEFAULT;
          // L'angolo si riporta sempre fra -90 e +90: oltre, il testo si
          // leggerebbe capovolto. Un collegamento tirato da destra a sinistra
          // ha la stessa inclinazione di uno tirato al contrario, e l'etichetta
          // non deve sapere in che ordine è stato disegnato.
          let ang = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
          if (ang > 90) ang -= 180;
          if (ang < -90) ang += 180;
          const lg = g.append('g').attr(
            'transform',
            align === 'horizontal' ? `translate(${mx},${my})` : `translate(${mx},${my}) rotate(${ang})`,
          );
          const bgRect = lg.append('rect').style('pointer-events', 'none');
          const txt = lg.append('text').attr('x', 0).attr('y', 0)
            .attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
            .attr('fill', theme.ink).attr('font-family', labelFont).attr('font-size', OB_TEXT.meta).attr('font-weight', OB_WEIGHT.emphasis)
            .style('pointer-events', 'none').text(edge.label);
          try {
            let bb = (txt.node() as SVGTextElement).getBBox();
            // A CAPO — se il testo è più lungo del collegamento che lo porta.
            // Su un edge corto un'etichetta lunga sbordava da entrambi i capi e
            // finiva sopra i nodi collegati; con l'allineamento centrato, che
            // ora è il default, il problema è diventato la norma invece che
            // l'eccezione, perché il testo corre LUNGO la linea.
            const avail = elen - LABEL_PAD;
            if (bb.width > avail && edge.label.length > 1) {
              const charW = bb.width / edge.label.length;   // esatto: monospaziato
              const perLine = Math.max(LABEL_MIN_CHARS, Math.floor(avail / charW));
              const lines = wrapLabel(edge.label, perLine);
              if (lines.length > 1) {
                txt.text(null);
                lines.forEach((ln, i) => {
                  txt.append('tspan')
                    // La prima riga sale di metà blocco, così il gruppo di righe
                    // resta centrato sul punto di mezzo come lo era la singola.
                    .attr('x', 0)
                    .attr('dy', i === 0 ? -((lines.length - 1) * LABEL_LINE_H) / 2 : LABEL_LINE_H)
                    .text(ln);
                });
                bb = (txt.node() as SVGTextElement).getBBox();
              }
            }
            // `above`: alzata quanto basta perché il bordo basso della pillola
            // stia 3px sopra la linea. Nel gruppo ruotato "in alto" è già
            // perpendicolare all'edge, quindi non serve nessun conto di seni.
            const dy = align === 'above' ? -(bb.height / 2 + 5) : 0;
            if (dy) txt.attr('y', dy);
            bgRect.attr('x', bb.x - 5).attr('y', bb.y + dy - 2).attr('width', bb.width + 10).attr('height', bb.height + 4).attr('rx', 4)
              .attr('fill', theme.surface).attr('stroke', isEdgeSel ? selAccent : theme.border).attr('stroke-width', 1);
          } catch { bgRect.remove(); }
        }
        // ⚠️ Con un oggetto ARMATO l'edge si tira indietro: niente rosso al
        // passaggio (l'unica accensione che deve contare è quella dell'innesto,
        // che è d'accento) e niente click rubato — sopra un collegamento il
        // click POSA, ed è anzi il gesto con cui ci si innesta.
        g.on('mouseenter', () => { if (markerModeRef.current || subjectModeRef.current) return; vl.attr('stroke', '#E24B4A').attr('stroke-width', Math.max(baseWidth, 2.5)); })
         .on('mouseleave', () => {
           // Ripristina il baseline consapevole della selezione (può cambiare in hover).
           const sel = selectedIdsRef.current;
           const ms = sel.length >= 2 && sel.includes(edge.source_id) && sel.includes(edge.target_id);
           vl.attr('stroke', ms ? selAccent : edgeColor).attr('stroke-width', ms ? Math.max(edgeWidth, 2.5) : edgeWidth);
         });
        g.on('click', (ev: MouseEvent) => {
          if (markerModeRef.current || subjectModeRef.current) return;   // il click scende al piano di sotto
          ev.stopPropagation(); onEdgeClickRef.current?.(edge.id);
        });
        g.on('contextmenu', (ev: MouseEvent) => { ev.preventDefault(); ev.stopPropagation(); onEdgeContextMenuRef.current({ x: ev.clientX, y: ev.clientY, edgeId: edge.id }); });
      });
    };
    drawEdgesRef.current = drawEdges;
    drawEdges();

    // ── Nodes ──
    // In SVG non esiste z-index: a sovrapporsi vince chi è disegnato DOPO.
    // Finora l'ordine era quello in cui `buildNodes()` restituiva le tile, cioè
    // arbitrario: due tile accostate si coprivano a caso, e a ogni ridisegno
    // poteva cambiare chi stava sopra. Ordinando per Y la regola diventa
    // deterministica e coincide con l'intuizione fisica — chi sta più in basso è
    // più vicino a chi guarda, quindi passa sopra. Conta soprattutto per ciò che
    // sborda dal rettangolo (i badge d'angolo del sistema visivo).
    // Copia ordinata, non `nodes.sort()`: l'array originale è usato altrove per
    // ricerche e per il salvataggio delle posizioni, e non va riordinato sotto
    // i piedi di chi lo tiene per riferimento.
    const stacked = [...nodes].sort((a, b) => a.y - b.y);
    const nodesG = board.append('g');
    const nodeGrps = nodesG.selectAll('g').data(stacked, (d: any) => d.id).enter().append('g').attr('class', 'tile-node').attr('transform', (d) => `translate(${d.x},${d.y})`);

    // Click / context on tiles — agganciati SUBITO (prima del disegno di badge/
    // velatura). Così, anche se un passo di disegno fallisce, le tile restano
    // selezionabili: la selezione apre il tile nella sidebar.
    // - CTRL/CMD/SHIFT + click → toggle nella multi-selezione (niente sidebar)
    // - Click semplice → azzera la multi-selezione e apre il tile nella sidebar
    nodeGrps.on('click.sel', (ev: MouseEvent, d: CanvasNode) => {
      ev.stopPropagation();
      if (ev.ctrlKey || ev.metaKey || ev.shiftKey) {
        const cur = selectedIdsRef.current;
        const has = cur.includes(d.id);
        const next = has ? cur.filter((id) => id !== d.id) : [...cur, d.id];
        selectedIdsRef.current = next;
        onSelectionChangeRef.current?.(next, next.length ? computeSelectionScreenBbox() : null);
        return;
      }
      if (selectedIdsRef.current.length > 0) {
        selectedIdsRef.current = [];
        onSelectionChangeRef.current?.([], null);
      }
      onTileClickRef.current(d.id);
    });
    nodeGrps.on('contextmenu.ctx', (ev: MouseEvent, d: CanvasNode) => { ev.preventDefault(); ev.stopPropagation(); onTileContextMenuRef.current({ x: ev.clientX, y: ev.clientY, tileId: d.id, inGroup: groupsRef.current.some((g) => g.nodeIds.includes(d.id)) }); });
    // ─── LA CARD ─────────────────────────────────────────────────────────────
    //
    // Il tile del canvas NON è più ridisegnato con primitive SVG: monta il
    // componente `Tile` — lo stesso di Chrono — dentro un `<foreignObject>`.
    //
    // È una scelta, non una scorciatoia. I cinque canali del sistema visivo
    // (bordo, badge d'angolo, strip dei passi, status a sinistra, metadato a
    // destra) vivono in CSS, e due di quelle cose in SVG non si possono fare:
    // i token dello stepper cambiano col tema chiaro/scuro, e un attributo di
    // presentazione SVG non legge `var(--…)`. Riscriverlo con `<rect>` avrebbe
    // prodotto un sosia destinato a divergere alla prima modifica del CSS.
    // Il file usa già `foreignObject` + `renderToString` per icone e badge:
    // questa è la stessa tecnica, applicata all'intera card invece che ai pezzi.
    //
    // Il riquadro è più grande del tile di TILE_BLEED per lato, perché il badge
    // sborda e il foreignObject ritaglia (vedi la costante).
    const formatDate = (iso: string) => new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' });
    const formatTime = (iso: string) => {
      const t = new Date(iso);
      return `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
    };

    /** Metadato del footer, già formattato, secondo quanto il tipo prevede. */
    const metaFor = (d: CanvasNode, key: ReturnType<typeof tileVisualKey>): string | undefined => {
      const kind = TILE_VISUAL[key].meta;
      if (kind === 'none') return undefined;
      if (kind === 'progress') {
        const items = d.subtasks ?? [];
        if (!items.length) return undefined;
        return `${items.filter((s) => s.is_done).length} di ${items.length}`;
      }
      // `deadline` vive su end_at, gli eventi su start_at: stessa regola del
      // resto dell'app (cfr. eventRefIso in chrono-live).
      const iso = key === 'deadline' ? (d.endAt || d.startAt) : (d.startAt || d.endAt);
      if (!iso) return undefined;
      if (kind === 'time') {
        const t = formatTime(iso);
        return d.endAt && d.startAt ? `${formatTime(d.startAt)}–${formatTime(d.endAt)}` : t;
      }
      return formatDate(iso);
    };

    /**
     * Riempita la colonna (`STEPPER_MAX_SEGMENTS`), il Tile mostra un segmento
     * riassuntivo e il conteggio pieno passa nel metadato, che è responsabilità
     * di chi monta la card.
     */
    const stepsFor = (d: CanvasNode): StepState[] | undefined => {
      const items = d.subtasks ?? [];
      if (!items.length) return undefined;
      return items.map(subtaskToStep);
    };

    nodeGrps.each(function (d) {
      const g = d3.select(this);
      const key = tileVisualKey({ action_type: d.actionType as ActionType, all_day: d.allDay });
      // `is_completed` e lo status `done` sono tenuti allineati dal database
      // (migration 015): qui valgono come la stessa cosa, come in Chrono.
      const status: TileStatus = d.isCompleted ? 'done' : ((d.statusName as TileStatus) ?? 'active');
      // L'accento tinge fondo, bordo e badge. Il colore del TIPO ha la
      // precedenza perché è quello con cui il canvas ha sempre velato i tile;
      // senza tipo si ricade sul colore dell'AZIONE, che almeno tiene rossa la
      // scadenza invece di lasciarla a una hairline grigia. Entrambi vengono
      // dalle impostazioni utente: nessun esadecimale scritto qui.
      const accent = d.typeColor || getColor(key);
      const steps = stepsFor(d);
      const meta = metaFor(d, key);

      const fo = g.append('foreignObject')
        .attr('class', 'tile-card')
        .attr('x', -TILE_BLEED).attr('y', -TILE_BLEED)
        .attr('width', TILE_W + TILE_BLEED * 2).attr('height', TILE_H + TILE_BLEED * 2)
        // Il disegno non intercetta il puntatore: click, menu contestuale e
        // trascinamento restano sul gruppo e sul rettangolo di presa qui sotto.
        .style('pointer-events', 'none')
        .style('overflow', 'visible');

      const host = document.createElement('div');
      host.style.cssText = `padding:${TILE_BLEED}px;`;
      try {
        host.innerHTML = renderToString(
          React.createElement(TileCard, {
            title: d.title,
            visualKey: key,
            status,
            steps,
            meta,
            sparks: d.sparks,
            accent,
            focused: d.isFocused,
          }),
        );
      } catch {
        // Una card non renderizzabile non deve rompere la board: il nodo resta
        // selezionabile e trascinabile, semplicemente senza grafica.
      }
      (fo.node() as SVGForeignObjectElement)?.appendChild(host);
    });

    // Rettangolo di PRESA — invisibile, sopra la card. Porta la classe
    // `.tile-bg` perché è il bersaglio che l'evidenziazione del drop-target
    // cerca per disegnarci il contorno di aggancio.
    nodeGrps.append('rect').attr('class', 'tile-bg')
      .attr('width', TILE_W).attr('height', TILE_H).attr('rx', RX)
      .attr('fill', 'transparent')
      .attr('stroke', 'none')
      .style('cursor', moveRef.current ? 'grab' : 'default');


    // Selection ring (toggled per tile based on selectedIds)
    nodeGrps.append('rect').attr('class', 'sel-ring')
      .attr('x', -3).attr('y', -3).attr('width', TILE_W + 6).attr('height', TILE_H + 6).attr('rx', RX_SEL)
      .attr('fill', 'none').attr('stroke', selAccent).attr('stroke-width', 2)
      .style('pointer-events', 'none')
      .attr('opacity', (d) => { const id = (d as CanvasNode).id; return (selectedIdsRef.current.includes(id) || selectedTileIdRef.current === id) ? 1 : 0; });

    // Tile ports
    const portG = nodeGrps.append('g').attr('class', 'ports');
    PORTS.forEach(({ cx, cy }) => { portG.append('circle').attr('class', 'port').attr('cx', cx).attr('cy', cy).attr('r', PORT_R).attr('fill', theme.accent).attr('stroke', theme.bg1).attr('stroke-width', 2).attr('opacity', 0).style('cursor', 'crosshair'); });
    // In hover mostra SOLO il punto di aggancio più vicino al cursore (non tutti
    // e 4). Escluso se il tile è selezionato (solo contorno obsidian) o durante
    // un collegamento attivo.
    nodeGrps.on('mousemove.ports', function (ev) {
      const d = d3.select(this).datum() as CanvasNode;
      const selected = !!d && (selectedTileIdRef.current === d.id || selectedIdsRef.current.includes(d.id));
      if (!linkRef.current || linkSrc.current || selected) { d3.select(this).selectAll('.port').attr('opacity', 0); return; }
      const [mx, my] = d3.pointer(ev, this);
      let best = -1, bestDist = Infinity;
      PORTS.forEach((p, i) => { const dd = (mx - p.cx) ** 2 + (my - p.cy) ** 2; if (dd < bestDist) { bestDist = dd; best = i; } });
      d3.select(this).selectAll<SVGCircleElement, unknown>('.port').attr('opacity', (_d, i) => (i === best ? 1 : 0));
    })
      .on('mouseleave.ports', function () { if (!linkSrc.current) d3.select(this).selectAll('.port').attr('opacity', 0); });

    // Tile port drag
    const portDrag = d3.drag<SVGCircleElement, unknown>().filter(() => linkRef.current)
      .on('start', function (ev) {
        const nd = d3.select((this.parentNode as SVGGElement).parentNode as SVGGElement).datum() as CanvasNode;
        const pcx = parseFloat(d3.select(this).attr('cx')), pcy = parseFloat(d3.select(this).attr('cy'));
        const pk = PORTS.find((p) => p.cx === pcx && p.cy === pcy)?.key as PortKey || 'right';
        startLink(nd.id, nd.x + pcx, nd.y + pcy, pk, ev);
      })
      .on('drag', dragLink)
      .on('end', () => { endLink(); nodeGrps.selectAll('.port').attr('opacity', 0); });
    portG.selectAll('circle.port').call(portDrag as any);

    // Node drag (supports multi-drag including text boxes when the dragged tile is part of selectedIds).
    let dragMultiNodes: CanvasNode[] | null = null;
    let dragMultiSelection: d3.Selection<SVGGElement, CanvasNode, SVGGElement, unknown> | null = null;
    let dragMultiTbs: CanvasTextBox[] | null = null;
    let dragSuppressedBbox = false;
    nodeGrps.call(d3.drag<SVGGElement, CanvasNode>()
      .filter((ev) => !(ev.target as SVGElement).classList?.contains('port') && moveRef.current)
      // Allow generous mouse jitter between mousedown/mouseup to still fire
      // the subsequent click handler (sidebar open). 5 px was too strict —
      // a touchpad tap or a hand-tremor click would slide past it, D3 would
      // suppress the click and the tile selection silently failed. 12 px is
      // wide enough to absorb that without breaking deliberate drags
      // (which are tens-to-hundreds of pixels long).
      .clickDistance(12)
      .on('start', function (_, d) {
        const sel = selectedIdsRef.current;
        if (sel.length > 1 && sel.includes(d.id)) {
          const idSet = new Set(sel);
          dragMultiNodes = nodes.filter((n) => idSet.has(n.id));
          dragMultiSelection = nodeGrps.filter((dd: any) => idSet.has(dd.id));
          dragMultiTbs = textBoxes.filter((tb) => idSet.has(`tb:${tb.id}`));
          dragSuppressedBbox = true;
          onSelectionChangeRef.current?.(sel, null);
        } else {
          dragMultiNodes = null;
          dragMultiSelection = null;
          dragMultiTbs = null;
          dragSuppressedBbox = false;
        }
      })
      .on('drag', function (ev, d) {
        d3.select(this).raise();
        if (dragMultiNodes && dragMultiSelection) {
          const dx = ev.dx, dy = ev.dy;
          for (const n of dragMultiNodes) { n.x += dx; n.y += dy; }
          dragMultiSelection.attr('transform', (dd: any) => `translate(${dd.x},${dd.y})`);
          if (dragMultiTbs && dragMultiTbs.length > 0) {
            const tbIdSet = new Set(dragMultiTbs.map((tb) => tb.id));
            for (const tb of dragMultiTbs) { tb.x += dx; tb.y += dy; }
            tbG.selectAll<SVGGElement, unknown>('g.tb-node').each(function () {
              const id = (this as SVGGElement).getAttribute('data-tb-id');
              if (!id || !tbIdSet.has(id)) return;
              const tb = dragMultiTbs!.find((t) => t.id === id);
              if (tb) d3.select(this).attr('transform', `translate(${tb.x},${tb.y})`);
            });
          }
        } else {
          d.x = ev.x; d.y = ev.y;
          d3.select(this).attr('transform', `translate(${d.x},${d.y})`);
        }
        drawEdges(); drawGroups();
        // INNESTO. Come per i marcatori, e solo trascinando UN tile per volta:
        // spezzare un collegamento cambia la struttura del grafo e va chiesto
        // con un gesto preciso, non spostando cinque cose insieme sopra la
        // lavagna. La sonda va DOPO `drawEdges`, che è ciò che rifà la geometria
        // su cui misura: prima leggerebbe le linee di un fotogramma fa.
        if (!dragMultiNodes && onSplitEdgeRef.current) {
          probeSplit(d.x + TILE_W / 2, d.y + TILE_H / 2, d.id, TILE_W, TILE_H);
        }
        // Publish the live pointer position so the parent can highlight the
        // staging panel when the cursor enters it during the drag.
        const srcEv = ev?.sourceEvent as MouseEvent | PointerEvent | undefined;
        if (srcEv) onTileDragMoveRef.current?.(srcEv.clientX, srcEv.clientY);
      })
      .on('end', (ev, d) => {
        // Determine the drop zone. If the gesture ended over the staging
        // panel (hosted outside the SVG), drop the dragged tiles from the
        // canvas layout instead of saving their new position.
        const sourceEv = ev?.sourceEvent as MouseEvent | PointerEvent | undefined;
        const isStagingDrop = !!(
          sourceEv &&
          isOverStagingRef.current &&
          isOverStagingRef.current(sourceEv.clientX, sourceEv.clientY)
        );
        const draggedIds = dragMultiNodes ? dragMultiNodes.map((n) => n.id) : [d.id];

        if (isStagingDrop) {
          // Send the dragged tile(s) back to the staging panel. The parent
          // updates canvas_layout accordingly; we still write a stripped
          // position list so the visual matches the data immediately.
          const removedSet = new Set(draggedIds);
          onPositionChangeRef.current(
            nodes
              .filter((n) => !removedSet.has(n.id))
              .map((n) => ({ tile_id: n.id, x: n.x, y: n.y })),
          );
          onTilesRemovedFromCanvasRef.current?.(draggedIds);
        } else {
          onPositionChangeRef.current(nodes.map((n) => ({ tile_id: n.id, x: n.x, y: n.y })));
        }

        // Persist text-box positions if they moved as part of a multi-drag
        if (dragMultiTbs) {
          for (const tb of dragMultiTbs) {
            onUpdateTextBoxRef.current(tb.id, { x: tb.x, y: tb.y });
          }
        }
        if (dragSuppressedBbox) {
          onSelectionChangeRef.current?.(selectedIdsRef.current, computeSelectionScreenBbox());
        }
        // Drag ended — notify the parent so it can clear any drag-state UI
        // (e.g. the staging panel highlight). Fires regardless of drop zone.
        onTileDragEndRef.current?.();
        const wasMulti = !!dragMultiNodes;
        dragMultiNodes = null;
        dragMultiSelection = null;
        dragMultiTbs = null;
        dragSuppressedBbox = false;
        // INNESTO — si compie al RILASCIO, non allo scadere dell'attesa: spezzare
        // l'edge a mano ancora premuta riscriverebbe i dati a metà gesto, e il
        // ridisegno che ne segue staccherebbe il trascinamento in corso
        // riportando il tile dov'era partito. L'attesa arma, la mano che si apre
        // conferma.
        // `clearSplit` va chiamato SEMPRE, anche uscendo di qui: lascia indietro
        // un timer e un edge acceso, e il prossimo trascinamento troverebbe la
        // lavagna già armata su un collegamento che non stava toccando.
        const armedSplit = clearSplit();
        if (armedSplit && !wasMulti && !isStagingDrop) {
          onSplitEdgeRef.current?.(armedSplit, d.id);
        } else if (armedSplit) {
          drawEdges();
        }
        // Drop-into-group only for single-tile drag that didn't go to staging.
        if (wasMulti || isStagingDrop) return;
        const cx = d.x + TILE_W / 2, cy = d.y + TILE_H / 2;
        const currentGroups = groupsRef.current;
        const alreadyIn = currentGroups.find((g) => g.nodeIds.includes(d.id));
        if (!alreadyIn) {
          for (const g of currentGroups) {
            const b = getGroupBounds(g, nodes);
            if (!b) continue;
            if (cx >= b.x && cx <= b.x + b.w && cy >= b.y - LABEL_H && cy <= b.y + b.h) {
              const updated = currentGroups.map((grp) =>
                grp.id === g.id ? { ...grp, nodeIds: [...grp.nodeIds, d.id] } : grp
              );
              onGroupsChangeRef.current(updated);
              break;
            }
          }
        }
      }));


    // ── Text boxes ──
    const tbG = board.append('g').attr('class', 'textboxes');

    // Move the corresponding HTML overlay div in sync with a D3 drag/resize.
    // React only re-renders the overlay when textBoxes prop CHANGES (server
    // round-trip), so during drag we update style directly to keep the editor
    // glued to the D3-drawn box frame.
    const syncOverlayBox = (tb: CanvasTextBox) => {
      const el = overlayInnerRef.current?.querySelector(`[data-box-id="${tb.id}"]`) as HTMLElement | null;
      if (!el) return;
      el.style.left = `${tb.x + TB_PAD}px`;
      el.style.top = `${tb.y + TB_PAD}px`;
      el.style.width = `${tb.w - 2 * TB_PAD}px`;
      el.style.height = `${tb.h - 2 * TB_PAD}px`;
    };

    const drawTextBoxes = () => {
      // Text editors live in the HTML overlay below the SVG, so this redraw
      // only handles the SVG-side frame: background rect, selection ring,
      // ports, and (for image boxes) the foreignObject <img>. No React mount
      // here, so no unmount conflicts.
      tbG.selectAll('*').remove();
      textBoxes.forEach((tb) => {
        const tw = tb.w, th = tb.h;
        const g = tbG.append('g').attr('transform', `translate(${tb.x},${tb.y})`).attr('class', 'tb-node').attr('data-tb-id', tb.id);

        // Background — i box di testo possono avere un colore di sfondo scelto
        // dalla TextSidebar (stessa palette dei gruppi); default = theme.surface.
        const bgFill = tb.type === 'text' && tb.content.bgColor ? tb.content.bgColor : theme.surface;
        // Il box di TESTO è squadrato e porta la stessa hairline dei tile
        // (`--ob-tile-border`, già risolta in un colore concreto più su): sulla
        // lavagna sta accanto a loro, e due contorni diversi lo facevano
        // leggere come un oggetto di un altro sistema. L'IMMAGINE no: quella
        // resta arrotondata, perché il suo riquadro è una cornice attorno a un
        // contenuto, non una scheda.
        const isTextBox = tb.type === 'text';
        const isMarker = tb.type === 'marker';
        const isSubject = tb.type === 'subject';
        // Marcatore e soggetto sono TONDI e piccoli, e tutto il resto del file
        // li tratta allo stesso modo: niente maniglie di ridimensionamento
        // (la misura è quella e basta) e anello di selezione a raggio pieno.
        const isDisc = isMarker || isSubject;
        if (isSubject) {
          // Disco di superficie con la figura di una persona: vedi `paintSubject`
          // per il perché non è colorato come i marcatori.
          paintSubject(g.node()!, tw, th);
          // La DENOMINAZIONE sotto il disco, con la stessa didascalia del
          // marcatore: un'icona anonima su una lavagna con quattro persone non
          // dice niente, ed è l'unico dei quattro campi che si legge da lontano.
          const sName = ((tb.content as { name?: string }).name || '').trim();
          if (sName) paintBoxLabel(g.node()!, sName, tw, th, theme.ink);
        } else if (isMarker) {
          // Fondo ROTONDO. Il riquadro resta quadrato (w = h = MARKER_SIZE) e il
          // disco ci sta dentro: le porte degli edge, i contorni dei gruppi e la
          // selezione continuano a ragionare su x/y/w/h senza sapere che qui la
          // forma è un cerchio.
          const mk = resolveMarkerKind((tb.content as { kind?: string }).kind);
          // Disco PIENO, senza contorno: il colore è la forma. Prima era un
          // anello — fondo della carta e bordo colorato — e a 36px il colore si
          // riduceva a un filo di 2px, che su una lavagna piena di tile e box
          // non bastava a farne un punto notevole.
          // Lo stop fa eccezione: è una X nuda, senza disco (`MARKER_SPEC`).
          paintMarker(g.node()!, mk, tw, th);
          // La didascalia: sotto il disco, centrata, larga quanto un tile e
          // troncata alla terza riga (vedi `paintMarkerLabel`).
          const mLabel = ((tb.content as { label?: string }).label || '').trim();
          if (mLabel) paintBoxLabel(g.node()!, mLabel, tw, th, theme.ink);
        } else {
          g.append('rect')
            .attr('width', tw).attr('height', th).attr('rx', isTextBox ? 0 : RX)
            .attr('fill', bgFill)
            .attr('stroke', isTextBox ? tileBorder : theme.border)
            .attr('stroke-width', SW);
        }

        // Selection ring (toggled per text box based on selectedIds)
        // Segue il raggio del riquadro che circonda: su un box squadrato un
        // anello stondato si stacca agli angoli invece di seguirlo.
        g.append('rect').attr('class', 'sel-ring')
          // Raggio pieno sul marcatore: un anello quadrato attorno a un disco
          // lascerebbe quattro angoli vuoti.
          .attr('x', -3).attr('y', -3).attr('width', tw + 6).attr('height', th + 6)
          .attr('rx', isDisc ? (tw + 6) / 2 : (isTextBox ? 0 : RX_SEL))
          .attr('fill', 'none').attr('stroke', selAccent).attr('stroke-width', 2)
          .style('pointer-events', 'none')
          .attr('opacity', (selectedIdsRef.current.includes(`tb:${tb.id}`) || selectedTextBoxIdRef.current === tb.id) ? 1 : 0);

        // Type-specific content. Image stays in SVG via foreignObject (lightweight,
        // no React state). Text editors are rendered in the HTML overlay (sibling
        // of <svg>) — see the JSX at the bottom of this component. The overlay
        // already covers the inner editor area; here we only need to leave the
        // box's TB_PAD margin clickable for D3 drag.
        if (tb.type === 'image') {
          // Image inset by IMG_PAD on every side for a thin frame around the
          // picture (the box border + a small breathing margin = a "polaroid"
          // look). page.tsx adds 2*IMG_PAD to the box dimensions so the inner
          // image area still matches the picture's natural aspect ratio.
          const IMG_PAD = 2;
          const title = (tb.content.title || '').trim();
          const fo = g.append('foreignObject')
            .attr('x', IMG_PAD).attr('y', IMG_PAD)
            .attr('width', tw - IMG_PAD * 2).attr('height', th - IMG_PAD * 2)
            .style('pointer-events', 'none');
          fo.append('xhtml:img')
            .attr('src', tb.content.src)
            .attr('alt', tb.content.alt || title)
            .attr('style', 'display:block;width:100%;height:100%;object-fit:fill;pointer-events:none;user-select:none;-webkit-user-drag:none;');
          if (tb.content.showTitle && title) {
            // Titolo FUORI dal box, appoggiato sopra il bordo e allineato a
            // sinistra — come l'etichetta di un gruppo. La foto si riprende
            // tutto il riquadro (e con esso le sue proporzioni).
            // Il riquadro dei gruppi tiene conto di questa fascia: vedi
            // getGroupRects, che alza di CAPTION_H il rettangolo di
            // un'immagine col titolo acceso.
            const maxChars = Math.max(3, Math.floor(tw / (CAPTION_FS * 0.55)));
            const label = title.length > maxChars ? `${title.slice(0, maxChars - 1)}…` : title;
            g.append('text')
              .attr('x', 0).attr('y', -6)
              .attr('fill', theme.ink)
              .attr('font-size', CAPTION_FS)
              .attr('font-weight', OB_WEIGHT.emphasis)
              .style('pointer-events', 'none')
              .text(label);
          }
          // Il titolo si legge anche col flag spento, passandoci sopra: il
          // tooltip nativo non occupa spazio sulla lavagna.
          if (title) g.append('title').text(title);
        }

        // CTRL/CMD/SHIFT + click → toggle nella multi-selezione. Click semplice →
        // seleziona SOLO questo box (contorno obsidian, senza menu), come i tile.
        g.on('click.select', (ev: MouseEvent) => {
          const tbId = `tb:${tb.id}`;
          if (ev.ctrlKey || ev.metaKey || ev.shiftKey) {
            ev.stopPropagation();
            const cur = selectedIdsRef.current;
            const has = cur.includes(tbId);
            const next = has ? cur.filter((id) => id !== tbId) : [...cur, tbId];
            selectedIdsRef.current = next;
            onSelectionChangeRef.current?.(next, next.length ? computeSelectionScreenBbox() : null);
            return;
          }
          ev.stopPropagation();
          onTextBoxClickRef.current?.(tb.id);
        });

        // 4 ports
        const tbPorts = g.append('g').attr('class', 'tb-ports');
        const tbPortList = [
          { key: 'top', cx: tw / 2, cy: 0 },
          { key: 'right', cx: tw, cy: th / 2 },
          { key: 'bottom', cx: tw / 2, cy: th },
          { key: 'left', cx: 0, cy: th / 2 },
        ];
        tbPortList.forEach(({ key, cx, cy }) => {
          tbPorts.append('circle').attr('class', 'port').attr('cx', cx).attr('cy', cy)
            .attr('r', PORT_R).attr('fill', theme.accent).attr('stroke', theme.bg1).attr('stroke-width', 2)
            .attr('opacity', 0).style('cursor', 'crosshair');
        });

        // In hover mostra SOLO il punto più vicino al cursore (non tutti e 4).
        // Escluso in selezione (contorno obsidian) o durante un link attivo.
        g.on('mousemove.ports', function (ev) {
          const selected = selectedIdsRef.current.includes(`tb:${tb.id}`) || selectedTextBoxIdRef.current === tb.id;
          if (!linkRef.current || linkSrc.current || selected) { tbPorts.selectAll('.port').attr('opacity', 0); return; }
          const [mx, my] = d3.pointer(ev, this);
          let best = -1, bestDist = Infinity;
          tbPortList.forEach((p, i) => { const dd = (mx - p.cx) ** 2 + (my - p.cy) ** 2; if (dd < bestDist) { bestDist = dd; best = i; } });
          tbPorts.selectAll<SVGCircleElement, unknown>('.port').attr('opacity', (_d, i) => (i === best ? 1 : 0));
        });
        g.on('mouseleave.ports', () => { if (!linkSrc.current) tbPorts.selectAll('.port').attr('opacity', 0); });

        // Port drag on text box
        const tbPortDrag = d3.drag<SVGCircleElement, unknown>().filter(() => linkRef.current)
          .on('start', function (ev) {
            const pcx = parseFloat(d3.select(this).attr('cx')), pcy = parseFloat(d3.select(this).attr('cy'));
            const pk = tbPortList.find((p) => p.cx === pcx && p.cy === pcy)?.key || 'right';
            startLink(`tb:${tb.id}`, tb.x + pcx, tb.y + pcy, `t:${pk}`, ev);
          })
          .on('drag', dragLink)
          .on('end', () => { endLink(); tbPorts.selectAll('.port').attr('opacity', 0); });
        tbPorts.selectAll('circle.port').call(tbPortDrag as any);

        // Drag to move (on background rect, not on ports/resize/text). Supports multi-drag
        // when this text box is part of selectedIds (moves all selected tiles + text boxes).
        // Cursore "move" (freccia di spostamento) quando il box non è in editing.
        g.select('rect').style('cursor', moveRef.current ? 'move' : 'default');
        g.call((() => {
          let prev: [number, number] | null = null;
          let multi = false;
          let mTiles: CanvasNode[] = [];
          let mTbs: CanvasTextBox[] = [];
          return d3.drag<SVGGElement, unknown>()
            .filter((ev) => {
              const el = ev.target as SVGElement | HTMLElement;
              if (el.classList?.contains('port')) return false;
              if (el.classList?.contains('tb-resize')) return false;
              if ((el as HTMLElement)?.getAttribute?.('contenteditable')) return false;
              return moveRef.current;
            })
            // Stessa tolleranza dei tile (`clickDistance(12)` sopra), e per lo
            // stesso motivo: senza, il default di D3 è ZERO px — un pixel di
            // tremolio fra mousedown e mouseup e il click che segue viene
            // soppresso. Il click sul box è quello che lo mette in selezione,
            // quindi un CTRL+click su un'immagine "non faceva niente": la
            // selezione restava col solo tile e "Crea gruppo" restava grigio.
            .clickDistance(12)
            .on('start', (ev) => {
              prev = d3.pointer(ev.sourceEvent, boardNode) as [number, number];
              const sel = selectedIdsRef.current;
              const tbId = `tb:${tb.id}`;
              multi = sel.length > 1 && sel.includes(tbId);
              if (multi) {
                const idSet = new Set(sel);
                mTiles = nodes.filter((n) => idSet.has(n.id));
                mTbs = textBoxes.filter((t) => idSet.has(`tb:${t.id}`));
                onSelectionChangeRef.current?.(sel, null); // hide menu during drag
              } else {
                mTiles = []; mTbs = [];
              }
            })
            .on('drag', (ev) => {
              const cur = d3.pointer(ev.sourceEvent, boardNode) as [number, number];
              if (!prev) { prev = cur; return; }
              const dx = cur[0] - prev[0], dy = cur[1] - prev[1];
              prev = cur;
              // L'editor di testo vive nell'overlay HTML (fuori dall'SVG) ed è
              // posizionato da React solo a fine drag: qui aggiorniamo la sua
              // posizione in tempo reale così il testo segue il frame D3.
              const syncOverlay = (id: string, x: number, y: number) => {
                const el = overlayInnerRef.current?.querySelector(`[data-box-id="${id}"]`) as HTMLElement | null;
                if (el) { el.style.left = `${x + TB_PAD}px`; el.style.top = `${y + TB_PAD}px`; }
              };
              if (multi) {
                for (const n of mTiles) { n.x += dx; n.y += dy; }
                for (const t of mTbs) { t.x += dx; t.y += dy; }
                const tIdSet = new Set(mTiles.map((n) => n.id));
                nodeGrps.filter((dd: any) => tIdSet.has(dd.id))
                  .attr('transform', (dd: any) => `translate(${dd.x},${dd.y})`);
                const tbIdSet = new Set(mTbs.map((t) => t.id));
                tbG.selectAll<SVGGElement, unknown>('g.tb-node').each(function () {
                  const id = (this as SVGGElement).getAttribute('data-tb-id');
                  if (!id || !tbIdSet.has(id)) return;
                  const t = mTbs.find((tt) => tt.id === id);
                  if (t) { d3.select(this).attr('transform', `translate(${t.x},${t.y})`); syncOverlay(t.id, t.x, t.y); }
                });
              } else {
                tb.x += dx; tb.y += dy;
                g.attr('transform', `translate(${tb.x},${tb.y})`);
                syncOverlay(tb.id, tb.x, tb.y);
              }
              // Un'immagine può essere membro di un gruppo: il contorno del
              // gruppo la segue mentre la si sposta, come per i tile.
              drawEdges(); drawGroups();
              // INNESTO. Solo i marcatori, e solo trascinati da soli: spezzare
              // un edge cambia la struttura del grafo, e va chiesto con un gesto
              // preciso su un oggetto piccolo — non trascinando cinque cose
              // insieme o passandoci sopra un'immagine larga.
              if (!multi && tb.type === 'marker' && onSplitEdgeRef.current) {
                probeSplit(tb.x + tb.w / 2, tb.y + tb.h / 2, `tb:${tb.id}`, tb.w, tb.h);
              }
            })
            .on('end', () => {
              prev = null;
              if (multi) {
                onPositionChangeRef.current(nodes.map((n) => ({ tile_id: n.id, x: n.x, y: n.y })));
                for (const t of mTbs) {
                  onUpdateTextBoxRef.current(t.id, { x: t.x, y: t.y });
                }
                onSelectionChangeRef.current?.(selectedIdsRef.current, computeSelectionScreenBbox());
              } else {
                if (tb.type === 'text') {
                  // Latest HTML is kept in tb.content.html by TextEditor's onChange.
                  onUpdateTextBoxRef.current(tb.id, { x: tb.x, y: tb.y, content: { html: tb.content.html ?? '' } });
                } else {
                  onUpdateTextBoxRef.current(tb.id, { x: tb.x, y: tb.y });
                }
              }
              const wasMulti = multi;
              multi = false; mTiles = []; mTbs = [];
              // L'innesto si compie al RILASCIO, non allo scadere dell'attesa:
              // spezzare l'edge a mano ancora premuta avrebbe riscritto i dati a
              // metà gesto, e il ridisegno che ne segue avrebbe staccato il
              // trascinamento in corso, riportando l'oggetto dov'era partito.
              // L'attesa arma, la mano che si apre conferma.
              const armed = clearSplit();
              if (armed && !wasMulti && tb.type === 'marker') {
                onSplitEdgeRef.current?.(armed, `tb:${tb.id}`);
              } else if (armed) {
                drawEdges();
              }
              // ── Drop-into-group ──
              // Stesso gesto dei tile: un BOX lasciato cadere dentro un gruppo
              // (drag singolo, centro del box dentro il riquadro) ne diventa
              // membro. Testo, immagine e soggetto allo stesso modo; i
              // marcatori restano fuori (vedi `isGroupableBox`).
              if (wasMulti || !isGroupableBox(tb)) return;
              const memberId = `${BOX_ID_PREFIX}${tb.id}`;
              const currentGroups = groupsRef.current;
              if (currentGroups.some((gr) => gr.nodeIds.includes(memberId))) return;
              const cx = tb.x + tb.w / 2, cy = tb.y + tb.h / 2;
              for (const gr of currentGroups) {
                const b = getGroupBounds(gr, nodes);
                if (!b) continue;
                if (cx >= b.x && cx <= b.x + b.w && cy >= b.y - LABEL_H && cy <= b.y + b.h) {
                  onGroupsChangeRef.current(currentGroups.map((gg) =>
                    gg.id === gr.id ? { ...gg, nodeIds: [...gg.nodeIds, memberId] } : gg
                  ));
                  break;
                }
              }
            });
        })() as any);

        // L'editor (overlay HTML) va tenuto allineato a posizione E dimensione
        // del frame SVG durante il resize: React aggiorna il div solo a fine
        // drag, quindi qui lo sincronizziamo in tempo reale.
        const syncOverlayBox = () => {
          const el = overlayInnerRef.current?.querySelector(`[data-box-id="${tb.id}"]`) as HTMLElement | null;
          if (!el) return;
          el.style.left = `${tb.x + TB_PAD}px`;
          el.style.top = `${tb.y + TB_PAD}px`;
          el.style.width = `${tb.w - 2 * TB_PAD}px`;
          el.style.height = `${tb.h - 2 * TB_PAD}px`;
        };

        // ── Maniglie di ridimensionamento ──────────────────────────────────
        // Ci sono sempre state, ma trasparenti: un'affordance che non si vede
        // non esiste. Ora, quando il box è selezionato, compaiono i quadratini
        // — quattro sui bordi (stirano) e quattro sugli ANGOLI (scala uniforme,
        // e per un'immagine riporta il box alle proporzioni vere della foto).
        // `tb-handle` è la classe che l'effect di selezione accende e spegne
        // senza ridisegnare l'SVG.
        const HS = 8;
        const tbSelected = selectedIdsRef.current.includes(`tb:${tb.id}`) || selectedTextBoxIdRef.current === tb.id;
        // Maniglie sui BORDI: solo per i box di testo. Su un'immagine stiravano
        // una dimensione sola — cioè l'unica cosa che il ridimensionamento di
        // una foto non deve fare. Restare come scorciatoia per una scala
        // uniforme sarebbe stato peggio che toglierle: quattro prese che
        // promettono "allarga in orizzontale" e ne fanno un'altra. Sull'immagine
        // il ridimensionamento sta tutto negli angoli, e i punti a metà bordo
        // tornano a essere quello che sembrano: i nodi di aggancio degli archi.
        const RESIZE_W = 6;
        // Il MARCATORE non si ridimensiona affatto: è un simbolo di misura
        // fissa, e stirarlo darebbe un'ellisse col disco fuori centro (il
        // cerchio è tracciato su `min(w,h)` ma centrato su `w/2, h/2`). I punti
        // a metà bordo gli restano come nodi d'aggancio degli archi, che è
        // l'unica cosa che deve sapere fare oltre a stare dov'è.
        const resizeEdges = (tb.type === 'image' || isDisc) ? [] : [
          { key: 'right', x: tw - RESIZE_W / 2, y: PORT_R + 4, w: RESIZE_W, h: th - PORT_R * 2 - 8, cursor: 'ew-resize' },
          { key: 'bottom', x: PORT_R + 4, y: th - RESIZE_W / 2, w: tw - PORT_R * 2 - 8, h: RESIZE_W, cursor: 'ns-resize' },
          { key: 'left', x: -RESIZE_W / 2, y: PORT_R + 4, w: RESIZE_W, h: th - PORT_R * 2 - 8, cursor: 'ew-resize' },
          { key: 'top', x: PORT_R + 4, y: -RESIZE_W / 2, w: tw - PORT_R * 2 - 8, h: RESIZE_W, cursor: 'ns-resize' },
        ];
        resizeEdges.forEach(({ key: rk, x: rx, y: ry, w: rw, h: rh, cursor }) => {
          const handle = g.append('rect')
            .attr('class', 'tb-resize')
            .attr('x', rx).attr('y', ry).attr('width', rw).attr('height', rh)
            .attr('fill', 'transparent').style('cursor', cursor);

          let resizeStart: { mx: number; my: number; ow: number; oh: number; ox: number; oy: number } | null = null;

          handle.call(d3.drag<SVGRectElement, unknown>()
            .on('start', (ev) => {
              ev.sourceEvent.stopPropagation();
              const [mx, my] = d3.pointer(ev.sourceEvent, boardNode);
              resizeStart = { mx, my, ow: tb.w, oh: tb.h, ox: tb.x, oy: tb.y };
            })
            .on('drag', (ev) => {
              if (!resizeStart) return;
              const [mx, my] = d3.pointer(ev.sourceEvent, boardNode);
              const dx = mx - resizeStart.mx, dy = my - resizeStart.my;
              // Un'IMMAGINE non si stira: il bordo che trascini SCALA il box,
              // l'altra dimensione lo segue e il rapporto resta quello che era
              // a inizio gesto. Il box è il ritaglio della foto, stirarlo la
              // deformava. Un box di TESTO invece è un contenitore: lì
              // larghezza e altezza restano indipendenti.
              //
              // Per l'immagine il limite minimo si applica alla SCALA, non alle
              // due dimensioni separatamente: clampare w e h ognuna per conto
              // suo è proprio il modo in cui il rapporto si rompe.
              const isImg = tb.type === 'image';
              const minScale = Math.max(TB_MIN_W / resizeStart.ow, TB_MIN_H / resizeStart.oh);
              const scaled = (s: number) => {
                const k = Math.max(s, minScale);
                tb.w = resizeStart!.ow * k;
                tb.h = resizeStart!.oh * k;
              };
              if (rk === 'right') {
                if (isImg) scaled((resizeStart.ow + dx) / resizeStart.ow);
                else tb.w = Math.max(TB_MIN_W, resizeStart.ow + dx);
              } else if (rk === 'bottom') {
                if (isImg) scaled((resizeStart.oh + dy) / resizeStart.oh);
                else tb.h = Math.max(TB_MIN_H, resizeStart.oh + dy);
              } else if (rk === 'left') {
                if (isImg) scaled((resizeStart.ow - dx) / resizeStart.ow);
                else tb.w = Math.max(TB_MIN_W, resizeStart.ow - dx);
                // Il bordo destro resta fermo.
                tb.x = resizeStart.ox + resizeStart.ow - tb.w;
              } else if (rk === 'top') {
                if (isImg) scaled((resizeStart.oh - dy) / resizeStart.oh);
                else tb.h = Math.max(TB_MIN_H, resizeStart.oh - dy);
                // Il bordo inferiore resta fermo.
                tb.y = resizeStart.oy + resizeStart.oh - tb.h;
              }
              // Redraw this text box (+ il gruppo, se il box ne fa parte: il
              // riquadro si auto-dimensiona sul contenuto).
              drawTextBoxes();
              drawEdges();
              drawGroups();
              syncOverlayBox();
            })
            .on('end', () => {
              resizeStart = null;
              if (tb.type === 'text') {
                onUpdateTextBoxRef.current(tb.id, { x: tb.x, y: tb.y, w: tb.w, h: tb.h, content: { html: tb.content.html ?? '' } });
              } else {
                onUpdateTextBoxRef.current(tb.id, { x: tb.x, y: tb.y, w: tb.w, h: tb.h });
              }
            }) as any);
        });

        // Pallini visibili a metà bordo: la presa è la striscia invisibile qui
        // sopra, questi sono solo il suo segno (pointer-events: none, così non
        // rubano il drag alla striscia né il click alla porta). Niente sulle
        // immagini: là quelle strisce non esistono più.
        ((tb.type === 'image' || isDisc) ? [] : [
          { hx: tw, hy: th / 2 }, { hx: tw / 2, hy: th },
          { hx: 0, hy: th / 2 }, { hx: tw / 2, hy: 0 },
        ]).forEach(({ hx, hy }) => {
          g.append('rect').attr('class', 'tb-handle')
            .attr('x', hx - HS / 2).attr('y', hy - HS / 2).attr('width', HS).attr('height', HS).attr('rx', 2)
            .attr('fill', selAccent).attr('stroke', theme.ink3).attr('stroke-width', 1)
            .attr('opacity', tbSelected ? 1 : 0)
            .style('pointer-events', 'none');
        });

        // Angoli: scala tenendo fermo l'angolo OPPOSTO. Prima ce n'era uno solo
        // (in basso a destra) e invisibile.
        const corners = isDisc ? [] : [
          { key: 'br', hx: tw, hy: th, cursor: 'nwse-resize' },
          { key: 'bl', hx: 0, hy: th, cursor: 'nesw-resize' },
          { key: 'tr', hx: tw, hy: 0, cursor: 'nesw-resize' },
          { key: 'tl', hx: 0, hy: 0, cursor: 'nwse-resize' },
        ];
        corners.forEach(({ key: ck, hx, hy, cursor }) => {
          const cornerHandle = g.append('rect')
            .attr('class', 'tb-resize tb-handle')
            .attr('x', hx - HS / 2).attr('y', hy - HS / 2).attr('width', HS).attr('height', HS).attr('rx', 2)
            .attr('fill', selAccent).attr('stroke', theme.ink3).attr('stroke-width', 1)
            // Invisibile finché il box non è selezionato, ma sempre afferrabile
            // (l'opacità non toglie gli eventi): il gesto di prima non si perde.
            .attr('opacity', tbSelected ? 1 : 0)
            .style('cursor', cursor);

          // Verso in cui l'angolo "cresce": +1 se allontanandosi dall'ancora si
          // allarga, -1 se il bordo che si trascina è quello opposto.
          const sx = (ck === 'br' || ck === 'tr') ? 1 : -1;
          const sy = (ck === 'br' || ck === 'bl') ? 1 : -1;

          let cornerStart: { mx: number; my: number; ow: number; oh: number; ax: number; ay: number } | null = null;
          cornerHandle.call(d3.drag<SVGRectElement, unknown>()
            .on('start', (ev) => {
              ev.sourceEvent.stopPropagation();
              const [mx, my] = d3.pointer(ev.sourceEvent, boardNode);
              // Nessuno scatto iniziale: il box conserva il rapporto che ha.
              // (Per rimettere in squadra una foto già deformata c'è
              // "Ripristina proporzioni" nella sidebar dell'immagine: è una
              // decisione, non un effetto collaterale del ridimensionare.)
              const ax = sx === 1 ? tb.x : tb.x + tb.w;
              const ay = sy === 1 ? tb.y : tb.y + tb.h;
              cornerStart = { mx, my, ow: tb.w, oh: tb.h, ax, ay };
            })
            .on('drag', (ev) => {
              if (!cornerStart) return;
              const [mx, my] = d3.pointer(ev.sourceEvent, boardNode);
              const dx = (mx - cornerStart.mx) * sx;
              const dy = (my - cornerStart.my) * sy;
              if (tb.type === 'image') {
                // Scala uniforme: la foto non si deforma mai. Il minimo è sulla
                // scala (vedi le maniglie dei bordi): clampare w e h separate
                // romperebbe il rapporto proprio al limite.
                const scale = Math.max(
                  (cornerStart.ow + dx) / cornerStart.ow,
                  (cornerStart.oh + dy) / cornerStart.oh,
                  TB_MIN_W / cornerStart.ow,
                  TB_MIN_H / cornerStart.oh,
                );
                tb.w = cornerStart.ow * scale;
                tb.h = cornerStart.oh * scale;
              } else {
                tb.w = Math.max(TB_MIN_W, cornerStart.ow + dx);
                tb.h = Math.max(TB_MIN_H, cornerStart.oh + dy);
              }
              // L'angolo opposto resta dov'è.
              tb.x = sx === 1 ? cornerStart.ax : cornerStart.ax - tb.w;
              tb.y = sy === 1 ? cornerStart.ay : cornerStart.ay - tb.h;
              drawTextBoxes();
              drawEdges();
              drawGroups();
              syncOverlayBox();
            })
            .on('end', () => {
              cornerStart = null;
              // x/y vanno salvate: da tre angoli su quattro l'origine si sposta.
              if (tb.type === 'text') {
                onUpdateTextBoxRef.current(tb.id, { x: tb.x, y: tb.y, w: tb.w, h: tb.h, content: { html: tb.content.html ?? '' } });
              } else {
                onUpdateTextBoxRef.current(tb.id, { x: tb.x, y: tb.y, w: tb.w, h: tb.h });
              }
            }) as any);
        });

        // Le porte (nodi di aggancio) stanno al centro dei bordi, dove passano
        // anche le maniglie di resize. Portandole in cima vincono l'interazione
        // nel loro punto → il nodo di aggancio resta afferrabile (non lo copre
        // la maniglia di stretch).
        tbPorts.raise();

        // Context menu
        g.on('contextmenu', (ev: MouseEvent) => {
          ev.preventDefault(); ev.stopPropagation();
          onTextBoxContextMenuRef.current({
            x: ev.clientX, y: ev.clientY, textBoxId: tb.id,
            inGroup: groupsRef.current.some((gr) => gr.nodeIds.includes(`${BOX_ID_PREFIX}${tb.id}`)),
          });
        });

        // Doppio click su un box di testo → entra in inserimento testo. Con
        // l'overlay non interattivo (modalità sposta) il dblclick passa al
        // gruppo D3; qui attiviamo l'editing (l'overlay diventa interattivo).
        if (tb.type === 'text') {
          g.on('dblclick', (ev: MouseEvent) => {
            ev.preventDefault(); ev.stopPropagation();
            setEditingBoxIdRef.current(tb.id);
          });
        }
      });
    };
    drawTextBoxes();

    // Drag on background to draw a new box in text/image mode. The same dashed
    // outline is reused for both modes; the mode active at mouseup decides
    // whether to insert a text box or open a file picker for an image box.
    const tbDrawRect = board.append('rect')
      .attr('fill', theme.surface).attr('fill-opacity', 0.6).attr('stroke', theme.accent).attr('stroke-width', 2)
      .attr('stroke-dasharray', '4,3').attr('opacity', 0);
    let tbStart: [number, number] | null = null;
    let tbStartMode: 'text' | 'image' | null = null;

    d3svg.on('mousedown.tb', (e: MouseEvent) => {
      const isTxt = textModeRef.current;
      const isImg = imageModeRef.current;
      if ((!isTxt && !isImg) || e.button !== 0 || e.target !== svg) return;
      e.preventDefault();
      const [mx, my] = d3.pointer(e, boardNode);
      tbStart = [mx, my];
      tbStartMode = isTxt ? 'text' : 'image';
      tbDrawRect.attr('x', mx).attr('y', my).attr('width', 0).attr('height', 0).attr('opacity', 1);
    });
    d3svg.on('mousemove.tb', (e: MouseEvent) => {
      if (!tbStart) return;
      const [mx, my] = d3.pointer(e, boardNode);
      tbDrawRect
        .attr('x', Math.min(tbStart[0], mx)).attr('y', Math.min(tbStart[1], my))
        .attr('width', Math.abs(mx - tbStart[0])).attr('height', Math.abs(my - tbStart[1]));
    });
    d3svg.on('mouseup.tb', (e: MouseEvent) => {
      if (!tbStart) return;
      const [mx, my] = d3.pointer(e, boardNode);
      const x = Math.min(tbStart[0], mx);
      const y = Math.min(tbStart[1], my);
      const w = Math.abs(mx - tbStart[0]);
      const h = Math.abs(my - tbStart[1]);
      const mode = tbStartMode;
      tbStart = null;
      tbStartMode = null;
      tbDrawRect.attr('opacity', 0);
      if (w < 30 || h < 20) return;
      if (mode === 'text') {
        onAddTextBoxRef.current(x, y, w, h);
      } else if (mode === 'image') {
        // Open file picker; on selection the parent uploads + inserts at (x,y,w,h).
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = () => {
          const file = input.files?.[0];
          if (file && onAddImageBoxRef.current) onAddImageBoxRef.current(file, x, y, w, h);
        };
        input.click();
      }
    });

    // ── IL GHOST DELL'OGGETTO ARMATO ─────────────────────────────────────────
    // Con uno strumento armato il click cambia significato, e finché non si
    // clicca non si vede né COSA si sta per posare né DOVE. Il ghost è l'oggetto
    // vero, disegnato dallo stesso pittore e velato: quello che si vede sotto il
    // cursore è quello che resta sulla lavagna.
    //
    // Sta dentro `board`, cioè sotto la trasformazione dello zoom: così è grande
    // quanto sarà davvero, e a zoom ridotto non promette un ingombro che non ha.
    let ghost: SVGGElement | null = null;
    const clearGhost = () => { ghost?.remove(); ghost = null; };
    // Spegne ghost e innesto insieme: sono lo stesso gesto interrotto.
    const cancelPlacing = () => {
      clearGhost();
      if (clearSplit()) drawEdges();
    };

    /**
     * COSA si sta per posare, se qualcosa. Un solo posto a rispondere, così
     * ghost e click non possono dare due risposte diverse — ed è quello che
     * aggiungere il soggetto avrebbe fatto scrivere due volte: un secondo
     * ghost, un secondo mouseleave, un secondo click con le stesse guardie.
     *
     * `key` serve solo al ghost, per sapere se quello già disegnato è ancora
     * quello giusto: cambiando strumento cambia la chiave e il ghost si rifà.
     *
     * `split` è acceso SOLO sul marcatore. Un marcatore posato su una linea la
     * spezza e ne diventa una tappa — è un oggetto del percorso, e stare in
     * mezzo è il suo mestiere. Un soggetto no: è una persona a cui una parte
     * della lavagna fa capo, e infilarla dentro un collegamento cambierebbe di
     * nascosto la struttura del grafo per un gesto che voleva dire tutt'altro.
     */
    type PlaceSpec = {
      key: string; w: number; h: number; split: boolean;
      paint: (node: SVGGElement) => void;
      place: (x: number, y: number, splitEdgeId?: string) => void;
    };
    const currentPlacing = (): PlaceSpec | null => {
      const kind = markerModeRef.current;
      if (kind) return {
        key: `marker:${kind}`, w: MARKER_SIZE, h: MARKER_SIZE, split: true,
        paint: (node) => paintMarker(node, kind, MARKER_SIZE, MARKER_SIZE),
        place: (x, y, splitEdgeId) => onAddMarkerAtRef.current?.(x, y, kind, splitEdgeId),
      };
      if (subjectModeRef.current && onAddSubjectAtRef.current) return {
        key: 'subject', w: SUBJECT_SIZE, h: SUBJECT_SIZE, split: false,
        paint: (node) => paintSubject(node, SUBJECT_SIZE, SUBJECT_SIZE),
        place: (x, y) => onAddSubjectAtRef.current?.(x, y),
      };
      return null;
    };

    d3svg.on('mousemove.place', (ev: MouseEvent) => {
      const spec = currentPlacing();
      if (!spec) { if (ghost) cancelPlacing(); return; }
      const [mx, my] = d3.pointer(ev, boardNode);
      if (!ghost || ghost.getAttribute('data-place') !== spec.key) {
        clearGhost();
        const gg = board.append('g')
          .attr('class', 'place-ghost').attr('data-place', spec.key)
          .style('pointer-events', 'none')
          .style('opacity', GHOST_OPACITY);
        ghost = gg.node();
        if (ghost) spec.paint(ghost);
      }
      ghost?.setAttribute('transform', `translate(${mx - spec.w / 2},${my - spec.h / 2})`);
      // Stessa sonda del trascinamento, stesso mezzo secondo. L'id di sé è
      // vuoto: l'oggetto non esiste ancora, quindi non c'è nessun edge suo da
      // escludere.
      if (spec.split && onSplitEdgeRef.current) probeSplit(mx, my, '', spec.w, spec.h);
    });
    // Uscendo dalla lavagna il ghost se ne va: lasciarlo fermo sull'ultimo punto
    // avrebbe fatto credere che l'oggetto fosse già posato lì.
    d3svg.on('mouseleave.place', () => cancelPlacing());

    // Posa l'oggetto CENTRATO sul punto cliccato: sono oggetti piccoli e tondi,
    // e ci si aspetta che finiscano dove si è puntato, non che ci appoggino il
    // proprio angolo in alto a sinistra.
    d3svg.on('click.place', (ev: MouseEvent) => {
      const spec = currentPlacing();
      if (!spec) return;
      // Il bersaglio può essere anche un EDGE, ma solo per chi innesta: posare
      // sopra un collegamento è il gesto dell'innesto, non un click andato a
      // vuoto. Tutto il resto (tile, box, gruppi) continua a non ricevere
      // oggetti addosso.
      const t = ev.target as Element;
      const onEdge = t !== svg && !!edgesG.node()?.contains(t);
      if (t !== svg && !(spec.split && onEdge)) return;
      const [mx, my] = d3.pointer(ev, boardNode);
      const armed = clearSplit();
      clearGhost();
      if (armed) drawEdges();
      spec.place(mx - spec.w / 2, my - spec.h / 2, armed ?? undefined);
    });

    d3svg.on('click.tile', (ev: MouseEvent) => {
      if (!tileModeRef.current) return;
      if (ev.target !== svg) return;
      const [mx, my] = d3.pointer(ev, boardNode);
      onAddTileAtRef.current(mx, my);
    });

    // ── ANTEPRIMA DEL FOGLIO ──────────────────────────────────────────────────
    // Vela tutto ciò che resta fuori dall'area stampabile e disegna i due bordi
    // della carta. È l'unico punto in cui la scelta del formato diventa
    // visibile: senza, «A3 orizzontale» è un'etichetta, e ci si accorge di cosa
    // era rimasto fuori solo a foglio stampato.
    const pdfG = board.append('g').attr('class', 'ob-canvas-pdfpreview').style('pointer-events', 'none');
    const drawPdfPreview = () => {
      pdfG.selectAll('*').remove();
      const p = pdfPreviewRef.current;
      if (!p) return;
      const { sheet, printable } = p;
      // Il velo è un rettangolo enorme col buco: una sola forma invece di
      // quattro bande da tenere allineate agli angoli.
      const OUT = 100000;
      const ring = (r: GroupBounds, pad: number) =>
        `M${r.x - pad},${r.y - pad}h${r.w + 2 * pad}v${r.h + 2 * pad}h${-(r.w + 2 * pad)}Z`;
      pdfG.append('path')
        .attr('d', ring(printable, OUT) + ring(printable, 0))
        .attr('fill-rule', 'evenodd')
        .style('fill', 'var(--ob-canvas)')
        .attr('opacity', 0.62);
      // `non-scaling-stroke`: la carta non è un oggetto del disegno, è
      // un'inquadratura — il suo bordo deve restare una linea sottile a
      // qualunque zoom, come il mirino di una fotocamera.
      pdfG.append('rect')
        .attr('x', sheet.x).attr('y', sheet.y).attr('width', sheet.w).attr('height', sheet.h)
        .attr('fill', 'none').attr('stroke', theme.accent).attr('stroke-width', 1.5)
        .attr('vector-effect', 'non-scaling-stroke');
      pdfG.append('rect')
        .attr('x', printable.x).attr('y', printable.y).attr('width', printable.w).attr('height', printable.h)
        .attr('fill', 'none').attr('stroke', theme.accent).attr('stroke-width', 1)
        .attr('stroke-dasharray', '5,4').attr('opacity', 0.7)
        .attr('vector-effect', 'non-scaling-stroke');
    };
    drawPdfPreviewRef.current = drawPdfPreview;

    drawGroups();
    nodesG.raise();
    tbG.raise();
    tempLine.raise();
    pdfG.raise();
    drawPdfPreview();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiles, edges, groups, textBoxes, buildNodes, getColor, hitTest, theme, viewKey]);

  useEffect(() => { render(); }, [render]);

  // Cambio di formato/orientamento → ridisegna SOLO l'anteprima del foglio.
  useEffect(() => { drawPdfPreviewRef.current?.(); }, [pdfPreview]);

  // Toggle the per-item selection ring (tiles + text boxes) without rebuilding the SVG.
  // Also refreshes connected-edge highlights.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const ids = new Set(selectedIds || []);
    d3.select(svg).selectAll<SVGGElement, CanvasNode>('g.tile-node').each(function (d) {
      const sel = ids.has(d.id) || selectedTileId === d.id;
      d3.select(this).select('.sel-ring').attr('opacity', sel ? 1 : 0);
      // Da selezionato niente nodi di aggancio: nasconde subito le porte anche se
      // erano comparse in hover prima del click.
      if (sel) d3.select(this).selectAll('.port').attr('opacity', 0);
    });
    d3.select(svg).selectAll<SVGGElement, unknown>('g.tb-node').each(function () {
      const id = (this as SVGGElement).getAttribute('data-tb-id');
      const sel = !!id && (ids.has(`tb:${id}`) || selectedTextBoxId === id);
      d3.select(this).select('.sel-ring').attr('opacity', sel ? 1 : 0);
      // Le maniglie di ridimensionamento si vedono solo sul box selezionato
      // (restano afferrabili anche spente: l'opacità non toglie gli eventi).
      d3.select(this).selectAll('.tb-handle').attr('opacity', sel ? 1 : 0);
      if (sel) d3.select(this).selectAll('.port').attr('opacity', 0);
    });
    // Edges: ridisegno completo del layer così colore/spessore/tipologia/etichetta
    // custom e l'alone del singolo edge selezionato restano coerenti (l'update
    // manuale precedente sovrascriveva il colore custom con quello neutro).
    drawEdgesRef.current?.();
  }, [selectedIds, selectedTileId, selectedTextBoxId, selectedEdgeId, selAccent, theme.border]);

  // Cambio di selezione del gruppo → ridisegna SOLO il layer dei gruppi
  // (contorno + punti di aggancio), senza ricostruire l'intero SVG.
  useEffect(() => {
    drawGroupsRef.current?.();
  }, [selectedGroupId]);

  useEffect(() => {
    if (!fitTrigger) return;
    const svg = svgRef.current, z = zoomRef.current, ns = nodesRef.current;
    if (!svg || !z || !ns.length) return;
    const { width: w, height: h } = svg.getBoundingClientRect();
    const [x1, x2] = [Math.min(...ns.map((n) => n.x)), Math.max(...ns.map((n) => n.x)) + TILE_W];
    const [y1, y2] = [Math.min(...ns.map((n) => n.y)), Math.max(...ns.map((n) => n.y)) + TILE_H];
    const s = Math.min((w - 80) / (x2 - x1), (h - 80) / (y2 - y1), 1.5);
    d3.select(svg).transition().duration(300).call(z.transform as any, d3.zoomIdentity.translate((w - (x2 - x1) * s) / 2 - x1 * s, (h - (y2 - y1) * s) / 2 - y1 * s).scale(s));
  }, [fitTrigger]);

  // Zoom to 100% (1:1)
  useEffect(() => {
    if (!zoom100Trigger) return;
    const svg = svgRef.current, z = zoomRef.current;
    if (!svg || !z) return;
    const { width: w, height: h } = svg.getBoundingClientRect();
    const t = zoomTransformRef.current;
    // Zoom to scale=1, keeping center of viewport
    const cx = w / 2, cy = h / 2;
    const newT = d3.zoomIdentity.translate(cx - (cx - t.x) / t.k, cy - (cy - t.y) / t.k).scale(1);
    d3.select(svg).transition().duration(300).call(z.transform as any, newT);
  }, [zoom100Trigger]);

  return (
    // `backgroundColor` e NON la scorciatoia `background`: quella azzera anche
    // `background-image`, e l'immagine è la griglia che arriva da `.ob-dotgrid`.
    // Uno stile inline vincerebbe sulla classe e la lavagna tornerebbe liscia.
    <div ref={setRoot} className="relative w-full h-full ob-dotgrid" style={{ backgroundColor: theme.bg1 }}>
      <svg ref={svgRef} className="absolute inset-0 w-full h-full" />
      {/* HTML overlay: hosts TipTap editors as positioned divs OUTSIDE the SVG.
          A single inner wrapper takes the SVG's pan/zoom transform, so editors
          stay aligned with their D3-drawn box frames. Editors live in the React
          tree (no D3 mount/unmount), so TipTap state survives box redraws. */}
      <div ref={overlayRef} className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* `data-canvas-overlay-inner`: l'aggancio con cui la stampa ritrova
            questo strato nel clone e gli riscrive la trasformazione (il ref non
            sopravvive alla copia del DOM). */}
        <div ref={overlayInnerRef} data-canvas-overlay-inner="" style={{ transformOrigin: '0 0', position: 'absolute', inset: 0 }}>
          {textBoxes.filter((b) => b.type === 'text').map((tb) => (
            <div
              key={tb.id}
              data-box-id={tb.id}
              className="absolute"
              style={{
                left: tb.x + TB_PAD,
                top: tb.y + TB_PAD,
                width: tb.w - 2 * TB_PAD,
                height: tb.h - 2 * TB_PAD,
                // Interattivo solo in editing: altrimenti click/drag passano al
                // gruppo D3 sotto (modalità sposta, cursore "move").
                pointerEvents: editingBoxId === tb.id ? 'auto' : 'none',
                cursor: editingBoxId === tb.id ? 'text' : 'move',
              }}
              // Il tasto destro sul testo (editor TipTap in overlay, fuori
              // dall'SVG) non raggiunge il gruppo D3: intercettiamo qui per
              // aprire il menu del text box invece di quello nativo del browser.
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                // L'overlay ospita solo box di TESTO, che nei gruppi non entrano.
                onTextBoxContextMenuRef.current({ x: e.clientX, y: e.clientY, textBoxId: tb.id, inGroup: false });
              }}
            >
              <TextEditor
                editing={editingBoxId === tb.id}
                fontSize={(tb as { type: 'text'; content: { fontSize?: number } }).content.fontSize ?? BOX_FONT_SIZE}
                onMeasure={(m) => reportBoxMeasure(tb.id, m)}
                textColor={tb.content.bgColor ? readableOn(tb.content.bgColor) : 'var(--ob-text)'}
                initialHtml={(tb as { type: 'text'; content: { html: string } }).content.html}
                onChange={(html) => {
                  // Keep local box in sync so D3 drag-end save uses the latest HTML.
                  if (tb.type === 'text') tb.content = { html };
                  const prev = editorSaveTimersRef.current.get(tb.id);
                  if (prev) clearTimeout(prev);
                  const t = setTimeout(() => {
                    onUpdateTextBoxRef.current(tb.id, { content: { html } });
                    editorSaveTimersRef.current.delete(tb.id);
                  }, 600);
                  editorSaveTimersRef.current.set(tb.id, t);
                }}
              />
              {/* BADGE DI ESPANSIONE — compare SOLO quando il testo non ci sta,
                  cioè esattamente quando compare la barra di scorrimento. È
                  l'alternativa a scorrere: un clic e il box diventa alto quanto
                  serve.

                  `pointerEvents: 'auto'` è indispensabile: il div del box è
                  `none` fuori dall'editing (click e trascinamento devono
                  passare al gruppo D3 sotto), e un figlio deve riaccenderli per
                  sé. `stopPropagation` sul mousedown impedisce che il gesto
                  inizi un trascinamento del box.

                  Geometria: 16px appesi allo spigolo in basso a destra, 7
                  dentro e 9 fuori — le stesse proporzioni con cui il badge
                  d'azione sta appeso al tile, che qui accanto rende 16 anche
                  lui. Il box non è zoomato, quindi 16 sono 16. */}
              {boxOverflow[tb.id] != null && (
                <button
                  type="button"
                  className="ob-boxfit"
                  title="Espandi il box per mostrare tutto il testo"
                  aria-label="Espandi il box per mostrare tutto il testo"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    expandBoxToFit(tb, boxOverflow[tb.id]);
                  }}
                >
                  <IconChevronsDown size={10} stroke={2} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});
