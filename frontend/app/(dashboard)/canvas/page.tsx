'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { IconComponents, IconTrash, IconCopy, IconBoxMultiple, IconInbox, IconClipboard, IconPencil } from '@tabler/icons-react';
import { usePixelTheme } from '@/components/pixel';
import { Modal } from '@/components/primitives/overlays';
import { tagsApi, canvasApi, tilesApi, uploadApi } from '@/lib/api';
import { CanvasTopbar } from '@/components/canvas/CanvasTopbar';
import { CanvasBoard, type CanvasEdge, type CanvasGroup, type CanvasTextBox } from '@/components/canvas/CanvasBoard';
import { StagingPanel, STAGING_MIN_W } from '@/components/canvas/StagingPanel';
import { GroupSidebar } from '@/components/canvas/GroupSidebar';
import { TextSidebar } from '@/components/canvas/TextSidebar';
import { EdgeSidebar } from '@/components/canvas/EdgeSidebar';
import { TileSidebar } from '@/components/tileview/TileSidebar';
import { MultiTileSidebar } from '@/components/tileview/MultiTileSidebar';
import { useTypeIcons } from '@/store/type-icons-store';
import { useIsomorphicLayoutEffect } from '@/lib/use-isomorphic-layout-effect';
import type { Tag, Tile } from '@/types';
import { OB_WEIGHT, OB_TEXT } from '@/lib/theme/ob-typography';

export default function CanvasPage() {
  const theme = usePixelTheme();
  // Migrazione Obsidian (Fase 8): dentro lo shell la pagina vive nel
  // ViewContainer → niente <Header/> di pagina (lo shell ne ha già uno) e il
  // root cresce nel body flex. Il restyle dei token D3 interni è rimandato.
  const searchParams = useSearchParams();
  const router = useRouter();
  const tagId = searchParams.get('tag');
  // Deep-link: `?tile=` mette a fuoco un tile specifico. Consumato una volta e
  // tolto dall'URL, per non sporcare la cronologia.
  const tileParam = searchParams.get('tile');
  const queryClient = useQueryClient();

  const [textMode, setTextMode] = useState(false);
  const [tileMode, setTileMode] = useState(false);
  // Appunti canvas (copia/incolla). Copiando un elemento (tile/testo/immagine)
  // si memorizza qui; l'incolla avviene SOLO col tasto destro sul punto target
  // (menu "Incolla"), non più col click sinistro.
  const [clipboard, setClipboard] = useState<{ kind: 'tile' | 'text' | 'image'; id: string } | null>(null);
  // Menu contestuale "Incolla" sullo sfondo del canvas (posizione + coord locali).
  const [pasteMenu, setPasteMenu] = useState<{ x: number; y: number; localX: number; localY: number } | null>(null);
  const [imageMode, setImageMode] = useState(false);
  // Modalità "Seleziona a contorno": il drag sullo sfondo disegna un rettangolo
  // di selezione (sinistra→destra = tile contenuti; destra→sinistra = intersecati).
  const [selectMode, setSelectMode] = useState(false);
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  // Box (testo/immagine) selezionato con click singolo → contorno obsidian.
  const [selectedTextBoxId, setSelectedTextBoxId] = useState<string | null>(null);
  // Edge selezionato con click singolo → EdgeSidebar (proprietà del collegamento).
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [fitTrigger, setFitTrigger] = useState(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch tag — same queryKey as the Chrono page so they share the cache.
  // Tags change rarely; 5 min staleTime makes Chrono↔Canvas navigation skip
  // the network round-trip entirely.
  const { data: tagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagsApi.list(),
    staleTime: 5 * 60 * 1000,
  });
  const tags: Tag[] = tagsData?.data || [];
  const tag = tagId ? tags.find((t) => t.id === tagId) || null : null;

  // Persist last opened tag to localStorage
  useEffect(() => {
    if (tagId) {
      try { localStorage.setItem('canvas_last_tag', tagId); } catch { /* */ }
    }
  }, [tagId]);

  // Auto-redirect to last used tag if mounted without ?tag= query
  useEffect(() => {
    if (tagId) return;
    if (tileParam) return; // tile-deep-link effect will pick the tag
    if (tags.length === 0) return; // wait for tags to load
    try {
      const last = localStorage.getItem('canvas_last_tag');
      if (last && tags.some((t) => t.id === last)) {
        router.replace(`/canvas?tag=${last}`);
      }
    } catch { /* */ }
  }, [tagId, tileParam, tags, router]);

  // Deep-link resolver — if we arrived with ?tile= but no ?tag=, fetch the
  // tile to discover a tag to open the canvas under, then redirect preserving
  // ?tile= and ?flow= so the secondary effect below picks them up.
  //
  // Tag choice priority:
  //   1) the LAST visited canvas tag (localStorage) — keeps context when the
  //      user clicks "Apri tile" from the Flow modal on the current canvas
  //   2) the first non-root tag returned by the API
  useEffect(() => {
    if (!tileParam) return;
    if (tagId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await tilesApi.get(tileParam);
        if (cancelled) return;
        const tileTags = res.data?.tags ?? [];
        const nonRoot = tileTags.filter((t) => !t.is_root && t.name !== 'GIMMICK');
        let lastTag: string | null = null;
        try { lastTag = localStorage.getItem('canvas_last_tag'); } catch { /* */ }
        const preferred = lastTag ? nonRoot.find((t) => t.id === lastTag) : undefined;
        const candidate = preferred ?? nonRoot[0] ?? tileTags[0];
        if (candidate) {
          router.replace(`/canvas?tag=${candidate.id}&tile=${tileParam}`);
        } else {
          // Tile has no tag besides GIMMICK root — nothing to anchor canvas on.
          router.replace('/tiles');
        }
      } catch {
        router.replace('/tiles');
      }
    })();
    return () => { cancelled = true; };
  }, [tileParam, tagId, router]);

  // Fetch tiles for tag
  const { data: tilesData } = useQuery({
    queryKey: ['canvas-tiles', tagId],
    queryFn: () => tagsApi.getTiles(tagId!),
    enabled: !!tagId,
    staleTime: 60 * 1000,
  });
  const allTagTiles: Tile[] = useMemo(() => tilesData?.data || [], [tilesData]);
  // Set of tile ids that own at least one Flow node — drives the FLOW badge.
  // Associazioni tile→type-icon: servono per copiare il TIPO in fase di incolla.
  const typeTileIcons = useTypeIcons((s) => s.tileIcons);
  const assignTypeIcon = useTypeIcons((s) => s.assignIcon);

  // Applica il deep-link: quando il tag è risolto E il tile esiste fra quelli
  // caricati, lo seleziona e apre la sidebar sul suo tab predefinito.
  useEffect(() => {
    if (!tileParam) return;
    if (!tagId) return;
    if (allTagTiles.length === 0) return;
    const t = allTagTiles.find((tile) => tile.id === tileParam);
    if (!t) return;
    setSelectedTileId(tileParam);
    setSidebarOpen(true);
    router.replace(`/canvas?tag=${tagId}`);
  }, [tileParam, tagId, allTagTiles, router]);

  // Fetch layout
  const { data: layoutData } = useQuery({
    queryKey: ['canvas-layout', tagId],
    queryFn: () => canvasApi.getLayout(tagId!),
    enabled: !!tagId,
    staleTime: 60 * 1000,
  });
  const layout = useMemo(() => layoutData?.data || [], [layoutData]);

  // Split tag tiles into "positioned" (have a layout entry → render on canvas)
  // and "staging" (no entry → render in the left staging panel until the user
  // drags them onto the canvas). Avoids cluttering the canvas with new tiles
  // at default coordinates.
  const positionedTileIds = useMemo(
    () => new Set(layout.map((l: { tile_id: string }) => l.tile_id)),
    [layout],
  );
  /**
   * Il pulsante "Done" della topbar EVIDENZIA le attività completate, non le
   * filtra: i tile ci sono in entrambi gli stati, e quello che cambia è solo se
   * si tingono di verde. Acceso, il contenitore della board prende `ob-done-hl`
   * e la regola di contesto in obsidian-primitives.css fa il resto — nessun
   * ricalcolo, nessun ridisegno della board.
   *
   * Default SPENTO: il verde è un modo di guardare la board, non come la board
   * è fatta. Chi apre il canvas vede quello che vedeva prima e accende
   * l'evidenziazione quando gli serve. La scelta resta su questo dispositivo
   * (localStorage), come la larghezza dello staging.
   */
  const [doneHl, setDoneHl] = useState(false);
  useIsomorphicLayoutEffect(() => {
    try { if (localStorage.getItem('canvas_done_hl') === '1') setDoneHl(true); } catch { /* */ }
  }, []);
  const toggleDoneHl = useCallback(() => {
    setDoneHl((v) => {
      const next = !v;
      try { localStorage.setItem('canvas_done_hl', next ? '1' : '0'); } catch { /* */ }
      return next;
    });
  }, []);

  const tiles = useMemo(
    () => allTagTiles.filter((t) => positionedTileIds.has(t.id)),
    [allTagTiles, positionedTileIds],
  );
  const stagingTiles = useMemo(
    () => allTagTiles.filter((t) => !positionedTileIds.has(t.id)),
    [allTagTiles, positionedTileIds],
  );

  // Refs + state for drag-and-drop between staging and canvas.
  const stagingPanelRef = useRef<HTMLDivElement | null>(null);
  const canvasWrapperRef = useRef<HTMLDivElement | null>(null);

  // Resizable splitter between StagingPanel and the canvas column. The width
  // is persisted to localStorage so it survives reloads; default mirrors the
  // previous `w-44` (176px) value.
  // STAGING_MIN_W arriva da StagingPanel: è la larghezza di una colonna di tile
  // (stessa regola delle colonne NOTES/TODO di CHRONO), così il minimo resta
  // agganciato alla dimensione reale del tile invece di essere un numero fisso.
  const STAGING_MAX_W = 700;
  // Default = una colonna di tile esatta. Era 176, calcolato su un tile da 150:
  // col tile standard a 120 quei 33px in più erano vuoto a destra delle card.
  // Le larghezze già salvate restano (sono sopra il minimo): cambia solo il
  // punto di partenza di chi apre il canvas per la prima volta.
  const [stagingWidth, setStagingWidth] = useState<number>(STAGING_MIN_W);
  const [stagingOpen, setStagingOpen] = useState<boolean>(true);
  // Layout-effect: evita che il pannello venga disegnato alla larghezza di
  // default (176px) prima di saltare a quella salvata.
  useIsomorphicLayoutEffect(() => {
    try {
      const raw = localStorage.getItem('canvas_staging_width');
      if (raw) {
        const n = parseInt(raw, 10);
        if (Number.isFinite(n)) {
          setStagingWidth(Math.min(STAGING_MAX_W, Math.max(STAGING_MIN_W, n)));
        }
      }
      const openRaw = localStorage.getItem('canvas_staging_open');
      if (openRaw === '0') setStagingOpen(false);
    } catch { /* */ }
  }, []);
  const toggleStagingOpen = useCallback(() => {
    setStagingOpen((v) => {
      const next = !v;
      try { localStorage.setItem('canvas_staging_open', next ? '1' : '0'); } catch { /* */ }
      return next;
    });
  }, []);
  const handleStagingResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = stagingWidth;
    let lastW = startW;
    const onMove = (ev: MouseEvent) => {
      const w = Math.min(STAGING_MAX_W, Math.max(STAGING_MIN_W, startW + (ev.clientX - startX)));
      lastW = w;
      setStagingWidth(w);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      try { localStorage.setItem('canvas_staging_width', String(Math.round(lastW))); } catch { /* */ }
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [stagingWidth]);
  // Populated by CanvasBoard once its zoom system is ready. Converts viewport
  // (clientX/Y) coords to canvas-local coords accounting for current pan/zoom.
  // Used when dropping a staged tile so it lands under the cursor.
  const canvasScreenToLocalRef = useRef<((clientX: number, clientY: number) => { x: number; y: number }) | null>(null);
  // Drag-back highlight: true while a canvas tile is being dragged AND the
  // cursor is currently over the staging panel.
  const [stagingDropHover, setStagingDropHover] = useState(false);

  // Fetch edges
  const { data: edgesData } = useQuery({
    queryKey: ['canvas-edges', tagId],
    queryFn: () => canvasApi.getEdges(tagId!),
    enabled: !!tagId,
    staleTime: 60 * 1000,
  });
  // API in snake_case → CanvasEdge in camelCase (lo stile edge è opzionale).
  const edges = useMemo<CanvasEdge[]>(() => (edgesData?.data || []).map((e: any) => ({
    id: e.id,
    source_id: e.source_id,
    target_id: e.target_id,
    source_port: e.source_port,
    target_port: e.target_port,
    color: e.color ?? null,
    lineStyle: e.line_style ?? null,
    lineWidth: e.line_width ?? null,
    label: e.label ?? null,
  })), [edgesData]);
  const selectedEdge = useMemo(() => edges.find((e) => e.id === selectedEdgeId) || null, [edges, selectedEdgeId]);

  // Groups — persisted via backend API
  const { data: groupsData } = useQuery({
    queryKey: ['canvas-groups', tagId],
    queryFn: () => canvasApi.getGroups(tagId!),
    enabled: !!tagId,
    staleTime: 60 * 1000,
  });
  const canvasGroups: CanvasGroup[] = useMemo(() => (groupsData?.data || []).map((g: any) => ({
    id: g.id,
    label: g.label || '',
    nodeIds: g.node_ids || [],
    bgColor: g.bg_color ?? null,
    borderColor: g.border_color ?? null,
    borderWidth: g.border_width ?? null,
    borderStyle: g.border_style ?? null,
    bounds: g.bounds ?? null,
  })), [groupsData]);

  // Serializza un gruppo (camelCase interno → snake_case DB) per cache e API.
  const serializeGroup = (g: CanvasGroup) => ({
    id: g.id,
    label: g.label,
    node_ids: g.nodeIds,
    bg_color: g.bgColor ?? null,
    border_color: g.borderColor ?? null,
    border_width: g.borderWidth ?? null,
    border_style: g.borderStyle ?? null,
    bounds: g.bounds ?? null,
  });

  const saveGroupsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleGroupsChange = useCallback((newGroups: CanvasGroup[]) => {
    if (!tagId) return;
    // Optimistic update
    queryClient.setQueryData(['canvas-groups', tagId], {
      data: newGroups.map(serializeGroup),
    });
    // Debounce save
    if (saveGroupsTimer.current) clearTimeout(saveGroupsTimer.current);
    saveGroupsTimer.current = setTimeout(() => {
      canvasApi.saveGroups(tagId, newGroups.map(serializeGroup));
    }, 800);
  }, [tagId, queryClient]);

  // Save positions (debounced) + optimistic cache update
  const handlePositionChange = useCallback((positions: { tile_id: string; x: number; y: number }[]) => {
    if (!tagId) return;
    /**
     * Optimistic: keep layout cache in sync with current visual positions
     * so that any re-render uses the latest values, not stale DB data.
     *
     * FUSIONE e non sostituzione: `positions` descrive i tile DISEGNATI, che
     * oggi sono tutti quelli posizionati ma non è detto lo restino. Sostituendo,
     * un tile non disegnato uscirebbe da `positionedTileIds` al primo
     * trascinamento e ricomparirebbe nel pannello STAGING come se non fosse mai
     * stato messo sul canvas. Il server è già al sicuro da solo — il suo PUT è
     * un upsert e non cancella mai le voci mancanti (backend/src/routes/canvas.ts):
     * l'unica a poterle perdere era questa cache.
     */
    queryClient.setQueryData(['canvas-layout', tagId], (old: any) => {
      const merged = new Map<string, { tile_id: string; x: number; y: number }>(
        ((old?.data ?? []) as { tile_id: string; x: number; y: number }[]).map((l) => [l.tile_id, l]),
      );
      positions.forEach((p) => merged.set(p.tile_id, p));
      return { success: true, data: [...merged.values()] };
    });
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      canvasApi.saveLayout(tagId, positions);
    }, 800);
  }, [tagId, queryClient]);

  // Add edge
  const handleAddEdge = useCallback(async (source_id: string, target_id: string, source_port?: string, target_port?: string) => {
    if (!tagId) return;
    const tempId = `temp-${Date.now()}`;
    // Optimistic: add with temp ID
    queryClient.setQueryData(['canvas-edges', tagId], (old: any) => ({
      data: [...(old?.data || []), { id: tempId, source_id, target_id, source_port, target_port }],
    }));
    try {
      const res = await canvasApi.addEdge(tagId, source_id, target_id, source_port, target_port);
      // Replace temp with real data from server, preserving port info
      if (res?.data) {
        const d = res.data as any;
        queryClient.setQueryData(['canvas-edges', tagId], (old: any) => ({
          data: (old?.data || []).map((e: any) => e.id === tempId ? {
            ...d,
            source_port: d.source_port || source_port,
            target_port: d.target_port || target_port,
          } : e),
        }));
      }
    } catch {
      // Revert optimistic on error
      queryClient.setQueryData(['canvas-edges', tagId], (old: any) => ({
        data: (old?.data || []).filter((e: any) => e.id !== tempId),
      }));
    }
  }, [tagId, queryClient]);

  // Delete edge
  const handleDeleteEdge = useCallback(async (id: string) => {
    if (!tagId) return;
    // Optimistic
    queryClient.setQueryData(['canvas-edges', tagId], (old: any) => ({
      data: (old?.data || []).filter((e: CanvasEdge) => e.id !== id),
    }));
    await canvasApi.deleteEdge(id);
  }, [tagId, queryClient]);

  // Aggiorna lo stile di un edge (colore/tipologia/spessore/testo). La cache
  // tiene i dati in snake_case (come dall'API): mappiamo il patch camelCase e
  // salviamo in modo debounced.
  const edgeUpdateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleUpdateEdge = useCallback((id: string, patch: { color?: string | null; lineStyle?: 'solid' | 'dashed' | 'dotted' | null; lineWidth?: number | null; label?: string | null }) => {
    if (!tagId) return;
    const snake: Record<string, unknown> = {};
    if ('color' in patch) snake.color = patch.color ?? null;
    if ('lineStyle' in patch) snake.line_style = patch.lineStyle ?? null;
    if ('lineWidth' in patch) snake.line_width = patch.lineWidth ?? null;
    if ('label' in patch) snake.label = patch.label ?? null;
    queryClient.setQueryData(['canvas-edges', tagId], (old: any) => ({
      data: (old?.data || []).map((e: any) => e.id === id ? { ...e, ...snake } : e),
    }));
    if (edgeUpdateTimer.current) clearTimeout(edgeUpdateTimer.current);
    edgeUpdateTimer.current = setTimeout(() => { canvasApi.updateEdge(id, snake); }, 500);
  }, [tagId, queryClient]);

  // ── Boxes (text/image, polymorphic) ──
  const { data: boxesData } = useQuery({
    queryKey: ['canvas-boxes', tagId],
    queryFn: () => canvasApi.getBoxes(tagId!),
    enabled: !!tagId,
    staleTime: 60 * 1000,
  });
  const textBoxes = useMemo(() => (boxesData?.data || []) as unknown as CanvasTextBox[], [boxesData]);
  // Box di TESTO attualmente selezionato → alimenta la TextSidebar destra.
  const selectedTextBox = useMemo(
    () => textBoxes.find((b) => b.id === selectedTextBoxId && b.type === 'text') || null,
    [textBoxes, selectedTextBoxId],
  );

  const handleAddTextBox = useCallback(async (x: number, y: number, w: number, h: number) => {
    if (!tagId) return;
    setTextMode(false);
    const tempId = `temp-tb-${Date.now()}`;
    queryClient.setQueryData(['canvas-boxes', tagId], (old: any) => ({
      data: [...(old?.data || []), { id: tempId, type: 'text', content: { html: '' }, x, y, w, h }],
    }));
    try {
      const res = await canvasApi.addBox(tagId, { type: 'text', content: { html: '' }, x, y, w, h });
      if (res?.data) {
        const d = res.data as any;
        queryClient.setQueryData(['canvas-boxes', tagId], (old: any) => ({
          data: (old?.data || []).map((tb: any) => tb.id === tempId ? d : tb),
        }));
      }
    } catch {
      queryClient.setQueryData(['canvas-boxes', tagId], (old: any) => ({
        data: (old?.data || []).filter((tb: any) => tb.id !== tempId),
      }));
    }
  }, [tagId, queryClient]);

  const tbUpdateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleUpdateTextBox = useCallback((id: string, updates: { type?: 'text' | 'image'; content?: Record<string, unknown>; x?: number; y?: number; w?: number; h?: number }) => {
    if (!tagId) return;
    // For content-only updates, skip cache write: the contenteditable DOM already reflects
    // the typed text and updating the cache would trigger a re-render that rebuilds the SVG,
    // losing focus and dropping in-flight keystrokes.
    const isContentOnly = 'content' in updates && !('x' in updates) && !('y' in updates) && !('w' in updates) && !('h' in updates);
    if (!isContentOnly) {
      queryClient.setQueryData(['canvas-boxes', tagId], (old: any) => ({
        data: (old?.data || []).map((tb: any) => tb.id === id ? { ...tb, ...updates } : tb),
      }));
    }
    if (tbUpdateTimer.current) clearTimeout(tbUpdateTimer.current);
    tbUpdateTimer.current = setTimeout(() => { canvasApi.updateBox(id, updates); }, 800);
  }, [tagId, queryClient]);

  const handleDeleteTextBox = useCallback(async (id: string) => {
    if (!tagId) return;
    queryClient.setQueryData(['canvas-boxes', tagId], (old: any) => ({
      data: (old?.data || []).filter((tb: any) => tb.id !== id),
    }));
    await canvasApi.deleteBox(id);
  }, [tagId, queryClient]);

  // ── Modifica di un box di testo dalla SIDEBAR destra ──
  // Il backend RIMPIAZZA la colonna `content` (JSON), non la fonde: ogni save
  // deve inviare il content COMPLETO. Leggiamo quindi l'ultima versione dalla
  // cache (già aggiornata in modo ottimistico) e la mandiamo intera, debounced.
  const tbMirrorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tbContentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleBoxSave = useCallback((id: string) => {
    if (!tagId) return;
    if (tbContentTimer.current) clearTimeout(tbContentTimer.current);
    tbContentTimer.current = setTimeout(() => {
      const boxes = (queryClient.getQueryData(['canvas-boxes', tagId]) as any)?.data || [];
      const box = boxes.find((b: any) => b.id === id);
      if (box) canvasApi.updateBox(id, { content: box.content });
    }, 800);
  }, [tagId, queryClient]);

  // Testo (per-tasto): lo specchio in cache innesca un redraw completo dell'SVG,
  // quindi è debounced (a fine digitazione) per non ridisegnare a ogni tasto;
  // così la nota sul canvas si riallinea senza scatti. handleUpdateTextBox
  // (editing inline) resta invariato: salta la cache di proposito.
  const handleTextBoxContentChange = useCallback((id: string, html: string) => {
    if (!tagId) return;
    if (tbMirrorTimer.current) clearTimeout(tbMirrorTimer.current);
    tbMirrorTimer.current = setTimeout(() => {
      queryClient.setQueryData(['canvas-boxes', tagId], (old: any) => ({
        data: (old?.data || []).map((tb: any) => tb.id === id ? { ...tb, content: { ...(tb.content || {}), html } } : tb),
      }));
    }, 300);
    scheduleBoxSave(id);
  }, [tagId, queryClient, scheduleBoxSave]);

  // Stile (colore sfondo / dimensione font): azioni discrete → specchio in
  // cache immediato (aggiornamento istantaneo sul canvas) + save debounced.
  const handleTextBoxStylePatch = useCallback((id: string, patch: { bgColor?: string | null; fontSize?: number }) => {
    if (!tagId) return;
    queryClient.setQueryData(['canvas-boxes', tagId], (old: any) => ({
      data: (old?.data || []).map((tb: any) => tb.id === id ? { ...tb, content: { ...(tb.content || {}), ...patch } } : tb),
    }));
    scheduleBoxSave(id);
  }, [tagId, queryClient, scheduleBoxSave]);

  // Image box: drag a rectangle (w,h) → file picker → measure the image LOCALLY
  // from the File (so CORS / CDN delays can't cause a fallback) → upload to
  // canvas-assets → fit the box to the picture's aspect ratio so the frame
  // matches the image (no empty letterbox bands).
  const handleAddImageBox = useCallback(async (file: File, x: number, y: number, w: number, h: number) => {
    if (!tagId) return;
    setImageMode(false);
    if (!file.type.startsWith('image/')) {
      toast.error('Il file deve essere un\'immagine');
      return;
    }
    try {
      // Measure natural dimensions from the local file via a blob URL.
      const blobUrl = URL.createObjectURL(file);
      const dims = await new Promise<{ nw: number; nh: number } | null>((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ nw: img.naturalWidth, nh: img.naturalHeight });
        img.onerror = () => resolve(null);
        img.src = blobUrl;
      });
      URL.revokeObjectURL(blobUrl);
      // CanvasBoard insets the image by IMG_PAD (2px) on every side. So the
      // box dimensions = inner image area + 2*IMG_PAD. Compute the inner area
      // from drawn rect (minus padding), fit aspect ratio, then add padding
      // back to get the final box size.
      const PAD_TOTAL = 4; // 2 * IMG_PAD
      const innerW = Math.max(40, w - PAD_TOTAL);
      const innerH = Math.max(40, h - PAD_TOTAL);
      let finalW = w;
      let finalH = h;
      if (dims && dims.nw > 0 && dims.nh > 0) {
        const aspect = dims.nw / dims.nh;
        const innerAspect = innerW / innerH;
        let fitW = innerW;
        let fitH = innerH;
        if (aspect > innerAspect) {
          // Picture is wider than the inner rect → keep width, shrink height.
          fitH = Math.max(40, Math.round(innerW / aspect));
        } else {
          // Picture is taller than the inner rect → keep height, shrink width.
          fitW = Math.max(40, Math.round(innerH * aspect));
        }
        finalW = fitW + PAD_TOTAL;
        finalH = fitH + PAD_TOTAL;
      }
      const upRes = await uploadApi.uploadFile(file, 'canvas', 'canvas-assets');
      if (!upRes.success || !upRes.data) {
        toast.error(upRes.error || 'Upload fallito');
        return;
      }
      const src = upRes.data.url;
      const tempId = `temp-img-${Date.now()}`;
      queryClient.setQueryData(['canvas-boxes', tagId], (old: any) => ({
        data: [...(old?.data || []), { id: tempId, type: 'image', content: { src }, x, y, w: finalW, h: finalH }],
      }));
      const res = await canvasApi.addBox(tagId, { type: 'image', content: { src }, x, y, w: finalW, h: finalH });
      if (res?.data) {
        const d = res.data as any;
        queryClient.setQueryData(['canvas-boxes', tagId], (old: any) => ({
          data: (old?.data || []).map((tb: any) => tb.id === tempId ? d : tb),
        }));
      }
    } catch (err: any) {
      toast.error(err?.message || 'Errore inserimento immagine');
    }
  }, [tagId, queryClient]);

  // Text box context menu
  const [tbCtx, setTbCtx] = useState<{ x: number; y: number; textBoxId: string } | null>(null);

  // Add new tile at position — SOLO in modalità +Tile. Un click "nudo" sullo
  // sfondo non deve mai aggiungere un tile. (L'incolla di una copia avviene col
  // tasto destro → menu "Incolla", vedi handlePasteAt.)
  const handleAddTileAt = useCallback(async (x: number, y: number) => {
    if (!tagId) return;
    if (!tileMode) return;
    setTileMode(false);
    try {
      const res = await tilesApi.create({ title: 'Nuovo tile' });
      const newId = res?.data?.id;
      if (!newId) return;
      // Assign tag
      const tag = tags.find((t: Tag) => t.id === tagId);
      if (tag) await tagsApi.tagTiles(tag.id, [newId]);
      // Save position
      const currentLayout = (queryClient.getQueryData(['canvas-layout', tagId]) as any)?.data || [];
      const newLayout = [...currentLayout, { tile_id: newId, x, y }];
      queryClient.setQueryData(['canvas-layout', tagId], { data: newLayout });
      canvasApi.saveLayout(tagId, newLayout);
      // Refresh tiles + tags (sidebar count)
      queryClient.invalidateQueries({ queryKey: ['canvas-tiles', tagId] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      // Open sidebar
      setSelectedTileId(newId);
      setSidebarOpen(true);
    } catch { /* ignore */ }
  }, [tagId, tags, tileMode, queryClient]);

  // Incolla l'elemento negli appunti nel punto (coord locali canvas). Supporta
  // tile, testo e immagine. Gli appunti restano attivi → si può incollare più
  // volte finché non si copia altro o si preme Esc.
  const handlePasteAt = useCallback(async (localX: number, localY: number) => {
    if (!tagId || !clipboard) return;
    const { kind, id } = clipboard;
    if (kind === 'tile') {
      try {
        const source = tiles.find((t) => t.id === id);
        const res = await tilesApi.create({ title: source ? source.title : 'Nuovo tile' });
        const newId = res?.data?.id;
        if (!newId) return;
        if (source) {
          const updates: Parameters<typeof tilesApi.update>[1] = {};
          if (source.action_type) updates.action_type = source.action_type;
          if (source.is_cta !== undefined) updates.is_cta = source.is_cta;
          if (source.status_id) updates.status_id = source.status_id;
          // Daily vs Timing hanno lo stesso action_type ('event'): la distinzione
          // è `all_day`. Senza copiarlo, un Daily diventava un Timing. Replichiamo
          // anche is_event e la data/ora per un clone fedele.
          if (source.is_event !== undefined) updates.is_event = source.is_event;
          if (source.all_day !== undefined) updates.all_day = source.all_day;
          if (source.start_at !== undefined) updates.start_at = source.start_at;
          if (source.end_at !== undefined) updates.end_at = source.end_at;
          if (Object.keys(updates).length > 0) {
            try { await tilesApi.update(newId, updates); } catch { /* non bloccante */ }
          }
        }
        // TAG: replica i tag del sorgente (fallback: il tag del canvas corrente).
        const sourceTagIds = (source?.tags ?? []).filter((t) => !t.is_root).map((t) => t.id);
        const tagIdsToAssign = sourceTagIds.length > 0 ? sourceTagIds : (tagId ? [tagId] : []);
        for (const tid of tagIdsToAssign) {
          try { await tagsApi.tagTiles(tid, [newId]); } catch { /* non bloccante */ }
        }
        // TIPO: replica l'associazione type-icon del sorgente.
        const srcIcon = typeTileIcons[id];
        if (srcIcon) assignTypeIcon(newId, srcIcon);
        const currentLayout = (queryClient.getQueryData(['canvas-layout', tagId]) as any)?.data || [];
        const newLayout = [...currentLayout, { tile_id: newId, x: localX, y: localY }];
        queryClient.setQueryData(['canvas-layout', tagId], { data: newLayout });
        canvasApi.saveLayout(tagId, newLayout);
        queryClient.invalidateQueries({ queryKey: ['canvas-tiles', tagId] });
        queryClient.invalidateQueries({ queryKey: ['tags'] });
      } catch { /* ignore */ }
    } else {
      // Text / image box: replica contenuto e dimensioni del sorgente.
      const src = textBoxes.find((b) => b.id === id);
      if (!src) return;
      const payload = { type: kind, content: src.content as Record<string, unknown>, x: localX, y: localY, w: src.w, h: src.h };
      const tempId = `temp-paste-${Date.now()}`;
      queryClient.setQueryData(['canvas-boxes', tagId], (old: any) => ({
        data: [...(old?.data || []), { id: tempId, ...payload }],
      }));
      try {
        const res = await canvasApi.addBox(tagId, payload);
        if (res?.data) {
          const d = res.data as any;
          queryClient.setQueryData(['canvas-boxes', tagId], (old: any) => ({
            data: (old?.data || []).map((b: any) => (b.id === tempId ? d : b)),
          }));
        }
      } catch {
        queryClient.setQueryData(['canvas-boxes', tagId], (old: any) => ({
          data: (old?.data || []).filter((b: any) => b.id !== tempId),
        }));
      }
    }
  }, [tagId, clipboard, tiles, tags, textBoxes, typeTileIcons, assignTypeIcon, queryClient]);

  const handleFit = useCallback(() => {
    setFitTrigger((n) => n + 1);
  }, []);

  const [zoom100Trigger, setZoom100Trigger] = useState(0);
  const handleZoom100 = useCallback(() => {
    setZoom100Trigger((n) => n + 1);
  }, []);

  // Pinned tags ordering (Canvas topbar breadcrumb chips, drag-reorderable).
  const pinnedTags = useMemo(
    () => tags
      .filter((t) => t.is_pinned && !t.is_archived)
      .sort((a, b) => (a.pin_order ?? 0) - (b.pin_order ?? 0)),
    [tags]
  );

  const handleReorderPinned = useCallback(async (orderedIds: string[]) => {
    // Snapshot for rollback if the API call fails.
    const prev = queryClient.getQueryData(['tags']);
    // Optimistic: reorder locally so UI updates immediately
    queryClient.setQueryData(['tags'], (old: any) => {
      if (!old?.data) return old;
      const indexMap = new Map(orderedIds.map((id, i) => [id, i]));
      return {
        ...old,
        data: old.data.map((t: Tag) =>
          indexMap.has(t.id) ? { ...t, pin_order: indexMap.get(t.id)! } : t
        ),
      };
    });
    const res = await tagsApi.reorderPinned(orderedIds);
    if (!res.success) {
      // Rollback + tell the user — usually means migration 018 not applied
      // or backend not restarted.
      queryClient.setQueryData(['tags'], prev);
      toast.error(res.error || 'Riordinamento non riuscito');
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['tags'] });
  }, [queryClient]);

  // Edge context menu
  const [edgeCtx, setEdgeCtx] = useState<{ x: number; y: number; edgeId: string } | null>(null);

  useEffect(() => {
    if (!edgeCtx) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setEdgeCtx(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [edgeCtx]);

  const handleEdgeContextMenu = useCallback((e: { x: number; y: number; edgeId: string }) => {
    setEdgeCtx(e);
  }, []);

  const handleConfirmDeleteEdge = useCallback(() => {
    if (!edgeCtx) return;
    handleDeleteEdge(edgeCtx.edgeId);
    setEdgeCtx(null);
  }, [edgeCtx, handleDeleteEdge]);

  // Multi-selection state (CTRL/SHIFT + drag/click in CanvasBoard).
  // IDs are mixed: bare UUID = tile, "tb:<uuid>" = text box.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionBbox, setSelectionBbox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  // Gruppo selezionato (click sinistro): dati nella sidebar destra + punti di
  // aggancio evidenziati sul canvas.
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // Derived splits
  const selectedTileIds = useMemo(() => selectedIds.filter((id) => !id.startsWith('tb:')), [selectedIds]);
  const selectedTextBoxIds = useMemo(() => selectedIds.filter((id) => id.startsWith('tb:')).map((id) => id.slice(3)), [selectedIds]);

  const handleSelectionChange = useCallback((ids: string[], bbox: { x: number; y: number; w: number; h: number } | null) => {
    setSelectedIds(ids);
    setSelectionBbox(bbox);
    // Cambio selezione → azzera gruppo e tile singolo (onTileClick li ri-imposta
    // subito dopo nel flusso di click singolo). Su click vuoto restano azzerati.
    setSelectedGroupId(null);
    setSelectedTileId(null);
    setSelectedTextBoxId(null);
    setSelectedEdgeId(null);
    // Auto-open sidebar on multi-selection so the bulk editor is immediately visible
    if (ids.length >= 2) setSidebarOpen(true);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
    setSelectionBbox(null);
  }, []);

  // Esc clears selection (multi, gruppo, tile singolo, box, edge)
  useEffect(() => {
    if (selectedIds.length === 0 && !selectedGroupId && !selectedTileId && !selectedTextBoxId && !selectedEdgeId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { clearSelection(); setSelectedGroupId(null); setSelectedTileId(null); setSelectedTextBoxId(null); setSelectedEdgeId(null); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selectedIds.length, selectedGroupId, selectedTileId, selectedTextBoxId, selectedEdgeId, clearSelection]);

  // Esc disarma +Tile, svuota gli appunti e chiude il menu "Incolla".
  useEffect(() => {
    if (!tileMode && !clipboard && !pasteMenu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setTileMode(false); setClipboard(null); setPasteMenu(null); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [tileMode, clipboard, pasteMenu]);

  const handleBulkDeleteSelected = useCallback(async () => {
    if (selectedIds.length === 0 || !tagId) return;
    const tileIds = selectedTileIds;
    const tbIds = selectedTextBoxIds;
    // Edges connected to any deleted endpoint must also go (avoid orphans).
    // edge.source_id/target_id are stored bare for tiles and "tb:<uuid>" for text boxes.
    const allEndpoints = new Set([...tileIds, ...tbIds.map((id) => `tb:${id}`)]);
    const currentEdges = ((queryClient.getQueryData(['canvas-edges', tagId]) as any)?.data || []) as CanvasEdge[];
    const edgesToDelete = currentEdges.filter((e) => allEndpoints.has(e.source_id) || allEndpoints.has(e.target_id));

    clearSelection();
    try {
      await Promise.all([
        ...tileIds.map((id) => tilesApi.delete(id).catch(() => null)),
        ...tbIds.map((id) => canvasApi.deleteBox(id).catch(() => null)),
        ...edgesToDelete.map((e) => canvasApi.deleteEdge(e.id).catch(() => null)),
      ]);
      queryClient.invalidateQueries({ queryKey: ['canvas-tiles', tagId] });
      queryClient.invalidateQueries({ queryKey: ['canvas-layout', tagId] });
      queryClient.invalidateQueries({ queryKey: ['canvas-edges', tagId] });
      queryClient.invalidateQueries({ queryKey: ['canvas-boxes', tagId] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    } catch { /* ignore */ }
  }, [selectedIds, selectedTileIds, selectedTextBoxIds, tagId, queryClient, clearSelection]);

  const handleCreateGroupFromSelection = useCallback(() => {
    // Groups are tile-only; require ≥2 tiles AND no text boxes in selection.
    if (selectedTileIds.length < 2 || selectedTextBoxIds.length > 0) return;
    const ids = selectedTileIds;
    const ng = canvasGroups
      .map((g) => ({ ...g, nodeIds: g.nodeIds.filter((nid) => !ids.includes(nid)) }))
      .filter((g) => g.nodeIds.length >= 2);
    ng.push({ id: crypto.randomUUID(), label: '', nodeIds: ids });
    handleGroupsChange(ng);
    clearSelection();
  }, [selectedTileIds, selectedTextBoxIds, canvasGroups, handleGroupsChange, clearSelection]);

  // Modalità "Raggruppa a contorno": i tile catturati dal rettangolo formano
  // subito un nuovo gruppo. Rimuove gli id dai gruppi esistenti (un tile sta in
  // un solo gruppo) e scarta i gruppi rimasti con <2 tile.
  const handleGroupTiles = useCallback((ids: string[]) => {
    // Il pulsante Group si disattiva dopo ogni uso (come Tile/Text/Image).
    setSelectMode(false);
    if (ids.length < 2) return;
    const idSet = new Set(ids);
    const ng = canvasGroups
      .map((g) => ({ ...g, nodeIds: g.nodeIds.filter((nid) => !idSet.has(nid)) }))
      .filter((g) => g.nodeIds.length >= 2);
    ng.push({ id: crypto.randomUUID(), label: '', nodeIds: ids });
    handleGroupsChange(ng);
  }, [canvasGroups, handleGroupsChange]);

  // Menu del gruppo (Rinomina / Elimina) + modale di rinomina in stile Obsidian.
  const [groupCtx, setGroupCtx] = useState<{ x: number; y: number; groupId: string } | null>(null);
  const [renameGroup, setRenameGroup] = useState<{ id: string; name: string } | null>(null);

  const handleGroupClick = useCallback((groupId: string) => {
    // Selezione esclusiva: un gruppo selezionato azzera selezione tile/box/edge/multi.
    setSelectedGroupId(groupId);
    setSelectedTileId(null);
    setSelectedTextBoxId(null);
    setSelectedEdgeId(null);
    setSelectedIds([]);
    setSelectionBbox(null);
    setSidebarOpen(true);
  }, []);

  // Click singolo su un box: selezione esclusiva → contorno obsidian. Per i box
  // di TESTO apriamo anche la sidebar destra con l'editor (come per i gruppi);
  // per le immagini resta solo il contorno.
  const handleTextBoxClick = useCallback((id: string) => {
    setSelectedTextBoxId(id);
    setSelectedTileId(null);
    setSelectedGroupId(null);
    setSelectedEdgeId(null);
    setSelectedIds([]);
    setSelectionBbox(null);
    const box = textBoxes.find((b) => b.id === id);
    if (box?.type === 'text') setSidebarOpen(true);
  }, [textBoxes]);

  // Click singolo su un edge: selezione esclusiva → apre la EdgeSidebar.
  const handleEdgeClick = useCallback((id: string) => {
    setSelectedEdgeId(id);
    setSelectedTileId(null);
    setSelectedGroupId(null);
    setSelectedTextBoxId(null);
    setSelectedIds([]);
    setSelectionBbox(null);
    setSidebarOpen(true);
  }, []);

  const handleGroupContextMenu = useCallback((e: { x: number; y: number; groupId: string }) => {
    setGroupCtx(e);
  }, []);

  // Elimina il gruppo: rimuove SOLO il contenitore (i tile restano sul canvas,
  // come "Ungroup" ma su tutto il gruppo).
  const handleDeleteGroup = useCallback((groupId: string) => {
    handleGroupsChange(canvasGroups.filter((g) => g.id !== groupId));
    setSelectedGroupId((cur) => (cur === groupId ? null : cur));
  }, [canvasGroups, handleGroupsChange]);

  const handleRenameGroup = useCallback((groupId: string, name: string) => {
    handleGroupsChange(canvasGroups.map((g) => g.id === groupId ? { ...g, label: name.trim() } : g));
  }, [canvasGroups, handleGroupsChange]);

  // Aggiorna proprietà del gruppo (nome/stile) in modo generico.
  const handleUpdateGroup = useCallback((groupId: string, patch: Partial<CanvasGroup>) => {
    handleGroupsChange(canvasGroups.map((g) => g.id === groupId ? { ...g, ...patch } : g));
  }, [canvasGroups, handleGroupsChange]);

  // Tile context menu
  const [tileCtx, setTileCtx] = useState<{ x: number; y: number; tileId: string; inGroup: boolean } | null>(null);

  const handleTileContextMenu = useCallback((e: { x: number; y: number; tileId: string; inGroup: boolean }) => {
    setTileCtx(e);
  }, []);

  const handleUngroupTile = useCallback(() => {
    if (!tileCtx) return;
    const id = tileCtx.tileId;
    setTileCtx(null);
    const newGroups = canvasGroups
      .map((g) => ({ ...g, nodeIds: g.nodeIds.filter((nid) => nid !== id) }))
      .filter((g) => g.nodeIds.length >= 2);
    handleGroupsChange(newGroups);
  }, [tileCtx, canvasGroups, handleGroupsChange]);

  const handleConfirmDeleteTile = useCallback(async () => {
    if (!tileCtx) return;
    const id = tileCtx.tileId;
    setTileCtx(null);
    try {
      await tilesApi.delete(id);
      queryClient.invalidateQueries({ queryKey: ['canvas-tiles', tagId] });
      queryClient.invalidateQueries({ queryKey: ['canvas-layout', tagId] });
      queryClient.invalidateQueries({ queryKey: ['canvas-edges', tagId] });
    } catch { /* ignore */ }
  }, [tileCtx, tagId, queryClient]);

  // "Copia": memorizza il tile negli appunti. L'incolla avviene col tasto
  // destro sul punto target (menu "Incolla"), vedi handlePasteAt.
  const handleCopyTile = useCallback(() => {
    if (!tileCtx) return;
    setClipboard({ kind: 'tile', id: tileCtx.tileId });
    setTileCtx(null);
  }, [tileCtx]);

  // "Copia" per un box di testo/immagine → appunti.
  const handleCopyBox = useCallback(() => {
    if (!tbCtx) return;
    const box = textBoxes.find((b) => b.id === tbCtx.textBoxId);
    if (box) setClipboard({ kind: box.type, id: box.id });
    setTbCtx(null);
  }, [tbCtx, textBoxes]);

  return (
    <div className={`flex flex-col h-full flex-1 min-w-0`} style={{ background: theme.bg1 }}>

      {tagId && tag ? (
        <div className="flex flex-1 overflow-hidden">
        <StagingPanel
          tiles={stagingTiles}
          panelRef={stagingPanelRef}
          selectedTileId={selectedTileId}
          isDropTargetHover={stagingDropHover}
          width={stagingWidth}
          open={stagingOpen}
          onToggle={toggleStagingOpen}
          onTileClick={(id) => { setSelectedTileId(id); setSidebarOpen(true); }}
        />
        {/* Resizable splitter between Staging and Canvas. The handle is 4px
            wide with a transparent hit area that widens via padding so the
            grab zone is comfortable. Hidden when staging is collapsed — the
            thin strip has a fixed width and there's nothing to resize. */}
        {stagingOpen && (
          <div
            role="separator"
            aria-orientation="vertical"
            onMouseDown={handleStagingResizeStart}
            style={{ position: 'relative', width: 4, marginLeft: -2, marginRight: -2, flexShrink: 0, cursor: 'col-resize', background: 'transparent', zIndex: 10 }}
            title="Trascina per ridimensionare"
            onMouseEnter={(e) => (e.currentTarget.style.background = `${theme.accent}66`)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <div
              aria-hidden
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 6,
                height: 40,
                background: theme.border,
                pointerEvents: 'none',
              }}
            />
          </div>
        )}
        <div className="flex-1 flex flex-col overflow-hidden">
          <CanvasTopbar
            tag={tag}
            textMode={textMode}
            tileMode={tileMode}
            imageMode={imageMode}
            selectMode={selectMode}
            onToggleTextMode={() => { setTextMode((v) => !v); setTileMode(false); setImageMode(false); setSelectMode(false); }}
            onToggleTileMode={() => { setTileMode((v) => !v); setTextMode(false); setImageMode(false); setSelectMode(false); }}
            onToggleImageMode={() => { setImageMode((v) => !v); setTextMode(false); setTileMode(false); setSelectMode(false); }}
            onToggleSelectMode={() => { setSelectMode((v) => !v); setTextMode(false); setTileMode(false); setImageMode(false); }}
            onFit={handleFit}
            onZoom100={handleZoom100}
            doneHighlight={doneHl}
            onToggleDoneHighlight={toggleDoneHl}
            pinnedTags={pinnedTags}
            onPinnedTagClick={(id) => router.push(`/canvas?tag=${id}`)}
            onReorderPinned={handleReorderPinned}
            onUnpinTag={async (id) => {
              queryClient.setQueryData(['tags'], (old: any) => {
                if (!old?.data) return old;
                return { ...old, data: old.data.map((t: Tag) => t.id === id ? { ...t, is_pinned: false } : t) };
              });
              try { await tagsApi.update(id, { is_pinned: false }); }
              finally { queryClient.invalidateQueries({ queryKey: ['tags'] }); }
            }}
          />
          <div
            ref={canvasWrapperRef}
            // `ob-done-hl` accende il verde sui tile completati DENTRO la board.
            // Una classe sul contenitore, non un dato passato ai nodi: la board
            // e' disegnata da D3 e rimontarla per cambiare un colore sarebbe
            // sproporzionato — qui cambia solo una regola CSS.
            className={`flex-1 relative overflow-hidden${doneHl ? ' ob-done-hl' : ''}`}
            style={{ cursor: (textMode || tileMode || imageMode || selectMode) ? 'crosshair' : undefined }}
            // Disabilita il menu contestuale del browser su TUTTO il canvas.
            // I menu di tile/box/edge partono dai loro handler D3 (che fanno
            // stopPropagation) e non arrivano qui: qui gestiamo solo il tasto
            // destro sullo SFONDO vuoto → menu "Incolla" (se ci sono appunti).
            onContextMenu={(e) => {
              e.preventDefault();
              if (!clipboard) return;
              const local = canvasScreenToLocalRef.current?.(e.clientX, e.clientY) ?? { x: e.clientX, y: e.clientY };
              setPasteMenu({ x: e.clientX, y: e.clientY, localX: local.x, localY: local.y });
            }}
            onDragOver={(e) => {
              // Allow drops only when a staging tile is being dragged.
              if (!e.dataTransfer.types.includes('text/x-canvas-tile-id')) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
            }}
            onDrop={(e) => {
              const tileId = e.dataTransfer.getData('text/x-canvas-tile-id');
              if (!tileId || !tagId) return;
              e.preventDefault();
              // Compute drop coords relative to the canvas wrapper, then
              // invert by the current zoom transform so the tile lands under
              // the cursor regardless of pan/zoom. The transform is exposed
              // by CanvasBoard via the screen-to-canvas converter ref below.
              const screen = canvasScreenToLocalRef.current;
              const wrapper = canvasWrapperRef.current;
              if (!wrapper) return;
              const rect = wrapper.getBoundingClientRect();
              const localXY = screen
                ? screen(e.clientX, e.clientY)
                : { x: e.clientX - rect.left, y: e.clientY - rect.top };
              const newEntry = { tile_id: tileId, x: localXY.x, y: localXY.y };
              const next = [...layout.filter((l: { tile_id: string }) => l.tile_id !== tileId), newEntry];
              queryClient.setQueryData(['canvas-layout', tagId], { success: true, data: next });
              canvasApi.saveLayout(tagId, next);
            }}
          >
            <CanvasBoard
              // Vista (pan + zoom) persistita per canvas: riapre dove l'hai lasciata.
              viewKey={tagId}
              tiles={tiles}
              layout={layout}
              edges={edges}
              groups={canvasGroups}
              textBoxes={textBoxes}
              moveEnabled={true}
              linkEnabled={true}
              textMode={textMode}
              tileMode={tileMode}
              imageMode={imageMode}
              selectMode={selectMode}
              onGroupTiles={handleGroupTiles}
              onGroupContextMenu={handleGroupContextMenu}
              onGroupClick={handleGroupClick}
              selectedGroupId={selectedGroupId}
              selectedTileId={selectedTileId}
              selectedTextBoxId={selectedTextBoxId}
              onTextBoxClick={handleTextBoxClick}
              onEdgeClick={handleEdgeClick}
              selectedEdgeId={selectedEdgeId}
              onAddImageBox={handleAddImageBox}
              onAddTileAt={handleAddTileAt}
              onPositionChange={handlePositionChange}
              onAddEdge={handleAddEdge}
              onDeleteEdge={handleDeleteEdge}
              onEdgeContextMenu={handleEdgeContextMenu}
              onTileContextMenu={handleTileContextMenu}
              onTileClick={(id) => {
                // La TileSidebar carica da sé il tile autorevole (`tile-detail`,
                // con status/tipo/subtasks/description/sparks) via tileId.
                // NIENTE overwrite ottimistico con la proiezione ridotta della
                // lista canvas: sovrascriveva i dati completi lasciando la
                // sidebar senza corrispondenza con il tile selezionato.
                setSelectedGroupId(null);
                setSelectedTextBoxId(null);
                setSelectedEdgeId(null);
                setSelectedTileId(id);
                setSidebarOpen(true);
              }}
              onGroupsChange={handleGroupsChange}
              onAddTextBox={handleAddTextBox}
              onUpdateTextBox={handleUpdateTextBox}
              onTextBoxContextMenu={(e) => setTbCtx(e)}
              selectedIds={selectedTileIds}
              onSelectionChange={handleSelectionChange}
              fitTrigger={fitTrigger}
              zoom100Trigger={zoom100Trigger}
              screenToLocalRef={canvasScreenToLocalRef}
              isOverStaging={(clientX, clientY) => {
                const el = stagingPanelRef.current;
                if (!el) return false;
                const r = el.getBoundingClientRect();
                return (
                  clientX >= r.left &&
                  clientX <= r.right &&
                  clientY >= r.top &&
                  clientY <= r.bottom
                );
              }}
              onTilesRemovedFromCanvas={(ids) => {
                if (!tagId || ids.length === 0) return;
                const removed = new Set(ids);
                const next = layout.filter((l: { tile_id: string }) => !removed.has(l.tile_id));
                // Optimistic cache update so the tile jumps to the staging
                // panel immediately. saveLayout is upsert-only; DELETE is
                // needed for each removed tile to make the change persistent.
                queryClient.setQueryData(['canvas-layout', tagId], { success: true, data: next });
                Promise.all(ids.map((id) => canvasApi.removeFromLayout(tagId, id))).catch(() => {
                  // On failure, refetch to resync with the server.
                  queryClient.invalidateQueries({ queryKey: ['canvas-layout', tagId] });
                });
              }}
              onTileDragMove={(clientX, clientY) => {
                const el = stagingPanelRef.current;
                if (!el) {
                  if (stagingDropHover) setStagingDropHover(false);
                  return;
                }
                const r = el.getBoundingClientRect();
                const inside =
                  clientX >= r.left && clientX <= r.right &&
                  clientY >= r.top && clientY <= r.bottom;
                if (inside !== stagingDropHover) setStagingDropHover(inside);
              }}
              onTileDragEnd={() => setStagingDropHover(false)}
            />
          </div>
        </div>

          {/* 5 — SIDEBAR DESTRA. Priorità: gruppo → edge → box di testo (editor)
              → MultiTileSidebar (≥2 tile) → TileSidebar. */}
          {selectedGroupId && canvasGroups.find((g) => g.id === selectedGroupId) ? (
            <GroupSidebar
              group={canvasGroups.find((g) => g.id === selectedGroupId)!}
              tiles={tiles}
              open={sidebarOpen}
              onToggle={() => setSidebarOpen(!sidebarOpen)}
              onUpdate={(patch) => handleUpdateGroup(selectedGroupId, patch)}
              onDelete={() => handleDeleteGroup(selectedGroupId)}
              onSelectTile={(id) => { setSelectedGroupId(null); setSelectedTileId(id); setSidebarOpen(true); }}
            />
          ) : selectedEdge ? (
            <EdgeSidebar
              key={selectedEdge.id}
              edge={selectedEdge}
              open={sidebarOpen}
              onToggle={() => setSidebarOpen(!sidebarOpen)}
              onUpdate={(patch) => handleUpdateEdge(selectedEdge.id, patch)}
              onDelete={() => { handleDeleteEdge(selectedEdge.id); setSelectedEdgeId(null); }}
            />
          ) : selectedTextBox ? (
            <TextSidebar
              key={selectedTextBox.id}
              boxId={selectedTextBox.id}
              initialHtml={(selectedTextBox as { content: { html: string } }).content.html || ''}
              bgColor={(selectedTextBox as { content: { bgColor?: string | null } }).content.bgColor ?? null}
              fontSize={(selectedTextBox as { content: { fontSize?: number } }).content.fontSize ?? 11}
              open={sidebarOpen}
              onToggle={() => setSidebarOpen(!sidebarOpen)}
              onChange={(html) => handleTextBoxContentChange(selectedTextBox.id, html)}
              onStyleChange={(patch) => handleTextBoxStylePatch(selectedTextBox.id, patch)}
              onDelete={() => { handleDeleteTextBox(selectedTextBox.id); setSelectedTextBoxId(null); }}
            />
          ) : selectedTileIds.length >= 2 && selectedTextBoxIds.length === 0 ? (
            <MultiTileSidebar
              tiles={tiles.filter((t) => selectedTileIds.includes(t.id))}
              open={sidebarOpen}
              onToggle={() => setSidebarOpen(!sidebarOpen)}
              invalidateKeys={['canvas-tiles', 'canvas-layout', 'canvas-edges', 'tags']}
              onClearSelection={clearSelection}
            />
          ) : (
            <TileSidebar
              tileId={selectedTileId}
              open={sidebarOpen}
              onToggle={() => setSidebarOpen(!sidebarOpen)}
              invalidateKeys={['canvas-tiles', 'canvas-layout', 'canvas-edges', 'tags']}
            />
          )}

          {/* Selection action menu (CTRL/SHIFT + drag/click → multi-select).
              Selection may include tiles and text boxes; "Crea gruppo" is gated to tiles-only. */}
          {selectedIds.length > 0 && selectionBbox && createPortal(
            (() => {
              const menuW = 200;
              const margin = 8;
              const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
              const vh = typeof window !== 'undefined' ? window.innerHeight : 768;
              let left = selectionBbox.x + selectionBbox.w / 2 - menuW / 2;
              left = Math.max(margin, Math.min(left, vw - menuW - margin));
              let top = selectionBbox.y + selectionBbox.h + margin;
              const estH = 80;
              if (top + estH > vh - margin) top = Math.max(margin, selectionBbox.y - estH - margin);
              const tileCount = selectedTileIds.length;
              const tbCount = selectedTextBoxIds.length;
              const groupAllowed = tileCount >= 2 && tbCount === 0;
              return (
                <div
                  className="fixed"
                  style={{
                    top, left, width: menuW,
                    zIndex: 9999,
                    background: theme.surface,
                    border: `1px solid ${theme.border}`,
                    boxShadow: 'var(--ob-shadow-card)',
                    borderRadius: 'var(--ob-radius-md)',
                    padding: 4,
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div
                    style={{
                      padding: '6px 10px',
                      fontFamily: 'var(--ob-font-mono)',
                      fontSize: OB_TEXT.micro,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: theme.ink3,
                      borderBottom: `1px solid ${theme.border}`,
                    }}
                  >
                    {selectedIds.length} elementi
                    {tbCount > 0 && tileCount > 0 && (
                      <span style={{ marginLeft: 4, textTransform: 'none', color: theme.ink3, fontFamily: ('var(--ob-font-sans)'), fontSize: OB_TEXT.meta }}>({tileCount} tile · {tbCount} note)</span>
                    )}
                  </div>
                  <button
                    onClick={handleCreateGroupFromSelection}
                    disabled={!groupAllowed}
                    title={!groupAllowed ? 'I gruppi possono contenere solo tile' : undefined}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      padding: '6px 10px',
                      textAlign: 'left',
                      background: 'transparent',
                      border: 'none',
                      cursor: groupAllowed ? 'pointer' : 'not-allowed',
                      color: groupAllowed ? theme.ink2 : theme.ink3,
                      opacity: groupAllowed ? 1 : 0.4,
                      fontFamily: ('var(--ob-font-sans)'),
                      fontSize: OB_TEXT.card,
                    }}
                  >
                    <IconBoxMultiple size={14} />
                    Crea gruppo
                  </button>
                  <button
                    onClick={handleBulkDeleteSelected}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      padding: '6px 10px',
                      textAlign: 'left',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--ob-danger)',
                      fontFamily: ('var(--ob-font-sans)'),
                      fontSize: OB_TEXT.card,
                    }}
                  >
                    <IconTrash size={14} />
                    Elimina elementi
                  </button>
                </div>
              );
            })(),
            document.body
          )}

          {/* Tile context menu */}
          {tileCtx && createPortal(
            (() => {
              const inMultiSel = selectedIds.length > 1 && selectedTileIds.includes(tileCtx.tileId);
              const groupAllowed = selectedTileIds.length >= 2 && selectedTextBoxIds.length === 0;
              const menuItem: React.CSSProperties = {
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '6px 10px',
                textAlign: 'left',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: theme.ink2,
                fontFamily: ('var(--ob-font-sans)'),
                fontSize: OB_TEXT.card,
              };
              const dangerItem: React.CSSProperties = { ...menuItem, color: 'var(--ob-danger)' };
              return (
                <>
                  <div className="fixed inset-0 z-[9998]" onClick={() => setTileCtx(null)} onContextMenu={(e) => { e.preventDefault(); setTileCtx(null); }} />
                  <div
                    className="fixed"
                    style={{
                      top: tileCtx.y,
                      left: tileCtx.x,
                      zIndex: 9999,
                      width: 184,
                      background: theme.surface,
                      border: `1px solid ${theme.border}`,
                      boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
                      padding: 4,
                    }}
                  >
                    {inMultiSel && (
                      <>
                        <div
                          style={{
                            padding: '6px 10px',
                            fontFamily: 'var(--ob-font-mono)',
                            fontSize: OB_TEXT.micro,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            color: theme.ink3,
                            borderBottom: `1px solid ${theme.border}`,
                          }}
                        >
                          {selectedIds.length} selezionati
                        </div>
                        <button
                          onClick={() => { setTileCtx(null); handleCreateGroupFromSelection(); }}
                          disabled={!groupAllowed}
                          title={!groupAllowed ? 'I gruppi possono contenere solo tile' : undefined}
                          style={{ ...menuItem, cursor: groupAllowed ? 'pointer' : 'not-allowed', color: groupAllowed ? theme.ink2 : theme.ink3, opacity: groupAllowed ? 1 : 0.4 }}
                        >
                          <IconBoxMultiple size={14} />
                          Crea gruppo
                        </button>
                        <button onClick={() => { setTileCtx(null); handleBulkDeleteSelected(); }} style={dangerItem}>
                          <IconTrash size={14} />
                          Elimina {selectedIds.length} elementi
                        </button>
                        <div style={{ margin: '4px 0', borderTop: `1px solid ${theme.border}` }} />
                      </>
                    )}
                    {tileCtx.inGroup && (
                      <button onClick={handleUngroupTile} style={menuItem}>
                        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
                        Ungroup
                      </button>
                    )}
                    <button onClick={handleCopyTile} style={menuItem}>
                      <IconCopy size={14} />
                      Copia
                    </button>
                    <button
                      onClick={() => {
                        if (!tileCtx || !tagId) return;
                        const id = tileCtx.tileId;
                        setTileCtx(null);
                        const next = layout.filter((l: { tile_id: string }) => l.tile_id !== id);
                        queryClient.setQueryData(['canvas-layout', tagId], { success: true, data: next });
                        canvasApi.removeFromLayout(tagId, id).catch(() => {
                          queryClient.invalidateQueries({ queryKey: ['canvas-layout', tagId] });
                        });
                      }}
                      style={menuItem}
                    >
                      <IconInbox size={14} />
                      Rimuovi dal canvas
                    </button>
                    <button onClick={handleConfirmDeleteTile} style={dangerItem}>
                      <IconTrash size={14} />
                      Delete
                    </button>
                  </div>
                </>
              );
            })(),
            document.body
          )}

          {/* Text box context menu */}
          {tbCtx && createPortal(
            <>
              <div className="fixed inset-0 z-[9998]" onClick={() => setTbCtx(null)} onContextMenu={(e) => { e.preventDefault(); setTbCtx(null); }} />
              <div
                className="fixed"
                style={{
                  top: tbCtx.y,
                  left: tbCtx.x,
                  zIndex: 9999,
                  width: 168,
                  background: theme.surface,
                  border: `1px solid ${theme.border}`,
                  boxShadow: 'var(--ob-shadow-card)',
                  borderRadius: 'var(--ob-radius-md)',
                  padding: 4,
                }}
              >
                <button
                  onClick={handleCopyBox}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    padding: '6px 10px',
                    textAlign: 'left',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: theme.ink2,
                    fontFamily: ('var(--ob-font-sans)'),
                    fontSize: OB_TEXT.card,
                  }}
                >
                  <IconCopy size={14} />
                  Copia
                </button>
                <button
                  onClick={() => { handleDeleteTextBox(tbCtx.textBoxId); setTbCtx(null); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    padding: '6px 10px',
                    textAlign: 'left',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--ob-danger)',
                    fontFamily: ('var(--ob-font-sans)'),
                    fontSize: OB_TEXT.card,
                  }}
                >
                  <IconTrash size={14} />
                  Elimina
                </button>
              </div>
            </>,
            document.body
          )}

          {/* Paste context menu — tasto destro sullo sfondo con appunti attivi */}
          {pasteMenu && createPortal(
            <>
              <div className="fixed inset-0 z-[9998]" onClick={() => setPasteMenu(null)} onContextMenu={(e) => { e.preventDefault(); setPasteMenu(null); }} />
              <div
                className="fixed"
                style={{
                  top: pasteMenu.y,
                  left: pasteMenu.x,
                  zIndex: 9999,
                  width: 168,
                  background: theme.surface,
                  border: `1px solid ${theme.border}`,
                  boxShadow: 'var(--ob-shadow-card)',
                  borderRadius: 'var(--ob-radius-md)',
                  padding: 4,
                }}
              >
                <button
                  onClick={() => { handlePasteAt(pasteMenu.localX, pasteMenu.localY); setPasteMenu(null); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    padding: '6px 10px',
                    textAlign: 'left',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: theme.ink2,
                    fontFamily: ('var(--ob-font-sans)'),
                    fontSize: OB_TEXT.card,
                  }}
                >
                  <IconClipboard size={14} />
                  Incolla {clipboard?.kind === 'tile' ? 'tile' : clipboard?.kind === 'image' ? 'immagine' : 'testo'}
                </button>
              </div>
            </>,
            document.body
          )}

          {/* Group context menu — click/tasto destro sulla zona del gruppo senza tile */}
          {groupCtx && createPortal(
            (() => {
              const menuItem: React.CSSProperties = {
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '6px 10px',
                textAlign: 'left',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: theme.ink2,
                fontFamily: 'var(--ob-font-sans)',
                fontSize: OB_TEXT.card,
              };
              const group = canvasGroups.find((g) => g.id === groupCtx.groupId);
              return (
                <>
                  <div className="fixed inset-0 z-[9998]" onClick={() => setGroupCtx(null)} onContextMenu={(e) => { e.preventDefault(); setGroupCtx(null); }} />
                  <div
                    className="fixed"
                    style={{
                      top: groupCtx.y,
                      left: groupCtx.x,
                      zIndex: 9999,
                      width: 184,
                      background: theme.surface,
                      border: `1px solid ${theme.border}`,
                      boxShadow: 'var(--ob-shadow-card)',
                      borderRadius: 'var(--ob-radius-md)',
                      padding: 4,
                    }}
                  >
                    <button
                      onClick={() => { setRenameGroup({ id: groupCtx.groupId, name: group?.label || '' }); setGroupCtx(null); }}
                      style={menuItem}
                    >
                      <IconPencil size={14} />
                      Rinomina gruppo
                    </button>
                    <button
                      onClick={() => { handleDeleteGroup(groupCtx.groupId); setGroupCtx(null); }}
                      style={{ ...menuItem, color: 'var(--ob-danger)' }}
                    >
                      <IconTrash size={14} />
                      Elimina gruppo
                    </button>
                  </div>
                </>
              );
            })(),
            document.body
          )}

          {/* Rinomina gruppo — modale in stile Obsidian */}
          <Modal
            open={!!renameGroup}
            onClose={() => setRenameGroup(null)}
            title="Rinomina gruppo"
            maxWidth={380}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!renameGroup) return;
                handleRenameGroup(renameGroup.id, renameGroup.name);
                setRenameGroup(null);
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
            >
              <input
                autoFocus
                value={renameGroup?.name ?? ''}
                onChange={(e) => setRenameGroup((r) => r ? { ...r, name: e.target.value } : r)}
                placeholder="Nome del gruppo"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  background: theme.bg1,
                  border: `1px solid ${theme.border}`,
                  borderRadius: 'var(--ob-radius-sm)',
                  color: theme.ink,
                  fontFamily: 'var(--ob-font-sans)',
                  fontSize: OB_TEXT.control,
                  outline: 'none',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setRenameGroup(null)}
                  style={{
                    padding: '8px 14px',
                    background: 'transparent',
                    border: `1px solid ${theme.border}`,
                    borderRadius: 'var(--ob-radius-sm)',
                    color: theme.ink2,
                    fontFamily: 'var(--ob-font-sans)',
                    fontSize: OB_TEXT.control,
                    cursor: 'pointer',
                  }}
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 14px',
                    background: theme.accent,
                    border: `1px solid ${theme.accent}`,
                    borderRadius: 'var(--ob-radius-sm)',
                    color: theme.onAccent,
                    fontFamily: 'var(--ob-font-sans)',
                    fontSize: OB_TEXT.control,
                    fontWeight: OB_WEIGHT.emphasis,
                    cursor: 'pointer',
                  }}
                >
                  Salva
                </button>
              </div>
            </form>
          </Modal>

          {/* Edge context menu */}
          {edgeCtx && createPortal(
            <>
              <div className="fixed inset-0 z-[9998]" onClick={() => setEdgeCtx(null)} onContextMenu={(e) => { e.preventDefault(); setEdgeCtx(null); }} />
              <div
                className="fixed"
                style={{
                  top: edgeCtx.y,
                  left: edgeCtx.x,
                  zIndex: 9999,
                  width: 168,
                  background: theme.surface,
                  border: `1px solid ${theme.border}`,
                  boxShadow: 'var(--ob-shadow-card)',
                  borderRadius: 'var(--ob-radius-md)',
                  padding: 4,
                }}
              >
                <button
                  onClick={handleConfirmDeleteEdge}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    padding: '6px 10px',
                    textAlign: 'left',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--ob-danger)',
                    fontFamily: ('var(--ob-font-sans)'),
                    fontSize: OB_TEXT.card,
                  }}
                >
                  <IconTrash size={14} />
                  Delete
                </button>
              </div>
            </>,
            document.body
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          <CanvasTopbar
            tag={null}
            textMode={false}
            tileMode={false}
            imageMode={false}
            selectMode={false}
            onToggleTextMode={() => {}}
            onToggleTileMode={() => {}}
            onToggleImageMode={() => {}}
            onToggleSelectMode={() => {}}
            onFit={() => {}}
            onZoom100={() => {}}
            pinnedTags={pinnedTags}
            onPinnedTagClick={(id) => router.push(`/canvas?tag=${id}`)}
            onReorderPinned={handleReorderPinned}
            onUnpinTag={async (id) => {
              queryClient.setQueryData(['tags'], (old: any) => {
                if (!old?.data) return old;
                return { ...old, data: old.data.map((t: Tag) => t.id === id ? { ...t, is_pinned: false } : t) };
              });
              try { await tagsApi.update(id, { is_pinned: false }); }
              finally { queryClient.invalidateQueries({ queryKey: ['tags'] }); }
            }}
          />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 56,
                height: 56,
                background: theme.surfaceVariant,
                border: `1px solid ${theme.border}`,
                borderRadius: 14,
                color: theme.ink3,
              }}
            >
              <IconComponents size={28} strokeWidth={2} />
            </div>
            <p
              style={{
                fontFamily: 'var(--ob-font-mono)',
                fontSize: OB_TEXT.meta,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: theme.ink2,
                margin: 0,
              }}
            >
              Seleziona un tag dalla sidebar
            </p>
            <p style={{ fontFamily: ('var(--ob-font-sans)'), fontSize: OB_TEXT.meta, color: theme.ink3, margin: 0 }}>
              per aprire la lavagna
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
