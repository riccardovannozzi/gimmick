'use client';

/**
 * Gimmick · Obsidian — Comandi di zoom del canvas.
 *
 * Adatta e Scala 1:1, impilati in basso a destra SOPRA la lavagna.
 *
 * Stavano nella topbar, in fondo a destra, come due bottoni con etichetta
 * («Fit», «100%»). Erano fuori posto per due ragioni: non sono comandi del
 * documento come gli altri della barra — non creano né cambiano niente, spostano
 * solo il punto da cui lo guardi — e stavano lontanissimi dal loro effetto, che
 * accade sulla lavagna. Qui sono appoggiati sulla cosa che muovono, come in ogni
 * strumento di disegno.
 *
 * Solo icone: due comandi soli, sempre negli stessi due posti, imparati al primo
 * uso. L'etichetta resta nel tooltip.
 */
import { IconMaximize, IconZoomReset } from '@tabler/icons-react';

export function CanvasZoomControls({ onFit, onZoom100 }: {
  onFit: () => void;
  onZoom100: () => void;
}) {
  return (
    <div className="ob-zoomctl">
      <button type="button" className="ob-zoomctl__btn" onClick={onFit} title="Adatta alla vista" aria-label="Adatta alla vista">
        <IconMaximize size={16} stroke={1.6} />
      </button>
      <button type="button" className="ob-zoomctl__btn" onClick={onZoom100} title="Scala reale (100%)" aria-label="Scala reale (100%)">
        <IconZoomReset size={16} stroke={1.6} />
      </button>
    </div>
  );
}
