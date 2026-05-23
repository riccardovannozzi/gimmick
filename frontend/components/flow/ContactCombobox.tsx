'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { IconPlus, IconX } from '@tabler/icons-react';
import { useContacts } from '@/lib/hooks/useContacts';
import { usePixelTheme } from '@/components/pixel';
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
  const theme = usePixelTheme();
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
    <div style={{ position: 'relative' }} ref={containerRef}>
      {selected && !open ? (
        <div
          onClick={() => {
            setOpen(true);
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            padding: '0 10px',
            height: 30,
            background: theme.surfaceVariant,
            color: theme.ink,
            border: `2px solid ${theme.border}`,
            cursor: 'pointer',
            fontFamily: 'var(--font-pixel-body)',
            fontSize: 12,
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selected.color && (
              <span
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  background: selected.color,
                  border: `2px solid ${theme.border}`,
                  marginRight: 6,
                  verticalAlign: 'middle',
                }}
              />
            )}
            {selected.is_self ? `[ ${selected.name} ]` : selected.name}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onChange(null); }}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: theme.ink3,
              display: 'inline-flex',
              padding: 0,
            }}
            title="Rimuovi contatto"
            onMouseEnter={(e) => (e.currentTarget.style.color = '#E24B4A')}
            onMouseLeave={(e) => (e.currentTarget.style.color = theme.ink3)}
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
          style={{
            width: '100%',
            background: theme.surfaceVariant,
            border: `2px solid ${theme.border}`,
            padding: '0 8px',
            height: 30,
            color: theme.ink,
            fontFamily: 'var(--font-pixel-body)',
            fontSize: 12,
            outline: 'none',
          }}
        />
      )}

      {open && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: '100%',
            marginTop: 4,
            zIndex: 50,
            background: theme.surface,
            border: `2px solid ${theme.border}`,
            boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
            padding: 4,
            maxHeight: 256,
            overflowY: 'auto',
          }}
        >
          {matches.length === 0 && !normalizedQuery && (
            <div
              style={{
                padding: '8px 10px',
                fontFamily: 'var(--font-pixel-body)',
                fontSize: 11,
                color: theme.ink3,
              }}
            >
              Nessun contatto. Digita un nome per crearne uno.
            </div>
          )}
          {matches.map((c) => {
            const isActive = c.id === value;
            return (
              <button
                key={c.id}
                onClick={() => { onChange(c.id); setQuery(''); setOpen(false); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '6px 8px',
                  height: 30,
                  textAlign: 'left',
                  background: isActive ? theme.surfaceVariant : 'transparent',
                  border: `2px solid ${isActive ? theme.border : 'transparent'}`,
                  color: isActive ? theme.ink : theme.ink2,
                  fontFamily: 'var(--font-pixel-body)',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                {c.color && (
                  <span
                    style={{
                      display: 'inline-block',
                      width: 8,
                      height: 8,
                      background: c.color,
                      border: `2px solid ${theme.border}`,
                      flexShrink: 0,
                    }}
                  />
                )}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.is_self ? `[ ${c.name} ]` : c.name}
                </span>
                {c.kind !== 'person' && (
                  <span
                    style={{
                      marginLeft: 'auto',
                      fontFamily: 'var(--font-pixel-head)',
                      fontSize: 8,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: theme.ink3,
                    }}
                  >
                    {c.kind}
                  </span>
                )}
              </button>
            );
          })}
          {normalizedQuery && !exactMatch && (
            <button
              onClick={handleCreate}
              disabled={creating}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                width: '100%',
                padding: '6px 8px',
                height: 30,
                textAlign: 'left',
                background: 'transparent',
                color: theme.accent,
                border: 'none',
                borderTop: `2px solid ${theme.border}`,
                fontFamily: 'var(--font-pixel-head)',
                fontSize: 9,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                cursor: creating ? 'not-allowed' : 'pointer',
                opacity: creating ? 0.5 : 1,
              }}
            >
              <IconPlus size={11} />
              {creating ? 'Creazione…' : <>Nuovo: <span style={{ color: theme.ink }}>&ldquo;{query.trim()}&rdquo;</span></>}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
