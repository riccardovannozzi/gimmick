'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { IconPlus, IconTrash, IconFilter, IconX } from '@tabler/icons-react';
import { toast } from 'sonner';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFilterStore } from '@/store/filter-store';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { sparksApi } from '@/lib/api';
import { typeColors } from '@/lib/spark-utils';
import { SparkViewer } from '@/components/spark/spark-viewer';
import type { Spark } from '@/types';

export default function SparksPage() {
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
      toast.error('Errore durante l\'eliminazione');
    },
  });

  const allSparks = data?.data || [];
  const pagination = data?.pagination;

  const sparks = useMemo(() => {
    if (!aiFilterIds) return allSparks;
    const idSet = new Set(aiFilterIds);
    return allSparks.filter((m) => idSet.has(m.id));
  }, [allSparks, aiFilterIds]);

  return (
    <div className="flex flex-col h-full">
      <Header title="Sparks" />

      <div className="flex-1 p-6 flex flex-col gap-4 overflow-hidden">
        {/* AI Filter Banner */}
        {aiFilterIds && (
          <div className="flex items-center justify-between rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2.5">
            <p className="text-sm text-blue-400">
              Filtro AI attivo — {sparks.length} spark trovati
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilter}
              className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/20 h-7 px-2"
            >
              <IconX className="h-3.5 w-3.5 mr-1" />
              Rimuovi filtro
            </Button>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="border-zinc-800 bg-zinc-900">
                  <IconFilter className="mr-2 h-4 w-4" />
                  {typeFilter || 'Tutti i tipi'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-zinc-900 border-zinc-800">
                <DropdownMenuItem onClick={() => setTypeIconFilter(undefined)}>
                  Tutti
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTypeIconFilter('photo')}>
                  Foto
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTypeIconFilter('text')}>
                  Testo
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTypeIconFilter('audio_recording')}>
                  Audio
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTypeIconFilter('file')}>
                  File
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Button className="bg-blue-600 hover:bg-blue-700">
            <IconPlus className="mr-2 h-4 w-4" />
            Nuovo Spark
          </Button>
        </div>

        {/* Table */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 flex flex-col flex-1 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-zinc-800/50">
                <TableHead className="text-zinc-400">Nome</TableHead>
                <TableHead className="text-zinc-400">Tipo</TableHead>
                <TableHead className="text-zinc-400">Data</TableHead>
                <TableHead className="text-zinc-400">Dimensione</TableHead>
                <TableHead className="text-zinc-400">AI</TableHead>
                <TableHead className="text-zinc-400 text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
          </Table>
          <div className="flex-1 overflow-y-auto">
          <Table>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-zinc-400">
                    Caricamento...
                  </TableCell>
                </TableRow>
              ) : sparks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-zinc-400">
                    Nessun spark trovato
                  </TableCell>
                </TableRow>
              ) : (
                sparks.map((memo) => (
                  <TableRow
                    key={memo.id}
                    className="border-zinc-800 hover:bg-zinc-800/50 cursor-pointer"
                    onClick={() => setSelectedSpark(memo)}
                  >
                    <TableCell className="font-medium text-white">
                      {memo.file_name || memo.content?.substring(0, 30) || memo.type}
                    </TableCell>
                    <TableCell>
                      <Badge className={typeColors[memo.type]}>
                        {memo.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-zinc-400">
                      {new Date(memo.created_at).toLocaleDateString('it-IT')}
                    </TableCell>
                    <TableCell className="text-zinc-400">
                      {memo.file_size
                        ? `${(memo.file_size / 1024).toFixed(1)} KB`
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2.5 h-2.5 rounded-full ${
                            memo.ai_status === 'completed'
                              ? 'bg-green-500'
                              : memo.ai_status === 'processing'
                              ? 'bg-yellow-500'
                              : memo.ai_status === 'failed'
                              ? 'bg-red-500'
                              : 'bg-zinc-500'
                          }`}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-zinc-400 hover:text-red-400"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMutation.mutate(memo.id);
                        }}
                      >
                        <IconTrash className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-400">
              Pagina {pagination.page} di {pagination.totalPages} ({pagination.total} totali)
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

      <SparkViewer
        spark={selectedSpark}
        open={selectedSpark !== null}
        onOpenChange={(open) => { if (!open) setSelectedSpark(null); }}
      />
    </div>
  );
}
