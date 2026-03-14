'use client';

import { useState, useMemo, Fragment, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LayoutGrid, Trash2, FileText, Image as ImageIcon, Mic, Film, File as FileIcon, Paperclip, X, Check, CheckCheck, Tag as TagIcon } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { tilesApi, tagsApi, uploadApi } from '@/lib/api';
import { useTileNotificationStore } from '@/store/tile-notification-store';
import { typeLabels } from '@/lib/spark-utils';
import { SparkViewer } from '@/components/spark/spark-viewer';
import type { Spark, SparkType, Tile, Tag } from '@/types';

const typeIcons: Record<SparkType, typeof FileText> = {
  photo: ImageIcon,
  image: ImageIcon,
  video: Film,
  audio_recording: Mic,
  text: FileText,
  file: FileIcon,
};

const typeIconColors: Record<SparkType, string> = {
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

// ─── Spark thumbnail (loads signed URL for images) ───
function SparkThumbnail({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    uploadApi.getSignedUrl(path).then((res) => {
      if (res.success && res.data) setUrl(res.data.url);
    }).catch(() => {});
  }, [path]);
  if (!url) return <div className="h-8 w-8 rounded bg-zinc-700 animate-pulse shrink-0" />;
  return (
    <img
      src={url}
      alt=""
      className="h-8 w-8 rounded object-cover shrink-0"
    />
  );
}

// ─── Spark chip (inline preview per spark) ───
function SparkChip({ spark }: { spark: { id: string; type: SparkType; content?: string; storage_path?: string; file_name?: string } }) {
  const t = spark.type;

  // Photo / Image → small thumbnail
  if (t === 'photo' || t === 'image') {
    const thumbPath = spark.storage_path;
    if (thumbPath) return <SparkThumbnail path={thumbPath} />;
    return (
      <div className="h-8 w-8 rounded bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0">
        <ImageIcon className="h-3.5 w-3.5 text-blue-400" />
      </div>
    );
  }

  // Video → icon
  if (t === 'video') {
    return (
      <div className="h-8 w-8 rounded bg-orange-500/15 border border-orange-500/30 flex items-center justify-center shrink-0">
        <Film className="h-3.5 w-3.5 text-orange-400" />
      </div>
    );
  }

  // Audio → icon
  if (t === 'audio_recording') {
    return (
      <div className="h-8 w-8 rounded bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0">
        <Mic className="h-3.5 w-3.5 text-red-400" />
      </div>
    );
  }

  // Text → excerpt
  if (t === 'text' && spark.content) {
    return (
      <div className="px-2 py-1 rounded bg-purple-500/10 border border-purple-500/20 shrink-0 max-w-[200px]">
        <p className="text-[11px] text-purple-300/80 line-clamp-2 leading-tight">
          {spark.content}
        </p>
      </div>
    );
  }

  // File → attachment icon + name
  if (t === 'file') {
    return (
      <div className="flex items-center gap-1 px-2 py-1 rounded bg-yellow-500/10 border border-yellow-500/20 shrink-0 max-w-[160px]">
        <Paperclip className="h-3 w-3 text-yellow-400 shrink-0" />
        <span className="text-[11px] text-yellow-300/80 truncate">
          {spark.file_name || 'file'}
        </span>
      </div>
    );
  }

  // Fallback
  return (
    <div className="h-8 w-8 rounded bg-zinc-700/50 border border-zinc-600 flex items-center justify-center shrink-0">
      <FileText className="h-3.5 w-3.5 text-zinc-400" />
    </div>
  );
}

// ─── Resizable column header ───
function ResizableHead({
  children,
  width,
  onResize,
  className,
}: {
  children?: React.ReactNode;
  width: number;
  onResize: (w: number) => void;
  className?: string;
}) {
  const startX = useRef(0);
  const startW = useRef(0);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      startX.current = e.clientX;
      startW.current = width;

      const onMouseMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startX.current;
        onResize(Math.max(40, startW.current + delta));
      };
      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [width, onResize]
  );

  return (
    <TableHead className={cn('relative', className)} style={{ width, minWidth: width, maxWidth: width }}>
      <span className="truncate">{children}</span>
      <div
        onMouseDown={onMouseDown}
        className="absolute top-0 bottom-0 cursor-col-resize hover:bg-blue-500/40 transition-colors z-10"
        style={{ right: -2, width: 5 }}
      />
    </TableHead>
  );
}

function TileRow({
  tile,
  selected,
  selectedIds,
  allTags,
  colWidths,
  onSelect,
  onSparkClick,
}: {
  tile: Tile;
  selected: boolean;
  selectedIds: Set<string>;
  allTags: Tag[];
  colWidths: { title: number; sparks: number; tags: number };
  onSelect: (id: string, checked: boolean) => void;
  onSparkClick: (spark: Spark) => void;
}) {
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const queryClient = useQueryClient();
  const markRead = useTileNotificationStore((s) => s.markRead);
  const lastSeen = useTileNotificationStore((s) => s.lastSeen);
  const readIds = useTileNotificationStore((s) => s.readIds);
  const isUnread = new Date(tile.created_at) > new Date(lastSeen) && !readIds.includes(tile.id);

  const deleteMutation = useMutation({
    mutationFn: tilesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tiles'] });
      toast.success('Tile eliminato');
    },
    onError: () => toast.error("Errore durante l'eliminazione"),
  });

  return (
    <Fragment>
      <TableRow
        className="border-zinc-800 cursor-pointer h-12"
        style={{ height: 48, maxHeight: 48 }}
        onClick={() => {
          if (selectedIds.size > 0) {
            onSelect(tile.id, !selected);
          } else {
            if (isUnread) markRead(tile.id);
          }
        }}
      >
        <TableCell className="border-r border-zinc-800" style={{ width: 40, minWidth: 40, maxWidth: 40 }}>
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
        <TableCell className={cn('text-xs border-r border-zinc-800 truncate', isUnread ? 'text-red-400' : 'text-white')} style={{ width: colWidths.title, minWidth: colWidths.title, maxWidth: colWidths.title }}>
          {tile.title || `Tile ${tile.id.slice(0, 8)}`}
        </TableCell>
        <TableCell className="border-r border-zinc-800 overflow-hidden py-1" style={{ width: colWidths.sparks, minWidth: colWidths.sparks, maxWidth: colWidths.sparks }}>
          {tile.sparks && tile.sparks.length > 0 ? (
            <div className="flex gap-1.5 items-center overflow-hidden">
              {tile.sparks.map((spark) => (
                <button
                  key={spark.id}
                  className="hover:opacity-80 hover:scale-105 transition-all"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSparkClick(spark as Spark);
                  }}
                >
                  <SparkChip spark={spark} />
                </button>
              ))}
            </div>
          ) : (
            <span className="text-zinc-600 text-sm">—</span>
          )}
        </TableCell>
        <TableCell className="border-r border-zinc-800 overflow-hidden py-1" style={{ width: colWidths.tags, minWidth: colWidths.tags, maxWidth: colWidths.tags }}>
          {tile.tags && tile.tags.length > 0 ? (
            <div className="flex gap-1 overflow-hidden">
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
        <TableCell className="border-r border-zinc-800" style={{ width: 40, minWidth: 40, maxWidth: 40 }}>
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
        <TableCell className="text-zinc-400 text-xs border-r border-zinc-800" style={{ width: 80, minWidth: 80, maxWidth: 80 }}>
          {new Date(tile.created_at).toLocaleDateString('it-IT')}
        </TableCell>
        <TableCell className="text-right border-r border-zinc-800" style={{ width: 56, minWidth: 56, maxWidth: 56 }}>
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
    </Fragment>
  );
}

export default function TilesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [selectedMemo, setSelectedMemo] = useState<Spark | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { tileIds: aiFilterIds, clearFilter } = useFilterStore();

  // Column widths (resizable)
  const [colWidths, setColWidths] = useState({
    title: 260,
    sparks: 380,
    tags: 160,
  });
  const setColWidth = useCallback(
    (col: keyof typeof colWidths, w: number) =>
      setColWidths((prev) => ({ ...prev, [col]: w })),
    []
  );

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
      <Header
        title="Tiles"
        actions={selectedIds.size > 0 ? (
          <div className="flex items-center gap-2">
            <Badge className="bg-blue-500/20 text-blue-400">
              {selectedIds.size} selezionat{selectedIds.size === 1 ? 'o' : 'i'}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                const ids = Array.from(selectedIds);
                const results = await Promise.all(ids.map((id) => tilesApi.delete(id)));
                const failed = results.filter((r) => !r.success).length;
                const succeeded = ids.length - failed;
                if (succeeded > 0) {
                  queryClient.invalidateQueries({ queryKey: ['tiles'] });
                  setSelectedIds(new Set());
                  toast.success(`${succeeded} tile eliminat${succeeded === 1 ? 'o' : 'i'}`);
                }
                if (failed > 0) {
                  toast.error(`${failed} tile non eliminat${failed === 1 ? 'o' : 'i'}`);
                }
              }}
              className="text-red-400 hover:text-red-300 hover:bg-red-950/50 h-8 px-3"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Elimina ({selectedIds.size})
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const { markRead } = useTileNotificationStore.getState();
                selectedIds.forEach((id) => markRead(id));
                setSelectedIds(new Set());
                toast.success(`${selectedIds.size} tile segnat${selectedIds.size === 1 ? 'o' : 'i'} come lett${selectedIds.size === 1 ? 'o' : 'i'}`);
              }}
              className="text-blue-400 hover:text-blue-300 hover:bg-blue-950/50 h-8 px-3"
            >
              <CheckCheck className="h-4 w-4 mr-1.5" />
              Segna come letti
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
              className="text-zinc-400 hover:text-zinc-300 h-8 px-2"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : undefined}
      />

      <div className="flex-1 p-6 flex flex-col gap-4 overflow-hidden">
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

        {/* Header info */}
        <div className="flex items-center gap-2 text-zinc-400">
          <LayoutGrid className="h-5 w-5" />
          <span className="text-sm">
            {pagination?.total || 0} tiles totali
          </span>
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
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-auto">
              <Table style={{ tableLayout: 'fixed', width: colWidths.title + colWidths.sparks + colWidths.tags + 40 + 40 + 80 + 56, minWidth: colWidths.title + colWidths.sparks + colWidths.tags + 40 + 40 + 80 + 56 }}>
                <TableHeader className="sticky top-0 z-10 bg-zinc-900">
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="border-r border-zinc-800" style={{ width: 40, minWidth: 40, maxWidth: 40 }}>
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
                    <ResizableHead width={colWidths.title} onResize={(w) => setColWidth('title', w)} className="text-zinc-400 border-r border-zinc-800">Titolo</ResizableHead>
                    <ResizableHead width={colWidths.sparks} onResize={(w) => setColWidth('sparks', w)} className="text-zinc-400 text-left border-r border-zinc-800">Sparks</ResizableHead>
                    <ResizableHead width={colWidths.tags} onResize={(w) => setColWidth('tags', w)} className="text-zinc-400 text-left border-r border-zinc-800">Tags</ResizableHead>
                    <TableHead className="text-zinc-400 border-r border-zinc-800" style={{ width: 40, minWidth: 40, maxWidth: 40 }} />
                    <TableHead className="text-zinc-400 border-r border-zinc-800" style={{ width: 80, minWidth: 80, maxWidth: 80 }}>Data</TableHead>
                    <TableHead className="text-zinc-400 text-right border-r border-zinc-800" style={{ width: 56, minWidth: 56, maxWidth: 56 }} />
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
                      colWidths={colWidths}
                      onSelect={handleSelect}
                      onSparkClick={setSelectedMemo}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
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

      <SparkViewer
        spark={selectedMemo}
        open={selectedMemo !== null}
        onOpenChange={(open) => { if (!open) setSelectedMemo(null); }}
      />
    </div>
  );
}
