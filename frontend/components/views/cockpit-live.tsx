'use client';

/**
 * Gimmick · Obsidian — COCKPIT.
 *
 * Due liste e una domanda sola: **di chi è la palla**. A sinistra quel che
 * dipende da te, a destra quel che stai aspettando da qualcun altro.
 *
 * ─── Perché solo i flow ──────────────────────────────────────────────────────
 *
 * Un flow è un rimpallo di responsabilità fra più soggetti: solo lì la palla
 * esiste. Su una lista della spesa è sempre di chi l'ha scritta, e mostrarla
 * riempirebbe la colonna «Tocca a me» di cose che non sono in attesa di
 * nessuno.
 *
 * ─── Perché NON c'è una corsia «fermi» ───────────────────────────────────────
 *
 * Il disegno ne prevedeva una, con soglia a 14 giorni. Sui dati veri il 63% dei
 * passi aperti supera i venti giorni: tre su quattro sarebbero finiti lì, e una
 * corsia che contiene quasi tutto non separa niente. L'anzianità è rimasta,
 * ma come CHIAVE DI ORDINAMENTO — un numero in fondo alla card, non un giudizio.
 *
 * ─── I conclusi ──────────────────────────────────────────────────────────────
 *
 * Non hanno una colonna: sono dietro un interruttore in barra. Ci finisce sia
 * il flow che ha chiuso tutti i passi, sia quello il cui TILE è stato chiuso a
 * mano — e in quel secondo caso i passi rimasti si leggono NEUTRI, né fatti né
 * da fare. È un caso anomalo che però capita spesso: un processo si abbandona
 * più di quanto lo si concluda.
 */
import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { IconUser, IconHourglass, IconCheck, IconArrowNarrowRight, IconArrowsSort } from '@tabler/icons-react';
import { tilesApi, subtasksApi } from '@/lib/api';
import { useContacts } from '@/lib/hooks/useContacts';
import { useStatuses } from '@/store/statuses-store';
import { useTileSelectionStore } from '@/store/tile-selection-store';
import {
  currentStep, stalenessFrom, cockpitLane, subtaskToStep,
  type CockpitLane, type StepState,
} from '@/lib/tile-visual';
import type { Subtask, Tile } from '@/types';

/** Oltre questa lunghezza il nome del tag viene tagliato; per intero in hover. */
const ANCHOR_MAX = 15;

/** Gli stati chiusi del tile: quelli che rendono neutri i passi rimasti. */
const CLOSED_STATUSES = new Set(['done', 'cancelled']);

type SortKey = 'age' | 'title';

type FlowRow = {
  tile: Tile;
  steps: Subtask[];
  lane: CockpitLane;
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

/** Il tag del tile, scartando il root GIMMICK: quello è di tutti e non àncora niente. */
function anchorOf(tile: Tile): string | null {
  const t = (tile.tags ?? []).find((x) => !x.is_root);
  return t?.name ?? null;
}

const LANES: Record<CockpitLane, { label: string; color: string; Icon: typeof IconUser }> = {
  mine: { label: 'Tocca a me', color: 'var(--ob-accent)', Icon: IconUser },
  theirs: { label: 'Tocca a te', color: '#5B8DEF', Icon: IconHourglass },
  closed: { label: 'Conclusi', color: 'var(--ob-step-done)', Icon: IconCheck },
};

export function CockpitLive() {
  const selectTile = useTileSelectionStore((s) => s.select);
  const { statuses } = useStatuses();
  const { contacts } = useContacts();
  const [showClosed, setShowClosed] = React.useState(false);
  const [sortKey, setSortKey] = React.useState<SortKey>('age');

  const tilesQuery = useQuery({
    // Chiave propria: la lista dei tile filtrata per `flow` è un'altra cosa
    // dalla lista piena, e condividerne una sarebbe due `queryFn` sulla stessa
    // chiave — la trappola che questo progetto ha già incontrato una volta.
    queryKey: ['tiles-cockpit'],
    queryFn: () => tilesApi.list({ action_type: 'flow', limit: 100 }),
    staleTime: 60_000,
  });

  const stepsQuery = useQuery({
    queryKey: ['subtasks-flow'],
    queryFn: () => subtasksApi.listFlow(),
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

  const rows: FlowRow[] = React.useMemo(() => {
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
      return {
        tile,
        steps: own,
        lane,
        next,
        ageDays: next ? daysSince(stalenessFrom(next)) : null,
        closed,
      };
    });
  }, [tilesQuery.data, stepsQuery.data, statuses, selfContactId]);

  const byLane = React.useCallback((lane: CockpitLane) => {
    const list = rows.filter((r) => r.lane === lane);
    // Il più fermo in cima: è l'ordine che risponde alla domanda per cui apri
    // questa pagina. Chi vuole cercare un nome passa all'alfabetico.
    return list.sort((a, b) => (
      sortKey === 'title'
        ? (a.tile.title ?? '').localeCompare(b.tile.title ?? '')
        : (b.ageDays ?? -1) - (a.ageDays ?? -1)
    ));
  }, [rows, sortKey]);

  const isLoading = tilesQuery.isLoading || stepsQuery.isLoading;
  const lanes: CockpitLane[] = showClosed ? ['mine', 'theirs', 'closed'] : ['mine', 'theirs'];
  const closedCount = rows.filter((r) => r.lane === 'closed').length;

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

      <div className="ob-cockpit__board">
        {lanes.map((key) => {
          const lane = LANES[key];
          const items = byLane(key);
          return (
            <div key={key} className="ob-cockpit__lane" style={{ ['--st-c' as string]: lane.color }}>
              <div className="ob-cockpit__lane-head">
                <span className="ob-cockpit__lane-badge"><lane.Icon size={13} /></span>
                <span className="ob-cockpit__lane-label">{lane.label}</span>
                <span className="ob-cockpit__lane-count">{items.length}</span>
              </div>
              <div className="ob-cockpit__lane-body ob-scroll-quiet">
                {isLoading
                  ? <div className="ob-cockpit__empty">Caricamento</div>
                  : items.length
                    ? items.map((r) => (
                      <FlowCard
                        key={r.tile.id}
                        row={r}
                        who={contactName(r.next?.contact_id)}
                        onOpen={() => selectTile(r.tile.id)}
                      />
                    ))
                    : <div className="ob-cockpit__empty">Niente qui</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * La card di un flow. Dice, dall'alto: a quale progetto appartiene, come si
 * chiama, qual è il prossimo passo, chi si aspetta, a che punto è e da quanto.
 *
 * La scaletta a sinistra è la stessa grammatica della strip sui tile: un piolo
 * per passo, dal primo in alto.
 */
function FlowCard({ row, who, onOpen }: { row: FlowRow; who?: string; onOpen: () => void }) {
  const { tile, steps, next, ageDays, closed } = row;
  const anchor = anchorOf(tile);
  const done = steps.filter((s) => s.is_done).length;
  const blocked = next?.state === 'blocked';

  return (
    <button
      type="button"
      className={`ob-cockpit__card${closed ? ' ob-cockpit__card--closed' : ''}`}
      onClick={onOpen}
    >
      <span className="ob-cockpit__ladder" aria-hidden>
        {steps.map((s) => (
          // Su un tile chiuso ogni passo non concluso diventa NEUTRO: il tile ha
          // l'ultima parola su quel che contiene. I `done` restano done — quelli
          // sono successi davvero.
          <span key={s.id} className={`ob-cockpit__rung ob-cockpit__rung--${rungOf(s, closed)}`} />
        ))}
      </span>

      <span className="ob-cockpit__card-main">
        {anchor && (
          <span className="ob-cockpit__card-tag" title={anchor}>
            {anchor.length > ANCHOR_MAX ? `${anchor.slice(0, ANCHOR_MAX)}…` : anchor}
          </span>
        )}
        <span className="ob-cockpit__card-title" title={tile.title ?? undefined}>
          {tile.title || 'Senza titolo'}
        </span>

        <span className={`ob-cockpit__card-action${blocked ? ' ob-cockpit__card-action--blocked' : ''}`}>
          <span className="ob-cockpit__card-arrow">
            {next ? <IconArrowNarrowRight size={14} /> : <IconCheck size={14} />}
          </span>
          <span className="ob-cockpit__card-action-text">
            {next ? (next.content || 'passo senza titolo') : 'nessun passo aperto'}
          </span>
        </span>

        <span className="ob-cockpit__card-foot">
          {who && (
            <span className="ob-cockpit__card-who">
              <IconUser size={11} />
              <span className="ob-cockpit__card-who-name">{who}</span>
            </span>
          )}
          <span className="ob-cockpit__card-meta">
            {steps.length > 0 && <span className="ob-cockpit__card-count">{done}/{steps.length}</span>}
            {/* Il giorno zero non si scrive: «0g» su una cosa appena scritta è
                rumore, e la colonna serve a far risaltare i numeri alti. */}
            {ageDays !== null && ageDays > 0 && (
              <span className="ob-cockpit__card-age" title="Da quanto il passo corrente è fermo lì">
                {ageDays}g
              </span>
            )}
          </span>
        </span>
      </span>
    </button>
  );
}

/** Il colore del piolo. `neutral` non viene da `subtaskToStep`: è il tile a
 *  imporlo ai passi che restavano aperti quando lo si è chiuso. */
function rungOf(s: Subtask, tileClosed: boolean): StepState | 'neutral' {
  const step = subtaskToStep(s);
  if (tileClosed && step === 'pending') return 'neutral';
  if (tileClosed && step === 'blocked') return 'neutral';
  return step;
}
