'use client';

import { useState } from 'react';
import { IconNote, IconLayoutGrid, IconPinnedOff, IconPhoto, IconLasso, IconFileTypePdf } from '@tabler/icons-react';
import { usePixelTheme } from '@/components/pixel';
import { ToolButton, ToolWord } from '@/components/primitives';
import { cn } from '@/lib/utils';
import type { Tag } from '@/types';

interface CanvasTopbarProps {
  tag: Tag | null;
  textMode: boolean;
  tileMode: boolean;
  imageMode: boolean;
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

export function CanvasTopbar({ tag, textMode, tileMode, imageMode, selectMode, onToggleTextMode, onToggleTileMode, onToggleImageMode, onToggleSelectMode, pdfMode = false, onTogglePdfMode, doneHighlight = false, onToggleDoneHighlight, pinnedTags = [], onPinnedTagClick, onUnpinTag, onReorderPinned }: CanvasTopbarProps) {
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
        <ToolButton icon={<IconLayoutGrid size={16} stroke={1.6} />} label="Tile" active={tileMode} onClick={onToggleTileMode} />
        <ToolButton icon={<IconNote size={16} stroke={1.6} />} label="Text" active={textMode} onClick={onToggleTextMode} />
        <ToolButton icon={<IconPhoto size={16} stroke={1.6} />} label="Image" active={imageMode} onClick={onToggleImageMode} />
        {onTogglePdfMode && (
          <>
            {/* Separato dai quattro qui sopra: quelli aggiungono qualcosa alla
                lavagna, questo la porta fuori. Stesso gesto (cerchia un'area),
                esito di natura diversa — e il divisore è quello che lo dice. */}
            <div className="ob-toolsep" />
            <ToolButton icon={<IconFileTypePdf size={16} stroke={1.6} />} label="PDF" active={pdfMode} onClick={onTogglePdfMode} />
          </>
        )}
        {onToggleDoneHighlight && (
          <>
            <div className="ob-toolsep" />
            {/* Non e' una modalita' di disegno come i quattro qui sopra — quelli
                cambiano cosa fa il click sulla lavagna, questo cambia solo come
                la guardi. Il separatore lo tiene a parte, e la forma pure: una
                parola nuda, senza fondo e senza icona.
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
