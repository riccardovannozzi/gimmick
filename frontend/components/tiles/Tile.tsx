'use client';

/**
 * Gimmick — Il Tile, 160×90 disegnati e 128×72 mostrati, con i cinque canali
 * visivi montati.
 *
 * Presentazionale: riceve la chiave grafica già risolta (`tileVisualKey()`) e
 * il metadato già formattato. Non legge il dominio, non formatta date, non
 * decide cosa sia un flow.
 *
 * Non sostituisce ancora nulla: le card di Chrono, Kanban e Staging restano al
 * loro posto finché non le si monta (STEP 4). Questo è il componente unico che
 * quelle tre copie dovranno diventare.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { TILE_VISUAL, type StepState, type TileStatus, type TileVisualKey } from '@/lib/tile-visual';
import { TileBadge, TileStepper, TileStatusLabel, TileSparks } from './TileChannels';
import { TILE_STATUS_LABEL } from '@/lib/tile-visual';
import type { SparkType } from '@/types';

/**
 * Larghezza utile del footer e costo medio di un carattere a 11px nel sans.
 *
 * La regola "se il metadato non entra in almeno 6 caratteri non renderizzarlo"
 * richiede di sapere quanto spazio resta accanto allo status. Misurarlo davvero
 * significherebbe un passaggio di layout per ogni tile; qui non serve, perché
 * la larghezza del tile è FISSA a 160 e il corpo tipografico è fisso: la stima
 * è deterministica, non un'approssimazione che cambia da caso a caso.
 *
 * ⚠️ Vanno rifatti se cambia `TILE_BASE_W` (lib/tile-visual.ts): sono la sua
 * larghezza meno il footer, non due numeri indipendenti.
 */
const FOOTER_W = 140;        // 160 − 10 di padding per lato
const FOOTER_W_STRIP = 122;  // con la strip il padding sinistro diventa 28
const CHAR_W = 5.4;          // larghezza media a var(--ob-text-meta)
const MIN_META_CHARS = 6;

function metaFits(statusLabel: string | null, hasStrip: boolean): boolean {
  const available = (hasStrip ? FOOTER_W_STRIP : FOOTER_W) - (statusLabel ? statusLabel.length * CHAR_W + 6 : 0);
  return available >= MIN_META_CHARS * CHAR_W;
}

export interface TileProps {
  title: string;
  /** Chiave grafica risolta con `tileVisualKey()`, non `action_type` grezzo. */
  visualKey: TileVisualKey;
  status?: TileStatus;
  /** Passi già tradotti in stati di segmento. Vuoto o assente = niente strip. */
  steps?: StepState[];
  /** Metadato già formattato: data, orario, ricorrenza o progressione. */
  meta?: string;
  /**
   * I tipi degli spark allegati, grezzi e con i doppioni: la card ne ricava un
   * pallino per tipo. Vuoto o assente = nessun pallino.
   *
   * ⚠️ È un SESTO canale, e i cinque erano dichiarati chiusi (vedi il commento
   * in cima a kanban.tsx, dove le cap-chip degli spark erano state tolte proprio
   * per questo). Ci rientra a una condizione: si può spegnere. Il pulsante nelle
   * toolbar scrive `data-sparks="off"` sulla radice e il canale sparisce da
   * tutte le viste insieme — senza di quello sarebbe rumore permanente.
   */
  sparks?: SparkType[];
  /** Colore dell'action, dalle impostazioni utente. Mai un hex scritto qui. */
  accent?: string;
  /**
   * Tile PROVVISORIO: il posto che il tile occuperà, disegnato mentre viene
   * creato davvero. Non è un'anteprima decorativa e non è cliccabile — è la
   * stessa card, attenuata, in attesa di diventare una riga.
   */
  ghost?: boolean;
  /**
   * FOCUS — l'attività su cui si sta lavorando adesso: una cornice rossa
   * tratteggiata e spessa, tutt'intorno al tile.
   *
   * Non è un sesto canale del sistema visivo: quelli descrivono il tile (che
   * cos'è, a che punto è, cosa contiene) e sono sempre accesi. Questo descrive
   * TE — dove stai guardando ora — vive su pochissimi tile per volta e si
   * spegne da sé quando hai finito. È il segno più forte che un tile possa
   * portare, e regge solo finché resta raro: acceso su venti tile sarebbe una
   * lavagna a righe rosse, cioè di nuovo nessuna indicazione.
   */
  focused?: boolean;
  active?: boolean;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  className?: string;
}

export function Tile({
  title, visualKey, status = 'active', steps, meta, sparks, accent, ghost,
  focused, active, onClick, onContextMenu, className,
}: TileProps) {
  const spec = TILE_VISUAL[visualKey];

  // La strip esiste solo se il tipo la prevede E ci sono davvero dei passi.
  // Una strip vuota sarebbe peggio dell'assenza: occuperebbe 20px per dire
  // niente, e sposterebbe il contenuto senza motivo.
  const steppedSteps = spec.stepper ? (steps ?? []) : [];
  const hasStrip = steppedSteps.length > 0;

  const statusLabel = TILE_STATUS_LABEL[status];
  const showMeta = !!meta && spec.meta !== 'none' && metaFits(statusLabel, hasStrip);

  return (
    <div
      className={cn(
        'ob-tile',
        hasStrip && 'ob-tile--stripped',
        onClick && 'ob-tile--clickable',
        ghost && 'ob-tile--ghost',
        active && 'ob-tile--active',
        status === 'done' && 'ob-tile--done',
        status === 'cancelled' && 'ob-tile--cancelled',
        className,
      )}
      data-border={spec.border}
      style={accent ? ({ ['--ac' as string]: accent }) : undefined}
      onClick={onClick}
      onContextMenu={onContextMenu}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
    >
      {/* La cornice del FOCUS: un figlio in posizione assoluta che si dispone
          appena fuori dal rettangolo, NON il bordo del tile — quel bordo dice
          già l'azione (`data-border`) e va lasciato dov'è. Restando fuori non
          tocca né la strip né il titolo: qualunque tipo di tile la porta
          identica, che è ciò che la rende un segno e non un dettaglio. */}
      {focused && <span className="ob-tile__focus" aria-label="In focus" />}
      {spec.badge && <TileBadge badge={spec.badge} shifted={hasStrip} />}
      <TileStepper steps={steppedSteps} />

      <div className="ob-tile__body">
        <div className="ob-tile__title">{title}</div>
      </div>

      <TileStatusLabel status={status} shifted={hasStrip} />
      {showMeta && <span className="ob-tile__meta">{meta}</span>}
      <TileSparks types={sparks} shifted={hasStrip} />
    </div>
  );
}
