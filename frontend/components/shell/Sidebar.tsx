'use client';

/**
 * Gimmick · Obsidian — Left Sidebar (tag / cartelle).
 *
 * "Sidebar Sinistra" (panel #1): TAG header + count, Tutti/Pinned segmented,
 * collapsible tag groups (folders) with children. Reference: GimmickApp.dc.html
 * / GimmickSidebar.dc.html. Single tag per tile, so children select exclusively.
 */
import * as React from 'react';
import { createPortal } from 'react-dom';
import * as TablerIcons from '@tabler/icons-react';
import { IconPin, IconPinFilled, IconArchive, IconArchiveOff, IconPlus } from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import { SegmentedControl } from '@/components/primitives';
import { Icon, type ShellIconName } from './icons';

/** Risolutore icone Tabler per nome (il tag-type salva il glyph in `emoji`,
 *  es. "IconBuilding"). Stesso pattern di settings-management / icon-picker. */
const TablerMap = TablerIcons as unknown as Record<
  string,
  React.ComponentType<{ size?: number; color?: string; stroke?: number }>
>;

export interface SidebarChild {
  id: string;
  name: string;
  pinned?: boolean;
  /** Tag archiviato → visibile solo nella tab "Storage". */
  archived?: boolean;
}

export interface SidebarGroup {
  id: string;
  name: string;
  icon: ShellIconName;
  /** Emoji del tag-type: se presente, ha la priorità sul glyph `icon`. */
  emoji?: string;
  /** Folder accent color (a tag color, not a type color). */
  color?: string;
  defaultOpen?: boolean;
  children?: SidebarChild[];
}

export interface SidebarProps {
  groups: SidebarGroup[];
  /** Total tag count shown in the header badge. */
  count?: number;
  /** Tag selezionati. Più d'uno quando li si prende con ctrl/cmd+click: le viste
   *  che filtrano per tag ne mostrano l'unione. */
  activeChildIds?: string[];
  /** `additive` = ctrl/cmd premuto: aggiungi/togli invece di sostituire. */
  onSelectChild?: (id: string, additive: boolean) => void;
  filter?: string;
  onFilterChange?: (value: string) => void;
  /** Label for the "pinned" segment (e.g. "Pinned · 2"). */
  pinnedLabel?: string;
  /** Label for the "storage" segment (e.g. "Storage · 3"). */
  storageLabel?: string;
  /** Toggle pin su un tag (figlio). `pinned` = nuovo stato desiderato. */
  onTogglePin?: (tagId: string, pinned: boolean) => void;
  /** Sposta un tag in Storage / ripristinalo in Tags. `archived` = nuovo stato. */
  onToggleArchive?: (tagId: string, archived: boolean) => void;
  /** Apri il tag selezionato nel Canvas. */
  onOpenCanvas?: (tagId: string) => void;
  /**
   * Tasto destro sulla testata di un gruppo → «Aggiungi tag». Il parent apre la
   * modale: la sidebar non sa creare niente, sa solo dire dove è stato chiesto.
   */
  onAddTag?: (group: SidebarGroup) => void;
}

export function Sidebar({
  groups,
  count,
  activeChildIds,
  onSelectChild,
  filter = 'all',
  onFilterChange,
  pinnedLabel = 'Pinned',
  storageLabel = 'Storage',
  onTogglePin,
  onToggleArchive,
  onOpenCanvas,
  onAddTag,
}: SidebarProps) {
  const [open, setOpen] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.map((g) => [g.id, g.defaultOpen ?? false])),
  );
  // Ricerca testuale: filtra gruppi e tag per nome.
  const [query, setQuery] = React.useState('');
  const q = query.trim().toLowerCase();

  const activeIds = React.useMemo(() => new Set(activeChildIds), [activeChildIds]);

  /**
   * Il menu del tasto destro su una riga tag. Porta le azioni che prima stavano
   * sulla riga come tre bottoni da 24px — pin, archivia, apri nel canvas.
   *
   * Se non è arrivato nessun callback non c'è niente da mostrare, e il tasto
   * destro torna a fare quello che fa il browser (anteprime senza handler).
   */
  const hasActions = !!onTogglePin || !!onToggleArchive || !!onOpenCanvas;
  /**
   * Un solo menu per due bersagli: la RIGA di un tag e la TESTATA di un gruppo.
   * Uno stato solo, perché due menu potrebbero restare aperti insieme — e
   * perché la posizione, la chiusura con Escape, lo sfondo che intercetta il
   * click e il ritaglio sui bordi della finestra sono gli stessi in entrambi i
   * casi. Cambia solo cosa c'è dentro.
   */
  type SidebarMenu =
    | { x: number; y: number; kind: 'child'; child: SidebarChild }
    | { x: number; y: number; kind: 'group'; group: SidebarGroup };
  const [menu, setMenu] = React.useState<SidebarMenu | null>(null);
  const closeMenu = React.useCallback(() => setMenu(null), []);
  React.useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menu]);

  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  // "Espandi/Comprimi tutto": apre tutti i gruppi se almeno uno è chiuso,
  // altrimenti li chiude tutti.
  const allOpen = groups.length > 0 && groups.every((g) => open[g.id]);
  const toggleAll = () =>
    setOpen(Object.fromEntries(groups.map((g) => [g.id, !allOpen])));

  // Quante voci avrà il menu aperto, e quindi quanto è alto: 8 di padding, 29 per
  // voce, 9 per il separatore. STIMATA e non misurata: misurarla vorrebbe dire
  // disegnare il menu nel posto sbagliato e poi spostarlo, che si vede.
  const ctxItems = !menu
    ? 0
    : menu.kind === 'group'
      ? 1
      : (onOpenCanvas ? 1 : 0) + (onTogglePin && !menu.child.archived ? 1 : 0) + (onToggleArchive ? 1 : 0);
  const ctxSep = menu?.kind === 'child' && onOpenCanvas && (onTogglePin || onToggleArchive) ? 9 : 0;
  const ctxH = 8 + ctxItems * 29 + ctxSep;

  return (
    <aside className="ob-sb">
      {/* Header della sidebar: prima barra della fascia sotto la navbar, come
          la toolbar del canvas e la tabbar dell'inspector. Resta fissa mentre
          la lista dei tag scorre nel corpo. */}
      <div className="ob-sb__bar">
        <div className="ob-sb__seg">
          <SegmentedControl
            aria-label="Filtro tag"
            value={filter}
            onChange={(v) => onFilterChange?.(v)}
            items={[
              { value: 'storage', label: storageLabel },
              { value: 'all', label: 'Tags' },
              { value: 'pinned', label: pinnedLabel },
            ]}
          />
        </div>
      </div>

      <div className="ob-sb__body ob-scroll">
      <div className="ob-sb__search">
        <Icon name="search" size={14} className="ob-sb__search-icon" />
        <input
          type="text"
          className="ob-sb__search-input"
          placeholder="Cerca tag…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Cerca tag"
        />
        {query && (
          <button type="button" className="ob-sb__search-clear" onClick={() => setQuery('')} aria-label="Cancella ricerca">×</button>
        )}
      </div>

      <button type="button" className="ob-sb__expand" onClick={toggleAll}>
        <Icon name="sort" size={13} />
        {allOpen ? 'Comprimi tutto' : 'Espandi tutto'}
      </button>

      {groups.map((g) => {
        // Filtro per tab: Storage → solo archiviati; Pinned → pinnati non
        // archiviati; Tags → attivi (non archiviati).
        let kids = (g.children ?? []).filter((c) => {
          if (filter === 'storage') return c.archived;
          if (filter === 'pinned') return !c.archived && c.pinned;
          return !c.archived;
        });
        // Ricerca: se il nome del gruppo combacia mostra tutti i suoi tag,
        // altrimenti solo i tag che combaciano; nascondi i gruppi senza match.
        const groupMatches = q !== '' && g.name.toLowerCase().includes(q);
        if (q && !groupMatches) kids = kids.filter((c) => c.name.toLowerCase().includes(q));
        // Nascondi i gruppi senza tag visibili nella tab corrente.
        if (kids.length === 0) return null;
        // Durante la ricerca i gruppi con match sono sempre espansi.
        const isOpen = q ? true : open[g.id];
        // Il tag-type salva il glyph come nome Tabler in `emoji`; se risolvibile
        // ha la priorità, altrimenti si usa il glyph dello shell `g.icon`.
        const Glyph = g.emoji ? TablerMap[g.emoji] : undefined;
        return (
          <div key={g.id} className="ob-sb-group">
            <button
              type="button"
              className="ob-sb-group__head"
              onClick={() => toggle(g.id)}
              aria-expanded={isOpen}
              // Tasto destro sulla testata → «Aggiungi tag». Il gruppo è già il
              // tipo del tag che nascerà: il gesto porta con sé la risposta a
              // una delle tre domande del modulo.
              onContextMenu={(e) => {
                if (!onAddTag) return;
                e.preventDefault();
                e.stopPropagation();
                setMenu({ x: e.clientX, y: e.clientY, kind: 'group', group: g });
              }}
              title={onAddTag ? `${g.name}\nTasto destro per aggiungere un tag qui dentro` : g.name}
            >
              <span className={cn('ob-sb-group__chev', isOpen && 'ob-sb-group__chev--open')}>
                <Icon name="chevR" size={13} stroke={1.8} />
              </span>
              <span className="ob-sb-group__glyph">
                {Glyph ? (
                  <Glyph size={16} color={g.color} stroke={1.7} />
                ) : (
                  <Icon name={g.icon} size={16} color={g.color} style={g.color ? { color: g.color } : undefined} />
                )}
              </span>
              <span className="ob-sb-group__name">{g.name}</span>
            </button>
            {isOpen && kids.length > 0 && (
              <div className="ob-sb-group__kids">
                {kids.map((c) => {
                  const isActive = activeIds.has(c.id);
                  return (
                    <div
                      key={c.id}
                      className={cn('ob-sb-child', isActive && 'ob-sb-child--active')}
                      // Tasto destro → le azioni del tag. Non stanno più sulla
                      // riga: erano tre bottoni che mangiavano il nome per farsi
                      // spazio (vedi la nota su `.ob-sb-child` in
                      // obsidian-shell.css).
                      onContextMenu={(e) => {
                        if (!hasActions) return;
                        e.preventDefault();
                        e.stopPropagation();
                        setMenu({ x: e.clientX, y: e.clientY, kind: 'child', child: c });
                      }}
                    >
                      <button
                        type="button"
                        className="ob-sb-child__main"
                        // Ctrl (cmd sul Mac) aggiunge invece di sostituire: si
                        // guardano più tag insieme. Chi riceve decide se la sua
                        // vista sa mostrarne più d'uno.
                        onClick={(e) => onSelectChild?.(c.id, e.ctrlKey || e.metaKey)}
                        // Il tooltip è l'unico posto in cui le due cose che la
                        // riga sa fare oltre al click si annunciano: senza
                        // bottoni in vista, niente le suggerirebbe.
                        title={`${c.name}\n${isActive
                          ? 'Ctrl+click per togliere questo tag dalla selezione'
                          : 'Ctrl+click per aggiungerlo a quelli già selezionati'}${hasActions ? '\nTasto destro per le opzioni' : ''}`}
                      >
                        <span className="ob-sb-child__name">{c.name}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      </div>

      {menu && typeof document !== 'undefined' && createPortal(
        <>
          {/* Sfondo che intercetta il click (e il tasto destro) fuori dal menu.
              Copre la finestra intera: chiudere solo al blur del menu lascerebbe
              aperto un menu mentre si lavora altrove. */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
            onClick={closeMenu}
            onContextMenu={(e) => { e.preventDefault(); closeMenu(); }}
          />
          <div
            className="ob-ctx"
            // Clampato sui bordi: aperto in fondo alla lista dei tag, un menu
            // ancorato al puntatore uscirebbe sotto la finestra.
            style={{
              top: Math.min(menu.y, window.innerHeight - ctxH),
              left: Math.min(menu.x, window.innerWidth - 200),
            }}
          >
            {menu.kind === 'group' ? (
              <button
                type="button"
                className="ob-ctx__item"
                onClick={() => { onAddTag?.(menu.group); closeMenu(); }}
              >
                <IconPlus size={14} />Aggiungi tag
              </button>
            ) : (
              <>
                {onOpenCanvas && (
                  <>
                    <button
                      type="button"
                      className="ob-ctx__item"
                      onClick={() => { onOpenCanvas(menu.child.id); closeMenu(); }}
                    >
                      <Icon name="canvas" size={14} />Apri nel Canvas
                    </button>
                    {(onTogglePin || onToggleArchive) && <div className="ob-ctx__sep" />}
                  </>
                )}
                {/* Un tag archiviato non si pinna: sta in Storage, e le linguette
                    dei pinnati sono una scorciatoia a quello che tieni sott'occhio. */}
                {onTogglePin && !menu.child.archived && (
                  <button
                    type="button"
                    className="ob-ctx__item"
                    onClick={() => { onTogglePin(menu.child.id, !menu.child.pinned); closeMenu(); }}
                  >
                    {menu.child.pinned ? <IconPinFilled size={14} /> : <IconPin size={14} />}
                    {menu.child.pinned ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
                  </button>
                )}
                {onToggleArchive && (
                  <button
                    type="button"
                    className="ob-ctx__item"
                    onClick={() => { onToggleArchive(menu.child.id, !menu.child.archived); closeMenu(); }}
                  >
                    {menu.child.archived ? <IconArchiveOff size={14} /> : <IconArchive size={14} />}
                    {menu.child.archived ? 'Ripristina in Tags' : 'Sposta in Storage'}
                  </button>
                )}
              </>
            )}
          </div>
        </>,
        document.body,
      )}
    </aside>
  );
}

