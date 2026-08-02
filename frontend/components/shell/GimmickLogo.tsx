/**
 * Gimmick — il logo del brand: il mostriciattolo rosso.
 *
 * Trascrizione PIXEL-ESATTA di `mobile/assets/icon.png`, l'icona dell'app
 * mobile: stessa griglia 10×15 quadretti, stessi due colori. È un SVG e non il
 * PNG perché il logo compare a 28–34px, misure a cui un pixel-art nato a 512
 * arriva sfocato dall'interpolazione del browser; qui i quadretti restano netti
 * a qualunque dimensione (`shapeRendering="crispEdges"`).
 *
 * ⚠️ I due colori sono IDENTITÀ del brand, non token del tema: non vanno legati
 * a `--ob-accent` né cambiati fra tema chiaro e scuro. Sul fondo scuro gli
 * occhi e la bocca (blu notte) si leggono come ritagli nel corpo, che è
 * esattamente l'effetto dell'icona originale sul bianco.
 */

/** Corpo del mostriciattolo. */
const BODY = '#FF3D3D';
/** Occhi e bocca. */
const INK = '#0A1837';

export interface GimmickLogoProps {
  /** Altezza in px; la larghezza segue le proporzioni 10:15 dello sprite. */
  size?: number;
  className?: string;
  /** Se presente, il logo diventa un'immagine accessibile con questo nome;
   *  altrimenti è decorativo (`aria-hidden`). */
  title?: string;
}

export function GimmickLogo({ size = 28, className, title }: GimmickLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 10 15"
      width={(size * 10) / 15}
      height={size}
      className={className}
      shapeRendering="crispEdges"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      <g fill={BODY}>
        {/* antenne */}
        <rect x="3" y="0" width="1" height="1" />
        <rect x="7" y="0" width="1" height="1" />
        <rect x="3" y="1" width="2" height="1" />
        <rect x="6" y="1" width="2" height="1" />
        <rect x="4" y="2" width="3" height="1" />
        {/* testa e corpo (un blocco pieno: occhi e bocca ci si posano sopra) */}
        <rect x="1" y="3" width="8" height="1" />
        <rect x="0" y="4" width="10" height="6" />
        <rect x="1" y="10" width="8" height="1" />
        {/* gambe e piedi */}
        <rect x="2" y="11" width="2" height="3" />
        <rect x="6" y="11" width="2" height="3" />
        <rect x="1" y="14" width="3" height="1" />
        <rect x="6" y="14" width="3" height="1" />
      </g>
      <g fill={INK}>
        <rect x="2" y="5" width="2" height="2" />
        <rect x="7" y="5" width="2" height="2" />
        <rect x="2" y="8" width="6" height="1" />
      </g>
    </svg>
  );
}
