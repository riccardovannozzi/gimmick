/**
 * Gimmick · Obsidian — Views screen wired to live data.
 *
 * Owns the active tab + per-tab data fetching so queries stay gated to the
 * visible tab. Tiles (tilesApi) and Flows (flowApi.hub, filter-aware) are live;
 * Chrono / Settings tabs still render their static mock for now.
 */
import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tilesApi, flowApi, calendarApi, statusesApi, typeIconsApi, settingsApi, sparksApi, type PaginatedResponse } from '@/lib/api';
import { tilesByInsertion, flowHubItemToVM, tileToChronoEvent } from '@/lib/obsidian-adapters';
import { getSignedUrls } from '@/lib/storage';
import { DEFAULT_ACTION_COLORS, type TileActionKey } from '@/constants/tile-colors';
import type { FlowHubFilter, Tile } from '@/types';
import { toast } from '@/store';
import { useSettingsStore } from '@/store/settingsStore';
import { useAuthStore } from '@/store/authStore';
import { ObsidianViewsScreen } from './ViewsScreen';
import type { MobileViewId } from '../TopNav';

const DAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
const MONTHS_SHORT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

export interface ObsidianViewsScreenLiveProps {
  initial?: MobileViewId;
  /**
   * Vista CONTROLLATA dall'esterno.
   *
   * Serve nei tab, dove ogni rotta ospita una vista sola e le schermate già
   * visitate restano MONTATE in sottofondo. Con la sola forma interna
   * succedeva questo: da Tiles si toccava Chrono, l'istanza di /history
   * impostava il proprio stato su 'chrono' e poi navigava — restando montata
   * con la vista sbagliata. Tornando su Tiles quella stessa istanza aveva
   * `active === 'chrono'`, quindi la query dei tile era DISABILITATA: la lista
   * mostrava quello che aveva in cache e non si aggiornava più.
   *
   * Passandola, l'istanza di una rotta è sempre la propria vista.
   */
  active?: MobileViewId;
  /** Opens the login screen from the Settings tab. */
  onSignIn?: () => void;
  /** TopNav home button → the Capture screen. */
  onHome?: () => void;
  onOpenTile?: (id: string) => void;
  onOpenFlow?: (tileId: string) => void;
  /** Fired after the internal switch, so a host route can keep the router in
   *  sync with the visible tab (see app/(tabs)/*). */
  onActiveChange?: (id: MobileViewId) => void;
  /** Ask Gimmick (cerchio a destra nell'header) → chat. */
  onAsk?: () => void;
}

export function ObsidianViewsScreenLive({ initial = 'tiles', active: activeProp, onOpenTile, onOpenFlow, onActiveChange, onSignIn, onHome, onAsk }: ObsidianViewsScreenLiveProps) {
  const queryClient = useQueryClient();
  const [activeState, setActiveState] = React.useState<MobileViewId>(initial);
  const active = activeProp ?? activeState;
  const handleActive = React.useCallback((id: MobileViewId) => {
    // Controllata dall'esterno: lo stato interno NON si tocca, o l'istanza
    // resterebbe montata con la vista di qualcun altro (vedi `active` nei props).
    if (activeProp === undefined) setActiveState(id);
    onActiveChange?.(id);
  }, [activeProp, onActiveChange]);
  const [flowFilter, setFlowFilter] = React.useState<FlowHubFilter>('wait');
  const [dayOffset, setDayOffset] = React.useState(0);

  // Settings tab — persisted via settingsStore (AsyncStorage).
  const haptic = useSettingsStore((s) => s.hapticFeedback);
  const setHaptic = useSettingsStore((s) => s.setHapticFeedback);
  const confirmDelete = useSettingsStore((s) => s.confirmDelete);
  const setConfirmDelete = useSettingsStore((s) => s.setConfirmDelete);
  const themeMode = useSettingsStore((s) => s.theme);
  const setThemeMode = useSettingsStore((s) => s.setTheme);

  const authUser = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);

  const tilesQuery = useQuery({
    queryKey: ['tiles', { page: 1, limit: 100 }],
    queryFn: () => tilesApi.list({ page: 1, limit: 100 }),
    enabled: active === 'tiles',
  });

  // Eliminazione dalla lista (scorri-per-eliminare). Il backend cancella a
  // cascata: sparks e file nello storage se ne vanno col tile.
  // Si invalida `tiles` senza il pezzo di paginazione, così qualunque pagina in
  // cache si rilegge — e `calendar-events`, perché un tile con data sparirebbe
  // dalla lista ma resterebbe nel calendario fino al riavvio.
  const deleteTile = useMutation({
    mutationFn: async (id: string) => {
      const res = await tilesApi.delete(id);
      // `apiRequest` NON lancia: su errore torna `{ success: false, error }`.
      // Senza questo controllo un'eliminazione fallita era indistinguibile da
      // una riuscita — si invalidava, la lista si rileggeva identica, il tile
      // restava lì e nessuno diceva perché. Premi e non succede niente.
      if (!res.success) throw new Error(res.error || 'Eliminazione non riuscita');
      return res;
    },
    // Il tile sparisce SUBITO, senza aspettare il server. L'attesa non era la
    // rete soltanto: il backend cancella anche i file nello storage e gli spark
    // uno per uno, quindi la risposta arriva con calma, e la lista si rileggeva
    // solo dopo. La card restava lì mezzo secondo buono dopo il tocco.
    onMutate: async (id: string) => {
      // Prima si fermano le letture in volo: una già partita tornerebbe DOPO la
      // rimozione ottimistica e riscriverebbe la cache col tile ancora dentro —
      // lo si vedrebbe riapparire.
      await queryClient.cancelQueries({ queryKey: ['tiles'] });
      // Si salvano TUTTE le pagine in cache, non solo quella a video: il
      // ripristino in caso di errore deve rimettere le cose com'erano.
      const previous = queryClient.getQueriesData<PaginatedResponse<Tile>>({ queryKey: ['tiles'] });
      queryClient.setQueriesData<PaginatedResponse<Tile>>({ queryKey: ['tiles'] }, (old) =>
        old ? { ...old, data: old.data.filter((t) => t.id !== id) } : old,
      );
      return { previous };
    },
    // Il server ha rifiutato: si rimette esattamente quello che c'era e si dice
    // perché. Senza il ripristino il tile resterebbe sparito dalla lista pur
    // essendo ancora sul server.
    onError: (e, _id, ctx) => {
      ctx?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data));
      toast.error(e instanceof Error ? e.message : 'Eliminazione non riuscita');
    },
    // In entrambi i casi si torna a chiedere al server: dopo un successo per
    // allinearsi davvero, dopo un errore perché la cache ripristinata potrebbe
    // essere vecchia.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tiles'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
    },
  });

  // Status e tipi vivono in tabelle separate: la card del tile ne mostra il
  // glifo/colore, quindi servono le due anagrafiche + l'assegnazione per tile.
  // Cambiano di rado → staleTime lungo, e comunque solo con il tab Tiles attivo.
  const statusesQuery = useQuery({
    queryKey: ['statuses'],
    queryFn: () => statusesApi.list(),
    enabled: active === 'tiles',
    staleTime: 5 * 60 * 1000,
  });
  const typeIconsQuery = useQuery({
    queryKey: ['type-icons'],
    queryFn: () => typeIconsApi.list(),
    enabled: active === 'tiles',
    staleTime: 5 * 60 * 1000,
  });
  const typeAssignQuery = useQuery({
    queryKey: ['type-icons', 'assignments'],
    queryFn: () => typeIconsApi.getAssignments(),
    enabled: active === 'tiles',
    staleTime: 5 * 60 * 1000,
  });
  // Colori dei badge azione: stessa impostazione utente che colora il canvas
  // (settings `action_colors`), con gli stessi default se non è mai stata
  // toccata — così un tile ha gli stessi colori su board e telefono.
  const actionColorsQuery = useQuery({
    queryKey: ['settings', 'action_colors'],
    queryFn: () => settingsApi.get<Partial<Record<TileActionKey, string>>>('action_colors'),
    enabled: active === 'tiles',
    staleTime: 5 * 60 * 1000,
  });
  const actionColors = React.useMemo(
    () => ({ ...DEFAULT_ACTION_COLORS, ...(actionColorsQuery.data?.data ?? {}) }),
    [actionColorsQuery.data],
  );

  const flowsQuery = useQuery({
    queryKey: ['flow-hub', flowFilter],
    queryFn: () => flowApi.hub(flowFilter),
    enabled: active === 'flows',
  });

  // Day window [00:00, 24:00) for the selected day (today + dayOffset).
  const day = React.useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + dayOffset);
    return d;
  }, [dayOffset]);
  const dayEnd = React.useMemo(() => {
    const d = new Date(day);
    d.setDate(d.getDate() + 1);
    return d;
  }, [day]);

  const chronoQuery = useQuery({
    queryKey: ['calendar-events', day.toISOString(), dayEnd.toISOString()],
    queryFn: () => calendarApi.events(day.toISOString(), dayEnd.toISOString()),
    enabled: active === 'chrono',
  });

  /**
   * Data scelta col picker → offset in giorni rispetto a oggi.
   *
   * La differenza si arrotonda sui millisecondi invece di contare i giorni uno
   * a uno: ai cambi d'ora legale un giorno dura 23 o 25 ore, ma l'errore è di
   * un'ora su 24 e `Math.round` lo assorbe.
   */
  const handleChronoPick = React.useCallback((picked: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(picked);
    target.setHours(0, 0, 0, 0);
    setDayOffset(Math.round((target.getTime() - today.getTime()) / 86_400_000));
  }, []);

  /**
   * Pillola "Add Tile": crea un tile-evento di un'ora nel giorno mostrato e lo
   * apre subito per la compilazione. L'orario di partenza è la prossima ora
   * tonda se il giorno è oggi (altrimenti si creerebbe un evento già passato),
   * le 9:00 negli altri giorni.
   */
  const addingRef = React.useRef(false);
  const handleChronoAdd = React.useCallback(async () => {
    if (addingRef.current) return;      // doppio tap → un solo tile
    addingRef.current = true;
    try {
      const start = new Date(day);
      if (dayOffset === 0) {
        const n = new Date();
        start.setHours(Math.min(23, n.getHours() + 1), 0, 0, 0);
      } else {
        start.setHours(9, 0, 0, 0);
      }
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      const created = await tilesApi.create({ title: '' });
      if (!created.success || !created.data) return;
      await tilesApi.update(created.data.id, {
        action_type: 'event',
        is_event: true,
        all_day: false,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
      });
      await queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      onOpenTile?.(created.data.id);
    } finally {
      addingRef.current = false;
    }
  }, [day, dayOffset, queryClient, onOpenTile]);

  // A failed fetch and an empty result render identically in the list content,
  // so surface the failure explicitly. Two distinct cases: the request threw
  // (network / unreachable backend) or it came back with success:false (auth,
  // validation). Both are reported to the user rather than swallowed.
  const activeQuery = active === 'tiles' ? tilesQuery : active === 'flows' ? flowsQuery : active === 'chrono' ? chronoQuery : null;
  const errorText = React.useMemo(() => {
    if (!activeQuery) return null;
    if (activeQuery.error) return `Impossibile contattare il backend: ${String((activeQuery.error as Error)?.message ?? activeQuery.error)}`;
    if (activeQuery.data && activeQuery.data.success === false) {
      return `Il backend ha rifiutato la richiesta: ${(activeQuery.data as { error?: string }).error ?? 'errore sconosciuto'}`;
    }
    return null;
  }, [activeQuery]);

  // Lookup per la card: status_id → nome di sistema, tile → glifo/colore del tipo.
  const statusNameById = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const s of statusesQuery.data?.data ?? []) m.set(s.id, s.name);
    return m;
  }, [statusesQuery.data]);
  const typeByTile = React.useMemo(() => {
    const icons = new Map((typeIconsQuery.data?.data ?? []).map((ti) => [ti.id, ti]));
    const m = new Map<string, { id: string; name?: string; icon?: string; color?: string }>();
    for (const row of typeAssignQuery.data?.data ?? []) {
      const ti = row.type_icon_id ? icons.get(row.type_icon_id) : undefined;
      if (ti) m.set(row.tile_id, { id: ti.id, name: ti.name, icon: ti.icon, color: ti.color });
    }
    return m;
  }, [typeIconsQuery.data, typeAssignQuery.data]);

  // Ricerca AI della lista Tiles: la query semantica gira sugli SPARK (è lì che
  // vive il contenuto indicizzato) e i risultati vengono riportati sui tile che
  // li contengono. La ricerca per titolo, immediata, resta locale nella lista.
  const [aiQuery, setAiQuery] = React.useState<string | null>(null);
  const aiQueryResult = useQuery({
    queryKey: ['sparks-search', aiQuery],
    queryFn: () => sparksApi.search(aiQuery!, 50),
    enabled: active === 'tiles' && !!aiQuery,
  });
  const aiTileIds = React.useMemo(() => {
    if (!aiQuery) return null;
    if (!aiQueryResult.data?.data) return null;
    const ids = new Set<string>();
    for (const s of aiQueryResult.data.data) if (s.tile_id) ids.add(s.tile_id);
    return [...ids];
  }, [aiQuery, aiQueryResult.data]);

  const baseTiles = React.useMemo(
    () => tilesByInsertion(tilesQuery.data?.data ?? [], { statusNameById, typeByTile }),
    [tilesQuery.data, statusNameById, typeByTile],
  );

  // Anteprime della lista. Il bucket è privato, quindi ogni immagine va firmata:
  // si firmano TUTTE in una richiesta sola (`createSignedUrls`) invece di una
  // per card. La chiave della query è l'elenco dei percorsi, così il risultato
  // si riusa finché la lista non cambia; `staleTime` sta sotto l'ora di validità
  // della firma, altrimenti si mostrerebbero URL scaduti.
  const previewPaths = React.useMemo(() => {
    const paths = baseTiles.flatMap((t) => t.previewPaths ?? []);
    return [...new Set(paths)].sort();
  }, [baseTiles]);
  const previewUrls = useQuery({
    queryKey: ['tile-preview-urls', previewPaths],
    queryFn: () => getSignedUrls(previewPaths),
    enabled: active === 'tiles' && previewPaths.length > 0,
    staleTime: 50 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
  const tiles = React.useMemo(() => {
    const urls = previewUrls.data;
    if (!urls?.size) return baseTiles;
    return baseTiles.map((t) => {
      if (!t.previewPaths?.length) return t;
      // I percorsi non firmati si scartano: la card mostra quelli riusciti
      // invece di un riquadro rotto. Il contatore non cambia — le foto nel tile
      // restano quelle, a prescindere da quante siamo riusciti a firmare.
      const uris = t.previewPaths.map((p) => urls.get(p)).filter((u): u is string => !!u);
      return { ...t, previewUris: uris };
    });
  }, [baseTiles, previewUrls.data]);
  const flows = React.useMemo(
    () => (flowsQuery.data?.data ?? []).map(flowHubItemToVM),
    [flowsQuery.data],
  );
  const chronoEvents = React.useMemo(
    () => (chronoQuery.data?.data ?? []).map(tileToChronoEvent).filter((e): e is NonNullable<typeof e> => e !== null),
    [chronoQuery.data],
  );
  const dayLabel = `${DAYS_SHORT[day.getDay()]} ${day.getDate()} ${MONTHS_SHORT[day.getMonth()]}`;

  return (
    <ObsidianViewsScreen
      active={active}
      onActiveChange={handleActive}
      tiles={tiles}
      actionColors={actionColors}
      onAiSearch={setAiQuery}
      onClearAiSearch={() => setAiQuery(null)}
      aiQuery={aiQuery}
      aiSearching={!!aiQuery && aiQueryResult.isFetching}
      aiTileIds={aiTileIds}
      tilesLoading={tilesQuery.isLoading}
      onOpenTile={onOpenTile}
      // Nessun dialogo di conferma: l'avviso è già il gesto. Scoprire il
      // pannello rosso è un movimento deliberato, e il cestino non si può
      // premere finché non è scoperto — chiedere "sei sicuro?" dopo due atti
      // volontari aggiunge un tocco senza aggiungere una decisione.
      onDeleteTile={(id) => deleteTile.mutate(id)}
      flows={flows}
      flowsLoading={flowsQuery.isLoading}
      flowFilter={flowFilter}
      onFlowFilter={setFlowFilter}
      onOpenFlow={onOpenFlow}
      chronoEvents={chronoEvents}
      chronoLoading={chronoQuery.isLoading}
      chronoDayLabel={dayLabel}
      chronoIsToday={dayOffset === 0}
      chronoDate={day}
      onChronoPrev={() => setDayOffset((o) => o - 1)}
      onChronoNext={() => setDayOffset((o) => o + 1)}
      onChronoToday={() => setDayOffset(0)}
      onChronoPickDate={handleChronoPick}
      onOpenEvent={onOpenTile}
      onChronoAddTile={handleChronoAdd}
      haptic={haptic}
      onHaptic={setHaptic}
      confirmDelete={confirmDelete}
      onConfirmDelete={setConfirmDelete}
      themeMode={themeMode}
      onThemeMode={setThemeMode}
      errorText={errorText}
      account={{ email: authUser?.email ?? null, onSignIn, onSignOut: signOut }}
      onHome={onHome}
      onAsk={onAsk}
    />
  );
}
