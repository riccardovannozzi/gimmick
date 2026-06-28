'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { IconPlus, IconX } from '@tabler/icons-react';
import { useContacts } from '@/lib/hooks/useContacts';
import { usePixelTheme } from '@/components/pixel';
import { isObsidianShellEnabled } from '@/lib/feature-flags';
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
  const inShell = isObsidianShellEnabled();
  const bW = inShell ? 1 : 2;
  const sansFont = inShell ? 'var(--ob-font-sans)' : 'var(--font-pixel-body)';
  const monoFont = inShell ? 'var(--ob-font-mono)' : 'var(--font-pixel-head)';
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
            height: inShell ? 36 : 30,
            background: inShell ? theme.surface : theme.surfaceVariant,
            color: theme.ink,
            border: `${bW}px solid ${theme.border}`,
            borderRadius: inShell ? 10 : 0,
            cursor: 'pointer',
            fontFamily: sansFont,
            fontSize: inShell ? 13 : 12,
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
                  border: `${bW}px solid ${theme.border}`,
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
            background: inShell ? theme.surface : theme.surfaceVariant,
            border: `${bW}px solid ${theme.border}`,
            borderRadius: inShell ? 10 : 0,
            padding: '0 10px',
            height: inShell ? 36 : 30,
            color: theme.ink,
            fontFamily: sansFont,
            fontSize: inShell ? 13 : 12,
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
            border: `${bW}px solid ${theme.border}`,
            borderRadius: inShell ? 12 : 0,
            boxShadow: inShell ? 'var(--ob-shadow-card)' : `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
            padding: 4,
            maxHeight: 256,
            overflowY: 'auto',
          }}
        >
          {matches.length === 0 && !normalizedQuery && (
            <div
              style={{
                padding: '8px 10px',
                fontFamily: sansFont,
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
                  height: inShell ? 34 : 30,
                  textAlign: 'left',
                  borderRadius: inShell ? 6 : 0,
                  background: isActive ? theme.surfaceVariant : 'transparent',
                  border: `${bW}px solid ${isActive && !inShell ? theme.border : 'transparent'}`,
                  color: isActive ? theme.ink : theme.ink2,
                  fontFamily: sansFont,
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
                      border: `${bW}px solid ${theme.border}`,
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
                      fontFamily: monoFont,
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
                borderTop: `${bW}px solid ${theme.border}`,
                marginTop: inShell ? 2 : 0,
                fontFamily: monoFont,
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
