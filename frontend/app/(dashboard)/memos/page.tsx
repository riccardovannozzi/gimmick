'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { memosApi } from '@/lib/api';
import type { MemoType } from '@/types';

const typeColors: Record<MemoType, string> = {
  photo: 'bg-blue-500/20 text-blue-400',
  image: 'bg-green-500/20 text-green-400',
  video: 'bg-orange-500/20 text-orange-400',
  audio_recording: 'bg-red-500/20 text-red-400',
  audio_file: 'bg-red-500/20 text-red-400',
  text: 'bg-purple-500/20 text-purple-400',
  file: 'bg-yellow-500/20 text-yellow-400',
};

export default function MemosPage() {
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<string | undefined>();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['memos', { page, type: typeFilter }],
    queryFn: () => memosApi.list({ page, limit: 20, type: typeFilter }),
  });

  const deleteMutation = useMutation({
    mutationFn: memosApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memos'] });
      toast.success('Memo eliminato');
    },
    onError: () => {
      toast.error('Errore durante l\'eliminazione');
    },
  });

  const memos = data?.data || [];
  const pagination = data?.pagination;

  return (
    <div className="flex flex-col h-full">
      <Header title="Memos" />

      <div className="flex-1 p-6 space-y-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="border-zinc-800 bg-zinc-900">
                  <Filter className="mr-2 h-4 w-4" />
                  {typeFilter || 'Tutti i tipi'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-zinc-900 border-zinc-800">
                <DropdownMenuItem onClick={() => setTypeFilter(undefined)}>
                  Tutti
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTypeFilter('photo')}>
                  Foto
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTypeFilter('text')}>
                  Testo
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTypeFilter('audio_recording')}>
                  Audio
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTypeFilter('file')}>
                  File
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Button className="bg-blue-600 hover:bg-blue-700">
            <Plus className="mr-2 h-4 w-4" />
            Nuovo Memo
          </Button>
        </div>

        {/* Table */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-zinc-800/50">
                <TableHead className="text-zinc-400">Nome</TableHead>
                <TableHead className="text-zinc-400">Tipo</TableHead>
                <TableHead className="text-zinc-400">Data</TableHead>
                <TableHead className="text-zinc-400">Dimensione</TableHead>
                <TableHead className="text-zinc-400 text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-zinc-400">
                    Caricamento...
                  </TableCell>
                </TableRow>
              ) : memos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-zinc-400">
                    Nessun memo trovato
                  </TableCell>
                </TableRow>
              ) : (
                memos.map((memo) => (
                  <TableRow
                    key={memo.id}
                    className="border-zinc-800 hover:bg-zinc-800/50"
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
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-zinc-400 hover:text-red-400"
                        onClick={() => deleteMutation.mutate(memo.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
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
    </div>
  );
}
