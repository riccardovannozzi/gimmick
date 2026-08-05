'use client';

/**
 * Gimmick — I tre canali visivi accessori del Tile.
 *
 * Componenti presentazionali PURI: ricevono già risolto ciò che devono
 * disegnare e non sanno niente di `action_type`, di status o di subtask. La
 * traduzione dal dominio ai canali sta in `lib/tile-visual.ts`; il montaggio
 * dentro la card sta nel Tile (STEP 3).
 *
 * La forma è in `app/obsidian-primitives.css` (classi `.ob-tbadge`, `.ob-tstrip`,
 * `.ob-tstep`, `.ob-tstatus`). Qui non ci sono stili inline: i colori dello
 * stepper cambiano col tema, e un valore inline non può farlo.
 */
import * as React from 'react';
import { IconFlame, IconCalendarMonth, IconClock } from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import { STEPPER_MAX_SEGMENTS, TILE_STATUS_LABEL, type StepState, type TileChannelSpec, type TileStatus } from '@/lib/tile-visual';

/** Glifi ammessi per il badge-icona. Chiavi = i `value` di TILE_VISUAL. */
const BADGE_ICON = {
  flame: IconFlame,
  'calendar-month': IconCalendarMonth,
  clock: IconClock,
} as const;

export type BadgeSpec = NonNullable<TileChannelSpec['badge']>;

/**
 * Pillola esterna al rettangolo, ancorata sopra il bordo superiore.
 *
 * Un Tile non porta mai due badge insieme, ed è l'unico punto iconico della
 * card: l'icona dell'action non va replicata all'interno.
 *
 * `shifted` sposta il badge-parola oltre la strip quando questa è presente,
 * altrimenti gli finirebbe sopra.
 */
export function TileBadge({ badge, shifted }: { badge: BadgeSpec; shifted?: boolean }) {
  // Il lato viene dalla specifica. Lo slittamento serve solo a un badge a
  // sinistra, che altrimenti finirebbe sopra la strip; a destra non c'è niente
  // da scavalcare.
  const side = badge.position === 'left' ? 'ob-tbadge--left' : 'ob-tbadge--right';
  const shift = badge.position === 'left' && shifted;

  if (badge.kind === 'word') {
    return (
      <span className={cn('ob-tbadge', 'ob-tbadge--word', side, shift && 'ob-tbadge--shifted')}>
        {badge.value}
      </span>
    );
  }
  const Glyph = BADGE_ICON[badge.value as keyof typeof BADGE_ICON];
  // Un `value` non mappato non deve far esplodere la card: meglio nessun badge
  // di un crash, e l'assenza si nota in revisione.
  if (!Glyph) return null;
  return (
    <span className={cn('ob-tbadge', 'ob-tbadge--icon', side)} aria-hidden>
      <Glyph size={10} stroke={1.8} />
    </span>
  );
}

/**
 * Strip + stepper verticale, riempito dall'alto verso il basso.
 *
 * Se non ci sono step la strip NON viene renderizzata affatto — non una strip
 * vuota: il Tile torna al suo padding normale. Per questo il componente
 * restituisce `null` e chi lo monta deve regolare il padding di conseguenza.
 *
 * Oltre il quinto segmento la colonna diventa illeggibile: si mostrano i primi
 * quattro più un segmento riassuntivo, e il conteggio completo passa nel
 * metadato del footer ("2 di 9"), che non è responsabilità di questo componente.
 */
export function TileStepper({ steps }: { steps: StepState[] }) {
  if (!steps.length) return null;

  const overflow = steps.length > STEPPER_MAX_SEGMENTS;
  const shown = overflow ? steps.slice(0, STEPPER_MAX_SEGMENTS - 1) : steps;

  return (
    <div className="ob-tstrip" aria-hidden>
      {shown.map((s, i) => (
        <span key={i} className={`ob-tstep ob-tstep--${s}`} />
      ))}
      {overflow && <span className="ob-tstep ob-tstep--more" />}
    </div>
  );
}

/**
 * Status in forma testuale, nel footer sinistro. Renderizzato solo quando lo
 * stato non è `active`: lo stato normale non si annuncia.
 *
 * I trattamenti che riguardano il CORPO della card — titolo barrato su `done`,
 * intero Tile attenuato su `cancelled` — non stanno qui: sono del Tile, perché
 * toccano elementi che questo componente non possiede.
 */
export function TileStatusLabel({ status, shifted }: { status: TileStatus; shifted?: boolean }) {
  const label = TILE_STATUS_LABEL[status];
  if (!label) return null;
  return (
    <span className={cn('ob-tstatus', shifted && 'ob-tstatus--shifted')}>{label}</span>
  );
}
