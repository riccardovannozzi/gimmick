'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { IconPlus, IconX } from '@tabler/icons-react';
import { useContacts } from '@/lib/hooks/useContacts';
import type { Contact } from '@/types/flow';

interface Props {
  value: string | null;
  onChange: (contactId: string | null) => void;
  /** Start with the search input + dropdown already visible — used when this
   *  combobox is mounted as the inline editor of a chip. The "selected pill
   *  before open" UI is redundant then. */
  autoOpen?: boolean;
}

/**
 * Search-as-you-type contact picker. Shows existing matches; when the query
 * has no exact match it offers "+ Nuovo contatto: '<query>'" which creates
 * one inline and selects it.
 */
export function ContactCombobox({ value, onChange, autoOpen = false }: Props) {
  const { contacts, create } = useContacts();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(autoOpen);
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const selected: Contact | null = useMemo(() => {
    if (!value) return null;
    return contacts.find((c) => c.id === value) ?? null;
  }, [contacts, value]);

  const normalizedQuery = query.trim().toLowerCase();

  // Pin the self contact to the top of every list so "ball on me" is always a
  // one-click pick. Falls back gracefully if the seed row is missing.
  const sortedContacts = useMemo(() => {
    return [...contacts].sort((a, b) => {
      if (a.is_self && !b.is_self) return -1;
      if (!a.is_self && b.is_self) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [contacts]);

  const matches = useMemo(() => {
    if (!normalizedQuery) return sortedContacts.slice(0, 10);
    return sortedContacts
      .filter((c) => c.name.toLowerCase().includes(normalizedQuery))
      .slice(0, 10);
  }, [sortedContacts, normalizedQuery]);

  const exactMatch = useMemo(
    () => contacts.find((c) => c.name.toLowerCase() === normalizedQuery),
    [contacts, normalizedQuery],
  );

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  // Focus the search input when the combobox starts already-open — saves the
  // caller from having to .focus() it from outside.
  useEffect(() => {
    if (autoOpen) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async () => {
    const name = query.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const result = await create.mutateAsync({ name, kind: 'person' });
      if (result?.id) {
        onChange(result.id);
        setQuery('');
        setOpen(false);
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      {selected && !open ? (
        <div
          onClick={() => {
            setOpen(true);
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
          className="flex items-center justify-between gap-2 px-2.5 h-8 rounded text-xs leading-none font-medium bg-zinc-800/60 text-zinc-200 hover:bg-zinc-800 cursor-pointer transition-colors"
        >
          <span className="truncate">
            {selected.color && (
              <span
                className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle"
                style={{ backgroundColor: selected.color }}
              />
            )}
            {selected.is_self ? `[ ${selected.name} ]` : selected.name}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onChange(null); }}
            className="text-zinc-500 hover:text-red-400"
            title="Rimuovi contatto"
          >
            <IconX size={12} />
          </button>
        </div>
      ) : (
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Cerca contatto…"
          className="w-full bg-zinc-800/60 border border-white/[0.08] rounded px-2 h-8 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
        />
      )}

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl max-h-64 overflow-y-auto py-1">
          {matches.length === 0 && !normalizedQuery && (
            <div className="px-2.5 py-2 text-[10px] text-zinc-500">Nessun contatto. Digita un nome per crearne uno.</div>
          )}
          {matches.map((c) => {
            const isActive = c.id === value;
            return (
              <button
                key={c.id}
                onClick={() => { onChange(c.id); setQuery(''); setOpen(false); }}
                className={`flex items-center gap-2 w-full px-2.5 h-8 text-left text-xs leading-none transition-colors ${
                  isActive ? 'bg-zinc-800 text-blue-300' : 'text-zinc-200 hover:bg-zinc-800/70'
                }`}
              >
                {c.color && (
                  <span
                    className="inline-block w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: c.color }}
                  />
                )}
                <span className="truncate">{c.is_self ? `[ ${c.name} ]` : c.name}</span>
                {c.kind !== 'person' && (
                  <span className="ml-auto text-[9px] text-zinc-500 uppercase tracking-wider">{c.kind}</span>
                )}
              </button>
            );
          })}
          {normalizedQuery && !exactMatch && (
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex items-center gap-2 w-full px-2.5 h-8 text-left text-xs leading-none font-medium text-blue-300 hover:bg-zinc-800/70 disabled:opacity-50 transition-colors border-t border-zinc-800"
            >
              <IconPlus size={12} />
              {creating ? 'Creazione…' : <>Nuovo contatto: <span className="text-blue-200">&ldquo;{query.trim()}&rdquo;</span></>}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
