'use client';

/**
 * Gimmick · Obsidian — Kanban view.
 *
 * "Snappy sposta i tile da una colonna all'altra": colonne definite dall'utente
 * coi propri filtri, ognuna con la sua lista ordinata di card.
 *
 * Le card erano raggruppate per giorno, con una pillola di intestazione per
 * data. Il raggruppamento e' stato tolto quando la card ha cominciato a portare
 * la propria data nel footer: l'intestazione diceva la stessa cosa a due
 * centimetri di distanza, e spezzava la colonna in blocchi per un'informazione
 * che ogni tile porta gia' con se'.
 *
 * ─── La griglia si misura da sola ───────────────────────────────────────────
 *
 * La larghezza di una colonna NON e' un numero nel CSS: la calcola `autoSlots`
 * dal numero di tile nella cella piu' piena di quella colonna. Una colonna vuota
 * resta stretta e regala il suo spazio a quelle piene; quando i tile si spostano
 * la board si ridisegna alla misura nuova.
 *
 * Sopra l'automatismo c'e' la mano dell'utente: trascinando il bordo di una
 * testata (o il bordo basso di un binario) si fissa la misura, e da quel momento
 * quella riga o colonna non si adatta piu'. «Adatta» nella toolbar cancella
 * tutte le misure fissate e restituisce la board al calcolo.
 *
 * Autonomo — si monta nel ViewContainer dello shell con `hideToolbar`.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  IconGripVertical, IconDots, IconArrowAutofitWidth,
  IconColumnInsertRight, IconRowInsertBottom, IconCube, IconTransform,
} from '@tabler/icons-react';
import { ToolButton, ToolWord } from '@/components/primitives';
import { SparkIconsToggle } from '@/components/tiles/SparkIconsToggle';
import { Icon } from '@/components/shell';
import { Tile } from '@/components/tiles/Tile';
import {
  autoSlots, colWidth, rowsIn, slotsFor, COL_COLLAPSED_W, MIN_COL_W, MIN_ROW_H,
  RAIL_CHROME, RAIL_KEY, RAIL_MIN, RAIL_MAX,
} from '@/lib/kanban-layout';

/** Cosa si sta trascinando: larghezza di colonna, altezza di corsia, o la
 *  larghezza del binario dei nomi (che e' orizzontale come la prima, ma vive
 *  nel ripiano della seconda — vedi `RAIL_KEY`). */
type ResizeKind = 'col' | 'row' | 'rail';
import type { StepState, TileStatus, TileVisualKey } from '@/lib/tile-visual';
import type { SparkType } from '@/types';

// ─── Model ────────────────────────────────────────────────────────────────────

export interface CardData {
  /** Presente quando la vista è collegata ai dati reali. */
  id?: string;
  title: string;
  /** Portato ma NON reso sulla card: il sistema visivo non ha un canale per il
   *  tag. Resta qui perché è l'unico segnale che le lane non danno già (non
   *  sono raggruppate per tag) e serve a chi volesse rimetterlo sotto la card. */
  tag: string;
  /** Ripiego d'accento per le scadenze quando `accent` non arriva. */
  amber?: boolean;
  /** I passi GIÀ tradotti in stati di segmento (`subtaskToStep`). Erano dei
   *  booleani, e un booleano non sa dire «fermo»: il rosso non poteva arrivare
   *  fin qui. */
  steps?: StepState[];
  /** Tile completato (is_completed) → si legge come status `done`. */
  done?: boolean;
  /** Chiave grafica risolta con `tileVisualKey()`: bordo, badge e metadato. */
  visualKey?: TileVisualKey;
  /** Nome grezzo dello status (`active`, `paused`…) — non l'etichetta tradotta. */
  statusName?: TileStatus;
  /** Metadato del footer destro, già formattato (data, orario, progressione). */
  meta?: string;
  /** I TIPI degli spark allegati (grezzi, con i doppioni) → pallini nel footer. */
  sparks?: SparkType[];
  /** Colore che tinge fondo, bordo e badge. Dalle impostazioni, mai un hex qui. */
  accent?: string;
  /** In FOCUS: l'attività su cui si sta lavorando adesso → cornice rossa
   *  tratteggiata tutt'intorno al tile. Vive sul tile, quindi si vede in ogni
   *  vista che lo disegna — un segno che sparisce cambiando scheda non è un
   *  segno. */
  focused?: boolean;
  /**
   * Card PROVVISORIA: la tile che il doppio click ha appena chiesto, disegnata
   * mentre il server la crea. Non si trascina e non si apre — il suo `id` non
   * esiste ancora da nessuna parte.
   */
  ghost?: boolean;
}
export interface Lane {
  /** Id colonna reale (target del drag-drop). */
  id?: string;
  label: string;
  color: string;
  /**
   * I tile della colonna, gia' ordinati. Erano raggruppati per giorno, con una
   * pillola di intestazione per data: quell'intestazione e' diventata ridondante
   * quando la card ha cominciato a portare la propria data nel footer, e diceva
   * due volte la stessa cosa a due centimetri di distanza.
   */
  tiles: CardData[];
}

const LANES: Lane[] = [
  {
    label: 'NOTE', color: 'var(--ob-muted)', tiles: [
      { title: 'Appuntamento con Marco Guerrieri', tag: 'OM' },
      { title: 'Moodboard cucina Ortano — riferimenti materiali', tag: 'GDS' },
    ],
  },
  {
    label: 'DA FARE', color: 'var(--ob-muted)', tiles: [
      { title: 'Revoca certificato digitale Aruba', tag: 'OM', amber: true, steps: ['done', 'done', 'pending'] },
      { title: 'Preparare brief Teleport per Marco', tag: 'GDS', steps: ['done', 'pending', 'pending', 'pending'] },
      { title: 'Lista materiali cucina', tag: 'OM', amber: true, steps: ['pending', 'pending'] },
    ],
  },
  {
    label: 'PROGRAMMATI', color: 'var(--ob-success)', tiles: [
      { title: 'Audio e incontro con Marco', tag: 'OM' },
      { title: 'GDS/bisdomini — sopralluogo', tag: 'GDS', amber: true },
    ],
  },
  {
    label: 'SCADENZE', color: 'var(--ob-error)', tiles: [
      { title: 'Aruba — rinnovo certificato', tag: 'OM', amber: true },
      { title: 'Rinnovo polizza Unipol casa', tag: 'OM', amber: true },
    ],
  },
  {
    label: 'FATTI', color: 'var(--ob-success)', tiles: [
      { title: 'Itinerario Lisbona confermato', tag: 'Viaggio', steps: ['done', 'done', 'done'] },
      { title: 'Demo prodotto v2 rivista', tag: 'GDS' },
    ],
  },
  { label: 'FAMIGLIA', color: 'var(--ob-warning)', tiles: [] },
];

// ─── Subcomponents ────────────────────────────────────────────────────────────

/**
 * La card della lane è il `Tile` del sistema visivo, come in Chrono, nel canvas
 * e nello staging. Misura già 160×90 come il Tile, quindi l'ingombro nella lane
 * non cambia: cambia cosa la card dice.
 *
 * ⚠️ Quattro segnali che la card del Kanban aveva e che il Tile NON ha:
 * le cap-chip dei tipi di spark, il chip del type-icon, l'etichetta del TAG e il
 * contatore degli spark. Non hanno un canale nel sistema — i cinque canali sono
 * bordo, badge, strip, status e metadato, e sono pieni. Restano tutti leggibili
 * aprendo il tile; il tag in più è l'unico che qui portava informazione che le
 * colonne non danno già, perché le lane del Kanban non sono per tag.
 *
 * Il contenitore resta per il TRASCINAMENTO fra lane, che il Tile non fa apposta
 * per restare presentazionale, e per la gronda in cui sborda il badge d'angolo.
 */
function TileCard({ t, onClick, onMenu, active }: {
  t: CardData;
  onClick?: () => void;
  /** Tasto destro (o ctrl/cmd+click) sulla card → menu della tile. */
  onMenu?: (e: React.MouseEvent) => void;
  active?: boolean;
}) {
  const draggable = !!t.id && !t.ghost;
  // `is_completed` e lo status `done` sono tenuti allineati dal database
  // (migration 015): qui valgono come la stessa cosa.
  const status: TileStatus = t.done ? 'done' : (t.statusName ?? 'active');
  return (
    <div
      className="ob-kanban__cell"
      draggable={draggable}
      onDragStart={draggable ? (e) => { e.dataTransfer.setData('text/x-tile', t.id!); e.dataTransfer.effectAllowed = 'move'; } : undefined}
      // Il menu sta sulla GRONDA e non sul tile: la ghost non prende il
      // puntatore, e comunque è di qui che passano tutti gli eventi della card.
      onContextMenu={onMenu}
      // Ctrl/cmd+click apre lo stesso menu — è il tasto destro di chi ha un
      // trackpad. In CATTURA e con la propagazione fermata: senza, il click
      // arriverebbe anche al tile e selezionerebbe la card mentre apre il menu.
      onClickCapture={onMenu ? (e) => {
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();
        e.stopPropagation();
        onMenu(e);
      } : undefined}
    >
      <Tile
        title={t.title}
        visualKey={t.visualKey ?? 'none'}
        status={status}
        steps={t.steps}
        meta={t.meta}
        sparks={t.sparks}
        accent={t.accent ?? (t.amber ? 'var(--ob-warning)' : undefined)}
        focused={t.focused}
        ghost={t.ghost}
        active={active}
        onClick={onClick}
      />
    </div>
  );
}

/** Tipi MIME dei tre trascinamenti che la board conosce. Distinti perche' la
 *  colonna e' bersaglio di piu' d'uno e deve sapere cosa sta ricevendo. */
const COL_MIME = 'text/x-kanban-col';
const ROW_MIME = 'text/x-kanban-row';
const TILE_MIME = 'text/x-tile';

/**
 * Testata di una colonna. Estratta perché con le corsie va disegnata UNA VOLTA
 * SOLA in cima alla griglia, non ripetuta in ogni fascia: ripetendola, cinque
 * corsie moltiplicavano per cinque le stesse cinque intestazioni, e la board
 * diventava un elenco di titoli con qualche tile in mezzo.
 */
function LaneHead({
  lane, collapsed, onToggleCollapse, onLaneMenu, onReorder, onResizeStart, style,
}: {
  lane: Pick<Lane, 'id' | 'label'>;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onLaneMenu?: (e: React.MouseEvent, laneId: string) => void;
  onReorder?: (fromId: string, toId: string) => void;
  /** Riceve il gesto e la larghezza ATTUALE misurata sul posto: partire dalla
   *  larghezza calcolata farebbe saltare la colonna al primo pixel, perche' con
   *  `flex-grow` quella resa e' quasi sempre maggiore. */
  onResizeStart?: (e: React.PointerEvent, from: number) => void;
  style?: React.CSSProperties;
}) {
  const [gripArmed, setGripArmed] = React.useState(false);
  const [colOver, setColOver] = React.useState(false);
  const canReorder = !!onReorder && !!lane.id;
  return (
    <div
      className={cn(
        'ob-kanban__lane-head',
        // Nella riga fissa la testata NON sta dentro `.ob-kanban__lane`, quindi
        // lo stile della colonna compressa non la raggiungerebbe: se lo porta da
        // sola.
        collapsed && 'ob-kanban__lane-head--collapsed',
        colOver && 'ob-kanban__lane-head--colover',
      )}
      style={style}
      draggable={canReorder && gripArmed}
      onDragStart={(e) => {
        e.dataTransfer.setData(COL_MIME, lane.id!);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragEnd={() => setGripArmed(false)}
      // Il riordino si fa sulla TESTATA, non sul corpo: nella griglia il corpo
      // di una colonna e' spezzato in tante celle quante sono le corsie, e la
      // testata e' l'unico pezzo che rappresenta la colonna intera.
      onDragOver={(e) => {
        if (!canReorder || !e.dataTransfer.types.includes(COL_MIME)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setColOver(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setColOver(false);
      }}
      onDrop={(e) => {
        const from = e.dataTransfer.getData(COL_MIME);
        setColOver(false);
        if (!from || !canReorder || from === lane.id) return;
        e.preventDefault();
        onReorder!(from, lane.id!);
      }}
    >
      <span
        className="ob-kanban__lane-grip"
        onMouseDown={() => canReorder && setGripArmed(true)}
        onMouseUp={() => setGripArmed(false)}
        title={canReorder ? 'Trascina per spostare la colonna' : undefined}
        style={canReorder ? { cursor: 'grab' } : undefined}
      ><IconGripVertical size={11} stroke={1.6} /></span>
      <span className="ob-kanban__lane-label" title={lane.label}>{lane.label}</span>
      <div style={{ flex: 1 }} />
      <button
        type="button"
        className="ob-kanban__lane-btn"
        aria-label={collapsed ? 'Espandi' : 'Comprimi'}
        // Compressa nella griglia resta il solo chevron: il titolo lo dice il
        // tooltip, perche' aprire il nome in verticale alzerebbe la riga fissa
        // delle intestazioni — che e' una sola e vale per tutte le colonne.
        title={collapsed ? `Espandi "${lane.label}"` : 'Comprimi la colonna'}
        aria-expanded={!collapsed}
        onClick={onToggleCollapse}
      ><Icon name={collapsed ? 'chevL' : 'chevR'} size={12} /></button>
      {onLaneMenu && lane.id && (
        <button
          type="button"
          className="ob-kanban__lane-btn"
          aria-label="Altro"
          title="Rinomina, sposta o elimina la colonna"
          onClick={(e) => onLaneMenu(e, lane.id!)}
        ><IconDots size={12} stroke={1.6} /></button>
      )}
      {onResizeStart && !collapsed && lane.id && (
        <span
          className="ob-kanban__rsz ob-kanban__rsz--col"
          title="Trascina per fissare la larghezza"
          onPointerDown={(e) => {
            const head = (e.currentTarget as HTMLElement).closest('.ob-kanban__lane-head') as HTMLElement | null;
            onResizeStart(e, head?.offsetWidth ?? MIN_COL_W);
          }}
        />
      )}
    </div>
  );
}

/** Il corpo di una colonna: le card, e il bersaglio del drop di un tile. */
function LaneBody({
  lane, onCardClick, onCardMenu, selectedId, onMoveTile, onCreateInCell, onReorder, collapsed, head, rowId, style,
}: {
  lane: Lane;
  onCardClick?: (id: string) => void;
  onCardMenu?: (e: React.MouseEvent, tileId: string) => void;
  selectedId?: string;
  onMoveTile?: (tileId: string, colId: string, rowId?: string) => void;
  onCreateInCell?: (colId: string, rowId?: string) => void;
  onReorder?: (fromId: string, toId: string) => void;
  collapsed: boolean;
  /** La testata, quando la colonna la porta con sé (board senza corsie). */
  head?: React.ReactNode;
  /** La corsia a cui questa cella appartiene: il drop applica ENTRAMBI gli assi. */
  rowId?: string;
  style?: React.CSSProperties;
}) {
  const [dragOver, setDragOver] = React.useState(false);
  const [colOver, setColOver] = React.useState(false);
  const canDrop = !!onMoveTile && !!lane.id;
  const canCreate = !!onCreateInCell && !!lane.id;
  const canReorder = !!onReorder && !!lane.id;
  return (
    <div
      className={cn(
        'ob-kanban__lane',
        collapsed && 'ob-kanban__lane--collapsed',
        dragOver && 'ob-kanban__lane--dropover',
        colOver && 'ob-kanban__lane--colover',
      )}
      style={{ ...style, ['--lane-c' as string]: lane.color }}
      onDragOver={(e) => {
        const isCol = e.dataTransfer.types.includes(COL_MIME);
        if (isCol ? !canReorder : !canDrop) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (isCol) setColOver(true); else setDragOver(true);
      }}
      onDragLeave={(e) => {
        // Solo quando si esce davvero dalla colonna: entrando in un figlio
        // parte comunque un dragleave, e l'evidenziazione sfarfallerebbe.
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setDragOver(false); setColOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false); setColOver(false);
        const from = e.dataTransfer.getData(COL_MIME);
        if (from) { if (canReorder && from !== lane.id) onReorder!(from, lane.id!); return; }
        const id = e.dataTransfer.getData(TILE_MIME);
        if (id && canDrop) onMoveTile!(id, lane.id!, rowId);
      }}
    >
      {head}
      <div
        className="ob-kanban__lane-body ob-scroll"
        hidden={collapsed}
        // Doppio click sul VUOTO della cella → nasce una tile qui dentro. Sulle
        // card no: lì il doppio click è due click sulla stessa tile, e creare
        // qualcosa sarebbe l'ultima cosa che ti aspetti.
        //
        // Si guarda anche la GRONDA (`.ob-kanban__cell`) e non solo il tile: la
        // ghost non prende il puntatore, quindi il bersaglio dell'evento è la
        // sua gronda — e un secondo doppio click sulla tile appena chiesta
        // avrebbe fatto nascere la seconda.
        onDoubleClick={canCreate ? (e) => {
          if ((e.target as HTMLElement).closest('.ob-tile, .ob-kanban__cell')) return;
          onCreateInCell!(lane.id!, rowId);
        } : undefined}
        title={canCreate ? 'Doppio click per creare una tile qui' : undefined}
      >
        {/* Una cella vuota resta vuota: niente scritta. Con una griglia le celle
            vuote sono la maggioranza, e ripetere "nessun tile" in ognuna riempie
            la board di rumore per dire una cosa che si vede da sola. Lo spazio
            resta comunque aperto (min-height sulla colonna) perche' e' li' che
            si rilascia un tile. */}
        {lane.tiles.map((t, ti) => (
          <TileCard
            key={t.id ?? ti}
            t={t}
            active={!!t.id && t.id === selectedId}
            // La ghost non si apre e non ha menu: il suo id vive solo in questa
            // cache, e ogni comando andrebbe su un tile che il server non ha.
            onClick={onCardClick && t.id && !t.ghost ? () => onCardClick(t.id!) : undefined}
            onMenu={onCardMenu && t.id && !t.ghost ? (e) => onCardMenu(e, t.id!) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

function LaneCol({
  lane, onCardClick, onCardMenu, selectedId, onMoveTile, onCreateInCell, onLaneMenu, onReorder, onResizeStart, style,
  collapsed, onToggleCollapse,
}: {
  lane: Lane;
  onCardClick?: (id: string) => void;
  onCardMenu?: (e: React.MouseEvent, tileId: string) => void;
  selectedId?: string;
  onMoveTile?: (tileId: string, colId: string, rowId?: string) => void;
  onCreateInCell?: (colId: string, rowId?: string) => void;
  onLaneMenu?: (e: React.MouseEvent, laneId: string) => void;
  onReorder?: (fromId: string, toId: string) => void;
  onResizeStart?: (e: React.PointerEvent, from: number) => void;
  style?: React.CSSProperties;
  /** Il collasso sta nella vista, non qui: e' la vista che calcola la larghezza
   *  della colonna, e con lo stato chiuso qui dentro avrebbe continuato a
   *  disegnarla larga come i suoi tile mentre il corpo era gia' sparito. */
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  return (
    <LaneBody
      lane={lane}
      onCardClick={onCardClick}
      onCardMenu={onCardMenu}
      selectedId={selectedId}
      onMoveTile={onMoveTile}
      onCreateInCell={onCreateInCell}
      onReorder={onReorder}
      collapsed={collapsed}
      style={style}
      head={
        <LaneHead
          lane={{ id: lane.id, label: lane.label }}
          collapsed={collapsed}
          onToggleCollapse={onToggleCollapse}
          onLaneMenu={onLaneMenu}
          onReorder={onReorder}
          onResizeStart={onResizeStart}
        />
      }
    />
  );
}

export interface KanbanViewProps {
  lanes?: Lane[];
  onCardClick?: (id: string) => void;
  /**
   * Tasto destro — o ctrl/cmd+click — su una card: il menu della tile. Assente
   * il callback, il gesto non fa niente (anteprime senza dati veri).
   */
  onCardMenu?: (e: React.MouseEvent, tileId: string) => void;
  selectedId?: string;
  onAddTile?: () => void;
  /** Drop di un tile in una cella → applica i filtri di colonna E di corsia. */
  onMoveTile?: (tileId: string, colId: string, rowId?: string) => void;
  /**
   * Doppio click sul vuoto di una cella → crea lì una tile, con i valori che la
   * cella impone (gli stessi che il drop applicherebbe a un tile trascinato).
   */
  onCreateInCell?: (colId: string, rowId?: string) => void;
  /** SOLO i tag pinnati, nell'ordine in cui l'utente li ha messi. La barra non
   *  e' un elenco di tag: e' la scorciatoia alle poche cose che tieni sott'occhio,
   *  esattamente come la tab-strip del canvas. Vuoto = nessuna linguetta. */
  tagPills?: { id: string; label: string; color?: string }[];
  /** Tag che la board sta mostrando. Vuoto = nessun filtro, cioè tutti i tile.
   *  Più d'uno quando li si prende con ctrl/cmd+click: la board mostra l'unione. */
  activeTags?: string[];
  /** `additive` = ctrl/cmd premuto: aggiungi/togli invece di sostituire. */
  onTagChange?: (id: string, additive: boolean) => void;
  onAddColumn?: () => void;
  onAddLane?: () => void;
  /**
   * Ruota la board: quello che divideva in verticale passa in orizzontale e
   * viceversa. Non è un riordino — è la stessa board guardata da un'altra parte.
   */
  onSwapAxes?: () => void;
  /**
   * Perché lo scambio non si può fare adesso. Presente = pulsante spento, e la
   * frase finisce nel tooltip: un comando disattivato che non dice perché è un
   * comando che sembra rotto.
   */
  swapBlockedReason?: string;
  /**
   * Le corsie orizzontali. Ognuna diventa una FASCIA che contiene la stessa
   * fila di colonne, con dentro solo i tile della corsia. Vuoto = board a una
   * dimensione, cioe' esattamente com'era prima che le corsie esistessero.
   */
  bands?: { id: string; label: string; lanes: Lane[] }[];
  /** Quale asse e' in modalita' DATA: solo quello scorre all'infinito. */
  dateAxis?: { column: boolean; lane: boolean };
  /** Allarga la finestra dei giorni quando lo scorrimento tocca un bordo. */
  onGrowDates?: (which: 'column' | 'lane', side: 'start' | 'end') => void;
  onLaneMenu?: (e: React.MouseEvent, laneId: string) => void;
  /** Riordino delle colonne per trascinamento della maniglia. */
  onReorder?: (fromId: string, toId: string) => void;
  /** Riordino delle corsie, stesso gesto sul binario dei nomi. */
  onReorderRow?: (fromId: string, toId: string) => void;
  /** Misure FISSATE a mano. Le voci assenti si adattano al contenuto. */
  colSize?: Record<string, number>;
  rowSize?: Record<string, number>;
  /** Fine di un trascinamento del bordo: una scrittura per gesto, non per pixel. */
  onResize?: (kind: ResizeKind, id: string, px: number) => void;
  /** Cancella misure e ordine fissati a mano e torna al calcolo automatico. */
  onReset?: () => void;
  /**
   * Tinge di verde le attività COMPLETATE, come il pulsante "Done" della topbar
   * del canvas. Non le filtra: le card ci sono in entrambi gli stati, cambia
   * solo se si tingono.
   * Assente il callback, il pulsante non compare (anteprime senza dati veri).
   */
  doneHighlight?: boolean;
  onToggleDoneHighlight?: () => void;
}

export function KanbanView({
  lanes = LANES, onCardClick, onCardMenu, selectedId, onAddTile, onMoveTile, onCreateInCell,
  tagPills, activeTags, onTagChange,
  onAddColumn, onAddLane, onSwapAxes, swapBlockedReason,
  onLaneMenu, onReorder, onReorderRow, bands, dateAxis, onGrowDates,
  colSize, rowSize, onResize, onReset, doneHighlight = false, onToggleDoneHighlight,
}: KanbanViewProps) {
  /**
   * Scorrimento infinito dell'asse DATA.
   *
   * A 120px dal bordo si chiede un altro tratto di giorni. La soglia non e' zero
   * apposta: allargando esattamente al bordo la board si fermerebbe un istante a
   * ogni giro, mentre cosi' i giorni nuovi sono gia' li' quando ci arrivi.
   *
   * ⚠️ Allargando all'INIZIO il contenuto cresce a sinistra e il browser tiene
   * fermo `scrollLeft`: la vista slitterebbe indietro di sette colonne. Si
   * compensa spostando lo scorrimento della stessa quantita' — la mano resta
   * dov'era e i giorni nuovi entrano da fuori.
   */
  // Con le corsie il collasso di una colonna vale per TUTTE le fasce: la testata
  // e' una sola, e comanda l'intera colonna.
  const active = React.useMemo(() => new Set(activeTags), [activeTags]);

  const [collapsedCols, setCollapsedCols] = React.useState<Set<string>>(new Set());
  const toggleCol = (key: string) => setCollapsedCols((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const EDGE = 120;
  const onEdgeScroll = (which: 'column' | 'lane') => (e: React.UIEvent<HTMLDivElement>) => {
    if (!onGrowDates) return;
    const el = e.currentTarget;
    const horizontal = which === 'column';
    const pos = horizontal ? el.scrollLeft : el.scrollTop;
    const size = horizontal ? el.clientWidth : el.clientHeight;
    const total = horizontal ? el.scrollWidth : el.scrollHeight;
    if (pos < EDGE) {
      const before = total;
      onGrowDates(which, 'start');
      requestAnimationFrame(() => {
        const grown = (horizontal ? el.scrollWidth : el.scrollHeight) - before;
        if (grown > 0) { if (horizontal) el.scrollLeft += grown; else el.scrollTop += grown; }
      });
    } else if (pos + size > total - EDGE) {
      onGrowDates(which, 'end');
    }
  };

  // ── Ridimensionamento a mano ────────────────────────────────────────────────
  /**
   * Durante il gesto la misura vive QUI, non nelle impostazioni: la board si
   * ridisegna a ogni pixel, e chi salva riceve un valore solo, al rilascio.
   * Salvare durante il trascinamento significherebbe una PATCH ogni pixel.
   */
  const [resizing, setResizing] = React.useState<{ kind: ResizeKind; id: string; px: number } | null>(null);
  // Il valore finale passa da un ref e non dallo stato: al `pointerup` lo stato
  // e' gia' quello del render corrente, e leggerlo dentro l'updater sarebbe un
  // effetto collaterale in fase di render (in StrictMode, due salvataggi).
  const lastPx = React.useRef(0);

  const beginResize = (kind: ResizeKind, id: string) => (e: React.PointerEvent, from: number) => {
    if (!onResize) return;
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget as HTMLElement;
    // Solo l'altezza delle corsie e' un gesto verticale: le larghezze — colonne
    // e binario — si trascinano in orizzontale.
    const axis = kind === 'row' ? 'clientY' : 'clientX';
    const p0 = e[axis];
    const min = kind === 'row' ? MIN_ROW_H : kind === 'rail' ? RAIL_MIN : MIN_COL_W;
    lastPx.current = from;
    setResizing({ kind, id, px: from });
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const next = Math.max(min, Math.round(from + (ev[axis] - p0)));
      lastPx.current = next;
      setResizing({ kind, id, px: next });
    };
    const end = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', end);
      el.removeEventListener('pointercancel', end);
      setResizing(null);
      onResize(kind, id, lastPx.current);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  };

  /** L'altezza data a mano a una corsia: quella del gesto in corso, se c'e',
   *  altrimenti quella salvata. E' un PAVIMENTO, non una misura fissa — la
   *  corsia la supera quando i tile non ci starebbero. `undefined` = nessuna
   *  misura data, la corsia segue il contenuto e basta. */
  const rowHeightOf = (id: string): number | undefined =>
    (resizing?.kind === 'row' && resizing.id === id ? resizing.px : rowSize?.[id]);

  // ── Larghezza delle colonne ─────────────────────────────────────────────────
  /**
   * Quanti posti affiancati chiede ogni colonna. E' il MASSIMO fra le sue celle e
   * non la somma: la larghezza serve alla cella che deve contenere i tile, e una
   * colonna con dieci tile sparsi su dieci corsie ne ha uno per cella.
   *
   * Il conto dipende da come e' messa la corsia in cui la cella si trova:
   *
   *   · corsia LIBERA (altezza dal contenuto) → `autoSlots`: la cella si tiene
   *     quadrata, e se i tile non ci stanno in larghezza vanno a capo e alzano
   *     la corsia.
   *   · corsia con un'altezza DATA a mano → le file sono quelle che ci stanno in
   *     quella misura, quindi la larghezza e' la prima cosa a cedere:
   *     `slotsFor` chiede i posti che servono a starci.
   *
   * E' questo che rende reversibile il gesto sulla corsia: abbassandola i tile si
   * allargano e la colonna cresce, rialzandola tornano a impilarsi e la colonna
   * si stringe. Durante il trascinamento la misura arriva da `resizing`, quindi
   * la board si ridisegna mentre trascini e non al rilascio.
   *
   * Se i posti non bastano — il tetto e' `MAX_SLOTS` — a cedere torna a essere
   * l'altezza: la corsia cresce oltre la misura che le hai dato invece di
   * tagliare i tile. La misura e' un pavimento, non una gabbia.
   */
  const colSlots = React.useMemo(() => {
    const m = new Map<string, number>();
    const need = (l: Lane, slots: number) => {
      const k = l.id ?? l.label;
      m.set(k, Math.max(m.get(k) ?? 0, slots));
    };
    if (bands?.length) {
      bands.forEach((b) => {
        const h = rowHeightOf(b.id);
        const rows = h ? rowsIn(h) : 0;
        b.lanes.forEach((l) => need(l, rows ? slotsFor(l.tiles.length, rows) : autoSlots(l.tiles.length)));
      });
    } else {
      lanes.forEach((l) => need(l, autoSlots(l.tiles.length)));
    }
    return m;
    // `resizing` e `rowSize` entrano perche' `rowHeightOf` li legge: sono loro a
    // dire quali corsie hanno un'altezza fissata, e quindi quali celle contano
    // le file invece di tenersi quadrate.
  }, [bands, lanes, rowSize, resizing]);

  /**
   * `flex-grow` pari agli slot e `flex-shrink: 0`: le colonne non scendono mai
   * sotto la misura che serve ai loro tile, e lo spazio che avanza va a quelle
   * che ne hanno di piu'. Una colonna con misura FISSATA non cresce: `0 0 Npx`.
   *
   * ⚠️ Lo stesso stile va alla testata e alla cella. Sono due contenitori flex
   * diversi (la riga fissa e la fascia) e restano allineati solo perche' hanno
   * gli stessi identici numeri: quando erano due regole CSS separate si erano
   * gia' scostate di due pixel per colonna.
   *
   * ⚠️⚠️ `width` ACCANTO A `flex-basis` NON E' UN DOPPIONE. Per la dimensione
   * usata non serve — comanda la base flex — ma serve per la dimensione
   * INTRINSECA, cioe' quando il browser calcola quanto e' larga al massimo la
   * fascia (`width: max-content`). In quel calcolo il ritorno a capo viene
   * ignorato: una cella con 25 tile viene misurata come se stessero tutti su una
   * riga, ~1950px invece dei 322 che occupa davvero, e quella misura gonfia la
   * fascia che la contiene. Risultato: la corsia piu' piena diventava molto piu'
   * larga delle altre e le sue colonne non tornavano piu' con l'intestazione.
   * Una larghezza DEFINITA chiude la domanda al contenuto: la colonna e' larga
   * quanto dice qui, e quanti tile ci stiano dentro non riguarda nessuno.
   * (Vale anche per le testate: un titolo lungo, che e' `nowrap`, gonfiava allo
   * stesso modo la riga fissa.)
   */
  const colStyle = React.useCallback((key: string): React.CSSProperties => {
    const pin = (px: number): React.CSSProperties =>
      ({ flex: `0 0 ${px}px`, width: px, minWidth: px, maxWidth: px });
    if (collapsedCols.has(key)) return pin(COL_COLLAPSED_W);
    const fixed = resizing?.kind === 'col' && resizing.id === key ? resizing.px : colSize?.[key];
    if (fixed) return pin(fixed);
    const slots = colSlots.get(key) ?? 1;
    const basis = colWidth(slots);
    return { flex: `${slots} 0 ${basis}px`, width: basis, minWidth: basis };
  }, [collapsedCols, resizing, colSize, colSlots]);

  // ── Riordino delle corsie ───────────────────────────────────────────────────
  const [rowGrip, setRowGrip] = React.useState<string | null>(null);
  const [rowOver, setRowOver] = React.useState<string | null>(null);

  // ── Larghezza del binario dei nomi ──────────────────────────────────────────
  /**
   * La prima colonna si adatta al nome di corsia piu' lungo.
   *
   * La misura si prende col `measureText` di un canvas e non dal DOM: i binari
   * sono uno per fascia, e per misurarli "a contenuto" bisognerebbe prima
   * lasciarli allargare — cioe' disegnare una griglia sbagliata e poi
   * correggerla, con lo sfarfallio annesso. Il canvas da' la larghezza del testo
   * senza disegnare niente, e la misura la ricevono tutti i binari insieme.
   *
   * Il font NON e' scritto qui: si legge da un'etichetta vera, cosi' se i token
   * tipografici cambiano la misura li segue da sola.
   */
  const labelRef = React.useRef<HTMLSpanElement | null>(null);
  const [railW, setRailW] = React.useState(RAIL_MIN);
  React.useLayoutEffect(() => {
    const el = labelRef.current;
    if (!el || !bands?.length) return;
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return;
    const cs = getComputedStyle(el);
    ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const widest = bands.reduce((m, b) => Math.max(m, ctx.measureText(b.label).width), 0);
    const next = Math.round(Math.min(RAIL_MAX, Math.max(RAIL_MIN, widest + RAIL_CHROME)));
    // Solo se cambia davvero: assegnare lo stesso valore in un layout effect
    // rimette in coda un render a ogni giro.
    setRailW((w) => (w === next ? w : next));
  }, [bands]);

  /**
   * La misura che il binario usa davvero. La mano dell'utente batte il calcolo,
   * come per colonne e corsie — ma il calcolo continua a girare sotto, cosi'
   * togliendo la misura fissata (con «Adatta») il binario e' gia' pronto con
   * quella giusta.
   */
  const railPx = (resizing?.kind === 'rail' ? resizing.px : rowSize?.[RAIL_KEY]) ?? railW;

  return (
    <div
      // Il binario si trascina in orizzontale, quindi durante il gesto veste il
      // cursore delle colonne: `rsz-rail` non esiste in CSS ed e' giusto cosi'.
      // `ob-done-hl` accende il verde sulle card completate: una classe sul
      // contenitore della board, come sul canvas, e la regola di contesto in
      // obsidian-primitives.css fa il resto. Le card non sanno di essere in una
      // board evidenziata — restano `Tile` presentazionali.
      className={cn(
        'ob-kanban',
        doneHighlight && 'ob-done-hl',
        resizing && `ob-kanban--rsz-${resizing.kind === 'row' ? 'row' : 'col'}`,
      )}
      // La larghezza del binario scende di qui al CSS: e' una misura sola,
      // calcolata una volta e letta da tutti i binari, che sono elementi
      // separati e altrimenti si dimensionerebbero ognuno per conto proprio.
      style={{ ['--ob-rail-w' as string]: `${railPx}px` }}
    >
      {/* Toolbar — prima riga della vista (niente header con titolo/mascotte).
          Stessi pezzi della topbar del CANVAS, presi dai primitivi: `.ob-lug`,
          `.ob-tool`, `.ob-toolword`. Niente più stili locali che li imitavano. */}
      <div className="ob-kanban__toolbar">
        {!!tagPills?.length && (
          // Lo SCROLL sta sul wrapper e il gruppo dentro: `overflow-x` diverso da
          // `visible` fa ritagliare anche in verticale, e quello che verrebbe
          // tagliato e' il pixel con cui la linguetta attiva copre la hairline —
          // cioe' il varco. Vedi `.ob-lugs-scroll`.
          <div className="ob-lugs-scroll">
            <div className="ob-lugs">
              {tagPills.map((p) => {
                const isActive = active.has(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={cn('ob-lug', isActive && 'ob-lug--active')}
                    // Click semplice: solo questo tag — e ricliccare la linguetta
                    // quando e' l'unica accesa toglie il filtro. Senza, servirebbe
                    // una linguetta "Tutti", che pero' non e' un tag pinnato e non
                    // ha titolo per stare in questa striscia.
                    // Ctrl (cmd sul Mac): aggiunge o toglie, per guardare piu' tag
                    // insieme.
                    onClick={(e) => onTagChange?.(p.id, e.ctrlKey || e.metaKey)}
                    aria-pressed={isActive}
                    title={isActive
                      ? `"${p.label}" — click per togliere il filtro, ctrl+click per togliere solo questo tag`
                      : `Mostra "${p.label}" — ctrl+click per aggiungerlo a quelli gia' accesi`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div className="ob-kanban__spacer" />
        {/* Tre gruppi separati da un filo, in ordine di raggio d'azione: il TILE
            (il contenuto), poi la STRUTTURA che lo contiene, poi il modo di
            GUARDARE quello che c'e'. Stesso glifo dello strumento «Tile» del
            canvas: la stessa cosa si chiede con la stessa icona, in qualunque
            vista si sia. Era un `+` con l'etichetta, e il `+` diceva «aggiungi»
            ma non aggiungi COSA. */}
        <div className="ob-tools">
          <ToolButton
            icon={<IconCube size={16} stroke={1.6} />}
            label="Nuovo tile"
            onClick={onAddTile}
            disabled={!onAddTile}
          />
          <div className="ob-toolsep" />
          {/* Icone di INSERIMENTO, non di struttura: senza etichetta, una colonna
              e una corsia si distinguono solo se l'icona dice dove finiscono. */}
          <ToolButton
            icon={<IconColumnInsertRight size={16} stroke={1.6} />}
            label="Nuova colonna"
            onClick={onAddColumn}
            disabled={!onAddColumn}
          />
          <ToolButton
            icon={<IconRowInsertBottom size={16} stroke={1.6} />}
            label="Nuova corsia"
            onClick={onAddLane}
            disabled={!onAddLane}
          />
          {/* Dopo i due inserimenti perché appartiene allo stesso gruppo — la
              STRUTTURA — ma non aggiunge niente: prende i due assi e li scambia.
              Il tooltip dice cosa succede, non come si chiama: «scambia gli
              assi» sarebbe il nome dell'operazione, non il suo effetto. */}
          {onSwapAxes && (
            <ToolButton
              icon={<IconTransform size={16} stroke={1.6} />}
              label={swapBlockedReason
                ? `Scambia righe e colonne — ${swapBlockedReason}`
                : 'Scambia righe e colonne: quello che divide in verticale passa in orizzontale e viceversa'}
              // Le colonne chiuse a fisarmonica sono ricordate per id di colonna:
              // dopo la rotazione quegli id stanno sull'altro asse, e resterebbero
              // chiuse delle colonne che non esistono più. Stessa pulizia di
              // «Adatta», per la stessa ragione.
              onClick={() => { setCollapsedCols(new Set()); onSwapAxes(); }}
              disabled={!!swapBlockedReason}
            />
          )}
          {onReset && (
            <ToolButton
              icon={<IconArrowAutofitWidth size={16} stroke={1.6} />}
              label="Adatta — cancella larghezze, altezze e ordine fissati a mano: la board torna ad adattarsi ai tile"
              onClick={() => { setCollapsedCols(new Set()); onReset(); }}
            />
          )}
          {/* Dopo il separatore i MODI DI GUARDARE: non sono comandi di
              struttura come quelli qui accanto, non creano niente e cambiano
              solo COME guardi la board. Parole nude, senza fondo e senza icona. */}
          <div className="ob-toolsep" />
          <SparkIconsToggle />
          {onToggleDoneHighlight && (
            <>
              {/* Accesa si tinge di VERDE, cioe' del colore che accende sulle
                  card — mostra il suo effetto invece di descriverlo. */}
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

      {/* Board */}
      {bands?.length ? (
        // Griglia: UN solo contenitore che scorre nei due sensi. La riga delle
        // intestazioni e' `sticky` in alto, la colonna dei nomi `sticky` a
        // sinistra: restano ferme mentre il resto scorre, e l'incrocio delle due
        // resta fermo in entrambi i sensi. Con scroller separati per fascia le
        // colonne si sarebbero disallineate al primo scorrimento.
        <div
          className="ob-kanban__grid ob-dotgrid ob-scroll"
          onScroll={(e) => {
            if (dateAxis?.column) onEdgeScroll('column')(e);
            if (dateAxis?.lane) onEdgeScroll('lane')(e);
          }}
        >
          <div className="ob-kanban__grid-head">
            <div className="ob-kanban__band-rail ob-kanban__grid-corner">
              {/* Il binario e' UNA misura condivisa da tutte le fasce, quindi ha
                  UNA maniglia. Sta nell'angolo perche' e' l'unico punto fermo in
                  entrambi i sensi — lo trovi senza scorrere, da qualunque parte
                  della board tu sia — e perche' e' l'unico binario che non porta
                  gia' la maniglia dell'altezza, che gli finirebbe addosso. */}
              {onResize && (
                <span
                  className="ob-kanban__rsz ob-kanban__rsz--col"
                  title="Trascina per fissare la larghezza della colonna dei nomi"
                  onPointerDown={(e) => {
                    const rail = (e.currentTarget as HTMLElement).closest('.ob-kanban__band-rail') as HTMLElement | null;
                    beginResize('rail', RAIL_KEY)(e, rail?.offsetWidth ?? RAIL_MIN);
                  }}
                />
              )}
            </div>
            {(bands[0]?.lanes ?? []).map((l) => {
              const key = l.id ?? l.label;
              return (
                <LaneHead
                  key={key}
                  lane={{ id: l.id, label: l.label }}
                  collapsed={collapsedCols.has(key)}
                  onToggleCollapse={() => toggleCol(key)}
                  onLaneMenu={onLaneMenu}
                  onReorder={onReorder}
                  onResizeStart={onResize ? beginResize('col', key) : undefined}
                  style={colStyle(key)}
                />
              );
            })}
          </div>
          {bands.map((b, bi) => {
            const h = rowHeightOf(b.id);
            return (
              <section
                key={b.id}
                className={cn('ob-kanban__band', rowOver === b.id && 'ob-kanban__band--rowover')}
                // `minHeight` e non `height`: l'altezza che dai alla corsia e' un
                // PAVIMENTO, non una gabbia. Con `height` la corsia smetteva di
                // seguire il contenuto per sempre, e i tile che non ci stavano —
                // dopo aver stretto una colonna, o all'arrivo di un tile nuovo —
                // finivano dentro uno scroll invece di allargare la riga.
                style={h ? { minHeight: h } : undefined}
              >
                <div
                  className="ob-kanban__band-rail"
                  draggable={!!onReorderRow && rowGrip === b.id}
                  onDragStart={(e) => { e.dataTransfer.setData(ROW_MIME, b.id); e.dataTransfer.effectAllowed = 'move'; }}
                  onDragEnd={() => setRowGrip(null)}
                  onDragOver={(e) => {
                    if (!onReorderRow || !e.dataTransfer.types.includes(ROW_MIME)) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    setRowOver(b.id);
                  }}
                  onDragLeave={(e) => {
                    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                    setRowOver(null);
                  }}
                  onDrop={(e) => {
                    const from = e.dataTransfer.getData(ROW_MIME);
                    setRowOver(null);
                    if (!from || !onReorderRow || from === b.id) return;
                    e.preventDefault();
                    onReorderRow(from, b.id);
                  }}
                >
                  <span
                    className="ob-kanban__lane-grip"
                    onMouseDown={() => onReorderRow && setRowGrip(b.id)}
                    onMouseUp={() => setRowGrip(null)}
                    title={onReorderRow ? 'Trascina per spostare la corsia' : undefined}
                    style={onReorderRow ? { cursor: 'grab' } : undefined}
                  ><IconGripVertical size={11} stroke={1.6} /></span>
                  {/* La prima etichetta fa da campione tipografico per misurare
                      la larghezza del binario: il font si legge da lei, non e'
                      scritto da nessuna parte nel codice. */}
                  <span ref={bi === 0 ? labelRef : undefined} className="ob-kanban__band-label" title={b.label}>{b.label}</span>
                  {onResize && (
                    <span
                      className="ob-kanban__rsz ob-kanban__rsz--row"
                      title="Trascina per dare un'altezza alla corsia"
                      onPointerDown={(e) => {
                        const band = (e.currentTarget as HTMLElement).closest('.ob-kanban__band') as HTMLElement | null;
                        beginResize('row', b.id)(e, band?.offsetHeight ?? MIN_ROW_H);
                      }}
                    />
                  )}
                </div>
                {b.lanes.map((l) => {
                  const key = l.id ?? l.label;
                  return (
                    <LaneBody
                      key={key}
                      lane={l}
                      rowId={b.id}
                      onCardClick={onCardClick}
                      onCardMenu={onCardMenu}
                      selectedId={selectedId}
                      onMoveTile={onMoveTile}
                      onCreateInCell={onCreateInCell}
                      onReorder={onReorder}
                      collapsed={collapsedCols.has(key)}
                      style={colStyle(key)}
                    />
                  );
                })}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="ob-kanban__board ob-dotgrid ob-scroll" onScroll={dateAxis?.column ? onEdgeScroll('column') : undefined}>
          {lanes.map((l) => {
            const key = l.id ?? l.label;
            return (
              <LaneCol
                key={key}
                lane={l}
                onCardClick={onCardClick}
                onCardMenu={onCardMenu}
                selectedId={selectedId}
                onMoveTile={onMoveTile}
                onCreateInCell={onCreateInCell}
                onLaneMenu={onLaneMenu}
                onReorder={onReorder}
                onResizeStart={onResize ? beginResize('col', key) : undefined}
                style={colStyle(key)}
                collapsed={collapsedCols.has(key)}
                onToggleCollapse={() => toggleCol(key)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
