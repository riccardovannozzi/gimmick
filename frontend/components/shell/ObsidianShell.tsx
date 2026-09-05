'use client';

/**
 * Gimmick · Obsidian — Shell live (Fase 0 della migrazione).
 *
 * Compone l'`AppShell` con dati REALI: Sidebar dai tag dell'utente, Header con
 * callback effettive (Ask/Bell/Settings/Avatar + navigazione viste via router),
 * Inspector come contenitore del dettaglio tile. A differenza di
 * `app/obsidian-shell/page.tsx` (anteprima con mock), questo wrapper si collega
 * a React Query, agli store e al routing Next.js per-URL.
 *
 * Il routing resta per-URL: `onViewChange` fa `router.push`, e la vista attiva
 * è derivata dal pathname. Così deep-link, back/forward e le query string
 * esistenti (`?tile=`, `?flow=`, `?tag=`) restano intatti.
 *
 * In Fase 0 le `children` sono ancora le vecchie pagine: lo shell le ospita
 * senza modificarle. L'Inspector mostra un empty-state finché una vista
 * migrata non inietta il proprio dettaglio tramite la prop `inspector`.
 */
import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AppShell, Sidebar, Inspector, NewTagModal, DEFAULT_RIGHT_VIEWS, type ViewId, type SidebarGroup } from '@/components/shell';
import { useViewPrefs } from '@/store/view-prefs-store';
import { tagsApi } from '@/lib/api';
import { prefetchView } from '@/lib/view-prefetch';
import { useTagTypes } from '@/store/tag-types-store';
import { useTagFilterStore } from '@/store/tag-filter-store';
import { useIsomorphicLayoutEffect } from '@/lib/use-isomorphic-layout-effect';
import { useChatStore } from '@/store/chat-store';
import { useAuthStore } from '@/store/auth-store';
import { useTileSelectionStore } from '@/store/tile-selection-store';
import { TileSidebar } from '@/components/tileview/TileSidebar';
import { useObsidianTheme } from '@/lib/theme/obsidian-provider';
import { tagsToSidebarGroups } from '@/lib/theme/tags-to-groups';
import type { Tag } from '@/types';
import { OB_LEADING, OB_TEXT } from '@/lib/theme/ob-typography';
import { ContactsModal } from '@/components/contacts/ContactsModal';
import { SettingsModal } from '@/components/views/settings-modal';
import { useSettingsModal } from '@/store/settings-modal-store';

/** Mappa vista → rotta. Single source of truth per la navigazione dello shell. */
const VIEW_TO_PATH: Record<ViewId, string> = {
  sparks: '/sparks',
  tiles: '/tiles',
  tags: '/tags',
  chrono: '/calendar',
  canvas: '/canvas',
  kanban: '/kanban',
  cockpit: '/cockpit',
  panopticon: '/graph',
};

const PATH_TO_VIEW: Record<string, ViewId> = Object.fromEntries(
  Object.entries(VIEW_TO_PATH).map(([view, path]) => [path, view as ViewId]),
) as Record<string, ViewId>;

export interface ObsidianShellProps {
  children: React.ReactNode;
  /** Override del pannello dettaglio. Default: empty-state Obsidian. */
  inspector?: React.ReactNode;
}

export function ObsidianShell({ children, inspector }: ObsidianShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { mode } = useObsidianTheme();

  const user = useAuthStore((s) => s.user);
  const setChatOpen = useChatStore((s) => s.setOpen);
  const selectedTagIds = useTagFilterStore((s) => s.selectedTagIds);
  const selectOnly = useTagFilterStore((s) => s.selectOnly);
  const toggleTag = useTagFilterStore((s) => s.toggle);
  const hydrateTags = useTagFilterStore((s) => s.hydrate);
  const pruneTags = useTagFilterStore((s) => s.prune);
  const selectedTileId = useTileSelectionStore((s) => s.selectedTileId);
  const clearTile = useTileSelectionStore((s) => s.clear);
  const { tagTypes } = useTagTypes();

  const { data: tagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagsApi.list(),
    enabled: !!user,
  });

  const { groups, count } = React.useMemo(
    () => tagsToSidebarGroups((tagsData?.data ?? []) as Tag[], tagTypes),
    [tagsData?.data, tagTypes],
  );

  /**
   * La selezione dei tag dell'ultima sessione. Sta qui e non nelle viste perché
   * lo shell è l'unica cosa montata sempre: ripristinandola nel Kanban, entrare
   * nel Kanban dopo aver scelto un tag altrove avrebbe sovrascritto la scelta
   * appena fatta con quella vecchia.
   */
  useIsomorphicLayoutEffect(() => { hydrateTags(); }, [hydrateTags]);

  /**
   * Le viste OPZIONALI. Oggi solo il Panopticon, spento finché non lo accendi
   * dalle impostazioni — vedi `store/view-prefs-store`.
   *
   * L'idratazione è in layout-effect, prima del paint: il default è «spento»,
   * quindi un'idratazione tardiva farebbe comparire la linguetta a cose fatte,
   * e una cosa che appare da sola dopo mezzo secondo sembra un guasto.
   */
  const panopticonOn = useViewPrefs((s) => s.panopticon);
  const hydrateViews = useViewPrefs((s) => s.hydrate);
  useIsomorphicLayoutEffect(() => { hydrateViews(); }, [hydrateViews]);

  const rightViews = React.useMemo(
    () => DEFAULT_RIGHT_VIEWS.filter((v) => v.id !== 'panopticon' || panopticonOn),
    [panopticonOn],
  );
  /** Le rotte che la barra può raggiungere: solo queste si scaldano. */
  const reachableViews = React.useMemo(
    () => (Object.keys(VIEW_TO_PATH) as ViewId[]).filter((v) => v !== 'panopticon' || panopticonOn),
    [panopticonOn],
  );

  // Un tag cancellato lascerebbe il suo id nella selezione persistita, e le
  // viste filtrerebbero su qualcosa che non esiste: board vuota e niente di
  // acceso che spieghi il perché. Si potano quando l'elenco vero è arrivato —
  // mai su un elenco vuoto, che in caricamento cancellerebbe tutto.
  const knownTagIds = React.useMemo(
    () => new Set(((tagsData?.data ?? []) as Tag[]).map((t) => t.id)),
    [tagsData?.data],
  );
  React.useEffect(() => {
    if (knownTagIds.size) pruneTags(knownTagIds);
  }, [knownTagIds, pruneTags]);

  /**
   * Navigazione ottimistica: il tab attivo deriva dal pathname, che si aggiorna
   * solo quando la navigazione si committa → il clic sembrava «non rispondere».
   * Teniamo una vista ottimistica che accende subito il tab cliccato, e la
   * azzeriamo quando il pathname raggiunge la destinazione.
   *
   * ⚠️ La navigazione NON è avvolta in `startTransition`. Lo era, e le due cose
   * si annullavano a vicenda: una transizione serve a TRATTENERE la vista
   * vecchia finché la nuova non è pronta, mentre `app/(dashboard)/loading.tsx`
   * esiste per mostrare SUBITO un fallback. Sono due esperienze opposte, ed è
   * stato scelto il fallback — trattenere la vecchia dà l'impressione che il
   * clic non sia arrivato. Il flag `isPending` per giunta veniva scartato, così
   * la transizione ritardava il commit senza dare niente in cambio.
   *
   * ⚠️ `activeView` accende la linguetta e scalda le cache: sono cose che
   * possono anticipare i fatti. Per decidere COSA C'È sullo schermo — quali
   * pannelli montare — si usa `derivedView`, che cambia insieme ai figli.
   */
  const derivedView: ViewId = PATH_TO_VIEW[pathname ?? ''] ?? 'tiles';
  const [optimisticView, setOptimisticView] = React.useState<ViewId | null>(null);
  const activeView = optimisticView ?? derivedView;

  React.useEffect(() => {
    if (optimisticView && derivedView === optimisticView) setOptimisticView(null);
  }, [derivedView, optimisticView]);

  // Prefetch di tutte le rotte delle viste al mount: il cambio pagina diventa
  // istantaneo (bundle + payload RSC già pronti) invece di caricare on-click.
  React.useEffect(() => {
    for (const v of reachableViews) router.prefetch(VIEW_TO_PATH[v]);
  }, [router, reachableViews]);

  // Prefetch dei DATI di TUTTE le viste quando il browser è inattivo. L'hover
  // sul tab copriva solo il mouse (e solo se ci passavi sopra abbastanza): al
  // clic diretto la vista montava e restava ad aspettare la rete. Scaldando la
  // cache a idle, il cambio vista trova i dati già pronti. Le viste diverse da
  // quella corrente vengono scaldate in coda, una per callback di idle, per non
  // competere con il rendering della vista attiva.
  React.useEffect(() => {
    // Solo le viste raggiungibili: scaldare i dati del Panopticon quando è
    // spento sarebbe la richiesta più pesante dell'app fatta per niente.
    const others = reachableViews.filter((v) => v !== activeView);
    let cancelled = false;
    type IdleWindow = Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    };
    const w = window as IdleWindow;
    const schedule = (cb: () => void) =>
      w.requestIdleCallback ? w.requestIdleCallback(cb, { timeout: 2000 }) : window.setTimeout(cb, 300);

    const next = (i: number) => {
      if (cancelled || i >= others.length) return;
      schedule(() => {
        if (cancelled) return;
        prefetchView(queryClient, others[i]);
        next(i + 1);
      });
    };
    next(0);
    return () => { cancelled = true; };
    // Si rilancia al cambio vista: la nuova "corrente" esce dalla coda e le
    // altre restano calde.
  }, [activeView, queryClient, reachableViews]);

  const handleViewChange = React.useCallback((v: ViewId) => {
    if (v === activeView) return;
    setOptimisticView(v); // feedback immediato sul tab
    router.push(VIEW_TO_PATH[v]);
  }, [activeView, router]);

  // Hover su un tab → prefetch dei dati della vista: al clic il contenuto è
  // spesso già in cache (niente spinner), oltre alla rotta già prefetchata.
  const handleHoverView = React.useCallback((v: ViewId) => {
    router.prefetch(VIEW_TO_PATH[v]);
    prefetchView(queryClient, v);
  }, [router, queryClient]);

  // Filtro Sidebar (Tutti / Pinned).
  const [tagFilter, setTagFilter] = React.useState('all');
  const [contactsOpen, setContactsOpen] = React.useState(false);
  // I settings NON sono uno `useState` locale: li apre anche la vecchia rotta
  // `/settings`, che è un reindirizzo e vive fra le `children`.
  const openSettings = useSettingsModal((s) => s.setOpen);
  /** Il gruppo su cui si è chiesto «Aggiungi tag». `null` = modale chiusa. */
  const [addTagGroup, setAddTagGroup] = React.useState<SidebarGroup | null>(null);

  // Pin/unpin di un tag: aggiornamento ottimistico della cache ['tags'].
  const handleTogglePin = React.useCallback((tagId: string, pinned: boolean) => {
    queryClient.setQueryData(['tags'], (old: { data?: Tag[] } | undefined) => {
      if (!old?.data) return old;
      return { ...old, data: old.data.map((t) => (t.id === tagId ? { ...t, is_pinned: pinned } : t)) };
    });
    tagsApi.update(tagId, { is_pinned: pinned })
      .finally(() => queryClient.invalidateQueries({ queryKey: ['tags'] }));
  }, [queryClient]);

  // Sposta un tag in Storage (archivia) o lo ripristina in Tags, con
  // aggiornamento ottimistico della cache ['tags']. Archiviare un tag lo
  // rimuove anche dai pinnati (uno stato archiviato non ha senso "in evidenza").
  const handleToggleArchive = React.useCallback((tagId: string, archived: boolean) => {
    // Un tag archiviato sparisce dalla lista «Tags», ma restava selezionato: la
    // board continuava a mostrare SOLO i suoi tile, e nella sidebar non c'era
    // più niente di acceso a dire perché. Archiviare è anche smettere di
    // guardarlo.
    if (archived && selectedTagIds.has(tagId)) toggleTag(tagId);
    queryClient.setQueryData(['tags'], (old: { data?: Tag[] } | undefined) => {
      if (!old?.data) return old;
      return { ...old, data: old.data.map((t) => (t.id === tagId ? { ...t, is_archived: archived, is_pinned: archived ? false : t.is_pinned } : t)) };
    });
    const updates = archived ? { is_archived: true, is_pinned: false } : { is_archived: false };
    tagsApi.update(tagId, updates)
      .finally(() => queryClient.invalidateQueries({ queryKey: ['tags'] }));
  }, [queryClient, selectedTagIds, toggleTag]);

  // Apri il tag nel Canvas (con navigazione ottimistica come i tab).
  const handleOpenCanvas = React.useCallback((tagId: string) => {
    setOptimisticView('canvas');
    router.push(`/canvas?tag=${tagId}`);
  }, [router]);

  /**
   * ─── La colonna centrale è UN RESTO ─────────────────────────────────────────
   *
   * Le due sponde hanno larghezza costante — 200 la sidebar dei tag, 280 il
   * pannello destro — e il centro è quello che avanza. È l'invariante che tiene
   * ferme le viste quando si passa dall'una all'altra: se una vista si prende
   * anche i 280 della sponda destra, cambiare vista sposta di 280px tutto quello
   * che c'è in mezzo.
   *
   * L'unica eccezione ammessa è il CANVAS, che una sponda destra ce l'ha ma se
   * la disegna da sé (le servono gli editor di gruppo, edge e box di testo che
   * l'Inspector generico non ha) — ed è larga 280 come questa, quindi il conto
   * torna lo stesso.
   *
   * ⚠️ Qui c'era anche il PANOPTICON, ma era un errore di simmetria: il Graph
   * NON ha una sponda propria (la console della fisica è un pannello a comparsa,
   * chiuso di default), quindi lo shell gli toglieva l'Inspector senza che
   * nessuno lo rimpiazzasse. Entrare e uscire dal Graph allargava e restringeva
   * il centro di 280px a ogni giro.
   *
   * ⚠️ Si legge `derivedView`, NON `activeView`. La differenza è tutta nel
   * momento in cui cambiano: `activeView` è la vista OTTIMISTICA e scatta al
   * click, mentre `children` è ancora la pagina vecchia finché la navigazione
   * non si è committata. `derivedView` viene dal pathname, che cambia nello
   * STESSO commit in cui arrivano i figli nuovi: è l'unica delle due che
   * descrive quello che c'è davvero sullo schermo.
   *
   * Con `activeView` la protezione si girava contro: uscendo dal Canvas lo shell
   * montava il suo Inspector mentre la lavagna era ancora lì con il proprio
   * (l'ultimo ramo della sidebar destra del canvas è un `TileSidebar` sempre
   * reso, non condizionale) — due rail insieme, la lavagna schiacciata di 280px
   * e il layer D3 ridisegnato sulla larghezza nuova, per poi rimettersi a posto
   * a transizione finita. Entrando nel Canvas succedeva lo specchio: l'Inspector
   * spariva subito e la pagina vecchia si allargava prima di andarsene.
   *
   * L'ottimismo serve ad accendere la linguetta, non a decidere quali pannelli
   * esistono: una variabile che anticipa i fatti non può reggere la struttura.
   */
  const pageOwnsInspector = derivedView === 'canvas';
  const activeChildIds = React.useMemo(() => [...selectedTagIds], [selectedTagIds]);

  const userInitials = (user?.email ?? 'GM').slice(0, 2).toUpperCase();

  return (
    <AppShell
      mode={mode}
      fill
      activeView={activeView}
      onViewChange={handleViewChange}
      header={{
        userInitials,
        rightViews,
        onHoverView: handleHoverView,
        onContacts: () => setContactsOpen(true),
        onAsk: () => setChatOpen(true),
        onBell: () => router.push('/tiles'),
        onSettings: () => openSettings(true),
        onAvatar: () => openSettings(true),
      }}
      sidebar={
        <Sidebar
          groups={groups}
          count={count}
          activeChildIds={activeChildIds}
          onSelectChild={(id, additive) => {
            // In Canvas il click sul tag apre direttamente la sua lavagna
            // (senza dover usare l'icona "Apri nel Canvas"). Nelle altre viste
            // resta una semplice selezione/filtro.
            //
            // ⚠️ Il canvas IGNORA il ctrl: una lavagna è di un tag solo, e la sua
            // rotta ne porta uno solo (`?tag=`). Accettando qui la selezione
            // multipla la sidebar avrebbe acceso due tag mentre la lavagna ne
            // mostrava uno — l'evidenziazione deve dire cosa stai guardando.
            if (activeView === 'canvas') { selectOnly(id); handleOpenCanvas(id); return; }
            if (additive) toggleTag(id);
            else selectOnly(id);
          }}
          filter={tagFilter}
          onFilterChange={setTagFilter}
          pinnedLabel="Pinned"
          storageLabel="Storage"
          onTogglePin={handleTogglePin}
          onToggleArchive={handleToggleArchive}
          onOpenCanvas={handleOpenCanvas}
          onAddTag={setAddTagGroup}
        />
      }
      // Niente `invalidateKeys` sulla sidebar: aggiorna da sé TUTTE le liste di
      // tile (vedi `lib/tile-cache`). Qui ne dichiarava una sola — `tiles` — e
      // per questo modificare un tile dal pannello destro non muoveva la card
      // della board che si stava guardando accanto.
      inspector={
        inspector ??
        (pageOwnsInspector ? undefined : selectedTileId ? (
          <TileSidebar
            tileId={selectedTileId}
            open
            onToggle={clearTile}
          />
        ) : (
          <Inspector><InspectorEmpty /></Inspector>
        ))
      }
    >
      {children}
      <ContactsModal open={contactsOpen} onClose={() => setContactsOpen(false)} />
      {/* Montata una volta sola qui: lo shell c'è in ogni vista, quindi le
          impostazioni si aprono da qualunque punto dell'app senza cambiare
          rotta — e chiudendole torni dove stavi, non su una vista a caso. */}
      <SettingsModal />
      {/* Il tag nuovo si accende subito nella sidebar: hai appena detto che ti
          interessa, e trovarlo già selezionato risparmia il passaggio di
          cercarlo nella lista che si è appena riordinata sotto di te. */}
      <NewTagModal
        group={addTagGroup}
        onClose={() => setAddTagGroup(null)}
        onCreated={(id) => selectOnly(id)}
      />
    </AppShell>
  );
}

function InspectorEmpty() {
  return (
    <div
      style={{
        padding: '48px 20px',
        textAlign: 'center',
        color: 'var(--ob-subtle)',
        fontSize: OB_TEXT.control,
        lineHeight: OB_LEADING.text,
        fontFamily: 'var(--ob-font-sans)',
      }}
    >
      Seleziona un tile per vederne il dettaglio.
    </div>
  );
}
