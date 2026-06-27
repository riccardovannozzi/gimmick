'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { IconTrash, IconFilter, IconX } from '@tabler/icons-react';
import { toast } from 'sonner';
import { Header } from '@/components/layout/header';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usePixelTheme, PixelCard, PixelBadge } from '@/components/pixel';
import { pixelToolbarBtn } from '@/lib/pixel-toolbar';
import { useFilterStore } from '@/store/filter-store';
import { sparksApi } from '@/lib/api';
import { SparkViewer } from '@/components/spark/spark-viewer';
import { ViewContainer } from '@/components/shell';
import { SparksLive } from '@/components/views/sparks-live';
import { isObsidianShellEnabled } from '@/lib/feature-flags';
import type { Spark } from '@/types';

const TYPE_LABELS: Record<string, string> = {
  photo: 'PHOTO',
  video: 'VIDEO',
  text: 'TEXT',
  audio_recording: 'AUDIO',
  file: 'FILE',
  image: 'IMAGE',
};

export default function SparksPage() {
  // Migrazione Obsidian (Fase 1): dietro feature-flag la vista Sparks reale è
  // resa dalla `SparksView` Obsidian collegata ai dati (niente più <Header/>
  // di pagina → no doppio header dentro lo shell). Default OFF = arcade.
  if (isObsidianShellEnabled()) {
    return (
      <ViewContainer hideToolbar>
        <SparksLive />
      </ViewContainer>
    );
  }
  return <ArcadeSparksPage />;
}

function ArcadeSparksPage() {
  const theme = usePixelTheme();
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeIconFilter] = useState<string | undefined>();
  const [selectedSpark, setSelectedSpark] = useState<Spark | null>(null);
  const queryClient = useQueryClient();
  const { sparkIds: aiFilterIds, clearFilter } = useFilterStore();

  const { data, isLoading } = useQuery({
    queryKey: ['sparks', { page, type: typeFilter }],
    queryFn: () => sparksApi.list({ page, limit: 50, type: typeFilter }),
  });

  const deleteMutation = useMutation({
    mutationFn: sparksApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sparks'] });
      toast.success('Spark eliminato');
    },
    onError: () => {
      toast.error("Errore durante l'eliminazione");
    },
  });

  const allSparks = data?.data || [];
  const pagination = data?.pagination;

  const sparks = useMemo(() => {
    if (!aiFilterIds) return allSparks;
    const idSet = new Set(aiFilterIds);
    return allSparks.filter((m) => idSet.has(m.id));
  }, [allSparks, aiFilterIds]);

  // Common cell + header styles — keep them DRY since the same pixel border
  // and font show up on every row.
  const headerCellStyle: React.CSSProperties = {
    fontFamily: 'var(--font-pixel-head)',
    fontSize: 9,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: theme.ink2,
    padding: '10px 12px',
    textAlign: 'left',
    background: theme.surfaceVariant,
    borderBottom: `2px solid ${theme.border}`,
  };
  const cellStyle: React.CSSProperties = {
    fontFamily: 'var(--font-pixel-body)',
    fontSize: 12,
    color: theme.ink,
    padding: '10px 12px',
    borderBottom: `2px solid ${theme.border}`,
  };

  return (
    <div className="flex flex-col h-full" style={{ background: theme.bg1 }}>
      <Header title="Sparks" />

      <div className="flex-1 p-6 flex flex-col gap-4 overflow-hidden">
        {/* AI Filter banner — shown only when the chat AI seeded a filter */}
        {aiFilterIds && (
          <PixelCard
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              background: `${theme.accent}22`,
              border: `2px solid ${theme.accent}`,
            }}
          >
            <p
              style={{
                fontFamily: 'var(--font-pixel-head)',
                fontSize: 10,
                letterSpacing: '0.06em',
                color: theme.accent,
              }}
            >
              FILTRO AI ATTIVO — {sparks.length} SPARK TROVATI
            </p>
            <button
              onClick={clearFilter}
              className="px-press"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                height: 28,
                padding: '0 10px',
                background: 'transparent',
                color: theme.accent,
                border: `2px solid ${theme.accent}`,
                fontFamily: 'var(--font-pixel-head)',
                fontSize: 8,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              <IconX size={11} />
              Rimuovi filtro
            </button>
          </PixelCard>
        )}

        {/* Toolbar — type filter + new spark */}
        <div className="flex items-center justify-between gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="px-press" style={pixelToolbarBtn(theme, !!typeFilter)}>
                <IconFilter size={13} />
                {typeFilter ? (TYPE_LABELS[typeFilter] ?? typeFilter) : 'Tutti i tipi'}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              style={{
                background: theme.surface,
                border: `2px solid ${theme.border}`,
                borderRadius: 0,
                padding: 0,
                boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
              }}
            >
              {([
                { id: undefined, label: 'TUTTI' },
                { id: 'photo', label: 'PHOTO' },
                { id: 'text', label: 'TEXT' },
                { id: 'audio_recording', label: 'AUDIO' },
                { id: 'file', label: 'FILE' },
              ] as const).map((opt) => (
                <DropdownMenuItem
                  key={opt.id ?? 'all'}
                  onClick={() => setTypeIconFilter(opt.id)}
                  style={{
                    fontFamily: 'var(--font-pixel-head)',
                    fontSize: 9,
                    letterSpacing: '0.08em',
                    color: theme.ink,
                    borderRadius: 0,
                  }}
                >
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

        </div>

        {/* Table — plain HTML table styled with pixel tokens. The shadcn
            Table wrapper was replaced because its rounded corners and zinc
            tones don't compose with the hard pixel chrome. */}
        <PixelCard
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            padding: 0,
            overflow: 'hidden',
          }}
        >
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                <tr>
                  <th style={headerCellStyle}>Nome</th>
                  <th style={headerCellStyle}>Tipo</th>
                  <th style={headerCellStyle}>Data</th>
                  <th style={headerCellStyle}>Dim.</th>
                  <th style={headerCellStyle}>AI</th>
                  <th style={{ ...headerCellStyle, textAlign: 'right' }}>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} style={{ ...cellStyle, textAlign: 'center', color: theme.ink2 }}>
                      Caricamento...
                    </td>
                  </tr>
                ) : sparks.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ ...cellStyle, textAlign: 'center', color: theme.ink2 }}>
                      Nessun spark trovato
                    </td>
                  </tr>
                ) : (
                  sparks.map((memo) => (
                    <tr
                      key={memo.id}
                      onClick={() => setSelectedSpark(memo)}
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLTableRowElement).style.background =
                          theme.surfaceMuted;
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLTableRowElement).style.background = 'transparent';
                      }}
                    >
                      <td style={{ ...cellStyle, fontWeight: 600 }}>
                        {memo.file_name || memo.content?.substring(0, 30) || memo.type}
                      </td>
                      <td style={cellStyle}>
                        <PixelBadge
                          bg={theme.cap[memo.type as keyof typeof theme.cap] ?? theme.ink}
                          color={theme.bg1}
                        >
                          {TYPE_LABELS[memo.type] ?? memo.type.toUpperCase()}
                        </PixelBadge>
                      </td>
                      <td style={{ ...cellStyle, color: theme.ink2 }}>
                        {new Date(memo.created_at).toLocaleDateString('it-IT')}
                      </td>
                      <td style={{ ...cellStyle, color: theme.ink2 }}>
                        {memo.file_size ? `${(memo.file_size / 1024).toFixed(1)} KB` : '-'}
                      </td>
                      <td style={cellStyle}>
                        {/* Solid square (no rounded) — green/yellow/red/grey
                            per AI indexing state. */}
                        <div
                          style={{
                            width: 12,
                            height: 12,
                            background:
                              memo.ai_status === 'completed'
                                ? '#1FB81F'
                                : memo.ai_status === 'processing'
                                ? '#FFB400'
                                : memo.ai_status === 'failed'
                                ? '#F82B60'
                                : theme.ink3,
                            border: `2px solid ${theme.border}`,
                          }}
                        />
                      </td>
                      <td style={{ ...cellStyle, textAlign: 'right' }}>
                        <button
                          aria-label="Elimina"
                          className="px-press"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteMutation.mutate(memo.id);
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 28,
                            height: 28,
                            background: theme.surface,
                            color: '#E24B4A',
                            border: `2px solid ${theme.border}`,
                            cursor: 'pointer',
                          }}
                        >
                          <IconTrash size={13} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </PixelCard>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p
              style={{
                fontFamily: 'var(--font-pixel-head)',
                fontSize: 9,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: theme.ink2,
              }}
            >
              Pagina {pagination.page} di {pagination.totalPages} ({pagination.total} totali)
            </p>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                className="px-press"
                style={{
                  height: 28,
                  padding: '0 12px',
                  background: theme.surfaceVariant,
                  color: theme.ink,
                  border: `2px solid ${theme.border}`,
                  fontFamily: 'var(--font-pixel-head)',
                  fontSize: 9,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  cursor: page === 1 ? 'not-allowed' : 'pointer',
                  opacity: page === 1 ? 0.4 : 1,
                }}
              >
                Precedente
              </button>
              <button
                disabled={page === pagination.totalPages}
                onClick={() => setPage(page + 1)}
                className="px-press"
                style={{
                  height: 28,
                  padding: '0 12px',
                  background: theme.surfaceVariant,
                  color: theme.ink,
                  border: `2px solid ${theme.border}`,
                  fontFamily: 'var(--font-pixel-head)',
                  fontSize: 9,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  cursor: page === pagination.totalPages ? 'not-allowed' : 'pointer',
                  opacity: page === pagination.totalPages ? 0.4 : 1,
                }}
              >
                Successiva
              </button>
            </div>
          </div>
        )}
      </div>

      <SparkViewer
        spark={selectedSpark}
        open={selectedSpark !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedSpark(null);
        }}
      />
    </div>
  );
}
