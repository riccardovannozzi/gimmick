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
import { tilesApi, typeIconsApi, statusesApi } from '@/lib/api';
import { STATUS_HEX, STATUS_HEX_FALLBACK } from '@/constants/tile-colors';
import { getSignedUrls } from '@/lib/storage';
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
    />
  );
}
