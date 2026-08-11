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
import {
  IconFlame, IconCalendarMonth, IconClock,
  IconCamera, IconPhoto, IconVideo, IconMicrophone, IconAlignLeft, IconPaperclip,
} from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import { STEPPER_MAX_SEGMENTS, TILE_STATUS_LABEL, type StepState, type TileChannelSpec, type TileStatus } from '@/lib/tile-visual';
import { typeLabels } from '@/lib/spark-utils';
import type { SparkType } from '@/types';

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
 * ─── SPARK ALLEGATI ──────────────────────────────────────────────────────────
 *
 * Glifo e colore di ogni tipo di spark. Non sono scelti qui: sono gli STESSI
 * dell'icona di cattura e dei token `--ob-type-*` che l'app usa dappertutto per
 * quel tipo. Un video è rosa in ogni schermata; se lo fosse solo qui, il
 * puntino sulla card sarebbe un secondo linguaggio da imparare.
 */
const SPARK_CHANNEL: Record<SparkType, { Glyph: typeof IconCamera; color: string }> = {
  photo: { Glyph: IconCamera, color: 'var(--ob-type-photo)' },
  image: { Glyph: IconPhoto, color: 'var(--ob-type-gallery)' },
  video: { Glyph: IconVideo, color: 'var(--ob-type-video)' },
  audio_recording: { Glyph: IconMicrophone, color: 'var(--ob-type-voice)' },
  text: { Glyph: IconAlignLeft, color: 'var(--ob-type-text)' },
  file: { Glyph: IconPaperclip, color: 'var(--ob-type-file)' },
};

/**
 * Ordine FISSO, uguale per tutte le card. Se seguisse l'ordine di allegamento,
 * due tile con gli stessi allegati mostrerebbero due file diverse di pallini e
 * non si potrebbero confrontare con un colpo d'occhio — che è l'unica cosa che
 * questi pallini servono a permettere.
 */
const SPARK_ORDER: SparkType[] = ['photo', 'image', 'video', 'audio_recording', 'text', 'file'];

/**
 * Oltre tre, la fila esce dal footer e i pallini diventano una barra. Un tile
 * con quattro tipi diversi di allegato è raro, e in quel caso il quarto si
 * scopre aprendolo: la card dice CHE COSA c'è dentro, non l'inventario.
 */
const SPARKS_MAX = 3;

/**
 * Un pallino per ogni TIPO di spark allegato — non per ogni spark: cinque foto
 * fanno un'icona sola. La card risponde a «che genere di roba c'è qui dentro»,
 * e cinque copie dello stesso glifo non aggiungono niente a quella risposta.
 *
 * Sta in basso a SINISTRA, e non a destra sotto il badge dell'azione, per una
 * ragione geometrica: nelle colonne di Chrono e nelle corsie del Kanban le card
 * sono impilate con 9px di stacco, e il badge sborda di 8 dal bordo. Due badge a
 * destra — questo sotto una card e quello dell'azione sopra la card seguente —
 * finirebbero nello stesso varco, l'uno addosso all'altro. A sinistra il varco è
 * libero, e i due canali si leggono come una diagonale invece che come una
 * colonna sovrapposta.
 */
export function TileSparks({ types, shifted }: { types?: SparkType[]; shifted?: boolean }) {
  const shown = React.useMemo(() => {
    if (!types?.length) return [];
    const present = new Set(types);
    return SPARK_ORDER.filter((t) => present.has(t)).slice(0, SPARKS_MAX);
  }, [types]);

  if (!shown.length) return null;

  return (
    <span
      className={cn('ob-tsparks', shifted && 'ob-tsparks--shifted')}
      // Il tooltip è l'unico posto in cui questi glifi si spiegano: sono 17px e
      // non hanno etichetta. Vale anche da nome accessibile.
      title={shown.map((t) => typeLabels[t]).join(' · ')}
    >
      {shown.map((t) => {
        const { Glyph, color } = SPARK_CHANNEL[t];
        return (
          <span key={t} className="ob-tspark" style={{ ['--sk' as string]: color }} aria-hidden>
            <Glyph size={14} stroke={1.8} />
          </span>
        );
      })}
    </span>
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
