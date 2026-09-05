'use client';

/**
 * Gimmick · Obsidian — COCKPIT.
 *
 * Due liste e una domanda sola: **di chi è la palla**. A sinistra quel che
 * dipende da te, a destra quel che stai aspettando da qualcun altro.
 *
 * Specifica di resa: `design_handoff_obsidian/GimmickCockpit.dc.html`.
 *
 * ─── Perché una RIGA e non una card ──────────────────────────────────────────
 *
 * Una card metteva in evidenza il contenitore — il titolo del tile — e relegava
 * l'azione a seconda fila. Qui è invertito: **il passo corrente è il testo
 * primario**, il titolo del tile scivola a contesto. In una lista di cose da
 * fare si legge l'azione, non la cartella in cui sta.
 *
 * ─── Perché solo i flow ──────────────────────────────────────────────────────
 *
 * Un flow è un rimpallo di responsabilità fra più soggetti: solo lì la palla
 * esiste. Su una lista della spesa è sempre di chi l'ha scritta.
 *
 * ─── Perché NON c'è una corsia «fermi» ───────────────────────────────────────
 *
 * Il disegno ne prevedeva una, con soglia a 14 giorni. Sui dati veri il 63% dei
 * passi aperti supera i venti giorni: tre su quattro sarebbero finiti lì, e una
 * corsia che contiene quasi tutto non separa niente. L'anzianità è rimasta come
 * CHIAVE DI ORDINAMENTO — un numero in coda alla riga, non un giudizio.
 *
 * ⚠️ Tutta la derivazione sta in `lib/tile-visual.ts` e non va riscritta qui:
 * `currentStep`, `subtaskBall`, `stalenessFrom`, `cockpitLane`, `subtaskToStep`.
 * Questo file decide solo COME si vedono.
 */
import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  IconProgress, IconClockHour4, IconCheck, IconArrowsSort, IconLock,
  IconPointFilled, IconPoint, IconCalendarTime,
} from '@tabler/icons-react';
import { tilesApi, subtasksApi, calendarApi } from '@/lib/api';
import { useContacts } from '@/lib/hooks/useContacts';
import { useStatuses } from '@/store/statuses-store';
import { useTileSelectionStore } from '@/store/tile-selection-store';
import {
  currentStep, stalenessFrom, cockpitLane, subtaskToStep, tileVisualKey, eventRefIso, TILE_VISUAL,
  type CockpitLane, type StepState,
} from '@/lib/tile-visual';
import { Tile as TileCard } from '@/components/tiles/Tile';
import type { Subtask, Tile, SparkType } from '@/types';

/** Oltre questa lunghezza il nome del tag viene tagliato; per intero in hover. */
const ANCHOR_MAX = 15;

/**
 * Oltre questa anzianità il numero si fa più scuro e più pesante.
 *
 * ⚠️ NON è una soglia di allarme e non fa entrare né uscire niente da nessuna
 * lista: le righe sono già ordinate per attesa, e questo serve solo a far
 * emergere le prime quando si scorre in fretta. Il valore viene dai dati veri —
 * la mediana dei passi aperti sta poco sopra le tre settimane.
 */
const AGE_EMPHASIS_DAYS = 20;

/**
 * QUANTE RIGHE mostra una colonna prima di dichiarare il resto.
 *
 * Stesso mestiere di `STEPPER_MAX_SEGMENTS`: oltre la soglia non si allunga, si
 * riassume. E come quello, il numero viene dalla GEOMETRIA e non dal gusto —
 * righe da 30px, e su una finestra bassa (720) la colonna ne ospita quindici
 * dopo aver tolto barra, fascia, testata e piede.
 *
 * ⚠️ Sta SOTTO la capienza, non pari: se il tetto fosse quindici la riga di
 * collasso comparirebbe quasi mai, e una lista che mostra sempre tutto non ha
 * bisogno di un tetto — è la condizione che questa vista serve a evitare. Dodici
 * lascia il piede sempre significativo e non si scontra col fondo della colonna.
 */
const LANE_MAX_ROWS = 12;

/**
 * Quanti CONCLUSI mostra la coda.
 *
 * Molto meno del tetto delle righe vive, e non per far spazio: un concluso non
 * è lavoro, è memoria. Serve a dire «questo è finito, non cercarlo più sopra», e
 * per quello ne bastano pochi — se la coda diventasse lunga quanto la lista,
 * tornerebbe a competere con le cose da fare, che è il motivo per cui i
 * conclusi la colonna propria l'hanno persa.
 */
const CLOSED_TAIL_ROWS = 3;

/**
 * Quanti giorni guarda avanti l'Orizzonte.
 *
 * Dieci: una settimana piena più l'inizio della prossima, che è quanto serve per
 * accorgersi di una consegna «fra poco» senza trasformare la colonna in un
 * calendario — quello c'è già e si chiama Chrono. Quel che cade oltre non
 * sparisce: lo dichiara il piede della colonna.
 */
const HORIZON_DAYS = 10;

/** Gli stati chiusi del tile: quelli che rendono neutri i passi rimasti. */
const CLOSED_STATUSES = new Set(['done', 'cancelled']);

type SortKey = 'age' | 'title';

type FlowRowData = {
  tile: Tile;
  steps: Subtask[];
  lane: CockpitLane;
  /** La lista in cui la riga si mostra. Per un concluso è quella in cui sarebbe
   *  finito da aperto: la coda sta sotto la lista di appartenenza, non a parte. */
  home: 'mine' | 'theirs';
  /**
   * Il flow è finito. Due strade diverse che arrivano allo stesso posto:
   * il TILE è stato chiuso a mano, oppure non resta più un passo aperto.
   * Entrambe finiscono in coda. È `closed` — lo status — a decidere invece se i
   * pioli si leggono NEUTRI: quello capita solo quando è il tile ad avere
   * l'ultima parola sui passi che gli restavano dentro.
   */
  concluded: boolean;
  /** Il primo passo che resta da fare. `null` su un flow concluso. */
  next: Subtask | null;
  /** Da quanti giorni il passo corrente è fermo lì. `null` se non calcolabile. */
  ageDays: number | null;
  closed: boolean;
};

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

/** Il tag del tile. Il root GIMMICK non ancora niente ma si mostra lo stesso,
 *  spento: dice «questo non è ancora stato archiviato da nessuna parte». */
function anchorOf(tile: Tile): { name: string; root: boolean } | null {
  const tags = tile.tags ?? [];
  const real = tags.find((t) => !t.is_root);
  if (real) return { name: real.name, root: false };
  const root = tags[0];
  return root ? { name: root.name, root: true } : null;
}

const LANES: Record<CockpitLane, { label: string; hint: string; color: string; Icon: typeof IconProgress }> = {
  mine: { label: 'Tocca a me', hint: 'passo corrente non marcato', color: 'var(--ob-accent)', Icon: IconProgress },
  theirs: { label: 'Tocca a te', hint: 'passi marcati', color: 'var(--ob-theirs)', Icon: IconClockHour4 },
  closed: { label: 'Conclusi', hint: 'i passi rimasti si leggono neutri', color: 'var(--ob-muted)', Icon: IconCheck },
};

export function CockpitLive() {
  const selectTile = useTileSelectionStore((s) => s.select);
  const { statuses } = useStatuses();
  const { contacts } = useContacts();
  const [showClosed, setShowClosed] = React.useState(false);
  const [sortKey, setSortKey] = React.useState<SortKey>('age');
  /** Le colonne aperte oltre il tetto. Una per volta non basta: può servire
   *  vederle entrambe per intero mentre si confronta. */
  const [expanded, setExpanded] = React.useState<ReadonlySet<CockpitLane>>(new Set());
  const toggleExpanded = React.useCallback((lane: CockpitLane) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(lane)) next.delete(lane);
      else next.add(lane);
      return next;
    });
  }, []);

  const tilesQuery = useQuery({
    // Chiave propria: la lista dei tile filtrata per `flow` è un'altra cosa
    // dalla lista piena, e condividerne una sarebbe due `queryFn` sulla stessa
    // chiave — la trappola che questo progetto ha già incontrato una volta.
    queryKey: ['tiles-cockpit'],
    // ⚠️ `limit: 100` non è la lunghezza della lista: quella la decide
    // `LANE_MAX_ROWS`. È quanto se ne CARICA, e deve restare alto perché il piede
    // di colonna dichiara un conteggio ESATTO («altri 19»). Il default del
    // backend è 20: con venti tile in mano quel numero sarebbe una bugia, e
    // dire il falso sul non-visibile è peggio che non dirlo.
    queryFn: () => tilesApi.list({ action_type: 'flow', limit: 100 }),
    staleTime: 60_000,
  });

  const stepsQuery = useQuery({
    queryKey: ['subtasks-flow'],
    queryFn: () => subtasksApi.listFlow(),
    staleTime: 60_000,
  });

  /** La finestra dell'Orizzonte: da mezzanotte di oggi, dieci giorni. Calcolata
   *  una volta al montaggio — ricalcolarla a ogni render cambierebbe la chiave
   *  di cache a ogni battito e la query non si fermerebbe mai. */
  const horizon = React.useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + HORIZON_DAYS);
    return { start: start.toISOString(), end: end.toISOString() };
  }, []);

  const eventsQuery = useQuery({
    // Stessa chiave e stessa forma di Chrono: se hai già aperto il calendario su
    // questa finestra, qui i dati sono già in cache.
    queryKey: ['calendar-events', horizon.start, horizon.end],
    queryFn: async () => {
      const res = await calendarApi.events(horizon.start, horizon.end);
      if (!res.success) throw new Error(res.error || 'Errore caricamento eventi');
      return res;
    },
    staleTime: 2 * 60 * 1000,
  });

  /** I tile IN EVIDENZA. Il filtro è nuovo sul backend: nessuna vista aveva mai
   *  chiesto «dammi quelli in evidenza», lo leggevano tutte sui tile che avevano
   *  già in mano. */
  const focusQuery = useQuery({
    queryKey: ['tiles-focused'],
    queryFn: () => tilesApi.list({ is_focused: true, limit: 100 }),
    staleTime: 60_000,
  });

  const statsQuery = useQuery({
    queryKey: ['tiles-stats'],
    queryFn: () => tilesApi.stats(),
    staleTime: 60_000,
  });

  const selfContactId = React.useMemo(
    () => contacts.find((c) => c.is_self)?.id ?? null,
    [contacts],
  );
  const contactName = React.useCallback(
    (id?: string | null) => (id ? contacts.find((c) => c.id === id)?.name : undefined),
    [contacts],
  );

  const rows: FlowRowData[] = React.useMemo(() => {
    const tiles = (tilesQuery.data?.data ?? []) as Tile[];
    const steps = (stepsQuery.data?.data ?? []) as Subtask[];

    // Un passaggio solo sui passi invece di un `filter` per tile: con 123 righe
    // non cambia niente, ma la forma non peggiora se un giorno saranno mille.
    const byTile = new Map<string, Subtask[]>();
    for (const s of steps) {
      const list = byTile.get(s.tile_id);
      if (list) list.push(s);
      else byTile.set(s.tile_id, [s]);
    }

    return tiles.map((tile) => {
      const own = byTile.get(tile.id) ?? [];
      const statusName = tile.status_id
        ? statuses.find((st) => st.id === tile.status_id)?.name
        : undefined;
      const closed = !!statusName && CLOSED_STATUSES.has(statusName);
      const lane = cockpitLane({ closed, steps: own }, selfContactId);
      const next = closed ? null : currentStep(own);
      /**
       * A quale delle due liste appartiene un concluso: quella in cui STAREBBE
       * se non fosse chiuso. La domanda si gira alla stessa funzione passandole
       * `closed: false` — non c'è una seconda regola da scrivere.
       *
       * Se anche così non c'è un passo aperto, il flow si è concluso da sé e non
       * ha una palla da nessuna parte: cade in «tocca a me», perché chiudere una
       * cosa è l'ultimo gesto di chi la teneva.
       */
      const home: 'mine' | 'theirs' = lane === 'closed'
        ? (() => {
          const would = cockpitLane({ closed: false, steps: own }, selfContactId);
          return would === 'closed' ? 'mine' : would;
        })()
        : lane;
      return {
        tile,
        steps: own,
        lane,
        home,
        concluded: lane === 'closed',
        next,
        ageDays: next ? daysSince(stalenessFrom(next)) : null,
        closed,
      };
    });
  }, [tilesQuery.data, stepsQuery.data, statuses, selfContactId]);

  const sorted = React.useCallback((list: FlowRowData[]) => (
    // Il più fermo in cima: è l'ordine che risponde alla domanda per cui apri
    // questa pagina. Chi vuole cercare un nome passa all'alfabetico.
    list.slice().sort((a, b) => (
      sortKey === 'title'
        ? (a.tile.title ?? '').localeCompare(b.tile.title ?? '')
        : (b.ageDays ?? -1) - (a.ageDays ?? -1)
    ))
  ), [sortKey]);

  const isLoading = tilesQuery.isLoading || stepsQuery.isLoading;
  const lanes: Array<'mine' | 'theirs'> = ['mine', 'theirs'];
  const closedCount = rows.filter((r) => r.concluded).length;

  return (
    <div className="ob-cockpit">
      <div className="ob-cockpit__toolbar">
        <button
          type="button"
          className="ob-toolword"
          onClick={() => setSortKey((k) => (k === 'age' ? 'title' : 'age'))}
          title={sortKey === 'age' ? 'Ordinati per attesa. Passa all’alfabetico' : 'Ordinati per titolo. Torna all’attesa'}
        >
          <IconArrowsSort size={14} />
          {sortKey === 'age' ? 'Attesa' : 'Titolo'}
        </button>
        <div className="ob-cockpit__spacer" />
        <button
          type="button"
          className="ob-toolword"
          aria-pressed={showClosed}
          onClick={() => setShowClosed((v) => !v)}
          title="I flow conclusi non hanno una colonna fissa: si richiamano da qui"
        >
          <IconCheck size={14} />
          {showClosed ? 'Nascondi conclusi' : `Conclusi (${closedCount})`}
        </button>
      </div>

      <FocusBand
        tiles={(focusQuery.data?.data ?? []) as Tile[]}
        stats={statsQuery.data?.data}
        onOpen={selectTile}
      />

      <div className="ob-cockpit__board">
        {lanes.map((key) => {
          const lane = LANES[key];
          const items = sorted(rows.filter((r) => r.home === key && !r.concluded));
          // I conclusi stanno in CODA alla lista a cui appartengono, non in una
          // colonna a parte: restano attività individuate, e vederli accanto ai
          // vivi è quel che dice «questo ramo è esaurito».
          const done = showClosed ? sorted(rows.filter((r) => r.home === key && r.concluded)) : [];
          const open = expanded.has(key);
          const shown = open ? items : items.slice(0, LANE_MAX_ROWS);
          const shownDone = open ? done : done.slice(0, CLOSED_TAIL_ROWS);
          const hidden = (items.length - shown.length) + (done.length - shownDone.length);
          return (
            <div key={key} className="ob-cockpit__lane" style={{ ['--st-c' as string]: lane.color }}>
              <div className="ob-cockpit__lane-head">
                <span className="ob-cockpit__lane-badge"><lane.Icon size={12} /></span>
                <span className="ob-cockpit__lane-label">{lane.label}</span>
                <span className="ob-cockpit__lane-hint">{lane.hint}</span>
                {/* Il conteggio dice «quante ne vedi su quante» solo quando le due
                    cose differiscono: «7 di 7» sarebbe una domanda a cui nessuno
                    stava pensando. */}
                <span className="ob-cockpit__lane-count">
                  {hidden > 0 ? `${shown.length} di ${items.length}` : items.length}
                </span>
              </div>
              <div className={`ob-cockpit__lane-body${open ? ' ob-cockpit__lane-body--expanded' : ''}`}>
                {isLoading
                  ? <div className="ob-cockpit__empty">Caricamento</div>
                  : shown.length
                    ? shown.map((r) => (
                      <FlowRow
                        key={r.tile.id}
                        row={r}
                        who={contactName(r.next?.contact_id)}
                        onOpen={() => selectTile(r.tile.id)}
                      />
                    ))
                    : <div className="ob-cockpit__empty">Niente qui</div>}

                {shownDone.length > 0 && (
                  <>
                    <div className="ob-cockpit__divider">
                      {LANES.closed.label} · {LANES.closed.hint}
                    </div>
                    {shownDone.map((r) => (
                      <FlowRow
                        key={r.tile.id}
                        row={r}
                        who={contactName(r.next?.contact_id)}
                        onOpen={() => selectTile(r.tile.id)}
                      />
                    ))}
                  </>
                )}
              </div>
              <LaneFoot
                hidden={hidden}
                expanded={open}
                onToggle={() => toggleExpanded(key)}
              />
            </div>
          );
        })}

        <Horizon
          start={horizon.start}
          days={HORIZON_DAYS}
          tiles={(eventsQuery.data?.data ?? []) as Tile[]}
          loading={eventsQuery.isLoading}
          onOpen={selectTile}
        />
      </div>
    </div>
  );
}

/**
 * LA FASCIA FOCUS — su cosa stai lavorando adesso, e quanto pesa il resto.
 *
 * È l'unica parte della plancia che parla di TE e non delle cose: le liste
 * dicono cosa c'è, questa dice dove sei.
 *
 * I riquadri sono il componente `<Tile>` condiviso, quello che disegna le card
 * in Chrono, Kanban e Canvas — cornice rossa del focus compresa. Ridisegnarne
 * una copia qui avrebbe voluto dire due tile che si somigliano e divergono alla
 * prima modifica.
 *
 * ⚠️ Il metadato si passa solo quando è una DATA. La progressione «X di Y» no,
 * e non per dimenticanza: quella regola è scritta in cinque punti dell'app che
 * contano gli annullati nel denominatore, e finché non sono consolidati
 * aggiungerne un sesto peggiorerebbe il problema. La scaletta nella strip dice
 * già a che punto è, e il conteggio esatto vive nel pannello del tile.
 */
function FocusBand({ tiles, stats, onOpen }: {
  tiles: Tile[];
  stats?: { open_tiles: number; open_steps: number; triage: number; due_this_week: number };
  onOpen: (tileId: string) => void;
}) {
  return (
    <div className="ob-cockpit__band">
      <span className="ob-cockpit__band-label">Focus</span>

      <div className="ob-cockpit__slots">
        {tiles.length === 0
          ? (
            <div className="ob-cockpit__slot-empty">
              niente in evidenza
            </div>
          )
          : tiles.map((t) => {
            const key = tileVisualKey({ action_type: t.action_type, all_day: t.all_day });
            const iso = eventRefIso(t);
            return (
              <TileCard
                key={t.id}
                title={t.title || 'Senza titolo'}
                visualKey={key}
                steps={(t.subtasks ?? []).map(subtaskToStep)}
                sparks={(t.sparks ?? []).map((sp) => sp.type as SparkType)}
                meta={TILE_VISUAL[key].meta === 'date' && iso ? DATE_LABEL.format(new Date(iso)) : undefined}
                focused={!!t.is_focused}
                onClick={() => onOpen(t.id)}
              />
            );
          })}
      </div>

      <div className="ob-cockpit__pills">
        <Pill n={stats?.triage} label="da triagiare" sub="senza un tag vero" alert />
        <Pill n={stats?.open_tiles} label="tile aperti" sub={stats ? `${stats.open_steps} passi` : ''} />
        <Pill n={stats?.due_this_week} label="in scadenza" sub="questa settimana" />
      </div>
    </div>
  );
}

/** Il trattino finché i numeri non sono arrivati: uno zero che poi diventa
 *  diciassette è peggio di un vuoto dichiarato. */
function Pill({ n, label, sub, alert }: { n?: number; label: string; sub?: string; alert?: boolean }) {
  return (
    <div className={`ob-cockpit__pill${alert ? ' ob-cockpit__pill--alert' : ''}`}>
      <span className="ob-cockpit__pill-n">{n ?? '—'}</span>
      <span className="ob-cockpit__pill-l">
        {label}
        {sub ? <span className="ob-cockpit__pill-sub">{sub}</span> : null}
      </span>
    </div>
  );
}

const DATE_LABEL = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' });

/**
 * L'ORIZZONTE — i prossimi giorni, accanto a quel che c'è da fare.
 *
 * Non è una terza lista: è l'altra metà della domanda. Le due colonne dicono
 * cosa ASPETTA, questa dice cosa ARRIVA — ed è la differenza fra una plancia e
 * un elenco di cose da fare.
 *
 * Una riga per giorno, anche vuoto: un calendario che salta i giorni liberi non
 * si legge più come un calendario, e i buchi sono informazione quanto i pieni.
 */
function Horizon({ start, days, tiles, loading, onOpen }: {
  start: string;
  days: number;
  tiles: Tile[];
  loading: boolean;
  onOpen: (tileId: string) => void;
}) {
  const today = dayKey(new Date());

  /** I tile raccolti per giorno secondo la data che li colloca — `eventRefIso`,
   *  la stessa regola che usa Chrono. */
  const byDay = React.useMemo(() => {
    const map = new Map<string, Tile[]>();
    for (const t of tiles) {
      const iso = eventRefIso(t);
      if (!iso) continue;
      const k = dayKey(new Date(iso));
      const list = map.get(k);
      if (list) list.push(t);
      else map.set(k, [t]);
    }
    // Dentro il giorno, in ordine di ora: senza, l'ordine sarebbe quello in cui
    // il server li ha restituiti, e le due del pomeriggio starebbero sopra le
    // nove del mattino.
    for (const list of map.values()) {
      list.sort((a, b) => (eventRefIso(a) ?? '').localeCompare(eventRefIso(b) ?? ''));
    }
    return map;
  }, [tiles]);

  const cells = React.useMemo(() => (
    Array.from({ length: days }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    })
  ), [start, days]);

  const shown = cells.reduce((n, d) => n + (byDay.get(dayKey(d))?.length ?? 0), 0);
  const beyond = tiles.length - shown;

  return (
    <div className="ob-cockpit__lane" style={{ ['--st-c' as string]: 'var(--ob-muted)' }}>
      <div className="ob-cockpit__lane-head">
        <span className="ob-cockpit__lane-badge"><IconCalendarTime size={12} /></span>
        <span className="ob-cockpit__lane-label">Orizzonte</span>
        <span className="ob-cockpit__lane-hint">{days} giorni</span>
        <span className="ob-cockpit__lane-count">{shown}</span>
      </div>

      <div className="ob-cockpit__agenda">
        {loading
          ? <div className="ob-cockpit__empty">Caricamento</div>
          : cells.map((d) => {
            const k = dayKey(d);
            const evs = byDay.get(k) ?? [];
            const weekend = d.getDay() === 0 || d.getDay() === 6;
            const now = k === today;
            return (
              <div
                key={k}
                className={`ob-cockpit__day${weekend ? ' ob-cockpit__day--wknd' : ''}${now ? ' ob-cockpit__day--now' : ''}`}
              >
                <span className="ob-cockpit__day-label">
                  <b>{now ? 'oggi' : dayLabel(d)}</b>
                  {now ? dayLabel(d) : null}
                </span>
                <span className="ob-cockpit__day-events">
                  {evs.length === 0
                    ? <span className="ob-cockpit__day-empty">—</span>
                    : evs.map((t) => <HorizonEvent key={t.id} tile={t} onOpen={() => onOpen(t.id)} />)}
                </span>
              </div>
            );
          })}
      </div>

      <div className="ob-cockpit__lane-foot">
        {beyond > 0 ? `${beyond} oltre l'orizzonte` : 'niente altro in vista'}
      </div>
    </div>
  );
}

function HorizonEvent({ tile, onOpen }: { tile: Tile; onOpen: () => void }) {
  // Il tipo grafico lo decide la stessa funzione che lo decide sulle card:
  // `event + all_day` è `allday`, e la regola sta scritta in un posto solo.
  const key = tileVisualKey({ action_type: tile.action_type, all_day: tile.all_day });
  const kind = key === 'deadline' ? 'deadline' : key === 'allday' ? 'allday' : 'event';
  const iso = eventRefIso(tile);
  return (
    <button type="button" className="ob-cockpit__event" onClick={onOpen}>
      <span className={`ob-cockpit__event-kind ob-cockpit__event-kind--${kind}`} />
      <span className="ob-cockpit__event-hour">
        {kind === 'allday' || !iso ? 'tutto' : HOUR_LABEL.format(new Date(iso))}
      </span>
      <span className="ob-cockpit__event-title" title={tile.title ?? undefined}>
        {tile.title || 'Senza titolo'}
      </span>
    </button>
  );
}

/** Chiave di giorno LOCALE. Non l'ISO: quello è in UTC, e un evento delle 23
 *  finirebbe nel giorno dopo per chi lo guarda. */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

const DAY_LABEL = new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: 'numeric' });
const HOUR_LABEL = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' });

/** «ven 4». Il punto dell'abbreviazione italiana si toglie: in mono, allineato
 *  in colonna, è un pixel che balla senza dire niente. */
function dayLabel(d: Date): string {
  return DAY_LABEL.format(d).replace('.', '');
}

/**
 * IL PIEDE DELLA COLONNA — dice quante cose non stai vedendo.
 *
 * C'è sempre, anche quando non c'è niente di tagliato: una riga che compare e
 * scompare farebbe ballare l'altezza della colonna a ogni filtro, e il suo
 * mestiere vale anche quando la risposta è «nessuna».
 *
 * È un pulsante solo quando c'è davvero qualcosa da aprire.
 */
function LaneFoot({ hidden, expanded, onToggle }: {
  hidden: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  if (hidden === 0 && !expanded) {
    return <div className="ob-cockpit__lane-foot">nessun altro</div>;
  }
  return (
    <button
      type="button"
      className="ob-cockpit__lane-foot ob-cockpit__lane-foot--action"
      onClick={onToggle}
    >
      {expanded ? `mostra solo i primi ${LANE_MAX_ROWS}` : `altri ${hidden} · apri l'elenco completo`}
    </button>
  );
}

/**
 * Una riga da 30px, cinque slot allineati:
 *
 *   àncora · passo (+ contesto) · chi · pioli · età
 *
 * Le larghezze fisse sull'àncora e su «chi» sono ciò che rende la lista
 * scandibile in verticale: si legge una colonna sola dall'alto in basso senza
 * rileggere il resto. Solo il passo è elastico, perché è l'unico testo che vale
 * la pena leggere per intero.
 */
function FlowRow({ row, who, onOpen }: { row: FlowRowData; who?: string; onOpen: () => void }) {
  const { tile, steps, next, ageDays, closed, concluded, lane } = row;
  const anchor = anchorOf(tile);
  const blocked = next?.state === 'blocked';

  return (
    <button
      type="button"
      className={`ob-cockpit__row${concluded ? ' ob-cockpit__row--closed' : ''}`}
      onClick={onOpen}
      title={tile.title ?? undefined}
    >
      {anchor
        ? (
          <span
            className={`ob-cockpit__chip${anchor.root ? ' ob-cockpit__chip--root' : ''}`}
            title={anchor.name}
          >
            {anchor.name.length > ANCHOR_MAX ? `${anchor.name.slice(0, ANCHOR_MAX)}…` : anchor.name}
          </span>
        )
        : <span />}

      <span className="ob-cockpit__step">
        {blocked && (
          <span className="ob-cockpit__lock" title="Passo fermo">
            <IconLock size={10} />
          </span>
        )}
        {next
          ? (next.content || 'passo senza titolo')
          : <span className="ob-cockpit__ctx">nessun passo aperto</span>}
      </span>

      <WhoSlot lane={lane} name={who} context={tile.title} step={next?.content} />

      <span className="ob-cockpit__steps" aria-hidden>
        {steps.map((s) => (
          <span key={s.id} className={`ob-cockpit__rung ob-cockpit__rung--${rungOf(s, closed)}`} />
        ))}
      </span>

      {/* Il giorno zero non si scrive: «0g» su una cosa appena scritta è rumore,
          e la colonna serve a far risaltare i numeri alti. Sui conclusi non c'è
          attesa da misurare, e il trattino lo dice meglio del vuoto. */}
      <span className={`ob-cockpit__age${(ageDays ?? 0) >= AGE_EMPHASIS_DAYS ? ' ob-cockpit__age--hi' : ''}`}>
        {concluded ? '—' : (ageDays !== null && ageDays > 0 ? `${ageDays} g` : '')}
      </span>
    </button>
  );
}

/**
 * LO SLOT «CHI / CONTESTO» — contenuti diversi nelle due liste, **alla stessa
 * larghezza, nella stessa posizione e con lo stesso peso**.
 *
 *   tocca a me                 → il TITOLO DEL TILE, in `subtle`
 *   tocca a te, con un nome    → il nome del contatto, in `muted`, glifo PIENO
 *   tocca a te, senza nome     → «qualcuno» in corsivo `faint`, glifo VUOTO
 *
 * Che sia una colonna sola e non due è il punto: allineata, si scandisce
 * dall'alto in basso senza rileggere il resto della riga. Nella lista di
 * sinistra dice DOVE sta la cosa, in quella di destra DA CHI dipende — in
 * entrambi i casi è l'informazione che qualifica il passo senza essere il passo.
 *
 * Gli ultimi due sono la stessa cosa a due gradi di precisione, non due
 * categorie: da qui lo STESSO glifo, pieno o vuoto, e non due segni diversi.
 */
function WhoSlot({ lane, name, context, step }: {
  lane: CockpitLane;
  name?: string;
  context?: string | null;
  step?: string | null;
}) {
  if (lane === 'theirs') {
    if (name) {
      return (
        <span className="ob-cockpit__who ob-cockpit__who--named">
          <span className="ob-cockpit__who-glyph"><IconPointFilled size={9} /></span>
          <span className="ob-cockpit__who-name">{name}</span>
        </span>
      );
    }
    return (
      <span className="ob-cockpit__who ob-cockpit__who--anon">
        <span className="ob-cockpit__who-glyph"><IconPoint size={9} /></span>
        <span className="ob-cockpit__who-name">qualcuno</span>
      </span>
    );
  }

  // Il titolo si tace quando ripete il passo: su un tile con un solo elemento i
  // due testi coincidono, e scriverlo due volte sulla stessa riga è rumore.
  const title = (context ?? '').trim();
  if (!title || title === (step ?? '').trim()) return <span className="ob-cockpit__who" />;
  return (
    <span className="ob-cockpit__who" title={title}>
      <span className="ob-cockpit__who-name">{title}</span>
    </span>
  );
}

/** Il colore del piolo. `neutral` non viene da `subtaskToStep`: è il tile a
 *  imporlo ai passi che restavano aperti quando lo si è chiuso. */
function rungOf(s: Subtask, tileClosed: boolean): StepState | 'neutral' {
  const step = subtaskToStep(s);
  if (tileClosed && (step === 'pending' || step === 'blocked')) return 'neutral';
  return step;
}
