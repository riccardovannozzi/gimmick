'use client';

import * as React from 'react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { IconArticle, IconCube, IconPinnedOff, IconPhoto, IconLasso, IconFileTypePdf, IconFlag, IconX, IconGridDots, IconUser, IconBuilding } from '@tabler/icons-react';
import { MARKER_SPEC, MARKER_KINDS, MarkerBadge } from '@/components/canvas/CanvasBoard';
import type { MarkerKind } from '@/components/canvas/CanvasBoard';
import { usePixelTheme } from '@/components/pixel';
import { ToolButton, ToolWord } from '@/components/primitives';
import { SparkIconsToggle } from '@/components/tiles/SparkIconsToggle';
import { cn } from '@/lib/utils';
import type { Tag } from '@/types';

interface CanvasTopbarProps {
  tag: Tag | null;
  textMode: boolean;
  tileMode: boolean;
  imageMode: boolean;
  /** Tipo di marcatore armato, o null. */
  markerMode?: MarkerKind | null;
  onPickMarker?: (kind: MarkerKind | null) => void;
  /**
   * SOGGETTO — la persona a cui una parte della lavagna fa capo.
   *
   * Ha un pulsante suo e non una voce nel menu «Oggetti»: là dentro stanno i
   * quattro marcatori, che sono un vocabolario chiuso di segni del PERCORSO
   * (da dove parte, dove si ferma, dove arriva). Una persona non è un punto del
   * percorso, e infilarla fra loro avrebbe fatto cercare «start, stop, goal,
   * milestone… e Mario».
   */
  subjectMode?: boolean;
  onToggleSubjectMode?: () => void;
  /**
   * ORGANIZZAZIONE — un insieme di soggetti.
   *
   * Accanto al soggetto e per la stessa ragione per cui il soggetto sta fuori
   * dai marcatori: sono anagrafica, non segni del percorso. Dietro i due c'è una
   * riga della stessa rubrica — `kind` person contro company — e a distinguerli
   * sulla lavagna è la forma: tondo un individuo, squadrato un insieme.
   */
  organizationMode?: boolean;
  onToggleOrganizationMode?: () => void;
  selectMode: boolean;
  onToggleTextMode: () => void;
  onToggleTileMode: () => void;
  onToggleImageMode: () => void;
  onToggleSelectMode: () => void;
  /**
   * Modalità "Foglio": cerchia un'area e ne esce un PDF. Come Done, il pulsante
   * compare solo se il callback c'è — senza un canvas aperto non c'è niente da
   * stampare.
   */
  pdfMode?: boolean;
  onTogglePdfMode?: () => void;
  /**
   * RIORDINO: allinea gli oggetti sulla griglia e regolarizza le distanze senza
   * cambiare la disposizione. Come Foglio e Done, assente il callback il pulsante
   * non compare — senza una lavagna aperta non c'è niente da riordinare.
   */
  onTidy?: () => void;
  /** Cosa dice il tooltip: cambia se c'è una selezione (la pagina lo sa, la
   *  barra no). */
  tidyLabel?: string;
  /**
   * Tinge di verde le attività COMPLETATE. Non le filtra: i tile ci sono in
   * entrambi gli stati, cambia solo se si tingono.
   * Assente il callback, il pulsante non compare: è così che la barra si spegne
   * nello stato "nessun tag aperto".
   */
  doneHighlight?: boolean;
  onToggleDoneHighlight?: () => void;
  pinnedTags?: Tag[];
  onPinnedTagClick?: (tagId: string) => void;
  onUnpinTag?: (tagId: string) => void;
  /** Called with the new ordered list of tag ids after a drag-drop reorder. */
  onReorderPinned?: (orderedIds: string[]) => void;
}

export function CanvasTopbar({ tag, textMode, tileMode, imageMode, selectMode, markerMode = null, onPickMarker, subjectMode = false, onToggleSubjectMode, organizationMode = false, onToggleOrganizationMode, onToggleTextMode, onToggleTileMode, onToggleImageMode, onToggleSelectMode, pdfMode = false, onTogglePdfMode, onTidy, tidyLabel, doneHighlight = false, onToggleDoneHighlight, pinnedTags = [], onPinnedTagClick, onUnpinTag, onReorderPinned }: CanvasTopbarProps) {
  const theme = usePixelTheme();
  const chipBorderW = 1;
  /**
   * Forma, misure e colori delle linguette NON stanno più qui: sono `.ob-lug` in
   * app/obsidian-primitives.css, le stesse identiche delle sidebar. Erano una
   * quarantina di righe di stili inline — altezza, raggi, ancoraggio, fondi —
   * che ripetevano a mano quello che le sidebar dichiaravano in CSS, e che a
   * ogni ritocco andavano tenute allineate a occhio.
   *
   * Resta questo: metà della scatola del CONTENUTO della linguetta, su cui si
   * centra la crocetta di unpin, che è l'unica cosa che questa striscia ha in
   * più delle altre. Ora che la linguetta riempie la fascia coincide col centro
   * della barra, quindi la crocetta cade sulla riga del testo.
   */
  const TAB_CONTENT_MID = 'calc((var(--ob-toolbar-height) - 1px) / 2)';
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const handleDrop = (targetId: string) => {
    if (!draggingId || draggingId === targetId) {
      setDraggingId(null);
      setDropTargetId(null);
      return;
    }
    const ids = pinnedTags.map((t) => t.id);
    const from = ids.indexOf(draggingId);
    const to = ids.indexOf(targetId);
    if (from === -1 || to === -1) {
      setDraggingId(null);
      setDropTargetId(null);
      return;
    }
    const next = [...ids];
    next.splice(from, 1);
    next.splice(to, 0, draggingId);
    onReorderPinned?.(next);
    setDraggingId(null);
    setDropTargetId(null);
  };

  /**
   * La striscia mostra i pinnati NEL LORO ORDINE, sempre gli stessi e sempre al
   * loro posto: cambiare canvas accende una linguetta, non riordina la barra.
   *
   * Il tag corrente si aggiunge in testa solo quando NON è pinnato — lì è un
   * ospite, non una scheda che hai messo tu.
   */
  const isCurrentPinned = !!tag && pinnedTags.some((p) => p.id === tag.id);
  const strip = pinnedTags;

  return (
    <div
      className="shrink-0"
      /* Appiglio per il menu degli oggetti, che si stacca di 4px dal bordo
         BASSO di questa fascia: la misura si prende qui, non si ricopia. */
      data-ob-topbar=""
      style={{
        // Fascia sotto la navbar, come header staging e tabbar destra.
        // Scala verticale dello shell: 56 navbar · 48 fascia · 40 sotto-barre.
        // Il valore è il token `--ob-toolbar-height` (app/obsidian.css): questa
        // è la toolbar VERA del canvas, quella che l'utente vede, quindi deve
        // seguire il token come le toolbar dichiarate in CSS.
        height: 'var(--ob-toolbar-height)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        // 12 a sinistra come a destra: la prima linguetta non parte incollata al
        // bordo della lavagna, e i due margini della barra sono uguali.
        // Sta sulla BARRA e non sulla striscia, così resta anche quando le
        // linguette scorrono — un padding dentro lo scroller se ne andrebbe via
        // col primo trascinamento.
        padding: '0 12px',
        borderBottom: `${chipBorderW}px solid ${theme.border}`,
        // Bianca come le toolbar di Chrono e Kanban: la fascia dei comandi resta
        // sulla superficie chiara, non incassata.
        // ⚠️ Le linguette perdono così il loro stacco: l'attiva prende il fondo
        // della lavagna, che è lo stesso della barra, e a distinguerla restano
        // solo il contorno e il varco nella hairline. Da rivedere insieme al
        // resto delle strisce.
        background: 'var(--ob-surface)',
        // Il pannello sotto questa barra è la LAVAGNA, non una sponda: le
        // linguette leggono di qui il colore che devono prendere da accese.
        ['--lug-bg' as string]: 'var(--ob-canvas)',
      }}
    >
      {/* Lo SCROLL sta sul wrapper e il gruppo dentro: `overflow-x` diverso da
          `visible` fa ritagliare anche in verticale, e quello che verrebbe
          tagliato è il pixel con cui la linguetta attiva copre la hairline —
          cioè il varco. Le misure che lo evitano sono in `.ob-lugs-scroll`. */}
      <div className="ob-lugs-scroll">
      <div className="ob-lugs">
        {/* Il canvas corrente in testa SOLO se non è fra i pinnati. Se lo è, si
            accende al suo posto nella striscia (vedi `isActive` qui sotto):
            prima veniva tolto dalla lista e ridisegnato per primo, così
            cliccando una linguetta quella saltava in testa e tutte le altre
            slittavano — l'ordine dei pinnati è una cosa che hai deciso tu
            trascinandole, e cambiare canvas non deve rimescolarlo. */}
        {tag && !isCurrentPinned && (
          <div
            className="ob-lug ob-lug--active"
            style={{ cursor: 'default' }}
            title={`Canvas corrente: ${tag.name}`}
          >
            {tag.name}
          </div>
        )}
        {strip.map((pt, idx) => {
          const isDragging = draggingId === pt.id;
          const isDropTarget = dropTargetId === pt.id && draggingId !== pt.id;
          const draggingIdx = draggingId ? strip.findIndex((t) => t.id === draggingId) : -1;
          const insertAfter = draggingIdx !== -1 && draggingIdx < idx;
          const isActive = pt.id === tag?.id;
          return (
          <div
            key={pt.id}
            className={cn('ob-lug group', isActive && 'ob-lug--active')}
            draggable={!!onReorderPinned}
            onDragStart={(e) => {
              setDraggingId(pt.id);
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', pt.id);
            }}
            onDragOver={(e) => {
              if (!draggingId) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              if (draggingId !== pt.id) setDropTargetId(pt.id);
            }}
            onDragLeave={() => {
              setDropTargetId((curr) => (curr === pt.id ? null : curr));
            }}
            onDrop={(e) => {
              e.preventDefault();
              handleDrop(pt.id);
            }}
            onDragEnd={() => {
              setDraggingId(null);
              setDropTargetId(null);
            }}
            style={{
              // Forma, misure, centraggio e colori vengono dalla classe
              // `.ob-lug`: qui restano solo le due cose che questa striscia ha in
              // piu' — lo spazio a destra per la crocetta di unpin e il gesto di
              // riordino. (Anche il «larga quanto il nome» viene dal CSS ora:
              // `.ob-lugs-scroll .ob-lug`, condiviso con la barra del Kanban.)
              paddingRight: 26,
              cursor: 'grab',
              opacity: isDragging ? 0.4 : 1,
            }}
          >
            <button
              onClick={() => onPinnedTagClick?.(pt.id)}
              style={{
                // Eredita tutto dalla linguetta che lo contiene: è la sua area
                // cliccabile, non un controllo con un aspetto suo. L'ellissi sta
                // QUI e non sulla linguetta: il contenitore è un flex, e lì
                // `text-overflow` non ha su cosa applicarsi.
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'inherit',
                font: 'inherit',
                letterSpacing: 'inherit',
                padding: 0,
              }}
              title={`Apri "${pt.name}" in Canvas`}
            >
              {pt.name}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onUnpinTag?.(pt.id); }}
              draggable={false}
              onDragStart={(e) => e.stopPropagation()}
              className="hidden group-hover:flex"
              style={{
                position: 'absolute',
                right: 2,
                // Centrata sulla scatola del CONTENUTO (che esclude il padding
                // inferiore della linguetta), non sull'intera linguetta: così
                // resta sulla riga del testo.
                top: TAB_CONTENT_MID,
                transform: 'translateY(-50%)',
                width: 16,
                height: 16,
                alignItems: 'center',
                justifyContent: 'center',
                background: theme.surface,
                border: `${chipBorderW}px solid ${theme.border}`,
                borderRadius: 'var(--ob-radius-sm)',
                color: 'var(--ob-danger)',
                cursor: 'pointer',
              }}
              title="Rimuovi dal pin"
            >
              <IconPinnedOff size={9} />
            </button>
            {isDropTarget && (
              <div
                style={{
                  pointerEvents: 'none',
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  width: 3,
                  background: theme.accent,
                  ...(insertAfter ? { right: -4 } : { left: -4 }),
                }}
              />
            )}
          </div>
          );
        })}
      </div>
      </div>

      <div className="ob-tools">
        {/* I quattro MODI di disegno. Armato, il fondo resta acceso: cambia cosa
            fa il click sulla lavagna, e non può essere uno stato che si scopre
            provando. */}
        <ToolButton icon={<IconLasso size={16} stroke={1.6} />} label="Group" active={selectMode} onClick={onToggleSelectMode} />
        <ToolButton icon={<IconCube size={16} stroke={1.6} />} label="Tile" active={tileMode} onClick={onToggleTileMode} />
        <ToolButton icon={<IconArticle size={16} stroke={1.6} />} label="Text" active={textMode} onClick={onToggleTextMode} />
        <ToolButton icon={<IconPhoto size={16} stroke={1.6} />} label="Image" active={imageMode} onClick={onToggleImageMode} />
        {onPickMarker && <MarkerTool value={markerMode} onPick={onPickMarker} />}
        {onToggleSubjectMode && (
          <ToolButton
            icon={<IconUser size={16} stroke={1.6} />}
            label="Soggetto"
            active={subjectMode}
            onClick={onToggleSubjectMode}
          />
        )}
        {onToggleOrganizationMode && (
          <ToolButton
            icon={<IconBuilding size={16} stroke={1.6} />}
            label="Organizzazione"
            active={organizationMode}
            onClick={onToggleOrganizationMode}
          />
        )}
        {onTidy && (
          <>
            {/* Da solo fra due fili, e non è pignoleria: non aggiunge alla
                lavagna come i modi qui sopra, non la porta fuori come il PDF —
                rimette in ordine quello che c'è già. È anche l'unico comando
                della barra che modifica il documento SENZA passare da un gesto
                sulla lavagna, e stargli accanto lo farebbe scambiare per un
                modo da armare.
                Niente `active`: fa una cosa e finisce lì, non resta acceso
                (vedi la nota su `ToolButtonProps`). */}
            <div className="ob-toolsep" />
            <ToolButton
              icon={<IconGridDots size={16} stroke={1.6} />}
              label={tidyLabel ?? 'Ordina sulla griglia'}
              onClick={onTidy}
            />
          </>
        )}
        {onTogglePdfMode && (
          <>
            {/* Separato dai quattro qui sopra: quelli aggiungono qualcosa alla
                lavagna, questo la porta fuori. Stesso gesto (cerchia un'area),
                esito di natura diversa — e il divisore è quello che lo dice. */}
            <div className="ob-toolsep" />
            <ToolButton icon={<IconFileTypePdf size={16} stroke={1.6} />} label="PDF" active={pdfMode} onClick={onTogglePdfMode} />
          </>
        )}
        {/* Di la' dal filo i MODI DI GUARDARE: non sono modalita' di disegno
            come i quattro qui sopra — quelli cambiano cosa fa il click sulla
            lavagna, questi cambiano solo come la guardi. Compaiono con la
            lavagna: senza un canvas aperto non c'e' niente da guardare. */}
        {tag && (
          <>
            <div className="ob-toolsep" />
            <SparkIconsToggle />
          </>
        )}
        {onToggleDoneHighlight && (
          <>
            {/* La forma e' quella: una parola nuda, senza fondo e senza icona.
                ACCESO si tinge di VERDE, cioè del colore che accende sui tile: il
                comando mostra il suo effetto invece di descriverlo, e non serve
                nessun'altra evidenziazione. */}
            <ToolWord
              on={doneHighlight}
              tone="var(--ob-success)"
              onClick={onToggleDoneHighlight}
              title={doneHighlight
                ? 'Togli il verde dalle attività completate'
                : 'Evidenzia in verde le attività completate'}
            >
              Done
            </ToolWord>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Strumento OGGETTI — apre un menu con le forme che si possono posare sulla
 * lavagna, oggi i due marcatori di percorso.
 *
 * È l'unico strumento della barra a passare da un menu, e la ragione è che non
 * arma UNA cosa sola: gli altri quattro hanno un solo esito possibile, questo
 * deve prima farti scegliere quale oggetto. Una fila di pulsanti, uno per
 * oggetto, avrebbe allungato la barra a ogni forma aggiunta.
 *
 * ARMARE e APRIRE sono due cose separate, ed è la particolarità dello
 * strumento. Come gli altri quattro si disarma dopo aver posato una cosa (lo fa
 * la pagina, non questo componente: `handleAddMarkerAt` rimette `value` a null).
 * Il MENU però resta aperto, con la voce spenta: gli oggetti si mettono a
 * gruppi — un capolinea, tre nodi, un traguardo — e richiedere anche la
 * riapertura del menu avrebbe fatto tre click per oggetto invece di due.
 *
 * Conseguenza: il menu NON si chiude cliccando fuori. Fuori c'è la lavagna, che
 * è esattamente dove si posano gli oggetti — un click-fuori che chiude avrebbe
 * chiuso il menu alla prima posa, cioè sempre. Si chiude con la crocetta
 * d'angolo o ricliccando «Oggetti».
 */
function MarkerTool({ value, onPick }: { value: MarkerKind | null; onPick: (k: MarkerKind | null) => void }) {
  const [open, setOpen] = React.useState(false);
  /** Quota del bordo basso della barra: il menu ci si stacca di 4px. */
  const [top, setTop] = React.useState(0);
  const ref = React.useRef<HTMLDivElement>(null);

  const openMenu = () => {
    const bar = ref.current?.closest('[data-ob-topbar]')?.getBoundingClientRect();
    setTop((bar ? bar.bottom : 0) + 4);
    setOpen(true);
  };

  /** Chiudere DISARMA. Un menu chiuso con lo strumento ancora armato lascerebbe
   *  la lavagna a posare oggetti senza niente che lo dica. */
  const close = () => { setOpen(false); onPick(null); };

  /**
   * Cliccare una voce ARMA quella voce. Non è un interruttore: ricliccare quella
   * accesa la lascia accesa.
   *
   * Con il disarmo alla posa la voce accesa dura un click solo, quindi il caso
   * «riclicco quella già accesa» capita quasi solo a chi sta rimediando a una
   * scelta sbagliata — e spegnere lì avrebbe voluto dire un click a vuoto sulla
   * lavagna subito dopo. Per smettere ci sono già tre comandi che non si possono
   * fraintendere: la crocetta, il pulsante e Esc.
   */
  const pick = (k: MarkerKind) => onPick(k);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      {/* Armato, il pulsante SMETTE di essere generico: prende il disco e il
          nome dell'oggetto scelto. È l'unica cosa che resta visibile quando lo
          sguardo è sulla lavagna, e finché diceva «Oggetti» con un flag grigio
          non distingueva «armato su Goal» da «spento» — da lì il sospetto che
          lo strumento si disarmasse dopo ogni posa. */}
      <ToolButton
        icon={value ? <MarkerBadge kind={value} size={16} /> : <IconFlag size={16} stroke={1.6} />}
        label={value ? MARKER_SPEC[value].label : 'Oggetti'}
        active={open || !!value}
        onClick={() => (open ? close() : openMenu())}
      />
      {open && createPortal(
        /* Forma, centratura e stati stanno in `.ob-markermenu`
           (app/obsidian-canvas.css) — compreso il perché del portale. */
        <div className="ob-markermenu" style={{ top }}>
          <button type="button" className="ob-markermenu__close" onClick={close} title="Chiudi">
            <IconX size={12} stroke={2} />
          </button>
          {/* Le voci escono da `MARKER_SPEC`: aggiungere un marcatore è
              aggiungere una riga là, e il menu si adegua da solo. */}
          {MARKER_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => pick(k)}
              title={MARKER_SPEC[k].label}
              className={cn('ob-markermenu__item', value === k && 'ob-markermenu__item--on')}
            >
              <MarkerBadge kind={k} />
              {MARKER_SPEC[k].label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}

/* L'anteprima dell'oggetto — disegnarla invece di descriverla evita di dover
   spiegare a parole la differenza fra quattro simboli — sta in `MarkerBadge`,
   accanto a `MARKER_SPEC`: da quando lo stop non è più un disco col glifo
   dentro, una copia qui sarebbe rimasta indietro al primo cambio di faccia. */
