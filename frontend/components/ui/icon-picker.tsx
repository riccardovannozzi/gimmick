'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { IconSearch, IconX, IconChevronDown } from '@tabler/icons-react';
import * as TablerIcons from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import iconCategories from '@/lib/tabler-icon-categories.json';

type IconComp = React.ComponentType<{ size?: number; className?: string }>;
const Icons = TablerIcons as unknown as Record<string, IconComp>;

const ALL_ICON_NAMES: string[] = Object.keys(TablerIcons).filter(
  (k) => k.startsWith('Icon') && !k.includes('Filled') && (TablerIcons as Record<string, unknown>)[k] != null && typeof (TablerIcons as Record<string, unknown>)[k] === 'object'
);

const CATEGORIES = Object.keys(iconCategories) as string[];

const iconToCategory = new Map<string, string>();
for (const [cat, icons] of Object.entries(iconCategories)) {
  for (const name of icons as string[]) {
    iconToCategory.set(name, cat);
  }
}

function iconToSearchable(name: string): string {
  return name.replace(/^Icon/, '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([0-9])([A-Z])/g, '$1 $2').toLowerCase();
}
const SEARCHABLE = new Map(ALL_ICON_NAMES.map((n) => [n, iconToSearchable(n)]));

interface IconPickerProps {
  value: string;
  onChange: (iconName: string) => void;
  trigger?: React.ReactNode;
}

const GRID_COLS = 10;

export function IconPicker({ value, onChange, trigger }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [catOpen, setCatOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const catDropdownRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    let icons = ALL_ICON_NAMES;
    if (category !== 'all') {
      const set = new Set((iconCategories as Record<string, string[]>)[category] || []);
      icons = icons.filter((n) => set.has(n));
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      icons = icons.filter((n) => SEARCHABLE.get(n)!.includes(q));
    }
    return icons;
  }, [search, category]);

  useEffect(() => {
    if (open) {
      setSearch('');
      setCategory('all');
      setCatOpen(false);
      setTimeout(() => searchRef.current?.focus(), 150);
    }
  }, [open]);

  // Close category dropdown on click outside
  useEffect(() => {
    if (!catOpen) return;
    const handle = (e: MouseEvent) => {
      if (catDropdownRef.current && !catDropdownRef.current.contains(e.target as Node)) {
        setCatOpen(false);
      }
    };
    document.addEventListener('click', handle, true);
    return () => document.removeEventListener('click', handle, true);
  }, [catOpen]);

  const SelectedIcon = value ? Icons[value] : null;

  return (
    <>
      <button onClick={() => setOpen(true)} type="button" className="flex items-center justify-center">
        {trigger ?? (
          <div className="w-9 h-9 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center hover:bg-zinc-700 transition-colors">
            {SelectedIcon ? <SelectedIcon size={20} className="text-white" /> : <span className="text-zinc-500 text-xs">?</span>}
          </div>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 sm:max-w-lg p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-0">
            <DialogTitle className="text-white text-sm">Scegli icona</DialogTitle>
          </DialogHeader>

          {/* Search */}
          <div className="px-4 pt-3 pb-2">
            <div className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 h-9">
              <IconSearch className="h-4 w-4 text-zinc-500 shrink-0" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Cerca ${ALL_ICON_NAMES.length} icone...`}
                className="bg-transparent text-sm text-white w-full focus:outline-none placeholder:text-zinc-600"
              />
              {search && (
                <button onClick={() => setSearch('')} className="text-zinc-500 hover:text-zinc-300">
                  <IconX className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Category */}
          <div className="px-4 pb-2 relative" ref={catDropdownRef}>
            <button
              onClick={() => setCatOpen(!catOpen)}
              className="flex items-center gap-1.5 w-full px-2.5 h-9 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-zinc-400 hover:text-zinc-300 transition-colors"
            >
              <span className="truncate flex-1 text-left">{category === 'all' ? 'Tutte le categorie' : category}</span>
              <span className="text-[10px] text-zinc-600">{filtered.length}</span>
              <IconChevronDown className={cn('h-3 w-3 shrink-0 transition-transform', catOpen && 'rotate-180')} />
            </button>
            {catOpen && (
              <div className="absolute top-full left-4 right-4 mt-1 max-h-52 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-800 shadow-xl py-1 z-10">
                <button
                  onClick={() => { setCategory('all'); setCatOpen(false); }}
                  className={cn('w-full px-3 py-1.5 text-left text-xs hover:bg-zinc-700/50', category === 'all' ? 'text-blue-400' : 'text-zinc-400')}
                >
                  Tutte le categorie
                </button>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => { setCategory(cat); setCatOpen(false); }}
                    className={cn('w-full px-3 py-1.5 text-left text-xs hover:bg-zinc-700/50 flex justify-between', category === cat ? 'text-blue-400' : 'text-zinc-400')}
                  >
                    <span>{cat}</span>
                    <span className="text-zinc-600 text-[10px]">{(iconCategories as Record<string, string[]>)[cat]?.length}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Grid */}
          <div className="overflow-y-auto px-4 pb-4" style={{ maxHeight: 440 }}>
            {filtered.length === 0 ? (
              <p className="text-center text-zinc-600 text-xs py-8">Nessuna icona trovata</p>
            ) : (
              <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)` }}>
                {filtered.map((name) => {
                  const Comp = Icons[name];
                  if (!Comp) return null;
                  const sel = name === value;
                  return (
                    <button
                      key={name}
                      title={name.replace(/^Icon/, '') + (iconToCategory.has(name) ? ` · ${iconToCategory.get(name)}` : '')}
                      onClick={() => { onChange(name); setOpen(false); }}
                      className={cn(
                        'flex items-center justify-center rounded-md transition-colors aspect-square',
                        sel ? 'bg-blue-600/30 text-blue-300' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                      )}
                    >
                      <Comp size={24} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
