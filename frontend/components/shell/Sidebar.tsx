'use client';

/**
 * Gimmick · Obsidian — Left Sidebar (tag / cartelle).
 *
 * "Sidebar Sinistra" (panel #1): TAG header + count, Tutti/Pinned segmented,
 * collapsible tag groups (folders) with children. Reference: GimmickApp.dc.html
 * / GimmickSidebar.dc.html. Single tag per tile, so children select exclusively.
 */
import * as React from 'react';
import * as TablerIcons from '@tabler/icons-react';
import { IconPin, IconPinFilled } from '@tabler/icons-react';
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
  /** Currently selected child id (single selection). */
  activeChildId?: string;
  onSelectChild?: (id: string) => void;
  filter?: string;
  onFilterChange?: (value: string) => void;
  /** Label for the "pinned" segment (e.g. "Pinned · 2"). */
  pinnedLabel?: string;
  /** Toggle pin su un tag (figlio). `pinned` = nuovo stato desiderato. */
  onTogglePin?: (tagId: string, pinned: boolean) => void;
  /** Apri il tag selezionato nel Canvas. */
  onOpenCanvas?: (tagId: string) => void;
}

export function Sidebar({
  groups,
  count,
  activeChildId,
  onSelectChild,
  filter = 'all',
  onFilterChange,
  pinnedLabel = 'Pinned',
  onTogglePin,
  onOpenCanvas,
}: SidebarProps) {
  const [open, setOpen] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.map((g) => [g.id, g.defaultOpen ?? false])),
  );

  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  // "Espandi/Comprimi tutto": apre tutti i gruppi se almeno uno è chiuso,
  // altrimenti li chiude tutti.
  const allOpen = groups.length > 0 && groups.every((g) => open[g.id]);
  const toggleAll = () =>
    setOpen(Object.fromEntries(groups.map((g) => [g.id, !allOpen])));

  return (
    <aside className="ob-sb ob-scroll">
      <div className="ob-sb__head">
        <span className="ob-sb__head-label">TAG</span>
        {count != null && <span className="ob-sb__count">{count}</span>}
      </div>

      <div className="ob-sb__seg">
        <SegmentedControl
          aria-label="Filtro tag"
          value={filter}
          onChange={(v) => onFilterChange?.(v)}
          items={[
            { value: 'all', label: 'Tutti i tag' },
            { value: 'pinned', label: pinnedLabel },
          ]}
        />
      </div>

      <button type="button" className="ob-sb__expand" onClick={toggleAll}>
        <Icon name="sort" size={13} />
        {allOpen ? 'Comprimi tutto' : 'Espandi tutto'}
      </button>

      {groups.map((g) => {
        const isOpen = open[g.id];
        // Filtro "Pinned": mostra solo i tag pinnati (e nascondi i gruppi vuoti).
        const kids = (g.children ?? []).filter((c) => filter !== 'pinned' || c.pinned);
        if (filter === 'pinned' && kids.length === 0) return null;
        // Il tag-type salva il glyph come nome Tabler in `emoji`; se risolvibile
        // ha la priorità, altrimenti si usa il glyph dello shell `g.icon`.
        const Glyph = g.emoji ? TablerMap[g.emoji] : undefined;
        return (
          <div key={g.id} className="ob-sb-group">
            <button type="button" className="ob-sb-group__head" onClick={() => toggle(g.id)} aria-expanded={isOpen}>
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
                  const isActive = c.id === activeChildId;
                  return (
                    <div key={c.id} className={cn('ob-sb-child', isActive && 'ob-sb-child--active')}>
                      <button
                        type="button"
                        className="ob-sb-child__main"
                        onClick={() => onSelectChild?.(c.id)}
                      >
                        <span className="ob-sb-child__name">{c.name}</span>
                      </button>
                      <div className="ob-sb-child__actions">
                        {onTogglePin && (
                          <button
                            type="button"
                            className={cn('ob-sb-child__act', c.pinned && 'ob-sb-child__act--on')}
                            title={c.pinned ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
                            aria-pressed={!!c.pinned}
                            onClick={(e) => { e.stopPropagation(); onTogglePin(c.id, !c.pinned); }}
                          >
                            {c.pinned ? <IconPinFilled size={13} /> : <IconPin size={13} />}
                          </button>
                        )}
                        {onOpenCanvas && (
                          <button
                            type="button"
                            className="ob-sb-child__act"
                            title="Apri nel Canvas"
                            onClick={(e) => { e.stopPropagation(); onOpenCanvas(c.id); }}
                          >
                            <Icon name="canvas" size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </aside>
  );
}
