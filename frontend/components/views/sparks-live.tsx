'use client';

/**
 * Gimmick · Obsidian — Sparks view collegata ai dati reali (Fase 1).
 *
 * Avvolge la presentazione `SparksView` (design Obsidian) collegandola a:
 *   - `useQuery(['sparks'])` paginato (50/pagina), mappando `Spark` → `SparkItem`
 *   - filtro AI seedato dalla chat (`useFilterStore`) con banner Obsidian
 *   - eliminazione (`deleteMutation`) + toast
 *   - apertura `SparkViewer` al click sulla riga
 *   - paginazione server-side (footer)
 *
 * Il filtro per tipo è client-side via le chip della `SparksView` (coerente col
 * design DC); la paginazione resta server-side sull'insieme completo dei tipi.
 */
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/primitives';
import { Icon } from '@/components/shell';
import { SparksView, type SparkItem } from '@/components/views/sparks';
import { SparkViewer } from '@/components/spark/spark-viewer';
import { useFilterStore } from '@/store/filter-store';
import { sparksApi } from '@/lib/api';
import { formatFileSize } from '@/lib/spark-utils';
import type { Spark } from '@/types';

/** Mappa i tipi reali sugli accenti-tipo del design Obsidian. */
const TYPE_TO_KIND: Record<string, SparkItem['type']> = {
  photo: 'photo',
  image: 'photo',
  video: 'video',
  text: 'text',
  audio_recording: 'audio',
  file: 'file',
};

function toSparkItem(s: Spark): SparkItem {
  return {
    id: s.id,
    name: s.file_name || s.content?.substring(0, 40) || s.type,
    type: TYPE_TO_KIND[s.type] ?? 'file',
    date: new Date(s.created_at).toLocaleDateString('it-IT'),
    dim: s.file_size ? formatFileSize(s.file_size) : undefined,
    dimv: s.file_size ?? 0,
    ai: s.ai_status === 'completed',
  };
}

export function SparksLive() {
  const [page, setPage] = useState(1);
  const [selectedSpark, setSelectedSpark] = useState<Spark | null>(null);
  const queryClient = useQueryClient();
  const { sparkIds: aiFilterIds, clearFilter } = useFilterStore();

  const { data, isLoading } = useQuery({
    queryKey: ['sparks', { page }],
    queryFn: () => sparksApi.list({ page, limit: 50 }),
  });

  const deleteMutation = useMutation({
    mutationFn: sparksApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sparks'] });
      toast.success('Spark eliminato');
    },
    onError: () => toast.error("Errore durante l'eliminazione"),
  });

  const allSparks = useMemo(() => data?.data ?? [], [data]);
  const pagination = data?.pagination;

  // Filtro AI (lista di id seedata dalla chat), applicato lato client.
  const visibleSparks = useMemo(() => {
    if (!aiFilterIds) return allSparks;
    const idSet = new Set(aiFilterIds);
    return allSparks.filter((s) => idSet.has(s.id));
  }, [allSparks, aiFilterIds]);

  const items = useMemo(() => visibleSparks.map(toSparkItem), [visibleSparks]);

  const handleSelect = (id: string | number) => {
    const spark = allSparks.find((s) => s.id === id);
    if (spark) setSelectedSpark(spark);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {aiFilterIds && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '10px 20px',
            background: 'var(--ob-accent-soft)',
            borderBottom: '1px solid var(--ob-line)',
            color: 'var(--ob-accent-text)',
            fontFamily: 'var(--ob-font-mono)',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.04em',
          }}
        >
          <span>Filtro AI attivo — {items.length} spark trovati</span>
          <Button variant="ghost" size="sm" icon={<Icon name="chevL" size={13} />} onClick={clearFilter}>
            Rimuovi filtro
          </Button>
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0 }}>
        {isLoading ? (
          <div
            style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--ob-subtle)',
              fontSize: 13,
              fontFamily: 'var(--ob-font-sans)',
            }}
          >
            Caricamento…
          </div>
        ) : (
          <SparksView
            sparks={items}
            onSelect={handleSelect}
            onDelete={(id) => deleteMutation.mutate(String(id))}
          />
        )}
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '10px 20px',
            borderTop: '1px solid var(--ob-line)',
            background: 'var(--ob-head)',
          }}
        >
          <span style={{ fontFamily: 'var(--ob-font-mono)', fontSize: 12, color: 'var(--ob-muted)' }}>
            Pagina {pagination.page} di {pagination.totalPages} · {pagination.total} totali
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Precedente
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Successiva
            </Button>
          </div>
        </div>
      )}

      <SparkViewer
        spark={selectedSpark}
        open={selectedSpark !== null}
        onOpenChange={(open) => { if (!open) setSelectedSpark(null); }}
      />
    </div>
  );
}
