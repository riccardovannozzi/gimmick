'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LayoutGrid, Trash2, ChevronDown, ChevronRight, FileText, Image, Mic, Film, File } from 'lucide-react';
import { toast } from 'sonner';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { tilesApi } from '@/lib/api';
import { typeLabels } from '@/lib/memo-utils';
import { MemoViewer } from '@/components/memo/memo-viewer';
import type { Memo, MemoType, Tile } from '@/types';

const typeIcons: Record<MemoType, typeof FileText> = {
  photo: Image,
  image: Image,
  video: Film,
  audio_recording: Mic,
  text: FileText,
  file: File,
};

const typeIconColors: Record<MemoType, string> = {
  photo: 'text-blue-400',
  image: 'text-green-400',
  video: 'text-orange-400',
  audio_recording: 'text-red-400',
  text: 'text-purple-400',
  file: 'text-yellow-400',
};

function TileCard({ tile, onMemoClick }: { tile: Tile & { memos?: Memo[] }; onMemoClick: (memo: Memo) => void }) {
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();

  const { data: tileDetail } = useQuery({
    queryKey: ['tile', tile.id],
    queryFn: () => tilesApi.get(tile.id),
    enabled: expanded,
  });

  const deleteMutation = useMutation({
    mutationFn: tilesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tiles'] });
      toast.success('Tile eliminato');
    },
    onError: () => {
      toast.error("Errore durante l'eliminazione");
    },
  });

  const memos = tileDetail?.data?.memos || [];

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-3 text-left"
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-zinc-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-zinc-400" />
            )}
            <div>
              <CardTitle className="text-base text-white">
                {tile.title || `Tile ${tile.id.slice(0, 8)}`}
              </CardTitle>
              <p className="text-xs text-zinc-400 mt-1">
                {tile.memo_count || 0} memo · {new Date(tile.created_at).toLocaleDateString('it-IT')}
              </p>
            </div>
          </button>

          <Button
            variant="ghost"
            size="icon"
            className="text-zinc-400 hover:text-red-400"
            onClick={() => deleteMutation.mutate(tile.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          {memos.length === 0 ? (
            <p className="text-sm text-zinc-500 py-2">Caricamento...</p>
          ) : (
            <div className="space-y-2">
              {memos.map((memo) => {
                const Icon = typeIcons[memo.type] || FileText;
                const color = typeIconColors[memo.type] || 'text-zinc-400';
                return (
                  <button
                    key={memo.id}
                    className="flex items-center gap-3 p-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-700/50 transition-colors w-full text-left cursor-pointer"
                    onClick={() => onMemoClick(memo)}
                  >
                    <Icon className={`h-4 w-4 ${color}`} />
                    <span className="text-sm text-white flex-1 truncate">
                      {memo.file_name || memo.content?.substring(0, 40) || memo.type}
                    </span>
                    <Badge className="text-xs bg-zinc-700 text-zinc-300">
                      {typeLabels[memo.type]}
                    </Badge>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export default function TilesPage() {
  const [page, setPage] = useState(1);
  const [selectedMemo, setSelectedMemo] = useState<Memo | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['tiles', { page }],
    queryFn: () => tilesApi.list({ page, limit: 20 }),
  });

  const tiles = data?.data || [];
  const pagination = data?.pagination;

  return (
    <div className="flex flex-col h-full">
      <Header title="Tiles" />

      <div className="flex-1 p-6 space-y-4">
        {/* Header info */}
        <div className="flex items-center gap-2 text-zinc-400">
          <LayoutGrid className="h-5 w-5" />
          <span className="text-sm">
            {pagination?.total || 0} tiles totali
          </span>
        </div>

        {/* Tiles list */}
        {isLoading ? (
          <p className="text-center text-zinc-400 py-8">Caricamento...</p>
        ) : tiles.length === 0 ? (
          <div className="text-center py-16">
            <LayoutGrid className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
            <p className="text-zinc-400">Nessun tile trovato</p>
            <p className="text-sm text-zinc-500 mt-1">
              I tiles vengono creati automaticamente quando invii più memo insieme
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {tiles.map((tile) => (
              <TileCard key={tile.id} tile={tile} onMemoClick={setSelectedMemo} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-400">
              Pagina {pagination.page} di {pagination.totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                className="border-zinc-800"
              >
                Precedente
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page === pagination.totalPages}
                onClick={() => setPage(page + 1)}
                className="border-zinc-800"
              >
                Successiva
              </Button>
            </div>
          </div>
        )}
      </div>

      <MemoViewer
        memo={selectedMemo}
        open={selectedMemo !== null}
        onOpenChange={(open) => { if (!open) setSelectedMemo(null); }}
      />
    </div>
  );
}
