'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { IconLayoutSidebarRightCollapse, IconLayoutSidebarRightExpand, IconCamera, IconPhoto, IconVideo, IconMicrophone, IconEdit, IconPaperclip, IconFileText, IconFile, IconPlayerPlay, IconTrash, IconExternalLink } from '@tabler/icons-react';
import * as TablerIcons from '@tabler/icons-react';
import { toast } from 'sonner';
import { tilesApi, sparksApi, uploadApi, tagsApi } from '@/lib/api';
import type { Tag } from '@/types';
import { usePatterns } from '@/store/patterns-store';
import { cn } from '@/lib/utils';
import { useStatusIcons } from '@/store/status-icons-store';
import type { Tile, Spark } from '@/types';

function toLocalInput(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const SPARK_ICONS: Record<string, typeof IconFile> = {
  photo: IconCamera,
  image: IconPhoto,
  video: IconVideo,
  audio_recording: IconMicrophone,
  text: IconFileText,
  file: IconFile,
};

const AllIcons = TablerIcons as unknown as Record<string, React.ComponentType<{ size?: number; className?: string }>>;

function StatusIconPicker({ tileId }: { tileId: string }) {
  const { icons, tileIcons, assignIcon } = useStatusIcons();
  const [open, setOpen] = useState(false);
  const currentIconId = tileIcons[tileId] || '';
  const current = icons.find((i) => i.id === currentIconId);
  const CurrentComp = current?.icon ? AllIcons[current.icon] : null;

  if (icons.length === 0) return null;

  return (
    <div className="relative">
      <label className="text-[11px] text-zinc-500 mb-1 block">Status</label>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 bg-zinc-800/60 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-300 hover:border-zinc-600 transition-colors"
      >
        {CurrentComp ? (
          <>
            <CurrentComp size={14} className="text-zinc-200 shrink-0" />
            <span className="truncate flex-1 text-left">{current!.name}</span>
          </>
        ) : (
          <span className="text-zinc-500 flex-1 text-left">Nessuno</span>
        )}
        <svg className={cn('h-3 w-3 text-zinc-500 shrink-0 transition-transform', open && 'rotate-180')} viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 max-h-48 overflow-y-auto">
          <button
            onClick={() => { assignIcon(tileId, null); setOpen(false); }}
            className={cn(
              'flex items-center gap-2 w-full px-2.5 py-1.5 text-left text-xs hover:bg-zinc-700/50 transition-colors',
              !currentIconId && 'bg-zinc-700/30'
            )}
          >
            <span className="w-4 h-4 flex items-center justify-center text-zinc-500">—</span>
            <span className="text-zinc-400">Nessuno</span>
          </button>
          {icons.map((icon) => {
            const Comp = AllIcons[icon.icon];
            const selected = currentIconId === icon.id;
            return (
              <button
                key={icon.id}
                onClick={() => { assignIcon(tileId, icon.id); setOpen(false); }}
                className={cn(
                  'flex items-center gap-2 w-full px-2.5 py-1.5 text-left text-xs hover:bg-zinc-700/50 transition-colors',
                  selected && 'bg-zinc-700/30'
                )}
              >
                {Comp && <Comp size={14} className="text-zinc-200 shrink-0" />}
                <span className="text-zinc-300 truncate">{icon.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TagPicker({ tileId, tileTags, onChanged }: { tileId: string; tileTags: { id: string; name: string }[]; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  const { data: tagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagsApi.list(),
    staleTime: 60_000,
  });
  const allTags: Tag[] = (tagsData as { data?: Tag[] })?.data || [];
  const tileTagIds = new Set(tileTags.map((t) => t.id));

  const handleToggle = async (tag: Tag) => {
    setToggling(tag.id);
    const isAssigned = tileTagIds.has(tag.id);
    try {
      if (isAssigned) {
        await tagsApi.untagTile(tag.id, tileId);
      } else {
        await tagsApi.tagTiles(tag.id, [tileId]);
      }
      onChanged();
    } catch (err) {
      console.error('Tag toggle failed:', err);
    } finally {
      setToggling(null);
    }
  };

  return (
    <div className="relative">
      <label className="text-[11px] text-zinc-500 mb-1 block">Tags</label>
      <div
        className="flex flex-wrap gap-1 min-h-[28px] bg-zinc-800/60 border border-zinc-700 rounded px-1.5 py-1 cursor-pointer hover:border-zinc-600 transition-colors"
        onClick={() => setOpen(!open)}
      >
        {tileTags.length > 0 ? (
          tileTags.map((tag) => (
            <span key={tag.id} className="text-[10px] bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded">{tag.name}</span>
          ))
        ) : (
          <span className="text-[10px] text-zinc-500">Seleziona tag...</span>
        )}
      </div>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl max-h-64 overflow-y-auto py-1">
          {allTags.length === 0 ? (
            <p className="text-xs text-zinc-500 text-center py-3">Nessun tag</p>
          ) : (
            allTags.map((tag) => {
              const assigned = tileTagIds.has(tag.id);
              const busy = toggling === tag.id;
              return (
                <button
                  key={tag.id}
                  disabled={busy}
                  onClick={() => handleToggle(tag)}
                  className={cn(
                    'flex items-center gap-2 w-full px-2.5 py-1.5 text-left text-xs hover:bg-zinc-700/50 transition-colors',
                    assigned && 'bg-zinc-700/30',
                    busy && 'opacity-50'
                  )}
                >
                  <div className={cn(
                    'w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0',
                    assigned ? 'bg-blue-600 border-blue-500' : 'border-zinc-600'
                  )}>
                    {assigned && <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <span className={cn('truncate', assigned ? 'text-zinc-200' : 'text-zinc-400')}>{tag.name}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function SparkEditor({
  spark,
  onDelete,
  onUpdateText,
}: {
  spark: Spark;
  onDelete: () => void;
  onUpdateText: (content: string) => void;
}) {
  const SparkIcon = SPARK_ICONS[spark.type] || IconFile;
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [editText, setEditText] = useState(spark.content || '');
  const textDirty = useRef(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (spark.storage_path && ['photo', 'image', 'video'].includes(spark.type)) {
      uploadApi.getSignedUrl(spark.storage_path).then((res) => {
        if (res.data?.url) setSignedUrl(res.data.url);
      }).catch(() => {});
    }
  }, [spark.storage_path, spark.type]);

  const handleDeleteClick = () => {
    if (confirmDelete) { onDelete(); setConfirmDelete(false); }
    else setConfirmDelete(true);
  };

  if (spark.type === 'text') {
    return (
      <div className="rounded border border-zinc-700 bg-zinc-800/40 px-2.5 py-2 group relative">
        <div className="flex items-center gap-1 mb-1">
          <IconFileText className="h-3 w-3 text-zinc-500" />
          <span className="text-[10px] text-zinc-500 uppercase">Testo</span>
        </div>
        <textarea
          value={editText}
          onChange={(e) => {
            setEditText(e.target.value);
            textDirty.current = true;
            e.target.style.height = 'auto';
            e.target.style.height = e.target.scrollHeight + 'px';
          }}
          onBlur={() => { if (textDirty.current) { onUpdateText(editText); textDirty.current = false; } }}
          ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
          className="w-full bg-transparent text-xs text-zinc-300 leading-relaxed resize-none focus:outline-none overflow-hidden"
        />
        <button
          onClick={handleDeleteClick}
          className={cn(
            'absolute top-1 right-1 p-0.5 rounded transition-all',
            confirmDelete ? 'bg-red-600 text-white' : 'text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100'
          )}
          title={confirmDelete ? 'Conferma eliminazione' : 'Elimina'}
        >
          <IconTrash className="h-3 w-3" />
        </button>
      </div>
    );
  }

  if ((spark.type === 'photo' || spark.type === 'image') && signedUrl) {
    return (
      <div className="rounded border border-zinc-700 overflow-hidden bg-zinc-800/40 group relative">
        <img src={signedUrl} alt="" className="w-full h-32 object-cover" />
        <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="p-1 bg-zinc-900/80 rounded text-zinc-300 hover:text-white">
            <IconExternalLink className="h-3 w-3" />
          </a>
          <button
            onClick={handleDeleteClick}
            className={cn('p-1 rounded', confirmDelete ? 'bg-red-600 text-white' : 'bg-zinc-900/80 text-zinc-300 hover:text-red-400')}
          >
            <IconTrash className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  }

  if (spark.type === 'video' && signedUrl) {
    return (
      <div className="rounded border border-zinc-700 overflow-hidden bg-zinc-800/40 group relative">
        <video src={signedUrl} className="w-full h-32 object-cover" />
        <div className="absolute inset-0 flex items-center justify-center">
          <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="p-2 bg-zinc-900/70 rounded-full text-white hover:bg-zinc-900/90">
            <IconPlayerPlay className="h-5 w-5" />
          </a>
        </div>
        <button
          onClick={handleDeleteClick}
          className={cn(
            'absolute top-1 right-1 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity',
            confirmDelete ? 'bg-red-600 text-white' : 'bg-zinc-900/80 text-zinc-300 hover:text-red-400'
          )}
        >
          <IconTrash className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="rounded border border-zinc-700 bg-zinc-800/40 px-2.5 py-2 flex items-center gap-2 group relative">
      <SparkIcon className="h-4 w-4 text-zinc-400 shrink-0" />
      <span className="text-xs text-zinc-400 truncate flex-1">{spark.file_name || spark.type}</span>
      {signedUrl && (
        <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-zinc-300 opacity-0 group-hover:opacity-100">
          <IconExternalLink className="h-3 w-3" />
        </a>
      )}
      <button
        onClick={handleDeleteClick}
        className={cn(
          'p-0.5 rounded transition-all',
          confirmDelete ? 'bg-red-600 text-white' : 'text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100'
        )}
      >
        <IconTrash className="h-3 w-3" />
      </button>
    </div>
  );
}

export function TileSidebar({
  tileId,
  open,
  onToggle,
  invalidateKeys = ['tiles-calendar'],
}: {
  tileId: string | null;
  open: boolean;
  onToggle: () => void;
  invalidateKeys?: string[];
}) {
  const queryClient = useQueryClient();
  const { customPatterns } = usePatterns();
  const { data, isLoading } = useQuery({
    queryKey: ['tile-detail', tileId],
    queryFn: () => tilesApi.get(tileId!),
    enabled: !!tileId,
    staleTime: 30_000,
  });

  const tile = data?.data;
  const sparks: Spark[] = (tile as Tile & { sparks?: Spark[] })?.sparks || [];

  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const titleDirty = useRef(false);
  const descDirty = useRef(false);

  useEffect(() => {
    if (tile) {
      setEditTitle(tile.title || '');
      setEditDesc(tile.description || '');
      titleDirty.current = false;
      descDirty.current = false;
    }
  }, [tile?.id, tile?.title, tile?.description]);

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['tile-detail', tileId] });
    invalidateKeys.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
  }, [queryClient, tileId, invalidateKeys]);

  const updateTileMutation = useMutation({
    mutationFn: (updates: Record<string, unknown>) =>
      tilesApi.update(tileId!, updates as Parameters<typeof tilesApi.update>[1]),
    onSuccess: invalidateAll,
  });

  const saveTitle = useCallback(() => {
    if (!titleDirty.current || !tileId) return;
    updateTileMutation.mutate({ title: editTitle.trim() });
    titleDirty.current = false;
  }, [editTitle, tileId, updateTileMutation]);

  const saveDesc = useCallback(() => {
    if (!descDirty.current || !tileId) return;
    updateTileMutation.mutate({ description: editDesc.trim() });
    descDirty.current = false;
  }, [editDesc, tileId, updateTileMutation]);

  const updateSparkMutation = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      sparksApi.update(id, { content }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tile-detail', tileId] }),
  });

  const deleteSparkMutation = useMutation({
    mutationFn: (id: string) => sparksApi.delete(id),
    onSuccess: () => {
      invalidateAll();
      toast.success('Contenuto eliminato');
    },
    onError: () => toast.error('Errore eliminazione'),
  });

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || !tileId) return;
    for (const file of Array.from(files)) {
      const mime = file.type;
      let sparkType: string = 'file';
      let folder = 'files';
      if (mime.startsWith('image/')) { sparkType = 'photo'; folder = 'photos'; }
      else if (mime.startsWith('video/')) { sparkType = 'video'; folder = 'videos'; }
      else if (mime.startsWith('audio/')) { sparkType = 'audio_recording'; folder = 'audio'; }
      try {
        const uploadRes = await uploadApi.uploadFile(file, folder);
        if (!uploadRes.data) throw new Error('Upload failed');
        await sparksApi.create({
          tile_id: tileId,
          type: sparkType as Spark['type'],
          storage_path: uploadRes.data.path,
          file_name: uploadRes.data.file_name,
          mime_type: uploadRes.data.mime_type,
          file_size: uploadRes.data.file_size,
        });
        toast.success('File aggiunto');
      } catch {
        toast.error('Errore upload');
      }
    }
    invalidateAll();
  }, [tileId, invalidateAll]);

  const [showNewText, setShowNewText] = useState(false);
  const [newTextContent, setNewTextContent] = useState('');
  const addTextMutation = useMutation({
    mutationFn: () => sparksApi.create({ tile_id: tileId!, type: 'text', content: newTextContent.trim() }),
    onSuccess: () => {
      invalidateAll();
      setNewTextContent('');
      setShowNewText(false);
      toast.success('Testo aggiunto');
    },
  });

  return (
    <div className={cn(
      'border-l border-zinc-800 bg-zinc-900/50 transition-all duration-200 flex flex-col shrink-0',
      open ? 'w-60' : 'w-8'
    )}>
      <button
        onClick={onToggle}
        className="h-10 flex items-center justify-center hover:bg-zinc-800 transition-colors shrink-0"
      >
        {open
          ? <IconLayoutSidebarRightCollapse className="h-4 w-4 text-zinc-400" />
          : <IconLayoutSidebarRightExpand className="h-4 w-4 text-zinc-400" />
        }
      </button>

      {open && (<>
        <div className="flex-1 overflow-y-auto px-3 pb-4">
          {!tileId ? (
            <p className="text-xs text-zinc-500 mt-4">Seleziona un tile</p>
          ) : isLoading ? (
            <p className="text-xs text-zinc-500 mt-4">Caricamento...</p>
          ) : !tile ? (
            <p className="text-xs text-zinc-500 mt-4">Tile non trovato</p>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-zinc-500">Titolo</label>
                <input
                  value={editTitle}
                  onChange={(e) => { setEditTitle(e.target.value); titleDirty.current = true; }}
                  onBlur={saveTitle}
                  onKeyDown={(e) => e.key === 'Enter' && saveTitle()}
                  className="w-full bg-zinc-800/60 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500 mt-0.5"
                  placeholder="Titolo..."
                />
              </div>

              <div>
                <label className="text-[11px] text-zinc-500">Descrizione</label>
                <textarea
                  value={editDesc}
                  onChange={(e) => {
                    setEditDesc(e.target.value);
                    descDirty.current = true;
                    e.target.style.height = 'auto';
                    e.target.style.height = e.target.scrollHeight + 'px';
                  }}
                  onBlur={saveDesc}
                  ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                  className="w-full bg-zinc-800/60 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-blue-500 mt-0.5 resize-none overflow-hidden"
                  placeholder="Descrizione..."
                />
              </div>

              {/* Type selector */}
              <div>
                <label className="text-[11px] text-zinc-500 mb-1 block">Tipo</label>
                <div className="flex flex-wrap gap-1">
                  {([
                    { value: 'none', label: 'NOTES' },
                    { value: 'anytime', label: 'TO DO' },
                    { value: 'deadline', label: 'DEADLINE' },
                    { value: 'event', label: 'ALL DAY', extra: { all_day: true } },
                    { value: 'event', label: 'TIMED', extra: { all_day: false } },
                  ] as const).map((opt) => {
                    const isActive = opt.value === 'event'
                      ? tile.action_type === 'event' && (opt.extra.all_day ? !!tile.all_day : !tile.all_day)
                      : tile.action_type === opt.value;
                    return (
                      <button
                        key={opt.label}
                        onClick={() => {
                          const updates: Record<string, unknown> = { action_type: opt.value };
                          if (opt.value === 'event') {
                            updates.all_day = opt.extra.all_day;
                            updates.is_event = true;
                          } else {
                            updates.is_event = false;
                            updates.all_day = false;
                          }
                          updateTileMutation.mutate(updates);
                        }}
                        className={cn(
                          'px-2 py-1 rounded text-[10px] font-medium border transition-all',
                          isActive
                            ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                            : 'bg-zinc-800/60 border-zinc-700 text-zinc-500 hover:border-zinc-600'
                        )}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date/time fields — shown for deadline, all day, timed */}
              {(tile.action_type === 'deadline' || tile.action_type === 'event') && (() => {
                const dateRef = tile.action_type === 'deadline' ? tile.end_at : tile.start_at;
                const dateVal = dateRef ? toLocalInput(dateRef).slice(0, 10) : '';
                const startTime = tile.start_at ? toLocalInput(tile.start_at).slice(11, 16) : '';
                const endTime = tile.end_at ? toLocalInput(tile.end_at).slice(11, 16) : '';
                const isTimed = tile.action_type === 'event' && !tile.all_day;

                const updateDate = (newDate: string) => {
                  if (!newDate) return;
                  if (tile.action_type === 'deadline') {
                    updateTileMutation.mutate({ end_at: new Date(`${newDate}T${endTime || '23:59'}`).toISOString() });
                  } else if (isTimed) {
                    const updates: Record<string, string> = {
                      start_at: new Date(`${newDate}T${startTime || '09:00'}`).toISOString(),
                    };
                    if (endTime) updates.end_at = new Date(`${newDate}T${endTime}`).toISOString();
                    updateTileMutation.mutate(updates);
                  } else {
                    updateTileMutation.mutate({
                      start_at: new Date(`${newDate}T00:00:00`).toISOString(),
                      end_at: new Date(`${newDate}T23:59:59`).toISOString(),
                    });
                  }
                };

                return (
                  <div className="space-y-2">
                    {/* Date */}
                    <div>
                      <label className="text-[11px] text-zinc-500 mb-0.5 block">
                        {tile.action_type === 'deadline' ? 'Scadenza' : 'Data'}
                      </label>
                      <input
                        type="date"
                        value={dateVal}
                        onChange={(e) => updateDate(e.target.value)}
                        className="w-full bg-zinc-800/60 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    {/* Start/End time — only for timed */}
                    {isTimed && (
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="text-[11px] text-zinc-500 mb-0.5 block">Inizio</label>
                          <input
                            type="time"
                            value={startTime}
                            onChange={(e) => {
                              if (!e.target.value || !dateVal) return;
                              updateTileMutation.mutate({ start_at: new Date(`${dateVal}T${e.target.value}`).toISOString() });
                            }}
                            className="w-full bg-zinc-800/60 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-[11px] text-zinc-500 mb-0.5 block">Fine</label>
                          <input
                            type="time"
                            value={endTime}
                            onChange={(e) => {
                              if (!e.target.value || !dateVal) return;
                              updateTileMutation.mutate({ end_at: new Date(`${dateVal}T${e.target.value}`).toISOString() });
                            }}
                            className="w-full bg-zinc-800/60 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Tags */}
              <TagPicker tileId={tile.id} tileTags={tile.tags || []} onChanged={invalidateAll} />

              {/* Done */}
              <div className="flex gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={!!tile.is_completed} onChange={(e) => updateTileMutation.mutate({ is_completed: e.target.checked })} className="accent-green-500 w-3.5 h-3.5" />
                  <span className="text-[11px] text-zinc-400">Done</span>
                </label>
              </div>

              {/* Creato */}
              <div className="text-[11px] text-zinc-500">
                Creato: <span className="text-zinc-300">{new Date(tile.created_at).toLocaleDateString('it-IT')}</span>
              </div>

              {/* Status Icon */}
              <StatusIconPicker tileId={tile.id} />

              {customPatterns.length > 0 && (
                <div>
                  <label className="text-[11px] text-zinc-500 mb-1 block">Pattern</label>
                  <select
                    value={tile.pattern_id || ''}
                    onChange={(e) => updateTileMutation.mutate({ pattern_id: e.target.value || null })}
                    className="w-full bg-zinc-800/60 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Nessuno</option>
                    {customPatterns.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="border-t border-zinc-800" />

              <div>
                <div className="text-[11px] text-zinc-500 mb-2">Contenuti ({sparks.length})</div>
                <div className="space-y-2">
                  {sparks.map((spark) => (
                    <SparkEditor
                      key={spark.id}
                      spark={spark}
                      onDelete={() => deleteSparkMutation.mutate(spark.id)}
                      onUpdateText={(content) => updateSparkMutation.mutate({ id: spark.id, content })}
                    />
                  ))}
                </div>

                {showNewText && (
                  <div className="mt-2 space-y-1">
                    <textarea
                      value={newTextContent}
                      onChange={(e) => setNewTextContent(e.target.value)}
                      rows={3}
                      autoFocus
                      className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-blue-500 resize-y"
                      placeholder="Scrivi testo..."
                    />
                    <div className="flex gap-1">
                      <button onClick={() => newTextContent.trim() && addTextMutation.mutate()} disabled={!newTextContent.trim()} className="text-[11px] bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded disabled:opacity-40">Salva</button>
                      <button onClick={() => { setShowNewText(false); setNewTextContent(''); }} className="text-[11px] text-zinc-400 hover:text-zinc-300 px-2 py-1">Annulla</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {tileId && tile && (
          <div className="border-t border-zinc-800 px-2 py-2 shrink-0">
            <div className="flex gap-1 justify-center">
              {[
                { id: 'photo', icon: IconCamera, color: '#5B8DEF', bg: '#1A2540', accept: 'image/*' },
                { id: 'video', icon: IconVideo, color: '#E87DA0', bg: '#2D1A22', accept: 'video/*' },
                { id: 'gallery', icon: IconPhoto, color: '#AB9FF2', bg: '#241E35', accept: 'image/*' },
                { id: 'text', icon: IconEdit, color: '#6FCF97', bg: '#1A2D1E', accept: null },
                { id: 'voice', icon: IconMicrophone, color: '#EF4444', bg: '#2D1A1A', accept: 'audio/*' },
                { id: 'file', icon: IconPaperclip, color: '#F2C94C', bg: '#2D2A1A', accept: '*/*' },
              ].map((opt) => {
                const BtnIcon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    onClick={() => {
                      if (opt.id === 'text') {
                        setShowNewText(true);
                      } else {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.multiple = true;
                        input.accept = opt.accept || '*/*';
                        input.onchange = () => { handleFileSelect(input.files); };
                        input.click();
                      }
                    }}
                    className="w-8 h-8 rounded flex items-center justify-center transition-colors"
                    style={{ backgroundColor: opt.bg, borderWidth: 1, borderColor: `${opt.color}40` }}
                    title={opt.id}
                  >
                    <BtnIcon style={{ color: opt.color }} className="h-3.5 w-3.5" />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </>)}
    </div>
  );
}
