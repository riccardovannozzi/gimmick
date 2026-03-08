'use client';

import { useState, useMemo, Fragment, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LayoutGrid, Trash2, ChevronDown, ChevronRight, FileText, Image, Mic, Film, File, X, Check, Tag as TagIcon } from 'lucide-react';
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
import { tilesApi, tagsApi } from '@/lib/api';
import { typeLabels } from '@/lib/memo-utils';
import { MemoViewer } from '@/components/memo/memo-viewer';
import type { Memo, MemoType, Tile, Tag } from '@/types';

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

function TagDropdown({
  tileIds,
  tileTags,
  allTags,
  open,
  onClose,
}: {
  tileIds: string[];
  tileTags: { id: string; name: string; color?: string }[];
  allTags: Tag[];
  open: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const tagMutation = useMutation({
    mutationFn: async ({ tagId, action }: { tagId: string; action: 'add' | 'remove' }) => {
      if (action === 'add') {
        return tagsApi.tagTiles(tagId, tileIds);
      } else {
        await Promise.all(tileIds.map((id) => tagsApi.untagTile(tagId, id)));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tiles'] });
    },
    onError: () => toast.error('Errore aggiornamento tag'),
  });

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, onClose]);

  if (!open) return null;

  const tileTagIds = new Set(tileTags.map((t) => t.id));
  const isBulk = tileIds.length > 1;

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-1 z-50 w-48 rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl py-1"
    >
      {isBulk && (
        <p className="text-xs text-blue-400 px-3 py-1.5 border-b border-zinc-800">
          {tileIds.length} tile selezionati
        </p>
      )}
      {allTags.length === 0 ? (
        <p className="text-xs text-zinc-500 px-3 py-2">Nessun tag disponibile</p>
      ) : (
        allTags.map((tag) => {
          const isAssigned = tileTagIds.has(tag.id);
          return (
            <button
              key={tag.id}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-left text-sm hover:bg-zinc-800 transition-colors"
              onClick={() =>
                tagMutation.mutate({ tagId: tag.id, action: isAssigned ? 'remove' : 'add' })
              }
            >
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: tag.color || '#3B82F6' }}
              />
              <span className="text-zinc-300 flex-1 truncate">{tag.name}</span>
              {isAssigned && <Check className="h-3.5 w-3.5 text-blue-400 shrink-0" />}
            </button>
          );
        })
      )}
    </div>
  );
}

function TileRow({
  tile,
  selected,
  selectedIds,
  allTags,
  onSelect,
  onMemoClick,
}: {
  tile: Tile;
  selected: boolean;
  selectedIds: Set<string>;
  allTags: Tag[];
  onSelect: (id: string, checked: boolean) => void;
  onMemoClick: (memo: Memo) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
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
    onError: () => toast.error("Errore durante l'eliminazione"),
  });

  const memos = tileDetail?.data?.memos || [];

  return (
    <Fragment>
      <TableRow className="border-zinc-800 cursor-pointer" onClick={() => {
        if (selectedIds.size > 0) {
          onSelect(tile.id, !selected);
        } else {
          setExpanded(!expanded);
        }
      }}>
        <TableCell className="w-10">
          <button
            onClick={(e) => { e.stopPropagation(); onSelect(tile.id, !selected); }}
            className={`h-4 w-4 rounded flex items-center justify-center border transition-colors ${
              selected
                ? 'bg-blue-500 border-blue-500'
                : 'bg-transparent border-zinc-300'
            }`}
          >
            {selected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
          </button>
        </TableCell>
        <TableCell className="w-8">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-zinc-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-zinc-400" />
          )}
        </TableCell>
        <TableCell className="text-white font-medium">
          {tile.title || `Tile ${tile.id.slice(0, 8)}`}
        </TableCell>
        <TableCell>
          {tile.tags && tile.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {tile.tags.map((tag) => (
                <Badge
                  key={tag.id}
                  className="text-xs px-1.5 py-0"
                  style={{
                    backgroundColor: tag.color ? `${tag.color}20` : undefined,
                    color: tag.color || undefined,
                    borderColor: tag.color ? `${tag.color}40` : undefined,
                  }}
                >
                  {tag.name}
                </Badge>
              ))}
            </div>
          ) : (
            <span className="text-zinc-600 text-sm">—</span>
          )}
        </TableCell>
        <TableCell className="w-10">
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-zinc-500 hover:text-blue-400"
              onClick={(e) => {
                e.stopPropagation();
                setTagDropdownOpen(!tagDropdownOpen);
              }}
            >
              <TagIcon className="h-3.5 w-3.5" />
            </Button>
            <TagDropdown
              tileIds={selected && selectedIds.size > 1 ? Array.from(selectedIds) : [tile.id]}
              tileTags={tile.tags || []}
              allTags={allTags}
              open={tagDropdownOpen}
              onClose={() => setTagDropdownOpen(false)}
            />
          </div>
        </TableCell>
        <TableCell className="text-zinc-400">{tile.memo_count || 0}</TableCell>
        <TableCell className="text-zinc-400 text-sm">
          {new Date(tile.created_at).toLocaleDateString('it-IT')}
        </TableCell>
        <TableCell className="text-right">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-zinc-500 hover:text-red-400"
            onClick={(e) => {
              e.stopPropagation();
              deleteMutation.mutate(tile.id);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </TableCell>
      </TableRow>

      {expanded && (
        <TableRow className="border-zinc-800 hover:bg-transparent">
          <TableCell colSpan={8} className="p-0">
            <div className="bg-zinc-800/30 px-6 py-3 space-y-1.5">
              {memos.length === 0 ? (
                <p className="text-sm text-zinc-500 py-2">Caricamento...</p>
              ) : (
                memos.map((memo) => {
                  const Icon = typeIcons[memo.type] || FileText;
                  const color = typeIconColors[memo.type] || 'text-zinc-400';
                  return (
                    <button
                      key={memo.id}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-700/50 transition-colors w-full text-left"
                      onClick={() => onMemoClick(memo)}
                    >
                      <Icon className={`h-4 w-4 ${color}`} />
                      <span className="text-sm text-white flex-1 truncate">
                        {memo.file_name || memo.content?.substring(0, 50) || memo.type}
                      </span>
                      <Badge className="text-xs bg-zinc-700 text-zinc-300">
                        {typeLabels[memo.type]}
                      </Badge>
                    </button>
                  );
                })
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </Fragment>
  );
}

export default function TilesPage() {
  const [page, setPage] = useState(1);
  const [selectedMemo, setSelectedMemo] = useState<Memo | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { tileIds: aiFilterIds, clearFilter } = useFilterStore();

  const { data, isLoading } = useQuery({
    queryKey: ['tiles', { page }],
    queryFn: () => tilesApi.list({ page, limit: 50 }),
  });

  const { data: tagsResult } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagsApi.list(),
  });

  const allTags = tagsResult?.data || [];
  const allTiles = data?.data || [];
  const pagination = data?.pagination;

  const tiles = useMemo(() => {
    if (!aiFilterIds) return allTiles;
    const idSet = new Set(aiFilterIds);
    return allTiles.filter((t) => idSet.has(t.id));
  }, [allTiles, aiFilterIds]);

  const allSelected = tiles.length > 0 && tiles.every((t) => selectedIds.has(t.id));
  const someSelected = tiles.some((t) => selectedIds.has(t.id));

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(tiles.map((t) => t.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="Tiles" />

      <div className="flex-1 p-6 space-y-4">
        {/* AI Filter Banner */}
        {aiFilterIds && (
          <div className="flex items-center justify-between rounded-lg border border-purple-500/30 bg-purple-500/10 px-4 py-2.5">
            <p className="text-sm text-purple-400">
              Filtro AI attivo — {tiles.length} tile trovati
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilter}
              className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/20 h-7 px-2"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Rimuovi filtro
            </Button>
          </div>
        )}

        {/* Header info + selection actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-zinc-400">
            <LayoutGrid className="h-5 w-5" />
            <span className="text-sm">
              {pagination?.total || 0} tiles totali
            </span>
            {selectedIds.size > 0 && (
              <Badge className="ml-2 bg-blue-500/20 text-blue-400">
                {selectedIds.size} selezionati
              </Badge>
            )}
          </div>
          {selectedIds.size > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
              className="text-zinc-400 hover:text-zinc-300 h-7 px-2"
            >
              Deseleziona tutto
            </Button>
          )}
        </div>

        {/* Tiles table */}
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
          <div className="rounded-lg border border-zinc-800 bg-zinc-900">
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="w-10">
                    <button
                      onClick={() => handleSelectAll(!allSelected)}
                      className={`h-4 w-4 rounded flex items-center justify-center border transition-colors ${
                        allSelected
                          ? 'bg-blue-500 border-blue-500'
                          : someSelected
                            ? 'bg-blue-500/50 border-blue-500'
                            : 'bg-transparent border-zinc-300'
                      }`}
                    >
                      {(allSelected || someSelected) && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                    </button>
                  </TableHead>
                  <TableHead className="text-zinc-400 w-8" />
                  <TableHead className="text-zinc-400">Titolo</TableHead>
                  <TableHead className="text-zinc-400">Tags</TableHead>
                  <TableHead className="text-zinc-400 w-10" />
                  <TableHead className="text-zinc-400 w-20">Memo</TableHead>
                  <TableHead className="text-zinc-400 w-28">Data</TableHead>
                  <TableHead className="text-zinc-400 text-right w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {tiles.map((tile) => (
                  <TileRow
                    key={tile.id}
                    tile={tile}
                    selected={selectedIds.has(tile.id)}
                    selectedIds={selectedIds}
                    allTags={allTags}
                    onSelect={handleSelect}
                    onMemoClick={setSelectedMemo}
                  />
                ))}
              </TableBody>
            </Table>
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
