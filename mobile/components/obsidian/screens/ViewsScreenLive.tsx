/**
 * Gimmick · Obsidian — Views screen wired to live data.
 *
 * Owns the active tab + per-tab data fetching so queries stay gated to the
 * visible tab. Tiles, Flows e Chrono leggono dati veri; il tab Settings è
 * cablato sullo store delle impostazioni.
 */
import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tilesApi, calendarApi, statusesApi, typeIconsApi, settingsApi, sparksApi, type PaginatedResponse } from '@/lib/api';
import { tilesByInsertion, tileToChronoEvent } from '@/lib/obsidian-adapters';
import { startOfDay, startOfWeek, startOfMonth, addDays, addMonths, isToday } from '@/lib/chrono-utils';
import type { ObChronoRange } from './ViewsScreen';
import { getSignedUrls } from '@/lib/storage';
import { DEFAULT_ACTION_COLORS, type TileActionKey } from '@/constants/tile-colors';
import type { Tile } from '@/types';
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
  /** Apre il dettaglio di un tile. Vale anche per i flow: sono tile. */
  onOpenTile?: (id: string) => void;
  /** Fired after the internal switch, so a host route can keep the router in
   *  sync with the visible tab (see app/(tabs)/*). */
  onActiveChange?: (id: MobileViewId) => void;
  /** Ask Gimmick (cerchio a destra nell'header) → chat. */
  onAsk?: () => void;
}

export function ObsidianViewsScreenLive({ initial = 'tiles', active: activeProp, onOpenTile, onActiveChange, onSignIn, onHome, onAsk }: ObsidianViewsScreenLiveProps) {
  const queryClient = useQueryClient();
  const [activeState, setActiveState] = React.useState<MobileViewId>(initial);
  const active = activeProp ?? activeState;
  const handleActive = React.useCallback((id: MobileViewId) => {
    // Controllata dall'esterno: lo stato interno NON si tocca, o l'istanza
    // resterebbe montata con la vista di qualcun altro (vedi `active` nei props).
    if (activeProp === undefined) setActiveState(id);
    onActiveChange?.(id);
  }, [activeProp, onActiveChange]);
  /**
   * Chrono: giorno di ancoraggio + ampiezza della vista (1 / 7 / M).
   *
   * L'ancora è una DATA e non più uno scostamento in giorni da oggi: col passo
   * mensile "un mese avanti" non è un numero fisso di giorni, e su un offset in
   * giorni non lo si sa scrivere. `startOfDay` perché è anche l'estremo della
   * finestra che si chiede al backend.
   */
  const [chronoAnchor, setChronoAnchor] = React.useState<Date>(() => startOfDay(new Date()));
  const [chronoRange, setChronoRange] = React.useState<ObChronoRange>('daily');

  // Settings tab — persisted via settingsStore (AsyncStorage).
  const haptic = useSettingsStore((s) => s.hapticFeedback);
  const setHaptic = useSettingsStore((s) => s.setHapticFeedback);
  const confirmDelete = useSettingsStore((s) => s.confirmDelete);
  const setConfirmDelete = useSettingsStore((s) => s.setConfirmDelete);
  const themeMode = useSettingsStore((s) => s.theme);
  const setThemeMode = useSettingsStore((s) => s.setTheme);

  const authUser = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);

  /**
   * Tiles e Flows disegnano la STESSA card, quindi hanno bisogno delle stesse
   * anagrafiche (status, tipi, colori azione) e delle stesse anteprime firmate.
   * Gating comune invece di `active === 'tiles'` sparso: legandole al solo tab
   * Tiles, la lista dei flow sarebbe rimasta senza glifo di status, senza
   * colore d'azione e senza miniature.
   */
  const wantsTileMeta = active === 'tiles' || active === 'flows';

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
  // Cambiano di rado → staleTime lungo.
  const statusesQuery = useQuery({
    queryKey: ['statuses'],
    queryFn: () => statusesApi.list(),
    enabled: wantsTileMeta,
    staleTime: 5 * 60 * 1000,
  });
  const typeIconsQuery = useQuery({
    queryKey: ['type-icons'],
    queryFn: () => typeIconsApi.list(),
    enabled: wantsTileMeta,
    staleTime: 5 * 60 * 1000,
  });
  const typeAssignQuery = useQuery({
    queryKey: ['type-icons', 'assignments'],
    queryFn: () => typeIconsApi.getAssignments(),
    enabled: wantsTileMeta,
    staleTime: 5 * 60 * 1000,
  });
  // Colori dei badge azione: stessa impostazione utente che colora il canvas
  // (settings `action_colors`), con gli stessi default se non è mai stata
  // toccata — così un tile ha gli stessi colori su board e telefono.
  const actionColorsQuery = useQuery({
    queryKey: ['settings', 'action_colors'],
    queryFn: () => settingsApi.get<Partial<Record<TileActionKey, string>>>('action_colors'),
    enabled: wantsTileMeta,
    staleTime: 5 * 60 * 1000,
  });
  const actionColors = React.useMemo(
    () => ({ ...DEFAULT_ACTION_COLORS, ...(actionColorsQuery.data?.data ?? {}) }),
    [actionColorsQuery.data],
  );

  /**
   * I flow sono TILE: si chiedono a `/api/tiles` filtrando per action_type, non
   * più a `/api/flows/hub` (rotta ritirata col modello a nodi).
   *
   * Il filtro è lato SERVER e non lato client: senza, il tetto di 100 è
   * spartito fra tutti i tipi in ordine di creazione, e con gli eventi che sono
   * la maggioranza dei tile la colonna dei flow risulterebbe quasi vuota pur
   * avendone. Stessa scelta del web (chrono-live.tsx).
   */
  const flowsQuery = useQuery({
    queryKey: ['tiles', { page: 1, limit: 100, action_type: 'flow' }],
    queryFn: () => tilesApi.list({ page: 1, limit: 100, action_type: 'flow' }),
    enabled: active === 'flows',
  });

  /**
   * Finestra da chiedere al backend, secondo l'ampiezza scelta.
   *
   * Il mese chiede le 6 SETTIMANE della griglia, non i giorni del mese: la
   * tabella comincia dal lunedì che precede il primo e finisce dopo l'ultimo, e
   * chiedendo solo il mese quelle caselle di bordo risulterebbero vuote anche
   * quando hanno eventi — sembrerebbe un dato mancante, non un altro mese.
   */
  const { winStart, winEnd } = React.useMemo(() => {
    if (chronoRange === 'week') {
      const s = startOfWeek(chronoAnchor);
      return { winStart: s, winEnd: addDays(s, 7) };
    }
    if (chronoRange === 'month') {
      const s = startOfWeek(startOfMonth(chronoAnchor));
      return { winStart: s, winEnd: addDays(s, 42) };
    }
    return { winStart: chronoAnchor, winEnd: addDays(chronoAnchor, 1) };
  }, [chronoRange, chronoAnchor]);

  const chronoQuery = useQuery({
    queryKey: ['calendar-events', winStart.toISOString(), winEnd.toISOString()],
    queryFn: () => calendarApi.events(winStart.toISOString(), winEnd.toISOString()),
    enabled: active === 'chrono',
  });

  /** Un passo avanti/indietro vale un giorno, una settimana o un mese. */
  const stepChrono = React.useCallback((dir: 1 | -1) => {
    setChronoAnchor((a) => (
      chronoRange === 'month' ? addMonths(a, dir)
      : chronoRange === 'week' ? addDays(a, 7 * dir)
      : addDays(a, dir)
    ));
  }, [chronoRange]);

  /**
   * Tocco su un giorno (intestazione della settimana o casella del mese): ci si
   * ancora sopra E si scende alla vista giornaliera. In settimana e mese la
   * colonna è larga ~48dp e mostra sì e no il titolo: il tocco serve ad andare a
   * vedere, non a selezionare qualcosa che resterebbe illeggibile lì.
   */
  const handleChronoSelectDay = React.useCallback((d: Date) => {
    setChronoAnchor(startOfDay(d));
    setChronoRange('daily');
  }, []);

  /**
   * Data scelta col picker → ci si ancora sopra, restando nell'ampiezza
   * corrente: da "M" si scegli un giorno e si vede il SUO mese, non il giorno.
   */
  const handleChronoPick = React.useCallback((picked: Date) => {
    setChronoAnchor(startOfDay(picked));
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
      const start = new Date(chronoAnchor);
      if (isToday(chronoAnchor)) {
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
  }, [chronoAnchor, queryClient, onOpenTile]);

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
  const baseFlows = React.useMemo(
    () => tilesByInsertion(flowsQuery.data?.data ?? [], { statusNameById, typeByTile }),
    [flowsQuery.data, statusNameById, typeByTile],
  );

  // Anteprime della lista. Il bucket è privato, quindi ogni immagine va firmata:
  // si firmano TUTTE in una richiesta sola (`createSignedUrls`) invece di una
  // per card. La chiave della query è l'elenco dei percorsi, così il risultato
  // si riusa finché la lista non cambia; `staleTime` sta sotto l'ora di validità
  // della firma, altrimenti si mostrerebbero URL scaduti.
  // Tiles e Flows firmano INSIEME: solo un tab per volta è attivo, quindi
  // l'elenco è di fatto quello della lista a video, e le due liste condividono
  // la cache quando uno stesso tile compare in entrambe.
  const previewPaths = React.useMemo(() => {
    const paths = [...baseTiles, ...baseFlows].flatMap((t) => t.previewPaths ?? []);
    return [...new Set(paths)].sort();
  }, [baseTiles, baseFlows]);
  const previewUrls = useQuery({
    queryKey: ['tile-preview-urls', previewPaths],
    queryFn: () => getSignedUrls(previewPaths),
    enabled: wantsTileMeta && previewPaths.length > 0,
    staleTime: 50 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
  /** Attacca gli URL firmati ai percorsi della card. */
  const withPreviews = React.useCallback((list: typeof baseTiles) => {
    const urls = previewUrls.data;
    if (!urls?.size) return list;
    return list.map((t) => {
      if (!t.previewPaths?.length) return t;
      // I percorsi non firmati si scartano: la card mostra quelli riusciti
      // invece di un riquadro rotto. Il contatore non cambia — le foto nel tile
      // restano quelle, a prescindere da quante siamo riusciti a firmare.
      const uris = t.previewPaths.map((p) => urls.get(p)).filter((u): u is string => !!u);
      return { ...t, previewUris: uris };
    });
  }, [previewUrls.data]);
  const tiles = React.useMemo(() => withPreviews(baseTiles), [baseTiles, withPreviews]);
  const flows = React.useMemo(() => withPreviews(baseFlows), [baseFlows, withPreviews]);
  const chronoEvents = React.useMemo(
    () => (chronoQuery.data?.data ?? []).map(tileToChronoEvent).filter((e): e is NonNullable<typeof e> => e !== null),
    [chronoQuery.data],
  );
  /**
   * Etichetta premibile in cima: dice quale finestra si sta guardando.
   *
   * Sta in ~62dp — la riga dei sei tondi si prende tutto il resto (vedi
   * CH_NAV_BTN in ViewsScreen), e in RN quei pulsanti non si comprimono: una
   * scritta più lunga si troncherebbe e basta. Da qui le forme corte:
   *   · giorno    → "Mer 5 ago"
   *   · settimana → "3–9 ago" e, a cavallo di due mesi, "30/7–5/8": il numerico
   *     è brutto ma sta dentro, mentre "30 lug – 5 ago" verrebbe tagliato a metà
   *     proprio sulla seconda data, cioè sull'informazione che manca;
   *   · mese      → "ago 2026", stesso mese abbreviato del giorno.
   * Il dettaglio comunque non manca: settimana e mese scrivono i numeri dei
   * giorni nelle proprie intestazioni.
   */
  const chronoLabel = React.useMemo(() => {
    if (chronoRange === 'week') {
      const s = winStart;
      const e = addDays(winStart, 6);
      return s.getMonth() === e.getMonth()
        ? `${s.getDate()}–${e.getDate()} ${MONTHS_SHORT[e.getMonth()]}`
        : `${s.getDate()}/${s.getMonth() + 1}–${e.getDate()}/${e.getMonth() + 1}`;
    }
    if (chronoRange === 'month') {
      return `${MONTHS_SHORT[chronoAnchor.getMonth()]} ${chronoAnchor.getFullYear()}`;
    }
    return `${DAYS_SHORT[chronoAnchor.getDay()]} ${chronoAnchor.getDate()} ${MONTHS_SHORT[chronoAnchor.getMonth()]}`;
  }, [chronoRange, chronoAnchor, winStart]);

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
      chronoEvents={chronoEvents}
      chronoLoading={chronoQuery.isLoading}
      chronoDayLabel={chronoLabel}
      chronoIsToday={isToday(chronoAnchor)}
      chronoDate={chronoAnchor}
      chronoRange={chronoRange}
      onChronoRange={setChronoRange}
      onChronoSelectDay={handleChronoSelectDay}
      onChronoPrev={() => stepChrono(-1)}
      onChronoNext={() => stepChrono(1)}
      onChronoToday={() => setChronoAnchor(startOfDay(new Date()))}
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
