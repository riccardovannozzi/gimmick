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
 * Autonomo — si monta nel ViewContainer dello shell con `hideToolbar`.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { IconGripVertical, IconDots } from '@tabler/icons-react';
import { Button } from '@/components/primitives';
import { Icon } from '@/components/shell';
import { Tile } from '@/components/tiles/Tile';
import type { StepState, TileStatus, TileVisualKey } from '@/lib/tile-visual';

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
  checklist?: boolean[];
  /** Tile completato (is_completed) → si legge come status `done`. */
  done?: boolean;
  /** Chiave grafica risolta con `tileVisualKey()`: bordo, badge e metadato. */
  visualKey?: TileVisualKey;
  /** Nome grezzo dello status (`active`, `paused`…) — non l'etichetta tradotta. */
  statusName?: TileStatus;
  /** Metadato del footer destro, già formattato (data, orario, progressione). */
  meta?: string;
  /** Colore che tinge fondo, bordo e badge. Dalle impostazioni, mai un hex qui. */
  accent?: string;
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
      { title: 'Revoca certificato digitale Aruba', tag: 'OM', amber: true, checklist: [true, true, false] },
      { title: 'Preparare brief Teleport per Marco', tag: 'GDS', checklist: [true, false, false, false] },
      { title: 'Lista materiali cucina', tag: 'OM', amber: true, checklist: [false, false] },
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
      { title: 'Itinerario Lisbona confermato', tag: 'Viaggio', checklist: [true, true, true] },
      { title: 'Demo prodotto v2 rivista', tag: 'GDS' },
    ],
  },
  { label: 'FAMIGLIA', color: 'var(--ob-warning)', tiles: [] },
];

// ─── Subcomponents ────────────────────────────────────────────────────────────

/**
 * La card della lane è il `Tile` del sistema visivo, come in Chrono, nel canvas
 * e nello staging. Misura già 150×80 come il Tile, quindi l'ingombro nella lane
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
function TileCard({ t, onClick, active }: { t: CardData; onClick?: () => void; active?: boolean }) {
  const draggable = !!t.id;
  const steps: StepState[] | undefined = t.checklist?.length
    ? t.checklist.map((d): StepState => (d ? 'done' : 'pending'))
    : undefined;
  // `is_completed` e lo status `done` sono tenuti allineati dal database
  // (migration 015): qui valgono come la stessa cosa.
  const status: TileStatus = t.done ? 'done' : (t.statusName ?? 'active');
  return (
    <div
      className="ob-kanban__cell"
      draggable={draggable}
      onDragStart={draggable ? (e) => { e.dataTransfer.setData('text/x-tile', t.id!); e.dataTransfer.effectAllowed = 'move'; } : undefined}
    >
      <Tile
        title={t.title}
        visualKey={t.visualKey ?? 'none'}
        status={status}
        steps={steps}
        meta={t.meta}
        accent={t.accent ?? (t.amber ? 'var(--ob-warning)' : undefined)}
        active={active}
        onClick={onClick}
      />
    </div>
  );
}

/** Tipo MIME del trascinamento di una COLONNA. Distinto da quello dei tile,
 *  perche' la lane e' bersaglio di entrambi e deve sapere cosa sta ricevendo. */
const COL_MIME = 'text/x-kanban-col';

function LaneCol({
  lane, onCardClick, selectedId, onMoveTile, onLaneMenu, onReorder,
}: {
  lane: Lane;
  onCardClick?: (id: string) => void;
  selectedId?: string;
  onMoveTile?: (tileId: string, targetColId: string) => void;
  /** Apre il menu della colonna nel punto cliccato. */
  onLaneMenu?: (e: React.MouseEvent, laneId: string) => void;
  /** Sposta la colonna trascinata prima di quella su cui viene rilasciata. */
  onReorder?: (fromId: string, toId: string) => void;
}) {
  const count = lane.tiles.length;
  const [dragOver, setDragOver] = React.useState(false);
  const [colOver, setColOver] = React.useState(false);
  // Il trascinamento della colonna parte SOLO dalla maniglia: `draggable` si
  // arma al mousedown sul grip e si disarma alla fine. Senza, l'intera testata
  // sarebbe trascinabile e il click sui pulsanti diventerebbe un trascinamento
  // mancato.
  const [gripArmed, setGripArmed] = React.useState(false);
  // La colonna compressa resta visibile come binario verticale: sparisce il
  // corpo, non la colonna — altrimenti non si saprebbe come riaprirla.
  const [collapsed, setCollapsed] = React.useState(false);
  const canDrop = !!onMoveTile && !!lane.id;
  const canReorder = !!onReorder && !!lane.id;
  return (
    <div
      className={cn(
        'ob-kanban__lane',
        collapsed && 'ob-kanban__lane--collapsed',
        dragOver && 'ob-kanban__lane--dropover',
        colOver && 'ob-kanban__lane--colover',
      )}
      style={{ ['--lane-c' as string]: lane.color }}
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
        const id = e.dataTransfer.getData('text/x-tile');
        if (id && canDrop) onMoveTile!(id, lane.id!);
      }}
    >
      <div
        className="ob-kanban__lane-head"
        draggable={canReorder && gripArmed}
        onDragStart={(e) => {
          e.dataTransfer.setData(COL_MIME, lane.id!);
          e.dataTransfer.effectAllowed = 'move';
        }}
        onDragEnd={() => setGripArmed(false)}
      >
        <span
          className="ob-kanban__lane-grip"
          onMouseDown={() => canReorder && setGripArmed(true)}
          onMouseUp={() => setGripArmed(false)}
          title={canReorder ? 'Trascina per spostare la colonna' : undefined}
          style={canReorder ? { cursor: 'grab' } : undefined}
        ><IconGripVertical size={11} stroke={1.6} /></span>
        <span className="ob-kanban__lane-label" title={lane.label}>{lane.label}</span>
        <span className="ob-kanban__lane-count">{count}</span>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          className="ob-kanban__lane-btn"
          aria-label={collapsed ? 'Espandi' : 'Comprimi'}
          title={collapsed ? 'Espandi la colonna' : 'Comprimi la colonna'}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((c) => !c)}
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
      </div>
      <div className="ob-kanban__lane-body ob-scroll" hidden={collapsed}>
        {count ? (
          lane.tiles.map((t, ti) => (
            <TileCard
              key={t.id ?? ti}
              t={t}
              active={!!t.id && t.id === selectedId}
              onClick={onCardClick && t.id ? () => onCardClick(t.id!) : undefined}
            />
          ))
        ) : (
          <div className="ob-kanban__lane-empty">NESSUN TILE</div>
        )}
      </div>
    </div>
  );
}

export interface KanbanViewProps {
  lanes?: Lane[];
  onCardClick?: (id: string) => void;
  selectedId?: string;
  onAddTile?: () => void;
  /** Drag di un tile su una colonna → applica i filtri colonna come update. */
  onMoveTile?: (tileId: string, targetColId: string) => void;
  /** SOLO i tag pinnati, nell'ordine in cui l'utente li ha messi. La barra non
   *  e' un elenco di tag: e' la scorciatoia alle poche cose che tieni sott'occhio,
   *  esattamente come la tab-strip del canvas. Vuoto = nessuna linguetta. */
  tagPills?: { id: string; label: string; color?: string }[];
  /** Tag attivo ('all' = nessun filtro). */
  activeTag?: string;
  onTagChange?: (id: string) => void;
  onAddColumn?: () => void;
  onAddLane?: () => void;
  /**
   * Le corsie orizzontali. Ognuna diventa una FASCIA che contiene la stessa
   * fila di colonne, con dentro solo i tile della corsia. Vuoto = board a una
   * dimensione, cioe' esattamente com'era prima che le corsie esistessero.
   */
  bands?: { id: string; label: string; lanes: Lane[] }[];
  onLaneMenu?: (e: React.MouseEvent, laneId: string) => void;
  /** Riordino delle colonne per trascinamento della maniglia. */
  onReorder?: (fromId: string, toId: string) => void;
}

export function KanbanView({
  lanes = LANES, onCardClick, selectedId, onAddTile, onMoveTile,
  tagPills, activeTag = 'all', onTagChange,
  onAddColumn, onAddLane, onLaneMenu, onReorder, bands,
}: KanbanViewProps) {
  return (
    <div className="ob-kanban">
      {/* Toolbar — prima riga della vista (niente header con titolo/mascotte). */}
      <div className="ob-kanban__toolbar">
        {!!tagPills?.length && (
          <>
            <div className="ob-kanban__div" />
            <div className="ob-kanban__tag-tabs">
              {tagPills.map((p) => {
                const isActive = activeTag === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={cn('ob-kanban__tag-tab', isActive && 'ob-kanban__tag-tab--active')}
                    // Ricliccare la linguetta attiva toglie il filtro. Senza,
                    // servirebbe una linguetta "Tutti" — che pero' non e' un tag
                    // pinnato e non ha titolo per stare in questa striscia.
                    onClick={() => onTagChange?.(isActive ? 'all' : p.id)}
                    aria-pressed={isActive}
                    title={isActive ? `Mostra tutti i tag (togli il filtro "${p.label}")` : `Mostra solo "${p.label}"`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </>
        )}
        <div className="ob-kanban__spacer" />
        <button type="button" className="ob-kanban__ctrl" onClick={onAddColumn} disabled={!onAddColumn} title="Colonne verticali della board">
          <span className="ob-kanban__ctrl-icon"><Icon name="kanban" size={13} /></span>Colonna
        </button>
        <button type="button" className="ob-kanban__ctrl" onClick={onAddLane} disabled={!onAddLane} title="Corsie orizzontali della board">
          <span className="ob-kanban__ctrl-icon"><Icon name="list" size={13} /></span>Corsia
        </button>
        <Button variant="primary" size="sm" icon={<Icon name="plus" size={13} />} onClick={onAddTile}>Tile</Button>
      </div>

      {/* Board */}
      {bands?.length ? (
        // Con le corsie la board scorre in VERTICALE fra le fasce, e ogni fascia
        // scorre per conto suo in orizzontale. Le colonne restano allineate fra
        // una fascia e l'altra perche' hanno tutte la stessa base flex.
        <div className="ob-kanban__bands ob-scroll">
          {bands.map((b) => (
            <section key={b.id} className="ob-kanban__band">
              <header className="ob-kanban__band-head">
                <span className="ob-kanban__band-label" title={b.label}>{b.label}</span>
                <span className="ob-kanban__band-count">
                  {b.lanes.reduce((n, l) => n + l.tiles.length, 0)}
                </span>
              </header>
              <div className="ob-kanban__board">
                {b.lanes.map((l) => (
                  <LaneCol
                    key={l.id ?? l.label}
                    lane={l}
                    onCardClick={onCardClick}
                    selectedId={selectedId}
                    onMoveTile={onMoveTile}
                    onLaneMenu={onLaneMenu}
                    onReorder={onReorder}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="ob-kanban__board ob-scroll">
          {lanes.map((l) => (
            <LaneCol
              key={l.id ?? l.label}
              lane={l}
              onCardClick={onCardClick}
              selectedId={selectedId}
              onMoveTile={onMoveTile}
              onLaneMenu={onLaneMenu}
              onReorder={onReorder}
            />
          ))}
        </div>
      )}
    </div>
  );
}
