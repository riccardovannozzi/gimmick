'use client';

/**
 * Gimmick · Obsidian — Il foglio del canvas.
 *
 * Monta una copia della board impaginata su un foglio ISO e chiama la stampa del
 * browser, da cui si ottiene il PDF ("Salva come PDF"). Si smonta da solo quando
 * la stampa è finita.
 *
 * ─── Perché un CLONE e non un ridisegno ─────────────────────────────────────
 * La board è un SVG con le card dentro `<foreignObject>` (HTML + token `--ob-*`)
 * e i testi in un overlay HTML sopra l'SVG. Sono tre tecnologie che si tengono
 * allineate a vicenda tramite la stessa trasformazione di zoom. Ridisegnarle per
 * la stampa vorrebbe dire mantenere un secondo renderer; clonare il nodo vivo
 * vuol dire stampare esattamente quello che si vede, con gli stessi fogli di
 * stile, gli stessi font e nessuna possibilità di divergere.
 *
 * Al clone si cambia una cosa sola: la trasformazione. Sullo schermo vale
 * `translate(pan) scale(zoom)`; sul foglio vale «porta l'angolo dell'area
 * scelta nell'origine e scalala al rapporto carta». Stessa forma, due valori
 * diversi — e va applicata in DUE posti, perché i due strati la ricevono in modo
 * diverso: attributo `transform` sull'SVG, `style.transform` sull'overlay.
 *
 * ─── Perché il tema chiaro forzato ──────────────────────────────────────────
 * I token stanno su `[data-theme='…']`, che è un selettore d'attributo e non è
 * legato alla radice: basta scriverlo sul contenitore del foglio perché tutto il
 * sottoalbero legga la palette chiara, senza toccare il tema dell'app. Un canvas
 * scuro stampato è un foglio nero: non è una preferenza, è inchiostro.
 */
import * as React from 'react';
import { createPortal } from 'react-dom';
import type { PaperPlan, Rect } from '@/lib/paper';
import { pageSizeCss } from '@/lib/paper';

/**
 * Elementi della board che sulla carta non hanno senso: sono affordance, cioè
 * inviti a fare qualcosa. Un foglio non si trascina.
 */
const AFFORDANCE_SELECTOR = [
  '.sel-ring',      // anello di selezione
  '.port',          // punti di aggancio degli edge
  '.tb-resize',     // maniglie dei box
  '.g-resize',      // maniglie dei gruppi
  '.ob-canvas-marquee',   // il rettangolo che stai trascinando
  '.ob-canvas-templine',  // la linea del collegamento in corso
  '.ob-canvas-pdfpreview', // l'anteprima del foglio: sul foglio sarebbe ricorsiva
  '.ob-print-hide',
].join(',');

interface CanvasPrintSheetProps {
  plan: PaperPlan;
  /** L'area scelta, in coordinate del canvas. */
  area: Rect;
  /** La radice della board (l'elemento che contiene SVG + overlay). */
  source: HTMLElement | null;
  /** Ripropone sul foglio il verde delle attività completate, se è acceso. */
  doneHighlight?: boolean;
  /** Chiamata a stampa conclusa (o annullata, o fallita): il parent smonta. */
  onDone: () => void;
}

/**
 * Le immagini del clone rifanno la richiesta, anche se il browser la serve dalla
 * cache. Stampare prima che siano decodificate lascia dei buchi bianchi al posto
 * delle immagini, quindi si aspetta — ma non all'infinito: un'immagine rotta non
 * deve bloccare la stampa di tutto il resto.
 */
function waitForImages(root: HTMLElement, timeoutMs = 3000): Promise<void> {
  const imgs = Array.from(root.querySelectorAll('img'));
  if (!imgs.length) return Promise.resolve();
  const each = imgs.map((img) => {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise<void>((resolve) => {
      img.addEventListener('load', () => resolve(), { once: true });
      img.addEventListener('error', () => resolve(), { once: true });
    });
  });
  return Promise.race([
    Promise.all(each).then(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

/** Riscrive il clone perché mostri l'area scelta alla scala della carta. */
function prepareClone(clone: HTMLElement, plan: PaperPlan, area: Rect) {
  const k = plan.scale;
  const tx = -area.x * k;
  const ty = -area.y * k;
  const w = plan.contentPx.w;
  const h = plan.contentPx.h;

  // Il contenitore era `w-full h-full` dentro la finestra: ora è la finestra.
  clone.removeAttribute('class');
  clone.setAttribute('style', `position:relative;width:${w}px;height:${h}px;overflow:hidden;background:transparent;`);

  const svg = clone.querySelector('svg');
  if (svg) {
    // Via la classe: porta anche `--lod`, il livello di dettaglio ridotto che si
    // accende sotto lo zoom 0.6. Sul foglio la scala è ~1 e i badge ci stanno.
    svg.removeAttribute('class');
    svg.setAttribute('width', String(w));
    svg.setAttribute('height', String(h));
    svg.setAttribute('style', 'position:absolute;top:0;left:0;display:block;');
    // Il gruppo radice è quello che porta la trasformazione di zoom.
    const board = svg.querySelector(':scope > g');
    if (board) board.setAttribute('transform', `translate(${tx},${ty}) scale(${k})`);
  }

  // Stessa trasformazione, altra sintassi: qui è CSS.
  const overlay = clone.querySelector<HTMLElement>('[data-canvas-overlay-inner]');
  if (overlay) overlay.style.transform = `translate(${tx}px,${ty}px) scale(${k})`;

  clone.querySelectorAll(AFFORDANCE_SELECTOR).forEach((n) => n.remove());
  // Gli editor di testo restano nel clone come HTML statico: senza questo
  // resterebbero modificabili, e un contenteditable in un albero fantasma è solo
  // un modo per far scrivere l'utente dove nessuno leggerà.
  clone.querySelectorAll('[contenteditable]').forEach((n) => n.setAttribute('contenteditable', 'false'));
}

export function CanvasPrintSheet({ plan, area, source, doneHighlight, onDone }: CanvasPrintSheetProps) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const onDoneRef = React.useRef(onDone);
  onDoneRef.current = onDone;
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    const host = hostRef.current;
    if (!mounted || !host) return;
    if (!source) { onDoneRef.current(); return; }

    const clone = source.cloneNode(true) as HTMLElement;
    prepareClone(clone, plan, area);
    host.replaceChildren(clone);

    // Il segnale di fine è `afterprint`, e SOLO quello.
    //
    // La tentazione è chiudere appena `window.print()` ritorna: nei browser
    // attuali la chiamata blocca fino a dialogo chiuso, quindi funzionerebbe.
    // Ma dove non blocca — ed è un dettaglio di implementazione, non una
    // garanzia — smonteremmo il foglio con l'anteprima ancora aperta. Fra
    // «restare montati qualche secondo di troppo» e «stampare una pagina
    // bianca» la scelta non è in dubbio. La rete di sicurezza serve al caso in
    // cui l'evento non arrivi mai, per non lasciare il pannello a «Preparo…».
    let finished = false;
    let safety: ReturnType<typeof setTimeout> | null = null;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (safety) clearTimeout(safety);
      window.removeEventListener('afterprint', finish);
      onDoneRef.current();
    };
    window.addEventListener('afterprint', finish);

    let cancelled = false;
    waitForImages(clone).then(() => {
      if (cancelled) return;
      safety = setTimeout(finish, 60_000);
      try {
        window.print();
      } catch {
        // Stampa negata (pop-up bloccati, contesto senza permessi): il pannello
        // deve tornare utilizzabile invece di restare in attesa di un evento
        // che non arriverà.
        finish();
      }
    });

    return () => {
      cancelled = true;
      finished = true;
      if (safety) clearTimeout(safety);
      window.removeEventListener('afterprint', finish);
      host.replaceChildren();
    };
  }, [mounted, plan, area, source]);

  if (!mounted) return null;

  return createPortal(
    <div className="ob-print" data-theme="light" aria-hidden>
      {/* La misura del foglio si dichiara al motore di stampa, non si simula:
          è questa riga a decidere che il PDF esca A3 orizzontale invece che A4.
          Margine zero perché i margini li tiene la pagina qui sotto — così
          l'area stampabile è esattamente quella su cui abbiamo fatto i conti. */}
      <style>{`@page { size: ${pageSizeCss(plan)}; margin: 0; }`}</style>
      <div
        className="ob-print__page"
        style={{
          width: `${plan.pageMm.w}mm`,
          height: `${plan.pageMm.h}mm`,
          padding: `${plan.marginMm}mm`,
        }}
      >
        <div className={`ob-print__frame${doneHighlight ? ' ob-done-hl' : ''}`}>
          <div
            ref={hostRef}
            className="ob-print__content"
            style={{ width: plan.contentPx.w, height: plan.contentPx.h }}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
