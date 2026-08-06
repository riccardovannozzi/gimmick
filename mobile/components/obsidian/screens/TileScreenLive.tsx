/**
 * Gimmick · Obsidian — Tile detail, wired to live data.
 *
 * Fetches the tile (with its sparks) via React Query + tilesApi.get and feeds
 * the presentational ObsidianTileScreen. Read-only display is wired (title,
 * schedule chip, tag, sparks count, voice/text spark cards); inline editing +
 * Save are deferred (the edit controls remain decorative for now).
 */
import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tilesApi, typeIconsApi, statusesApi, subtasksApi } from '@/lib/api';
import { STATUS_HEX, STATUS_HEX_FALLBACK } from '@/constants/tile-colors';
import { getSignedUrls } from '@/lib/storage';
import type { Subtask } from '@/types';
import { ObsidianTileScreen, sparkMediaPath, type CaptureKey } from './TileScreen';

export interface ObsidianTileScreenLiveProps {
  tileId: string;
  onBack?: () => void;
  /** Apre un canale di cattura per questo tile. La navigazione la fa la rotta. */
  onCapture?: (key: CaptureKey) => void;
}

export function ObsidianTileScreenLive({ tileId, onBack, onCapture }: ObsidianTileScreenLiveProps) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['tile-detail', tileId],
    queryFn: () => tilesApi.get(tileId),
    enabled: !!tileId,
  });

  // Salvataggio immediato per campo, come la sidebar web: ogni controllo manda
  // la sua patch e non esiste un momento "Salva". Si invalida anche `tiles`,
  // altrimenti la lista da cui si è arrivati resta indietro.
  // L'invalidazione sta DENTRO `mutationFn`, non in `onSuccess`: il titolo può
  // essere salvato mentre la schermata si smonta (uscita con Indietro a campo
  // ancora a fuoco), e in quel caso i callback legati all'osservatore del
  // componente non scattano più — la lista resterebbe indietro. Il queryClient
  // invece è globale e sopravvive.
  const patch = useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      const res = await tilesApi.update(tileId, updates as Parameters<typeof tilesApi.update>[1]);
      queryClient.invalidateQueries({ queryKey: ['tile-detail', tileId] });
      queryClient.invalidateQueries({ queryKey: ['tiles'] });
      return res;
    },
  });

  // Tipi e stati sono vocabolari dell'utente, non del tile: cambiano di rado,
  // quindi `staleTime` lungo invece di rileggerli a ogni apertura.
  const typesQuery = useQuery({ queryKey: ['type-icons'], queryFn: () => typeIconsApi.list(), staleTime: 5 * 60 * 1000 });
  const statusesQuery = useQuery({ queryKey: ['statuses'], queryFn: () => statusesApi.list(), staleTime: 5 * 60 * 1000 });
  // Il tipo assegnato NON sta sul tile: vive in una tabella di associazione a
  // parte, quindi va letto e scritto con un endpoint suo.
  const assignQuery = useQuery({ queryKey: ['type-icons', 'assignments'], queryFn: () => typeIconsApi.getAssignments(), staleTime: 5 * 60 * 1000 });
  const typeId = assignQuery.data?.data?.find((r) => r.tile_id === tileId)?.type_icon_id ?? null;

  const assignType = useMutation({
    mutationFn: async (id: string | null) => {
      const res = await typeIconsApi.assign(tileId, id);
      queryClient.invalidateQueries({ queryKey: ['type-icons', 'assignments'] });
      queryClient.invalidateQueries({ queryKey: ['tiles'] });
      return res;
    },
  });

  // ─── LIST del tile (e passi, sui flow) ─────────────────────────────────────
  //
  // Vive in una tabella a parte con un endpoint suo, quindi non arriva col tile:
  // è una seconda lettura, non un campo di `tilesApi.get`.
  const subtasksKey = React.useMemo(() => ['subtasks', tileId], [tileId]);
  const subtasksQuery = useQuery({
    queryKey: subtasksKey,
    queryFn: () => subtasksApi.list(tileId),
    enabled: !!tileId,
  });
  // `useMemo` e non `?? []` nudo: l'array di ripiego sarebbe nuovo a ogni
  // render, e `moveSubtask` — che ci si appoggia — cambierebbe identità di
  // continuo, rifacendo il render di tutta la lista a ogni battuta nel titolo.
  const subtasks: Subtask[] = React.useMemo(() => subtasksQuery.data?.data ?? [], [subtasksQuery.data]);

  /**
   * Ogni scrittura invalida anche `tiles`: la scaletta sulla card della lista
   * si disegna dai subtask che il tile porta con sé, quindi senza questa riga
   * si spunta una voce, si torna indietro e il segmento è ancora grigio.
   */
  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: subtasksKey });
    queryClient.invalidateQueries({ queryKey: ['tiles'] });
  }, [queryClient, subtasksKey]);

  const addSubtask = useMutation({
    mutationFn: () => subtasksApi.create({ tile_id: tileId, content: '' }),
    onSuccess: invalidate,
  });

  // Aggiornamento OTTIMISTICO: la spunta deve rispondere al dito, non alla
  // rete. Senza, fra il tocco e il ridisegno passava tutto il giro completo.
  const updateSubtask = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Parameters<typeof subtasksApi.update>[1] }) =>
      subtasksApi.update(id, updates),
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: subtasksKey });
      const prev = queryClient.getQueryData<{ data?: Subtask[] }>(subtasksKey);
      queryClient.setQueryData<{ data?: Subtask[] }>(subtasksKey, (old) =>
        old?.data ? { ...old, data: old.data.map((s) => (s.id === id ? { ...s, ...updates } : s)) } : old,
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) queryClient.setQueryData(subtasksKey, ctx.prev); },
    onSettled: invalidate,
  });

  const deleteSubtask = useMutation({
    mutationFn: (id: string) => subtasksApi.delete(id),
    onSuccess: invalidate,
  });

  const reorderSubtasks = useMutation({
    mutationFn: (items: { id: string; sort_order: number }[]) => subtasksApi.reorder(items),
    onSuccess: invalidate,
  });

  /**
   * Sposta una voce di una posizione e riscrive TUTTI i `sort_order`.
   *
   * La cache si aggiorna subito con l'ordine nuovo: aspettare la risposta
   * avrebbe fatto rimbalzare la riga indietro per un istante prima di
   * riassestarsi al posto giusto.
   */
  const moveSubtask = React.useCallback((from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= subtasks.length || to >= subtasks.length) return;
    const next = [...subtasks];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    const items = next.map((s, i) => ({ id: s.id, sort_order: i }));
    queryClient.setQueryData(subtasksKey, { success: true, data: next.map((s, i) => ({ ...s, sort_order: i })) });
    reorderSubtasks.mutate(items);
  }, [subtasks, queryClient, subtasksKey, reorderSubtasks]);

  // Anteprime degli sparks. Il bucket è privato, quindi ogni media va firmato:
  // si firmano TUTTI in una richiesta sola invece di una per scheda. La chiave
  // della query è l'elenco dei percorsi, così il risultato si riusa finché gli
  // sparks non cambiano; `staleTime` sta sotto l'ora di validità della firma,
  // altrimenti si mostrerebbero URL scaduti.
  const mediaPaths = React.useMemo(() => {
    const paths = (data?.data?.sparks ?? []).map(sparkMediaPath).filter((p): p is string => !!p);
    return [...new Set(paths)].sort();
  }, [data]);
  const mediaUrls = useQuery({
    queryKey: ['tile-spark-urls', mediaPaths],
    queryFn: () => getSignedUrls(mediaPaths),
    enabled: mediaPaths.length > 0,
    staleTime: 50 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  return (
    <ObsidianTileScreen
      mediaUrls={mediaUrls.data}
      tile={data?.data}
      loading={isLoading}
      onBack={onBack}
      onPatch={(updates) => patch.mutate(updates)}
      onCapture={onCapture}
      types={(typesQuery.data?.data ?? []).map((t) => ({ id: t.id, name: t.name, icon: t.icon, color: t.color }))}
      typeId={typeId}
      onSelectType={(id) => assignType.mutate(id)}
      // `StatusEntity` non porta un colore: lo stato ha una `shape`, e la tinta
      // vive in `STATUS_HEX` — la stessa tabella che colora la lista Tiles, così
      // uno stato è dello stesso colore ovunque compaia.
      statuses={(statusesQuery.data?.data ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        color: STATUS_HEX[s.name] ?? STATUS_HEX_FALLBACK,
      }))}
      subtasks={subtasks}
      subtasksLoading={subtasksQuery.isLoading}
      onToggleSubtask={(id, isDone) => updateSubtask.mutate({ id, updates: { is_done: isDone } })}
      onChangeSubtask={(id, content) => updateSubtask.mutate({ id, updates: { content } })}
      onAddSubtask={() => addSubtask.mutate()}
      onDeleteSubtask={(id) => deleteSubtask.mutate(id)}
      onMoveSubtask={moveSubtask}
    />
  );
}
