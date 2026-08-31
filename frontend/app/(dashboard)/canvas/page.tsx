'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { IconComponents, IconTrash, IconCopy, IconBoxMultiple, IconBoxOff, IconInbox, IconClipboard, IconPencil, IconGridDots, IconSquareDashed, IconEraser } from '@tabler/icons-react';
import { usePixelTheme } from '@/components/pixel';
import { Modal } from '@/components/primitives/overlays';
import { tagsApi, canvasApi, tilesApi, uploadApi, contactsApi } from '@/lib/api';
import { contactRole, isOrganizationKind, KIND_FOR_ROLE } from '@/types/contact';
import { useContactMemberships, type ContactMembership } from '@/lib/hooks/useContacts';
import { CanvasTopbar } from '@/components/canvas/CanvasTopbar';
import { CanvasZoomControls } from '@/components/canvas/CanvasZoomControls';
import { CanvasBoard, type CanvasEdge, type EdgeArrow, type EdgeLabelAlign, type MarkerKind, MARKER_SIZE, DOT_STEP, type CanvasGroup, type CanvasTextBox, type CanvasBoxImageContent, type CanvasBoxMarkerContent, type CanvasContact, SUBJECT_SIZE, ORGANIZATION_SIZE, MARKER_SPEC, resolveMarkerKind } from '@/components/canvas/CanvasBoard';
import { tidy, type TidyRect } from '@/lib/canvas-tidy';
import { StagingPanel, STAGING_MIN_W } from '@/components/canvas/StagingPanel';
import { PdfExportPanel } from '@/components/canvas/PdfExportPanel';
import { CanvasPrintSheet } from '@/components/canvas/CanvasPrintSheet';
import { planPaper, type PaperFormat, type PaperOrientation } from '@/lib/paper';
import { TILE_W, TILE_H } from '@/lib/tile-visual';
import { GroupSidebar } from '@/components/canvas/GroupSidebar';
import { TextSidebar } from '@/components/canvas/TextSidebar';
import { ImageSidebar } from '@/components/canvas/ImageSidebar';
import { MarkerSidebar } from '@/components/canvas/MarkerSidebar';
import { ContactSidebar } from '@/components/canvas/ContactSidebar';
import { ContactPicker } from '@/components/canvas/ContactPicker';
import { EdgeSidebar } from '@/components/canvas/EdgeSidebar';
import { TileSidebar } from '@/components/tileview/TileSidebar';
import { MultiTileSidebar } from '@/components/tileview/MultiTileSidebar';
import { useTypeIcons } from '@/store/type-icons-store';
import { useIsomorphicLayoutEffect } from '@/lib/use-isomorphic-layout-effect';
import type { Tag, Tile } from '@/types';
import { OB_WEIGHT, OB_TEXT } from '@/lib/theme/ob-typography';

/**
 * Prima riga leggibile di una nota, per elencarla dove l'HTML non ci sta: la
 * lista dei membri di un gruppo. Un'immagine ha una miniatura, un testo no —
 * e «Box di testo» ripetuto cinque volte non distingue i cinque.
 */
function boxTextPreview(html: string | undefined): string {
  const plain = (html || '')
    // I blocchi che finiscono diventano uno spazio, altrimenti l'ultima parola
    // di un paragrafo si incolla alla prima del successivo.
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6])>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
  return plain || 'Nota vuota';
}

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
  // I marcatori rientrano qui come qualunque altro box: il ramo di incollaggio
  // dei box è già generico (tipo, contenuto e misure del sorgente), quindi non
  // ha avuto bisogno di sapere che esistono.
  const [clipboard, setClipboard] = useState<{ kind: 'tile' | 'text' | 'image' | 'marker' | 'subject' | 'organization'; id: string } | null>(null);
  // Menu contestuale "Incolla" sullo sfondo del canvas (posizione + coord locali).
  const [pasteMenu, setPasteMenu] = useState<{ x: number; y: number; localX: number; localY: number } | null>(null);
  const [imageMode, setImageMode] = useState(false);
  /** Tipo di marcatore armato dalla barra, o null. */
  const [markerMode, setMarkerMode] = useState<MarkerKind | null>(null);
  const [subjectMode, setSubjectMode] = useState(false);
  const [organizationMode, setOrganizationMode] = useState(false);
  // Modalità "Seleziona a contorno": il drag sullo sfondo disegna un rettangolo
  // di selezione (sinistra→destra = tile contenuti; destra→sinistra = intersecati).
  const [selectMode, setSelectMode] = useState(false);
  // ─── FOGLIO (esporta in PDF) ───────────────────────────────────────────────
  // `pdfMode` arma il gesto, `pdfArea` è l'area cerchiata (coordinate canvas).
  // Formato e orientamento restano NULL finché non li imponi tu: null non vuol
  // dire "vuoto", vuol dire "lo decide l'area" — vedi lib/paper.ts.
  const [pdfMode, setPdfMode] = useState(false);
  const [pdfArea, setPdfArea] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [pdfFormat, setPdfFormat] = useState<PaperFormat | null>(null);
  const [pdfOrientation, setPdfOrientation] = useState<PaperOrientation | null>(null);
  const [printing, setPrinting] = useState(false);
  // La radice della board: la stampa la clona per impaginarla sul foglio.
  const boardRootRef = useRef<HTMLDivElement | null>(null);
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
    arrow: e.arrow ?? null,
    arrowSize: e.arrow_size ?? null,
    labelAlign: e.label_align ?? null,
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

  /** Sfila dei membri (tile o `tb:<id>` per le immagini) da ogni gruppo; i
   *  gruppi che restano con meno di 2 membri si sciolgono. Serve sia all'azione
   *  "Ungroup" sia alla cancellazione, che altrimenti lascerebbe id fantasma
   *  dentro i gruppi. */
  const removeFromGroups = useCallback((memberIds: string[]) => {
    const idSet = new Set(memberIds);
    const stripped = canvasGroups.map((g) => ({ ...g, nodeIds: g.nodeIds.filter((nid) => !idSet.has(nid)) }));
    // Niente giro in rete se nessun gruppo era coinvolto.
    if (!stripped.some((g, i) => g.nodeIds.length !== canvasGroups[i].nodeIds.length)) return;
    handleGroupsChange(stripped.filter((g) => g.nodeIds.length >= 2));
  }, [canvasGroups, handleGroupsChange]);

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
      // Un errore qui era MUTO: l'edge compariva e spariva, e sembrava un
      // collegamento "che non resta" invece di un salvataggio fallito. È così
      // che il rifiuto del database sugli endpoint non-tile (immagini, note,
      // gruppi) è passato inosservato — vedi migration 041.
      toast.error('Collegamento non salvato');
    }
  }, [tagId, queryClient]);

  /**
   * INNESTO — A→B diventa A→X e X→B, con X l'oggetto lasciato cadere sopra.
   *
   * I due mezzi EREDITANO lo stile del collegamento spezzato (colore, tratto,
   * spessore, freccia, misura della punta, disposizione del testo): quello che
   * si sta facendo è infilare una tappa in un percorso, non sostituirlo con due
   * collegamenti nuovi che ricominciano dai valori di fabbrica.
   *
   * L'ETICHETTA no: resta sul primo mezzo. Duplicarla avrebbe scritto due volte
   * la stessa parola a pochi pixel di distanza, e cancellarla avrebbe perso un
   * testo che l'utente aveva battuto a mano.
   *
   * Le porte esterne si conservano (A tiene la sua, B la sua); quelle nuove, sui
   * due capi che toccano l'oggetto, restano libere: il marcatore è tondo e la
   * scelta migliore la fa già `findBestPorts` in base a dove si trova.
   */
  const handleSplitEdge = useCallback(async (edgeId: string, nodeId: string) => {
    if (!tagId) return;
    const list = ((queryClient.getQueryData(['canvas-edges', tagId]) as any)?.data || []) as any[];
    const e = list.find((x) => x.id === edgeId);
    if (!e) return;
    // Lo stile viaggia in snake_case: è la forma in cui la cache tiene gli edge
    // (arrivano così dall'API) ed è quella che la PATCH si aspetta.
    const style = {
      color: e.color ?? null,
      line_style: e.line_style ?? null,
      line_width: e.line_width ?? null,
      arrow: e.arrow ?? null,
      arrow_size: e.arrow_size ?? null,
      label_align: e.label_align ?? null,
    };
    const stamp = Date.now();
    const tempA = `temp-split-a-${stamp}`;
    const tempB = `temp-split-b-${stamp}`;
    queryClient.setQueryData(['canvas-edges', tagId], (old: any) => ({
      data: [
        ...(old?.data || []).filter((x: any) => x.id !== edgeId),
        { id: tempA, source_id: e.source_id, target_id: nodeId, source_port: e.source_port, ...style, label: e.label ?? null },
        { id: tempB, source_id: nodeId, target_id: e.target_id, target_port: e.target_port, ...style, label: null },
      ],
    }));

    const [ra, rb] = await Promise.all([
      canvasApi.addEdge(tagId, e.source_id, nodeId, e.source_port, undefined),
      canvasApi.addEdge(tagId, nodeId, e.target_id, undefined, e.target_port),
    ]);
    const a = ra?.success ? (ra.data as any) : null;
    const b = rb?.success ? (rb.data as any) : null;

    if (!a || !b) {
      // Rimettiamo l'edge com'era. Un mezzo che fosse passato va tolto anche dal
      // server: lasciarlo darebbe un collegamento che nessuno ha chiesto, in più
      // a un edge che è ancora intero.
      queryClient.setQueryData(['canvas-edges', tagId], (old: any) => ({
        data: [...(old?.data || []).filter((x: any) => x.id !== tempA && x.id !== tempB), e],
      }));
      if (a) canvasApi.deleteEdge(a.id);
      if (b) canvasApi.deleteEdge(b.id);
      toast.error(ra?.error || rb?.error || 'Innesto non riuscito');
      return;
    }

    queryClient.setQueryData(['canvas-edges', tagId], (old: any) => ({
      data: (old?.data || []).map((x: any) =>
        x.id === tempA ? { ...x, id: a.id } : x.id === tempB ? { ...x, id: b.id } : x),
    }));
    // Lo stile non viaggia con la POST (che porta solo gli estremi): si scrive
    // subito dopo, e senza debounce — qui non c'è una mano che continua a
    // muovere un cursore, è una scrittura sola.
    canvasApi.updateEdge(a.id, { ...style, label: e.label ?? null });
    canvasApi.updateEdge(b.id, style);
    // Il vecchio se ne va per ULTIMO: fin qui, se qualcosa fosse andato storto,
    // il collegamento originale esisteva ancora sul server e si poteva rimettere.
    await canvasApi.deleteEdge(edgeId);
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
  /**
   * Salvataggi degli edge, rimandati di 500ms — UNO SPORTELLO PER EDGE, e con
   * gli aggiornamenti dello stesso edge che si SOMMANO.
   *
   * Stessa correzione fatta per i box: era un timer solo per tutti, quindi
   * scegliere il colore e poi la freccia entro mezzo secondo mandava al server
   * la sola freccia. Sullo schermo si vedeva tutto giusto — la cache si scrive
   * subito — e la perdita saltava fuori solo al ricaricamento.
   */
  const edgeUpdateTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const edgePending = useRef<Map<string, Record<string, unknown>>>(new Map());
  const handleUpdateEdge = useCallback((id: string, patch: { color?: string | null; lineStyle?: 'solid' | 'dashed' | 'dotted' | null; lineWidth?: number | null; label?: string | null; arrow?: EdgeArrow | null; arrowSize?: number | null; labelAlign?: EdgeLabelAlign | null }) => {
    if (!tagId) return;
    const snake: Record<string, unknown> = {};
    if ('color' in patch) snake.color = patch.color ?? null;
    if ('lineStyle' in patch) snake.line_style = patch.lineStyle ?? null;
    if ('lineWidth' in patch) snake.line_width = patch.lineWidth ?? null;
    if ('label' in patch) snake.label = patch.label ?? null;
    if ('arrow' in patch) snake.arrow = patch.arrow ?? null;
    if ('arrowSize' in patch) snake.arrow_size = patch.arrowSize ?? null;
    if ('labelAlign' in patch) snake.label_align = patch.labelAlign ?? null;
    queryClient.setQueryData(['canvas-edges', tagId], (old: any) => ({
      data: (old?.data || []).map((e: any) => e.id === id ? { ...e, ...snake } : e),
    }));
    const merged = { ...(edgePending.current.get(id) ?? {}), ...snake };
    edgePending.current.set(id, merged);
    const running = edgeUpdateTimers.current.get(id);
    if (running) clearTimeout(running);
    edgeUpdateTimers.current.set(id, setTimeout(() => {
      const payload = edgePending.current.get(id);
      edgePending.current.delete(id);
      edgeUpdateTimers.current.delete(id);
      if (payload) canvasApi.updateEdge(id, payload);
    }, 500));
  }, [tagId, queryClient]);

  // ── Boxes (text/image, polymorphic) ──
  const { data: boxesData } = useQuery({
    queryKey: ['canvas-boxes', tagId],
    queryFn: () => canvasApi.getBoxes(tagId!),
    enabled: !!tagId,
    staleTime: 60 * 1000,
  });
  const textBoxes = useMemo(() => (boxesData?.data || []) as unknown as CanvasTextBox[], [boxesData]);

  // ── L'ANAGRAFICA ───────────────────────────────────────────────
  //
  // Soggetti e organizzazioni non contengono i propri dati: puntano una riga di
  // `contacts` (migration 048). Sono la stessa rubrica dei passi dei tile e
  // della modale dei contatti — una persona, un posto solo.
  //
  // La chiave NON è legata al tag: la rubrica è dell'utente, non della lavagna,
  // e passando da un canvas all'altro non ha motivo di essere riscaricata.
  const { data: contactsData } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => contactsApi.list(),
    staleTime: 60 * 1000,
  });
  const contacts = useMemo(
    () => ((contactsData?.data || []) as unknown as CanvasContact[]),
    [contactsData],
  );
  // La definizione sta in `useContactMemberships`, non qui: questa chiave è
  // condivisa con la tabella dei contatti, e due `queryFn` diverse sulla stessa
  // chiave si sovrascrivono a vicenda in cache — vedi la nota sul hook.
  const { data: membershipsData } = useContactMemberships();
  const memberships = useMemo(() => membershipsData ?? [], [membershipsData]);
  /** Le organizzazioni fra cui si può scegliere: i contatti che sono un
   *  INSIEME, non un individuo.
   *
   *  La regola arriva da `types/contact.ts` e non è riscritta qui: la usano
   *  anche la tabella dei contatti e il suo selettore Tipo, e tre copie
   *  sarebbero divergenti al primo `kind` aggiunto. È una convenzione
   *  dell'interfaccia e non un vincolo del modello — vedi la migration 047. */
  const organizationContacts = useMemo(
    () => contacts.filter((c) => isOrganizationKind(c.kind)),
    [contacts],
  );
  /** I contatti già puntati da una figura di QUESTA lavagna. Il selettore li
   *  mostra spenti: due figure per la stessa persona sarebbero due segni che si
   *  rinominano a vicenda, e nessuno dei due direbbe qual è quello buono. */
  const contactsOnBoard = useMemo(
    () => textBoxes
      .filter((b) => b.type === 'subject' || b.type === 'organization')
      .map((b) => (b as { contact_id?: string | null }).contact_id)
      .filter((id): id is string => !!id),
    [textBoxes],
  );
  // Box di TESTO attualmente selezionato → alimenta la TextSidebar destra.
  const selectedTextBox = useMemo(
    () => textBoxes.find((b) => b.id === selectedTextBoxId && b.type === 'text') || null,
    [textBoxes, selectedTextBoxId],
  );
  // SOGGETTO o ORGANIZZAZIONE selezionati → ContactSidebar. Un pannello solo
  // per i due: dietro c'è la stessa riga di rubrica, e cambia il vocabolario.
  // Il predicato è un TYPE GUARD e non un semplice booleano: senza, il risultato
  // resterebbe l'unione di tutti i tipi di box e `contact_id` — che esiste solo
  // sui due dell'anagrafica — non sarebbe leggibile.
  const selectedContactBox = useMemo(
    () => textBoxes.find(
      (b): b is Extract<CanvasTextBox, { type: 'subject' | 'organization' }> =>
        b.id === selectedTextBoxId && (b.type === 'subject' || b.type === 'organization'),
    ) || null,
    [textBoxes, selectedTextBoxId],
  );
  // MARCATORE selezionato → MarkerSidebar (didascalia sotto il disco).
  const selectedMarkerBox = useMemo(
    () => textBoxes.find((b) => b.id === selectedTextBoxId && b.type === 'marker') || null,
    [textBoxes, selectedTextBoxId],
  );
  // Box IMMAGINE selezionato → ImageSidebar (titolo, note, mostra titolo).
  const selectedImageBox = useMemo(
    () => textBoxes.find((b) => b.id === selectedTextBoxId && b.type === 'image') || null,
    [textBoxes, selectedTextBoxId],
  );

  /**
   * Chiude una scrittura ottimistica: la riga provvisoria diventa quella vera,
   * oppure sparisce E DICE PERCHÉ.
   *
   * ⚠️ Esiste per una ragione precisa: `apiRequest` (lib/api.ts) NON LANCIA
   * MAI. Gli errori del server — e anche quelli di rete — tornano come valore,
   * `{ success: false, error }`. I quattro punti che posano un box si
   * affidavano tutti a un `catch` che quindi non scattava mai, e a un
   * `if (res?.data)` senza ramo else: quando l'insert falliva, la riga
   * provvisoria restava sullo schermo con il suo id finto, senza un avviso, e
   * spariva al primo reload. Da fuori è indistinguibile da «l'oggetto non è
   * persistente», ed è esattamente come si è presentato.
   */
  const commitBox = useCallback((
    tempId: string,
    res: { success?: boolean; data?: unknown; error?: string } | undefined,
    fallback: string,
  ) => {
    if (res?.success && res.data) {
      const d = res.data as any;
      queryClient.setQueryData(['canvas-boxes', tagId], (old: any) => ({
        data: (old?.data || []).map((b: any) => (b.id === tempId ? d : b)),
      }));
      return true;
    }
    queryClient.setQueryData(['canvas-boxes', tagId], (old: any) => ({
      data: (old?.data || []).filter((b: any) => b.id !== tempId),
    }));
    toast.error(res?.error || fallback);
    return false;
  }, [tagId, queryClient]);

  const handleAddTextBox = useCallback(async (x: number, y: number, w: number, h: number) => {
    if (!tagId) return;
    setTextMode(false);
    const tempId = `temp-tb-${Date.now()}`;
    queryClient.setQueryData(['canvas-boxes', tagId], (old: any) => ({
      data: [...(old?.data || []), { id: tempId, type: 'text', content: { html: '' }, x, y, w, h }],
    }));
    commitBox(tempId, await canvasApi.addBox(tagId, { type: 'text', content: { html: '' }, x, y, w, h }), 'Box di testo non salvato');
  }, [tagId, queryClient, commitBox]);

  /**
   * Salvataggi dei box, rimandati di 800ms — UNO SPORTELLO PER BOX.
   *
   * Era un timer solo per tutti: ogni chiamata azzerava quella prima, quindi di
   * due box toccati nello stesso secondo ne arrivava al server uno soltanto, e
   * dello stesso box una PATCH di posizione cancellava quella di testo. Con
   * l'espansione dei box il caso è diventato ordinario: si espande, il
   * salvataggio del testo che era già in coda porta via l’altezza, e al
   * ricaricamento la nota torna piccola.
   *
   * Gli aggiornamenti dello stesso box si SOMMANO invece di sostituirsi: due
   * chiamate ravvicinate (`{ h }` e poi `{ content }`) devono partire come una
   * PATCH sola con dentro entrambi i campi, o il secondo campo va perso.
   */
  type BoxUpdate = { type?: 'text' | 'image'; content?: Record<string, unknown>; x?: number; y?: number; w?: number; h?: number };
  const tbUpdateTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const tbPending = useRef<Map<string, BoxUpdate>>(new Map());
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
    const merged: BoxUpdate = { ...(tbPending.current.get(id) ?? {}), ...updates };
    tbPending.current.set(id, merged);
    const running = tbUpdateTimers.current.get(id);
    if (running) clearTimeout(running);
    tbUpdateTimers.current.set(id, setTimeout(() => {
      const payload = tbPending.current.get(id);
      tbPending.current.delete(id);
      tbUpdateTimers.current.delete(id);
      if (payload) canvasApi.updateBox(id, payload);
    }, 800));
  }, [tagId, queryClient]);

  /**
   * Posa un marcatore. Scrittura ottimistica come per gli altri box: compare
   * subito con un id provvisorio, che viene sostituito da quello vero appena il
   * server risponde — e tolto se rifiuta.
   *
   * UN CLICK, UN OGGETTO: lo strumento si disarma appena l'oggetto è posato.
   *
   * Restare armato voleva dire che il click successivo sulla lavagna posava un
   * altro oggetto invece di fare quello che fa sempre — selezionare, deselezionare,
   * cominciare un trascinamento. Uno strumento che cambia il significato del
   * click e ci resta è una modalità nascosta: si nota solo dall'oggetto di
   * troppo che si è appena messo per sbaglio.
   *
   * Il menu degli oggetti però NON si chiude: la voce si spegne e resta lì, così
   * riarmare costa un click solo. Tre marcatori di fila fanno sei click —
   * scegli, posa, scegli, posa — e ogni posa è deliberata.
   *
   * Il disarmo è la PRIMA cosa che succede, prima ancora della scrittura
   * ottimistica: se aspettasse il server, i click battuti nel frattempo
   * avrebbero posato altri oggetti.
   */
  const handleAddMarkerAt = useCallback(async (x: number, y: number, kind: MarkerKind, splitEdgeId?: string) => {
    if (!tagId) return;
    setMarkerMode(null);
    const payload = { type: 'marker' as const, content: { kind }, x, y, w: MARKER_SIZE, h: MARKER_SIZE };
    const tempId = `temp-marker-${Date.now()}`;
    queryClient.setQueryData(['canvas-boxes', tagId], (old: any) => ({
      data: [...(old?.data || []), { id: tempId, ...payload }],
    }));
    const res = await canvasApi.addBox(tagId, payload);
    if (!commitBox(tempId, res, 'Marcatore non salvato')) return;
    // INNESTO al volo: l'oggetto è stato posato su un edge armato. Si spezza
    // ADESSO e non prima, perché l'id con cui i due mezzi si aggancieranno nasce
    // qui — la lavagna, al momento del click, aveva solo un ghost.
    const newId = (res?.data as any)?.id;
    if (splitEdgeId && newId) handleSplitEdge(splitEdgeId, `tb:${newId}`);
  }, [tagId, queryClient, commitBox, handleSplitEdge]);

  /**
   * Posa un SOGGETTO o un'ORGANIZZAZIONE su un contatto GIÀ DECISO.
   *
   * Il box porta una foreign key, quindi il contatto deve esistere prima: chi
   * chiama o ne ha scelto uno dall'elenco, o ne ha appena creato uno. Non c'è
   * scrittura ottimistica come per gli altri box — l'id lo decide il server, e
   * disegnare la figura prima di averlo vorrebbe dire disegnare qualcosa che non
   * sa ancora chi è.
   *
   * Il pannello si apre da solo sul nuovo nato: il nome ce l'ha già, ma mail,
   * telefono e appartenenze sono quello che si sta per scrivere.
   */
  const placeContactBox = useCallback(async (
    x: number, y: number,
    variant: 'subject' | 'organization',
    contactId: string,
  ) => {
    if (!tagId) return;
    const isOrg = variant === 'organization';
    const size = isOrg ? ORGANIZATION_SIZE : SUBJECT_SIZE;
    const res = await canvasApi.addBox(tagId, {
      type: variant, content: {}, x, y, w: size, h: size, contact_id: contactId,
    });
    const newId = (res?.data as any)?.id;
    if (!newId) { toast.error(isOrg ? 'Organizzazione non salvata' : 'Soggetto non salvato'); return; }
    queryClient.invalidateQueries({ queryKey: ['canvas-boxes', tagId] });

    // Il pannello si apre sul nuovo nato, e su nient'altro.
    setSelectedTextBoxId(newId);
    setSelectedTileId(null);
    setSelectedGroupId(null);
    setSelectedEdgeId(null);
    setSelectedIds([]);
    setSelectionBbox(null);
    setSidebarOpen(true);
  }, [tagId, queryClient]);

  /**
   * LA DOMANDA APERTA: dove si è cliccato, e che cosa si stava posando.
   *
   * Fra il click e la figura c'è ora un passaggio: di CHI si tratta. Prima non
   * c'era, e ogni click fabbricava una riga nuova in rubrica chiamata «Soggetto
   * senza nome» — il che voleva dire che la stessa persona posata su due
   * lavagne diventava due persone, e che un click andato a vuoto lasciava un
   * senza nome in rubrica per sempre.
   *
   * Finché questo stato è pieno non è stato scritto NIENTE, né il box né il
   * contatto: annullare è davvero annullare.
   */
  const [pendingContact, setPendingContact] = useState<
    { variant: 'subject' | 'organization'; x: number; y: number; sx: number; sy: number } | null
  >(null);

  const handleAddSubjectAt = useCallback((x: number, y: number, at: { clientX: number; clientY: number }) => {
    setSubjectMode(false);
    setPendingContact({ variant: 'subject', x, y, sx: at.clientX, sy: at.clientY });
  }, []);

  const handleAddOrganizationAt = useCallback((x: number, y: number, at: { clientX: number; clientY: number }) => {
    setOrganizationMode(false);
    setPendingContact({ variant: 'organization', x, y, sx: at.clientX, sy: at.clientY });
  }, []);

  /** Risposta «questo qui»: si posa e basta, in rubrica non cambia niente. */
  const handlePickContact = useCallback((contactId: string) => {
    const pend = pendingContact;
    setPendingContact(null);
    if (pend) placeContactBox(pend.x, pend.y, pend.variant, contactId);
  }, [pendingContact, placeContactBox]);

  /** Risposta «uno nuovo, si chiama così»: prima la riga in rubrica, poi il
   *  segno che la punta. L'ordine non è negoziabile, è una foreign key. */
  const handleCreateContact = useCallback(async (name: string) => {
    const pend = pendingContact;
    setPendingContact(null);
    if (!pend) return;
    const isOrg = pend.variant === 'organization';
    const created = await contactsApi.create({
      name, kind: KIND_FOR_ROLE[isOrg ? 'organization' : 'subject'],
    });
    const contactId = (created?.data as any)?.id as string | undefined;
    if (!contactId) { toast.error(isOrg ? 'Organizzazione non creata' : 'Soggetto non creato'); return; }
    queryClient.invalidateQueries({ queryKey: ['contacts'] });
    await placeContactBox(pend.x, pend.y, pend.variant, contactId);
  }, [pendingContact, placeContactBox, queryClient]);

  /**
   * I campi dell'anagrafica che si DIGITANO, con lo stesso ritardo dei campi di
   * un box (`handleBoxFieldChange`): specchio in cache subito, salvataggio a
   * fine battuta.
   *
   * Un salvataggio a tasto avrebbe fatto una PATCH per lettera; senza specchio,
   * il nome sotto la figura sarebbe comparso solo alla fine.
   *
   * ⚠️ Scrive sulla RUBRICA, non sul box: rinominare da qui cambia quel contatto
   * ovunque compaia. È il punto di averli in un posto solo, ma va saputo.
   */
  /** I soli campi dell'anagrafica che il canvas modifica. `kind` e il resto si
   *  cambiano dalla rubrica, che è dove si vede l'effetto sull'intera app. */
  type ContactFields = Partial<Record<'name' | 'email' | 'phone' | 'notes', string>>;
  const contactFieldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contactFieldPending = useRef<{ id: string; patch: ContactFields } | null>(null);

  const flushContactField = useCallback(() => {
    if (contactFieldTimer.current) { clearTimeout(contactFieldTimer.current); contactFieldTimer.current = null; }
    const pending = contactFieldPending.current;
    contactFieldPending.current = null;
    if (!pending) return;
    contactsApi.update(pending.id, pending.patch as ContactFields)
      // Prefisso `['contacts']`, non la chiave esatta: la tabella dei contatti
      // tiene la sua lista sotto `['contacts', { archived }]`, e senza questo
      // un nome cambiato dalla lavagna restava vecchio là dentro fino al
      // prossimo giro. La rubrica è una sola: deve leggersi uguale ovunque.
      .then(() => queryClient.invalidateQueries({ queryKey: ['contacts'] }))
      .catch(() => toast.error('Modifica al contatto non salvata'));
  }, [queryClient]);

  const handleContactFieldChange = useCallback((id: string, patch: ContactFields) => {
    // Altro contatto rispetto a quello in attesa → prima si chiude il conto col
    // precedente, così non perde l'ultima riga scritta.
    if (contactFieldPending.current && contactFieldPending.current.id !== id) flushContactField();
    contactFieldPending.current = { id, patch: { ...(contactFieldPending.current?.patch || {}), ...patch } };
    queryClient.setQueryData(['contacts'], (old: any) =>
      old?.data ? { ...old, data: old.data.map((c: any) => (c.id === id ? { ...c, ...patch } : c)) } : old,
    );
    if (contactFieldTimer.current) clearTimeout(contactFieldTimer.current);
    contactFieldTimer.current = setTimeout(flushContactField, 400);
  }, [queryClient, flushContactField]);

  // Uscire dal canvas mentre si scrive non deve costare l'ultima modifica.
  useEffect(() => () => { flushContactField(); }, [flushContactField]);

  /**
   * Sposta una figura su un ALTRO contatto.
   *
   * Non tocca la rubrica: cambia a chi punta il box. Il contatto lasciato resta
   * dov'era, con tutto quello che ha — può essere su altre lavagne, e questa non
   * ha titolo per cancellarlo.
   *
   * Serve dopo il fatto: la scelta «chi è» si fa posando (vedi `ContactPicker`),
   * ma una figura posata sulla persona sbagliata non deve costare cancellarla e
   * rifarla — le linee che le arrivano non sopravvivrebbero.
   */
  const handleRelinkContactBox = useCallback(async (boxId: string, contactId: string) => {
    if (!tagId) return;
    const res = await canvasApi.updateBox(boxId, { contact_id: contactId });
    if (!res?.success) { toast.error('Collegamento non aggiornato'); return; }
    queryClient.invalidateQueries({ queryKey: ['canvas-boxes', tagId] });
  }, [tagId, queryClient]);

  /**
   * L'ELIMINAZIONE VERA, quella dalla rubrica — in attesa di conferma.
   *
   * Sulla figura di un soggetto ci sono due gesti che si somigliano e non lo
   * sono affatto: togliere il segno da questa lavagna, e cancellare la persona.
   * Il primo è un ripensamento sul disegno; il secondo tocca dati che vivono
   * fuori di qui, e `canvas_boxes.contact_id` è ON DELETE CASCADE — la stessa
   * persona sparisce da OGNI lavagna in cui è posata, non solo da questa.
   *
   * Per questo il secondo non parte dal menu: apre una finestra che dice che
   * cosa sta per succedere, e la si conferma lì. Due passaggi, e il secondo con
   * i conti in mano.
   */
  const [deleteContact, setDeleteContact] = useState<
    { boxId: string; contactId: string; name: string; isOrg: boolean } | null
  >(null);

  const handleDeleteContactEverywhere = useCallback(async () => {
    const pend = deleteContact;
    if (!pend) return;
    setDeleteContact(null);
    const res = await contactsApi.remove(pend.contactId);
    if (!res?.success) { toast.error('Contatto non eliminato'); return; }
    // La cascata sul database ha già portato via i box: qui si rilegge.
    queryClient.invalidateQueries({ queryKey: ['contacts'] });
    queryClient.invalidateQueries({ queryKey: ['contact-memberships'] });
    if (tagId) queryClient.invalidateQueries({ queryKey: ['canvas-boxes', tagId] });
    setSelectedTextBoxId(null);
    toast.success(`${pend.name} eliminato dalla rubrica`);
  }, [deleteContact, tagId, queryClient]);

  /** Sostituisce le organizzazioni di un contatto. L'insieme intero, non
   *  un'aggiunta: è la forma del gesto e quella dell'endpoint. */
  const handleSetOrganizations = useCallback(async (contactId: string, orgIds: string[]) => {
    queryClient.setQueryData<ContactMembership[]>(['contact-memberships'], (old) => [
      ...(old ?? []).filter((m) => m.member_id !== contactId),
      ...orgIds.map((org_id) => ({ member_id: contactId, org_id })),
    ]);
    try { await contactsApi.setOrganizations(contactId, orgIds); }
    catch {
      toast.error('Appartenenze non salvate');
      queryClient.invalidateQueries({ queryKey: ['contact-memberships'] });
    }
  }, [queryClient]);

  const handleDeleteTextBox = useCallback(async (id: string) => {
    if (!tagId) return;
    queryClient.setQueryData(['canvas-boxes', tagId], (old: any) => ({
      data: (old?.data || []).filter((tb: any) => tb.id !== id),
    }));
    // Un'immagine può essere membro di un gruppo: va sfilata, altrimenti il
    // gruppo resta con un id che non corrisponde a niente.
    removeFromGroups([`tb:${id}`]);
    await canvasApi.deleteBox(id);
  }, [tagId, queryClient, removeFromGroups]);

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

  // Stile (colore sfondo / dimensione font) e flag: azioni discrete → specchio
  // in cache immediato (aggiornamento istantaneo sul canvas) + save debounced.
  const handleTextBoxStylePatch = useCallback((id: string, patch: Record<string, unknown>) => {
    if (!tagId) return;
    queryClient.setQueryData(['canvas-boxes', tagId], (old: any) => ({
      data: (old?.data || []).map((tb: any) => tb.id === id ? { ...tb, content: { ...(tb.content || {}), ...patch } } : tb),
    }));
    scheduleBoxSave(id);
  }, [tagId, queryClient, scheduleBoxSave]);

  // ── Campi che si DIGITANO (titolo e note dell'immagine) ───────────────────
  // Ogni scrittura in cache ricostruisce l'SVG del canvas: si aspetta la fine
  // della digitazione. Specchio e salvataggio sono UN SOLO commit, non due
  // timer separati: con due, il debounce condiviso fra box diversi poteva
  // salvare il contenuto vecchio di un box e buttare via le sue ultime battute.
  const tbFieldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tbFieldPending = useRef<{ id: string; patch: Record<string, unknown> } | null>(null);

  /** Scrive in cache la patch in attesa e la salva. */
  const flushBoxField = useCallback(() => {
    if (tbFieldTimer.current) { clearTimeout(tbFieldTimer.current); tbFieldTimer.current = null; }
    const pending = tbFieldPending.current;
    tbFieldPending.current = null;
    if (!pending || !tagId) return;
    let merged: Record<string, unknown> | null = null;
    queryClient.setQueryData(['canvas-boxes', tagId], (old: any) => ({
      data: (old?.data || []).map((tb: any) => {
        if (tb.id !== pending.id) return tb;
        merged = { ...(tb.content || {}), ...pending.patch };
        return { ...tb, content: merged };
      }),
    }));
    // Il PATCH rimpiazza `content` per intero: si manda quello fuso, mai la
    // sola patch.
    if (merged) canvasApi.updateBox(pending.id, { content: merged });
  }, [tagId, queryClient]);

  const handleBoxFieldChange = useCallback((id: string, patch: Record<string, unknown>) => {
    if (!tagId) return;
    // Altro box rispetto a quello in attesa → prima si chiude il conto col
    // precedente, così non perde l'ultima riga scritta.
    if (tbFieldPending.current && tbFieldPending.current.id !== id) flushBoxField();
    tbFieldPending.current = { id, patch: { ...(tbFieldPending.current?.patch || {}), ...patch } };
    if (tbFieldTimer.current) clearTimeout(tbFieldTimer.current);
    tbFieldTimer.current = setTimeout(flushBoxField, 400);
  }, [tagId, flushBoxField]);

  // Uscire dal canvas mentre si scrive non deve costare l'ultima modifica.
  useEffect(() => () => { flushBoxField(); }, [flushBoxField]);

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
      commitBox(tempId, await canvasApi.addBox(tagId, { type: 'image', content: { src }, x, y, w: finalW, h: finalH }), 'Immagine non salvata');
    } catch (err: any) {
      // Resta un `catch` vero: qui dentro c'è anche l'UPLOAD del file, che
      // passa da un'altra strada e può lanciare davvero.
      toast.error(err?.message || 'Errore inserimento immagine');
    }
  }, [tagId, queryClient, commitBox]);

  // Text box context menu
  const [tbCtx, setTbCtx] = useState<{ x: number; y: number; textBoxId: string; inGroup: boolean } | null>(null);

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

  // Incolla l'elemento negli appunti nel punto (coord locali canvas). Il tile ha
  // un ramo suo (va creato come riga, taggato e messo a layout); ogni BOX —
  // testo, immagine, marcatore, soggetto — passa dallo stesso ramo generico:
  // si replicano `type`, `content` e le misure, e non c'è niente da sapere sul
  // tipo. Gli appunti restano attivi → si può incollare più volte finché non si
  // copia altro o si preme Esc.
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
      // Box di qualunque tipo: replica contenuto e dimensioni del sorgente.
      const src = textBoxes.find((b) => b.id === id);
      if (!src) return;
      // `contact_id` viaggia con la copia: incollare un soggetto rimette la
      // STESSA persona in un altro punto, non ne fabbrica una gemella. Due
      // schede della stessa persona in rubrica sarebbero un doppione nato da un
      // gesto che di anagrafica non parlava.
      const payload = {
        type: kind, content: src.content as Record<string, unknown>,
        x: localX, y: localY, w: src.w, h: src.h,
        contact_id: (src as { contact_id?: string | null }).contact_id ?? null,
      };
      const tempId = `temp-paste-${Date.now()}`;
      queryClient.setQueryData(['canvas-boxes', tagId], (old: any) => ({
        data: [...(old?.data || []), { id: tempId, ...payload }],
      }));
      commitBox(tempId, await canvasApi.addBox(tagId, payload), 'Copia non salvata');
    }
  }, [tagId, clipboard, tiles, tags, textBoxes, typeTileIcons, assignTypeIcon, queryClient, commitBox]);

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

  // Esc disarma +Tile, svuota gli appunti e chiude i pannelli al volo.
  useEffect(() => {
    if (!tileMode && !subjectMode && !organizationMode && !clipboard && !pasteMenu && !pendingContact) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setTileMode(false); setMarkerMode(null); setSubjectMode(false); setOrganizationMode(false); setClipboard(null); setPasteMenu(null); setPendingContact(null); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [tileMode, subjectMode, organizationMode, clipboard, pasteMenu, pendingContact]);

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
    // Gli elementi cancellati escono anche dai gruppi che li contenevano.
    removeFromGroups([...allEndpoints]);
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
  }, [selectedIds, selectedTileIds, selectedTextBoxIds, tagId, queryClient, clearSelection, removeFromGroups]);

  /**
   * ORDINA — allinea gli oggetti sulla griglia e regolarizza le distanze SENZA
   * cambiare la disposizione: chi era nella terza colonna resta nella terza
   * colonna, gli stacchi che separano i blocchi restano stacchi. Il conto sta
   * tutto in `lib/canvas-tidy.ts`; qui ci sono solo la raccolta dei rettangoli e
   * l'applicazione del risultato.
   *
   * Passa dai canali che esistono già — `handlePositionChange` per i tile (un
   * upsert in batch), `handleUpdateTextBox` per i box — quindi la lavagna si
   * ridisegna da sé: la board riceve `layout` e `textBoxes` come props e non sa
   * nemmeno che questo comando esiste. Nessuna riga di D3.
   *
   * ⚠️ Il ripensamento passa dal toast e non da una conferma preventiva: il
   * riordino si giudica guardandolo, e una modale che chiede «sei sicuro?» prima
   * di aver fatto vedere qualcosa chiede di decidere al buio. Nel canvas non
   * c'è undo, quindi l'Annulla è l'unica rete e va offerta qui.
   */
  const handleTidy = useCallback(() => {
    if (!tagId) return;

    // I rettangoli in gioco. Per i tile si parte dal LAYOUT — è lì che stanno le
    // posizioni — ma solo per le voci che hanno ancora un tile vero: quelle
    // orfane (tile cancellato altrove) non vanno né riordinate né riscritte.
    const tileIds = new Set(tiles.map((t) => t.id));
    const rects: TidyRect[] = [
      ...layout
        .filter((l: { tile_id: string }) => tileIds.has(l.tile_id))
        .map((l: { tile_id: string; x: number; y: number }) => ({ id: l.tile_id, x: l.x, y: l.y, w: TILE_W, h: TILE_H })),
      // Testo, immagini e marcatori insieme: sulla griglia sono tutti rettangoli.
      ...textBoxes.map((b) => ({ id: `tb:${b.id}`, x: b.x, y: b.y, w: b.w, h: b.h })),
    ];

    // C'è una selezione? Si riordina quella. Su una lavagna grande si sistema una
    // zona per volta, invece di rimettere in riga anche ciò che andava bene.
    const scope = selectedIds.length > 0 ? new Set(selectedIds) : null;
    const target = scope ? rects.filter((r) => scope.has(r.id)) : rects;
    if (target.length < 2) return;

    /**
     * I collegamenti: servono al riordino per tenere più larghe le corsie che un
     * edge attraversa — una freccia con la sua etichetta vuole spazio, e due
     * tile collegati appiccicati rendono il collegamento illeggibile.
     * `source_id`/`target_id` sono già nel formato dei rettangoli (id nudo =
     * tile, `tb:<id>` = box), quindi non c'è niente da tradurre.
     */
    const links = edges.map((e) => [e.source_id, e.target_id] as const);
    /**
     * Con una selezione il canone vale OVUNQUE, anche sugli stacchi larghi.
     * Indicare tre tile e chiedere di ordinarli vuol dire volerli equidistanti:
     * rispettare lì lo strappo in mezzo — che sulla lavagna intera è una
     * separazione da non toccare — significa rispondere «era già in ordine» a
     * chi sta guardando una fila sbilenca.
     */
    const strictCanon = !!scope;

    /**
     * ─── I GRUPPI SI RIORDINANO A DUE LIVELLI ─────────────────────────────────
     *
     * Un gruppo non è un tile grande: è una scatola che contiene tile e che ha
     * un ingombro suo, la gronda attorno al contenuto e la fascia dell'etichetta
     * sopra. Riordinando tutto alla rinfusa quell'ingombro non lo vede nessuno —
     * i tile finiscono spaziati bene e le SCATOLE si toccano, o peggio
     * l'etichetta di un gruppo cade sulla riga di sopra.
     *
     * Quindi due riordini annidati: prima DENTRO ogni gruppo, che dà anche la
     * misura giusta della scatola; poi FUORI, dove ogni gruppo partecipa come un
     * rettangolo solo — la sua scatola — accanto a tile liberi, note, immagini e
     * marcatori. Alla fine i membri seguono il loro gruppo dove è andato.
     *
     * Un gruppo entra come blocco solo se TUTTI i suoi membri sono in gioco:
     * selezionandone metà si sta indicando quei tile, non il gruppo, e vanno
     * trattati come oggetti singoli.
     */
    const inPlay = new Set(target.map((r) => r.id));
    const blocks = canvasGroups.filter((g) => g.nodeIds.length >= 2 && g.nodeIds.every((id) => inPlay.has(id)));
    const groupOf = new Map<string, string>();
    blocks.forEach((g) => g.nodeIds.forEach((id) => groupOf.set(id, g.id)));

    /**
     * Lo spazio che il gruppo si riserva attorno al contenuto, in PASSI INTERI di
     * griglia: uno per i lati e il fondo (basta per i 12 della gronda), due sopra
     * (i 12 della gronda più i 20 dell'etichetta fanno 32). Interi e non i valori
     * esatti perché il contenuto deve restare sulla griglia: la scatola si posa
     * su un multiplo del passo, e se la gronda non lo fosse i tile dentro
     * cadrebbero fra i puntini.
     */
    const PAD_SIDE = DOT_STEP;                       // 22 ≥ GROUP_PAD (12)
    const PAD_TOP = DOT_STEP * 2;                    // 44 ≥ GROUP_PAD + LABEL_H (32)
    const BLOCK = 'grp:';

    /** I collegamenti che restano dentro un insieme di id. */
    const linksAmong = (ids: Set<string>) =>
      links.filter(([a, b]) => ids.has(a) && ids.has(b));

    // ── Livello 1: dentro i gruppi ──
    /** Posizione di ogni membro DENTRO il suo gruppo, e la scatola che ne esce. */
    const innerPos = new Map<string, { x: number; y: number }>();
    const blockRects: TidyRect[] = [];
    for (const g of blocks) {
      const members = target.filter((r) => groupOf.get(r.id) === g.id);
      const ids = new Set(members.map((m) => m.id));
      const inner = tidy(members, { step: DOT_STEP, links: linksAmong(ids), strictCanon });
      const placedMembers = members.map((m) => ({ ...m, ...inner.get(m.id)! }));
      placedMembers.forEach((m) => innerPos.set(m.id, { x: m.x, y: m.y }));
      const x0 = Math.min(...placedMembers.map((m) => m.x));
      const y0 = Math.min(...placedMembers.map((m) => m.y));
      const x1 = Math.max(...placedMembers.map((m) => m.x + m.w));
      const y1 = Math.max(...placedMembers.map((m) => m.y + m.h));
      blockRects.push({
        id: BLOCK + g.id,
        x: x0 - PAD_SIDE, y: y0 - PAD_TOP,
        w: (x1 - x0) + PAD_SIDE * 2, h: (y1 - y0) + PAD_TOP + PAD_SIDE,
      });
    }

    // ── Livello 2: la lavagna, coi gruppi come blocchi ──
    const outer: TidyRect[] = [...target.filter((r) => !groupOf.has(r.id)), ...blockRects];
    // Un edge che tocca un membro vale, là fuori, per tutto il suo gruppo; quelli
    // interni al gruppo sono già stati considerati al primo livello.
    const asOuter = (id: string) => (groupOf.has(id) ? BLOCK + groupOf.get(id)! : id);
    const outerLinks = links
      .map(([a, b]) => [asOuter(a), asOuter(b)] as const)
      .filter(([a, b]) => a !== b);
    const placedOuter = outer.length >= 2
      ? tidy(outer, { step: DOT_STEP, links: outerLinks, strictCanon })
      : new Map<string, { x: number; y: number }>();

    // ── Composizione: i membri seguono il loro gruppo ──
    const next = new Map<string, { x: number; y: number }>();
    for (const r of outer) {
      const p = placedOuter.get(r.id) ?? { x: r.x, y: r.y };
      if (!r.id.startsWith(BLOCK)) { next.set(r.id, p); continue; }
      // Il contenuto riparte dall'angolo interno della scatola: lo scostamento è
      // fatto di passi interi, quindi resta tutto in griglia.
      const dx = (p.x + PAD_SIDE) - (r.x + PAD_SIDE);
      const dy = (p.y + PAD_TOP) - (r.y + PAD_TOP);
      const gid = r.id.slice(BLOCK.length);
      for (const [mid, mp] of innerPos) {
        if (groupOf.get(mid) === gid) next.set(mid, { x: mp.x + dx, y: mp.y + dy });
      }
    }

    const moved = target.filter((r) => {
      const p = next.get(r.id);
      return !!p && (p.x !== r.x || p.y !== r.y);
    });
    // Un toast con «Annulla» dopo un riordino che non ha riordinato niente è
    // peggio del silenzio: fa credere che qualcosa sia cambiato.
    if (moved.length === 0) { toast('Era già in ordine'); return; }

    const applyPositions = (pts: { id: string; x: number; y: number }[]) => {
      const tilePts = pts.filter((p) => !p.id.startsWith('tb:'));
      // Solo quelli che si muovono: `saveLayout` è un upsert e
      // `handlePositionChange` FONDE nella cache, quindi un invio parziale non
      // fa sparire nessuno dal canvas.
      if (tilePts.length) handlePositionChange(tilePts.map((p) => ({ tile_id: p.id, x: p.x, y: p.y })));
      pts.filter((p) => p.id.startsWith('tb:')).forEach((p) => handleUpdateTextBox(p.id.slice(3), { x: p.x, y: p.y }));
    };

    /**
     * LA SCATOLA DEL GRUPPO torna ad aderire al contenuto.
     *
     * Un gruppo ridimensionato a mano porta un `bounds` suo, e il riquadro
     * disegnato è l'UNIONE fra quello e i tile: serve a non stringersi sotto il
     * contenuto quando si tira una maniglia, ma dopo un riordino significa che la
     * scatola resta larga com'era mentre i tile dentro si sono compattati. La
     * misura manuale descriveva una disposizione che non c'è più, quindi si
     * toglie e il gruppo torna ad auto-dimensionarsi.
     *
     * Solo per i gruppi che il riordino ha davvero toccato: quelli fermi si
     * tengono la misura che gli hai dato.
     */
    const movedIds = new Set(moved.map((m) => m.id));
    const refit = new Set(
      canvasGroups.filter((g) => g.bounds && g.nodeIds.some((id) => movedIds.has(id))).map((g) => g.id),
    );
    const groupsBefore = canvasGroups;
    const applyGroups = (list: CanvasGroup[]) => { if (refit.size) handleGroupsChange(list); };

    const before = moved.map((r) => ({ id: r.id, x: r.x, y: r.y }));
    const after = moved.map((r) => ({ id: r.id, ...next.get(r.id)! }));
    applyPositions(after);
    applyGroups(canvasGroups.map((g) => (refit.has(g.id) ? { ...g, bounds: null } : g)));
    // Il menu della selezione è ancorato a coordinate di SCHERMO calcolate dalla
    // board: dopo che gli oggetti si sono spostati indicherebbe il vuoto. Si
    // nasconde tenendo la selezione, come già fa la board durante un drag
    // multiplo; ricompare al prossimo gesto.
    setSelectionBbox(null);

    toast.success(
      moved.length === 1 ? '1 oggetto riordinato' : `${moved.length} oggetti riordinati`,
      {
        duration: 6000,
        // L'annullamento ripercorre la stessa strada dell'andata: stessi canali,
        // stesso debounce. Funziona anche premuto prima che il salvataggio parta.
        action: { label: 'Annulla', onClick: () => { applyPositions(before); applyGroups(groupsBefore); } },
      },
    );
  }, [tagId, tiles, layout, textBoxes, edges, canvasGroups, selectedIds, handlePositionChange, handleUpdateTextBox, handleGroupsChange]);

  /** Un gruppo si può creare da due elementi qualsiasi in su. Non c'è più
   *  nessun tipo escluso: quello che conta è quanti sono, non di che cosa sono
   *  fatti. */
  const groupFromSelectionAllowed = selectedTileIds.length + selectedTextBoxIds.length >= 2;

  const handleCreateGroupFromSelection = useCallback(() => {
    // Dirlo, invece di non fare niente: da tastiera (CTRL+G) non c'è un pulsante
    // grigio a spiegare perché il gruppo non nasce.
    if (!groupFromSelectionAllowed) {
      toast.info('Seleziona almeno due elementi per creare un gruppo');
      return;
    }
    const ids = [...selectedTileIds, ...selectedTextBoxIds.map((id) => `tb:${id}`)];
    const idSet = new Set(ids);
    const ng = canvasGroups
      .map((g) => ({ ...g, nodeIds: g.nodeIds.filter((nid) => !idSet.has(nid)) }))
      .filter((g) => g.nodeIds.length >= 2);
    ng.push({ id: crypto.randomUUID(), label: '', nodeIds: ids });
    handleGroupsChange(ng);
    clearSelection();
  }, [groupFromSelectionAllowed, selectedTileIds, selectedTextBoxIds, canvasGroups, handleGroupsChange, clearSelection]);

  // Modalità "Raggruppa a contorno": tile e box catturati dal rettangolo
  // formano subito un nuovo gruppo (id nudo = tile, `tb:<id>` = box).
  // Rimuove gli id dai gruppi esistenti (un elemento sta in un solo gruppo) e
  // scarta i gruppi rimasti con <2 membri.
  const handleGroupTiles = useCallback((ids: string[]) => {
    // Il pulsante Group si disattiva dopo ogni uso (come Tile/Text/Image).
    setSelectMode(false);
    // Contorno che cattura 0 o 1 elemento: senza un messaggio è un gesto che
    // sembra non aver funzionato.
    if (ids.length < 2) {
      toast.info('Il contorno deve contenere almeno due elementi');
      return;
    }
    const idSet = new Set(ids);
    const ng = canvasGroups
      .map((g) => ({ ...g, nodeIds: g.nodeIds.filter((nid) => !idSet.has(nid)) }))
      .filter((g) => g.nodeIds.length >= 2);
    ng.push({ id: crypto.randomUUID(), label: '', nodeIds: ids });
    handleGroupsChange(ng);
  }, [canvasGroups, handleGroupsChange]);

  // ─── FOGLIO ────────────────────────────────────────────────────────────────
  // Il piano di stampa è DERIVATO dall'area: non c'è uno stato "formato scelto"
  // da tenere in sincrono, c'è un'area e una funzione pura che la traduce in
  // carta. Formato e orientamento imposti sono solo due deroghe a quella
  // funzione, ed è per questo che possono restare null.
  const pdfPlan = useMemo(
    () => (pdfArea ? planPaper(pdfArea, { format: pdfFormat, orientation: pdfOrientation }) : null),
    [pdfArea, pdfFormat, pdfOrientation],
  );

  const pdfPreview = useMemo(
    () => (pdfPlan ? { sheet: pdfPlan.sheet, printable: pdfPlan.printable } : null),
    [pdfPlan],
  );

  /** Quanti tile finiscono sul foglio: è la misura di quanto serve stamparlo. */
  const pdfTileCount = useMemo(() => {
    if (!pdfPlan) return 0;
    const p = pdfPlan.printable;
    return layout.filter((l: { x: number; y: number }) =>
      l.x < p.x + p.w && l.x + TILE_W > p.x && l.y < p.y + p.h && l.y + TILE_H > p.y,
    ).length;
  }, [pdfPlan, layout]);

  /** Nuova area cerchiata → il formato torna automatico: è un'altra domanda. */
  const handlePdfArea = useCallback((area: { x: number; y: number; w: number; h: number }) => {
    setPdfFormat(null);
    setPdfOrientation(null);
    setPdfArea(area);
  }, []);

  const closePdf = useCallback(() => {
    setPdfMode(false);
    setPdfArea(null);
    setPdfFormat(null);
    setPdfOrientation(null);
    // Anche la stampa: chiudere mentre il foglio è montato lo smonta, e senza
    // questo `printing` resterebbe acceso — la prossima area cerchiata partirebbe
    // in stampa da sola.
    setPrinting(false);
  }, []);

  // Esc esce dal foglio: chiude il pannello E disarma lo strumento, come per
  // +Tile. Registrato solo quando serve, così non intercetta l'Esc di nessun altro.
  useEffect(() => {
    if (!pdfMode && !pdfArea) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closePdf(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [pdfMode, pdfArea, closePdf]);

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

  // Click singolo su un box: selezione esclusiva → contorno obsidian + sidebar
  // destra. Testo → editor della nota; immagine → titolo, note e flag della
  // didascalia (ImageSidebar).
  const handleTextBoxClick = useCallback((id: string) => {
    setSelectedTextBoxId(id);
    setSelectedTileId(null);
    setSelectedGroupId(null);
    setSelectedEdgeId(null);
    setSelectedIds([]);
    setSelectionBbox(null);
    setSidebarOpen(true);
  }, []);

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
    removeFromGroups([id]);
  }, [tileCtx, removeFromGroups]);

  // Stessa azione per un box (testo o immagine) dentro un gruppo.
  const handleUngroupBox = useCallback(() => {
    if (!tbCtx) return;
    const id = tbCtx.textBoxId;
    setTbCtx(null);
    removeFromGroups([`tb:${id}`]);
  }, [tbCtx, removeFromGroups]);

  /** Sciogli: sul gruppo selezionato (via sidebar/click) toglie il contenitore;
   *  altrimenti sfila dai rispettivi gruppi gli elementi selezionati — tile e
   *  immagini insieme, che è il caso di una selezione mista. */
  const handleUngroupSelection = useCallback(() => {
    if (selectedGroupId) {
      handleDeleteGroup(selectedGroupId);
      return;
    }
    // `selectedIds` è già nel formato dei membri: id nudo = tile, `tb:<id>` = box.
    if (selectedIds.length) removeFromGroups(selectedIds);
  }, [selectedGroupId, handleDeleteGroup, selectedIds, removeFromGroups]);

  // Scorciatoie standard da editor di canvas: CTRL/⌘+G raggruppa la selezione,
  // CTRL/⌘+SHIFT+G scioglie. Ignorate mentre si scrive (input o box di testo in
  // editing), altrimenti ruberebbero i tasti all'editor.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'g' || !(e.ctrlKey || e.metaKey)) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || el?.isContentEditable) return;
      e.preventDefault();
      if (e.shiftKey) handleUngroupSelection();
      else handleCreateGroupFromSelection();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [handleUngroupSelection, handleCreateGroupFromSelection]);

  const handleConfirmDeleteTile = useCallback(async () => {
    if (!tileCtx) return;
    const id = tileCtx.tileId;
    setTileCtx(null);
    removeFromGroups([id]);
    try {
      await tilesApi.delete(id);
      queryClient.invalidateQueries({ queryKey: ['canvas-tiles', tagId] });
      queryClient.invalidateQueries({ queryKey: ['canvas-layout', tagId] });
      queryClient.invalidateQueries({ queryKey: ['canvas-edges', tagId] });
    } catch { /* ignore */ }
  }, [tileCtx, tagId, queryClient, removeFromGroups]);

  // "Copia": memorizza il tile negli appunti. L'incolla avviene col tasto
  // destro sul punto target (menu "Incolla"), vedi handlePasteAt.
  const handleCopyTile = useCallback(() => {
    if (!tileCtx) return;
    setClipboard({ kind: 'tile', id: tileCtx.tileId });
    setTileCtx(null);
  }, [tileCtx]);

  /**
   * FOCUS acceso/spento su un tile (migration 045).
   *
   * Scrittura ottimistica: il pallino deve comparire con il click, non con la
   * risposta del server. È un segno che serve a dire «sto lavorando a questo»,
   * e mezzo secondo di attesa lo trasformerebbe in un comando di cui ci si
   * chiede se sia arrivato.
   *
   * Non tocca lo status: sono due assi diversi (vedi la nota sulla colonna).
   * Se il server rifiuta, l'`invalidate` rimette la lavagna d'accordo coi dati.
   */
  const handleToggleFocus = useCallback(async (id: string, next: boolean) => {
    if (!tagId) return;
    queryClient.setQueryData(['canvas-tiles', tagId], (old: any) => (
      old?.data ? { ...old, data: old.data.map((t: Tile) => (t.id === id ? { ...t, is_focused: next } : t)) } : old
    ));
    try { await tilesApi.update(id, { is_focused: next }); }
    catch { queryClient.invalidateQueries({ queryKey: ['canvas-tiles', tagId] }); }
  }, [tagId, queryClient]);

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
            markerMode={markerMode}
            onPickMarker={setMarkerMode}
            subjectMode={subjectMode}
            onToggleSubjectMode={() => { setSubjectMode((v) => !v); setOrganizationMode(false); setMarkerMode(null); setTextMode(false); setTileMode(false); setImageMode(false); setSelectMode(false); closePdf(); }}
            organizationMode={organizationMode}
            onToggleOrganizationMode={() => { setOrganizationMode((v) => !v); setSubjectMode(false); setMarkerMode(null); setTextMode(false); setTileMode(false); setImageMode(false); setSelectMode(false); closePdf(); }}
            selectMode={selectMode}
            onToggleTextMode={() => { setTextMode((v) => !v); setTileMode(false); setImageMode(false); setSelectMode(false); closePdf(); }}
            onToggleTileMode={() => { setTileMode((v) => !v); setTextMode(false); setImageMode(false); setSelectMode(false); closePdf(); }}
            onToggleImageMode={() => { setImageMode((v) => !v); setTextMode(false); setTileMode(false); setSelectMode(false); closePdf(); }}
            onToggleSelectMode={() => { setSelectMode((v) => !v); setTextMode(false); setTileMode(false); setImageMode(false); closePdf(); }}
            pdfMode={pdfMode}
            onTogglePdfMode={() => {
              // Spegnendolo si porta via anche l'area e il pannello: il foglio
              // esiste finché lo strumento è armato.
              if (pdfMode) { closePdf(); return; }
              setPdfMode(true);
              setTextMode(false); setTileMode(false); setImageMode(false); setSelectMode(false);
            }}
            onTidy={tag ? handleTidy : undefined}
            tidyLabel={selectedIds.length > 0
              ? 'Ordina gli oggetti selezionati'
              : 'Ordina gli oggetti sulla griglia'}
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
            style={{ cursor: (textMode || tileMode || imageMode || selectMode || pdfMode || markerMode || subjectMode || organizationMode) ? 'crosshair' : undefined }}
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
              markerMode={markerMode}
              onAddMarkerAt={handleAddMarkerAt}
              subjectMode={subjectMode}
              onAddSubjectAt={handleAddSubjectAt}
              organizationMode={organizationMode}
              onAddOrganizationAt={handleAddOrganizationAt}
              // La rubrica: la lavagna non la modifica, le serve per scrivere
              // sotto ogni figura chi è.
              contacts={contacts}
              selectMode={selectMode}
              pdfMode={pdfMode}
              onPdfArea={handlePdfArea}
              pdfPreview={pdfPreview}
              boardRootRef={boardRootRef}
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
              onSplitEdge={handleSplitEdge}
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
              // Selezione MISTA (id nudo = tile, `tb:<id>` = box): passandone
              // solo la parte tile, le immagini selezionate perdevano contorno e
              // multi-drag — e con esse la possibilità di raggrupparle a vista.
              selectedIds={selectedIds}
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
            {/* Adatta e Scala 1:1, appoggiati sulla lavagna in basso a destra.
                Stavano in fondo alla topbar: sono gli unici comandi che non
                toccano il documento — spostano il punto da cui lo guardi — e
                stavano lontanissimi dal loro effetto, che accade qui. */}
            <CanvasZoomControls onFit={handleFit} onZoom100={handleZoom100} />
            {/* Il pannello del foglio sta SULLA lavagna, non sopra un fondale:
                dietro di lui c'è l'anteprima con tutto il fuori-foglio velato,
                ed è quella la risposta alla domanda «cosa entra». */}
            {pdfPlan && pdfArea && (
              <PdfExportPanel
                plan={pdfPlan}
                format={pdfFormat}
                onFormat={setPdfFormat}
                orientation={pdfPlan.orientation}
                onOrientation={setPdfOrientation}
                tileCount={pdfTileCount}
                busy={printing}
                onPrint={() => setPrinting(true)}
                onClose={closePdf}
              />
            )}
          </div>
        </div>

        {/* Monta il clone impaginato e chiama la stampa; si smonta da solo a
            dialogo chiuso. Il pannello resta aperto: se hai annullato per
            cambiare formato, lo trovi dov'era. */}
        {printing && pdfPlan && pdfArea && (
          <CanvasPrintSheet
            plan={pdfPlan}
            area={pdfArea}
            source={boardRootRef.current}
            doneHighlight={doneHl}
            onDone={() => setPrinting(false)}
          />
        )}

          {/* 5 — SIDEBAR DESTRA. Priorità: gruppo → edge → box di testo (editor)
              → immagine → soggetto → marcatore → MultiTileSidebar (≥2 tile)
              → TileSidebar. */}
          {selectedGroupId && canvasGroups.find((g) => g.id === selectedGroupId) ? (
            <GroupSidebar
              group={canvasGroups.find((g) => g.id === selectedGroupId)!}
              tiles={tiles}
              // OGNI box è membro a pieno titolo: il pannello li elenca come i
              // tile e permette di sfilarli uno per uno. Nessun filtro — il
              // pannello mostra i membri del gruppo, e i membri possono essere
              // di qualunque tipo.
              boxes={textBoxes.map((bx) => {
                if (bx.type === 'image') return {
                  id: bx.id,
                  type: 'image' as const,
                  src: (bx.content as CanvasBoxImageContent).src,
                  label: ((bx.content as CanvasBoxImageContent).title || '').trim() || 'Immagine',
                };
                if (bx.type === 'subject' || bx.type === 'organization') {
                  // Il nome viene dalla RUBRICA, non dal box: è lì che vive da
                  // quando soggetti e organizzazioni la puntano (migration 048).
                  const c = contacts.find((k) => k.id === bx.contact_id);
                  return {
                    id: bx.id,
                    type: 'subject' as const,
                    label: (c?.name || '').trim()
                      || (bx.type === 'organization' ? 'Organizzazione senza nome' : 'Soggetto senza nome'),
                  };
                }
                if (bx.type === 'marker') {
                  // Senza didascalia resta il nome del tipo («Start», «Stop»…):
                  // sono quattro e si ripetono, ma la riga porta accanto il
                  // simbolo vero, che è ciò che distingue due «Stop» fra loro
                  // meglio di qualunque parola.
                  const kind = resolveMarkerKind((bx.content as CanvasBoxMarkerContent).kind);
                  return {
                    id: bx.id,
                    type: 'marker' as const,
                    kind,
                    label: ((bx.content as CanvasBoxMarkerContent).label || '').trim() || MARKER_SPEC[kind].label,
                  };
                }
                return { id: bx.id, type: 'text' as const, label: boxTextPreview((bx.content as { html?: string }).html) };
              })}
              open={sidebarOpen}
              onToggle={() => setSidebarOpen(!sidebarOpen)}
              onUpdate={(patch) => handleUpdateGroup(selectedGroupId, patch)}
              onDelete={() => handleDeleteGroup(selectedGroupId)}
              onSelectTile={(id) => { setSelectedGroupId(null); setSelectedTileId(id); setSidebarOpen(true); }}
              onUngroupMember={(memberId) => removeFromGroups([memberId])}
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
          ) : selectedImageBox ? (
            <ImageSidebar
              key={selectedImageBox.id}
              boxId={selectedImageBox.id}
              src={(selectedImageBox.content as CanvasBoxImageContent).src}
              initialTitle={(selectedImageBox.content as CanvasBoxImageContent).title || ''}
              initialNotes={(selectedImageBox.content as CanvasBoxImageContent).notes || ''}
              showTitle={!!(selectedImageBox.content as CanvasBoxImageContent).showTitle}
              open={sidebarOpen}
              onToggle={() => setSidebarOpen(!sidebarOpen)}
              onTitleChange={(title) => handleBoxFieldChange(selectedImageBox.id, { title })}
              onNotesChange={(notes) => handleBoxFieldChange(selectedImageBox.id, { notes })}
              // Flag discreto → effetto immediato sulla didascalia del canvas.
              onShowTitleChange={(showTitle) => handleTextBoxStylePatch(selectedImageBox.id, { showTitle })}
              // Rimette il box in squadra: larghezza invariata, altezza dedotta
              // dal rapporto naturale della foto.
              onFitAspect={(aspect) => {
                if (!(aspect > 0)) return;
                handleUpdateTextBox(selectedImageBox.id, { h: Math.max(40, selectedImageBox.w / aspect) });
              }}
              onDelete={() => { handleDeleteTextBox(selectedImageBox.id); setSelectedTextBoxId(null); }}
            />
          ) : selectedContactBox ? (
            (() => {
              const cid = selectedContactBox.contact_id ?? null;
              const contact = contacts.find((c) => c.id === cid) ?? null;
              const isOrg = selectedContactBox.type === 'organization';
              return (
                <ContactSidebar
                  key={selectedContactBox.id}
                  boxId={selectedContactBox.id}
                  variant={isOrg ? 'organization' : 'subject'}
                  contact={contact}
                  // Mai sé stesso fra le proprie organizzazioni: il CHECK sulla
                  // tabella lo rifiuterebbe, ma una casella che non si può
                  // spuntare è peggio di una casella che non c'è.
                  organizations={organizationContacts.filter((o) => o.id !== cid)}
                  // Su chi si può spostare la figura: stesso ruolo (un soggetto
                  // resta un soggetto), non sé stessa, e non chi è già posato
                  // qui — due figure per la stessa persona sarebbero due segni
                  // che si rinominano a vicenda.
                  linkable={contacts.filter((c) => (
                    contactRole(c.kind) === (isOrg ? 'organization' : 'subject')
                    && c.id !== cid
                    && !contactsOnBoard.includes(c.id)
                  ))}
                  memberOf={memberships.filter((m) => m.member_id === cid).map((m) => m.org_id)}
                  members={isOrg
                    ? memberships
                        .filter((m) => m.org_id === cid)
                        .map((m) => contacts.find((c) => c.id === m.member_id))
                        .filter((c): c is CanvasContact => !!c)
                    : []}
                  open={sidebarOpen}
                  onToggle={() => setSidebarOpen(!sidebarOpen)}
                  // Campi che si DIGITANO → stesso ritardo dei campi di un box,
                  // ma la destinazione è la RUBRICA: questi dati non stanno più
                  // nel disegno.
                  onChange={(patch) => { if (cid) handleContactFieldChange(cid, patch); }}
                  onOrganizationsChange={(ids) => { if (cid) handleSetOrganizations(cid, ids); }}
                  onRelink={(nid) => handleRelinkContactBox(selectedContactBox.id, nid)}
                  onRemoveFromBoard={() => { handleDeleteTextBox(selectedContactBox.id); setSelectedTextBoxId(null); }}
                />
              );
            })()
          ) : selectedMarkerBox ? (
            <MarkerSidebar
              key={selectedMarkerBox.id}
              boxId={selectedMarkerBox.id}
              kind={(selectedMarkerBox.content as CanvasBoxMarkerContent).kind}
              initialLabel={(selectedMarkerBox.content as CanvasBoxMarkerContent).label || ''}
              open={sidebarOpen}
              onToggle={() => setSidebarOpen(!sidebarOpen)}
              // Campo che si DIGITA → stessa via di titolo e note dell'immagine:
              // specchio in cache e salvataggio a fine battuta, uno solo per
              // entrambi (il canvas si ridisegna per intero a ogni scrittura).
              onLabelChange={(label) => handleBoxFieldChange(selectedMarkerBox.id, { label })}
              onDelete={() => { handleDeleteTextBox(selectedMarkerBox.id); setSelectedTextBoxId(null); }}
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
              La selezione può contenere tile, immagini e box di testo; "Crea
              gruppo" è abilitato per tile + immagini (i testi restano fuori). */}
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
              // La stessa regola di CTRL+G e degli altri due menu, e non una
              // copia locale: qui diceva ancora `tbCount === 0`, cioè vietava il
              // gruppo appena nella selezione entrava un box. Era vero quando i
              // gruppi tenevano solo tile, ed è sopravvissuto per due giri a
              // quella verità — il pulsante restava grigio mentre CTRL+G, sulla
              // stessa selezione, il gruppo lo creava.
              const groupAllowed = groupFromSelectionAllowed;
              // Riordinare un oggetto solo non vuol dire niente: non ha vicini
              // rispetto a cui allinearsi.
              const tidyAllowed = selectedIds.length >= 2;
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
                  {/* Lo stesso comando dell'ingranaggio a puntini in barra, qui
                      dove si ragiona sulla selezione: chi ha appena cerchiato una
                      zona storta la vuole raddrizzare senza risalire alla toolbar
                      e senza rischiare di perdere la selezione per strada. */}
                  <button
                    onClick={handleTidy}
                    disabled={!tidyAllowed}
                    title={tidyAllowed
                      ? 'Allinea sulla griglia e regolarizza le distanze, senza cambiare la disposizione'
                      : 'Serve più di un oggetto: uno solo non ha vicini rispetto a cui allinearsi'}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      padding: '6px 10px',
                      textAlign: 'left',
                      background: 'transparent',
                      border: 'none',
                      cursor: tidyAllowed ? 'pointer' : 'not-allowed',
                      color: tidyAllowed ? theme.ink2 : theme.ink3,
                      opacity: tidyAllowed ? 1 : 0.4,
                      fontFamily: ('var(--ob-font-sans)'),
                      fontSize: OB_TEXT.card,
                    }}
                  >
                    <IconGridDots size={14} />
                    Ordina sulla griglia
                  </button>
                  <button
                    onClick={handleCreateGroupFromSelection}
                    disabled={!groupAllowed}
                    title={!groupAllowed ? 'Servono almeno due elementi selezionati' : undefined}
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
              const groupAllowed = groupFromSelectionAllowed;
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
                          onClick={() => { setTileCtx(null); handleTidy(); }}
                          disabled={selectedIds.length < 2}
                          title={selectedIds.length >= 2
                            ? 'Allinea sulla griglia e regolarizza le distanze, senza cambiare la disposizione'
                            : 'Serve più di un oggetto: uno solo non ha vicini rispetto a cui allinearsi'}
                          style={{ ...menuItem, cursor: selectedIds.length >= 2 ? 'pointer' : 'not-allowed', opacity: selectedIds.length >= 2 ? 1 : 0.4 }}
                        >
                          <IconGridDots size={14} />
                          Ordina sulla griglia
                        </button>
                        <button
                          onClick={() => { setTileCtx(null); handleCreateGroupFromSelection(); }}
                          disabled={!groupAllowed}
                          title={!groupAllowed ? 'Servono almeno due elementi selezionati' : undefined}
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
                    {/* FOCUS — l'attività su cui si sta lavorando adesso. Prima
                        voce del menu: è l'unica che si usa mentre si lavora, le
                        altre riguardano il posto del tile sulla lavagna. */}
                    {(() => {
                      const focused = !!allTagTiles.find((t) => t.id === tileCtx.tileId)?.is_focused;
                      return (
                        <button
                          onClick={() => { const id = tileCtx.tileId; setTileCtx(null); handleToggleFocus(id, !focused); }}
                          style={{ ...menuItem, color: focused ? 'var(--ob-focus)' : theme.ink2 }}
                          title={focused
                            ? 'Togli la cornice rossa: non è più l’attività di adesso'
                            : 'Segna questa come l’attività su cui stai lavorando'}
                        >
                          {/* Il quadrato tratteggiato è la cornice che il
                              comando accende, vista da lontano. */}
                          <IconSquareDashed size={14} style={{ color: focused ? 'var(--ob-focus)' : theme.ink3 }} />
                          {focused ? 'Focus off' : 'Focus on'}
                        </button>
                      );
                    })()}
                    <div style={{ margin: '4px 0', borderTop: `1px solid ${theme.border}` }} />
                    {tileCtx.inGroup && (
                      <button onClick={handleUngroupTile} style={menuItem}>
                        <IconBoxOff size={14} />
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

          {/* Box (testo/immagine) context menu — specchio di quello del tile:
              con più elementi selezionati offre le stesse azioni di insieme
              (Crea gruppo / Elimina), perché un'immagine nel gruppo vale un
              tile e il tasto destro va a finire sull'elemento che si ha sotto
              il cursore, non necessariamente su un tile. */}
          {tbCtx && createPortal(
            (() => {
              const inMultiSel = selectedIds.length > 1 && selectedTextBoxIds.includes(tbCtx.textBoxId);
              const groupAllowed = groupFromSelectionAllowed;
              // La figura di un'ANAGRAFICA ha due eliminazioni, non una: il
              // segno sulla lavagna e la persona in rubrica sono due cose, e il
              // menu deve dirlo invece di scegliere per conto suo.
              const ctxBox = textBoxes.find((b) => b.id === tbCtx.textBoxId);
              const ctxIsContact = ctxBox?.type === 'subject' || ctxBox?.type === 'organization';
              const ctxContactId = ctxIsContact ? (ctxBox as { contact_id?: string | null }).contact_id ?? null : null;
              const ctxContact = ctxContactId ? contacts.find((c) => c.id === ctxContactId) ?? null : null;
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
                  <div className="fixed inset-0 z-[9998]" onClick={() => setTbCtx(null)} onContextMenu={(e) => { e.preventDefault(); setTbCtx(null); }} />
                  <div
                    className="fixed"
                    style={{
                      top: tbCtx.y,
                      left: tbCtx.x,
                      zIndex: 9999,
                      width: 184,
                      background: theme.surface,
                      border: `1px solid ${theme.border}`,
                      boxShadow: 'var(--ob-shadow-card)',
                      borderRadius: 'var(--ob-radius-md)',
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
                          onClick={() => { setTbCtx(null); handleTidy(); }}
                          disabled={selectedIds.length < 2}
                          title={selectedIds.length >= 2
                            ? 'Allinea sulla griglia e regolarizza le distanze, senza cambiare la disposizione'
                            : 'Serve più di un oggetto: uno solo non ha vicini rispetto a cui allinearsi'}
                          style={{ ...menuItem, cursor: selectedIds.length >= 2 ? 'pointer' : 'not-allowed', opacity: selectedIds.length >= 2 ? 1 : 0.4 }}
                        >
                          <IconGridDots size={14} />
                          Ordina sulla griglia
                        </button>
                        <button
                          onClick={() => { setTbCtx(null); handleCreateGroupFromSelection(); }}
                          disabled={!groupAllowed}
                          title={!groupAllowed ? 'Servono almeno due elementi selezionati' : undefined}
                          style={{ ...menuItem, cursor: groupAllowed ? 'pointer' : 'not-allowed', color: groupAllowed ? theme.ink2 : theme.ink3, opacity: groupAllowed ? 1 : 0.4 }}
                        >
                          <IconBoxMultiple size={14} />
                          Crea gruppo
                        </button>
                        <button onClick={() => { setTbCtx(null); handleBulkDeleteSelected(); }} style={dangerItem}>
                          <IconTrash size={14} />
                          Elimina {selectedIds.length} elementi
                        </button>
                        <div style={{ margin: '4px 0', borderTop: `1px solid ${theme.border}` }} />
                      </>
                    )}
                    {/* Un box dentro un gruppo si sfila come un tile. */}
                    {tbCtx.inGroup && (
                      <button onClick={handleUngroupBox} style={menuItem}>
                        <IconBoxOff size={14} />
                        Ungroup
                      </button>
                    )}
                    <button onClick={handleCopyBox} style={menuItem}>
                      <IconCopy size={14} />
                      Copia
                    </button>
                    {ctxContact ? (
                      <>
                        {/* NON in rosso: togliere la figura dalla lavagna non
                            distrugge niente — il contatto resta in rubrica con
                            tutto quello che ha. Il rosso qui sotto è riservato
                            all'unico comando che perde davvero qualcosa. */}
                        <button onClick={() => { handleDeleteTextBox(tbCtx.textBoxId); setTbCtx(null); }} style={menuItem}>
                          <IconEraser size={14} />
                          Togli dalla lavagna
                        </button>
                        <button
                          onClick={() => {
                            if (ctxContact.is_self) return;
                            setTbCtx(null);
                            setDeleteContact({
                              boxId: tbCtx.textBoxId,
                              contactId: ctxContact.id,
                              name: ctxContact.name,
                              isOrg: ctxBox?.type === 'organization',
                            });
                          }}
                          disabled={ctxContact.is_self}
                          title={ctxContact.is_self
                            ? 'Il contatto «io» non si elimina'
                            : 'Elimina la persona dalla rubrica: sparisce da ogni lavagna'}
                          style={{
                            ...dangerItem,
                            cursor: ctxContact.is_self ? 'not-allowed' : 'pointer',
                            opacity: ctxContact.is_self ? 0.4 : 1,
                          }}
                        >
                          <IconTrash size={14} />
                          Elimina dai contatti
                        </button>
                      </>
                    ) : (
                      <button onClick={() => { handleDeleteTextBox(tbCtx.textBoxId); setTbCtx(null); }} style={dangerItem}>
                        <IconTrash size={14} />
                        Elimina
                      </button>
                    )}
                  </div>
                </>
              );
            })(),
            document.body
          )}

          {/* DI CHI SI TRATTA — la domanda che precede la figura, posta dove si è
              cliccato e non nel pannello a destra: in quel momento si sta
              guardando la lavagna, non la barra laterale. */}
          {pendingContact && (
            <ContactPicker
              variant={pendingContact.variant}
              at={{ x: pendingContact.sx, y: pendingContact.sy }}
              contacts={contacts}
              onBoard={contactsOnBoard}
              onPick={handlePickContact}
              onCreate={handleCreateContact}
              onCancel={() => setPendingContact(null)}
            />
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
                  Incolla {clipboard?.kind === 'tile' ? 'tile'
                    : clipboard?.kind === 'image' ? 'immagine'
                    : clipboard?.kind === 'marker' ? 'marcatore'
                    : clipboard?.kind === 'subject' ? 'soggetto'
                    : 'testo'}
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
                    {/* Sciogliere un gruppo NON cancella niente: toglie solo il
                        contenitore e lascia i membri dove sono. Era
                        etichettato "Elimina gruppo" in rosso col cestino —
                        l'azione giusta con il nome di quella sbagliata, e quindi
                        un ungroup che nessuno osava premere. */}
                    <button
                      onClick={() => { handleDeleteGroup(groupCtx.groupId); setGroupCtx(null); }}
                      style={menuItem}
                      title="Toglie il gruppo: i membri restano sul canvas"
                    >
                      <IconBoxOff size={14} />
                      Sciogli gruppo (Ungroup)
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
                  background: 'var(--ob-sunken)',
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

          {/* ── LA CONFERMA DELL'ELIMINAZIONE DALLA RUBRICA ──────────────────
              Una finestra e non il doppio clic che usiamo altrove: il doppio
              clic va bene per un'azione locale e rifacibile, questa non è né
              l'una né l'altra. E soprattutto è il posto dove si possono dire i
              CONTI — quanti membri perdono l'appartenenza — che in una voce di
              menu non ci starebbero. */}
          <Modal
            open={!!deleteContact}
            onClose={() => setDeleteContact(null)}
            title="Elimina dai contatti"
            maxWidth={400}
          >
            {deleteContact && (() => {
              const members = deleteContact.isOrg
                ? memberships.filter((m) => m.org_id === deleteContact.contactId).length
                : 0;
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <p style={{ margin: 0, color: theme.ink, fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.control, lineHeight: 1.6 }}>
                    <strong style={{ fontWeight: OB_WEIGHT.emphasis }}>{deleteContact.name}</strong>
                    {' '}esce dalla rubrica. Non è lo stesso che toglierlo da questa
                    lavagna:
                  </p>
                  <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6, color: theme.ink2, fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.card, lineHeight: 1.55 }}>
                    <li>sparisce da <strong style={{ color: theme.ink }}>ogni lavagna</strong> in cui è posato, non solo da questa;</li>
                    {members > 0 && (
                      <li>{members} contatt{members === 1 ? 'o smette' : 'i smettono'} di farne parte;</li>
                    )}
                    <li>i passi dei flow che lo citano restano senza contatto.</li>
                  </ul>
                  <p style={{ margin: 0, color: theme.ink3, fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.meta, lineHeight: 1.5 }}>
                    Non si annulla. Se ti serve solo toglierlo di mezzo, in rubrica
                    c&apos;è l&apos;archiviazione.
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setDeleteContact(null)}
                      style={{
                        padding: '8px 14px', background: 'transparent',
                        border: `1px solid ${theme.border}`, borderRadius: 'var(--ob-radius-sm)',
                        color: theme.ink2, fontFamily: 'var(--ob-font-sans)',
                        fontSize: OB_TEXT.control, cursor: 'pointer',
                      }}
                    >
                      Annulla
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteContactEverywhere}
                      style={{
                        padding: '8px 14px', background: 'var(--ob-danger)',
                        border: '1px solid var(--ob-danger)', borderRadius: 'var(--ob-radius-sm)',
                        color: '#FFFFFF', fontFamily: 'var(--ob-font-sans)',
                        fontSize: OB_TEXT.control, fontWeight: OB_WEIGHT.emphasis,
                        cursor: 'pointer',
                      }}
                    >
                      Elimina definitivamente
                    </button>
                  </div>
                </div>
              );
            })()}
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
