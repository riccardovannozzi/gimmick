'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { IconLayoutSidebarRightCollapse, IconLayoutSidebarRightExpand, IconCamera, IconPhoto, IconVideo, IconMicrophone, IconEdit, IconPaperclip, IconFileText, IconFile, IconPlayerPlay, IconTrash, IconExternalLink, IconBolt, IconClock, IconCalendar, IconMaximize, IconX, IconList, IconShare2, IconChevronDown, IconNote, IconCheckbox, IconSearch, IconWand } from '@tabler/icons-react';
import * as TablerIcons from '@tabler/icons-react';
import { toast } from 'sonner';
import { tilesApi, sparksApi, uploadApi, tagsApi } from '@/lib/api';
import { invalidateTileCaches, patchTileCaches } from '@/lib/tile-cache';
import type { Tag } from '@/types';
import { cn } from '@/lib/utils';
import { usePixelTheme } from '@/components/pixel';
import { OB_LEADING, OB_WEIGHT, OB_TEXT, obLabel as obLabelBase } from '@/lib/theme/ob-typography';
import { useTypeIcons } from '@/store/type-icons-store';
import { useTagTypes } from '@/store/tag-types-store';
import { useActionColors } from '@/store/action-colors-store';
import { useStatuses } from '@/store/statuses-store';
import { statusMeta, statusGlyph } from '@/lib/status-meta';
import { readableOn } from '@/lib/palette';
import { TimePicker } from '@/components/ui/time-picker';
import { DatePicker } from '@/components/ui/date-picker';
import { SubtaskList } from '@/components/tileview/SubtaskList';
import { MarkdownPreview } from '@/components/markdown/markdown-preview';
import { MarkdownEditorModal } from '@/components/markdown/markdown-editor-modal';
import { CameraCapture, type CaptureMode, type CapturedMedia } from '@/components/capture/CameraCapture';
import type { Tile, Spark } from '@/types';

function toLocalInput(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const SPARK_ICONS: Record<string, typeof IconFile> = {
  photo: IconCamera,
  image: IconPhoto,
  video: IconVideo,
  audio_recording: IconMicrophone,
  text: IconFileText,
  file: IconFile,
};

const AllIcons = TablerIcons as unknown as Record<string, React.ComponentType<{ size?: number; className?: string; color?: string }>>;

// ─── Flag-aware style helpers (Obsidian nativo in shell, pixel arcade fuori) ──
// I colori arrivano già dal PixelTheme mappato sui token Obsidian quando lo
// shell è attivo; qui cambiamo la STRUTTURA (font Geist, hairline 1px + raggi,
// niente uppercase pixel né ombre dure).
type PT = ReturnType<typeof usePixelTheme>;

/**
 * Il fondo di QUESTA colonna e quello degli oggetti che ci stanno dentro.
 *
 * Non passano dal PixelTheme come tutto il resto: sono i token delle due sponde
 * della vista (`obsidian.css`), gli STESSI che usa la sidebar dei tag a
 * sinistra. Prima erano `theme.bg2` e `theme.bg1`, cioe' due neutri scelti qui
 * per conto proprio, e in dark la colonna di destra risultava piu' scura della
 * sua gemella a sinistra — sembrava un buco accanto a lei.
 *
 * I due valori vanno insieme: gli oggetti dentro la colonna non hanno contorno e
 * si distinguono solo perche' si staccano dal fondo del pannello — sollevandosi
 * in light, affondando in dark. Il verso lo decidono i token, non questo file.
 */
const RAIL_BG = 'var(--ob-rail-bg)';
const RAIL_FIELD = 'var(--ob-rail-field)';
/** Fondo della barra delle linguette: un gradino sotto il pannello. */
const RAIL_SUNKEN = 'var(--ob-sunken)';

/**
 * Eyebrow/section label (TITOLO, AZIONE, …) — la tipografia arriva dall'helper
 * condiviso `lib/theme/ob-typography`; qui si aggiunge solo il layout di blocco,
 * che è specifico di questa sidebar (etichetta sopra il campo, non in riga).
 */
function obLabel(theme: PT): React.CSSProperties {
  return { ...obLabelBase(theme), display: 'block', lineHeight: OB_LEADING.none, marginBottom: 3 };
}

/** Field / select trigger box (input, dropdown trigger).
 *  Nessun contorno: gli oggetti si distinguono per il fondo, che si stacca da
 *  quello del pannello — `--ob-rail-field` contro `--ob-rail-bg`. Dando loro il
 *  fondo del pannello, senza bordo, sparirebbero. */
function obField(theme: PT): React.CSSProperties {
  return {
    background: RAIL_FIELD,
    border: 'none',
    borderRadius: 'var(--ob-radius-sm)',
    color: theme.ink,
    fontFamily: 'var(--ob-font-sans)',
    fontSize: OB_TEXT.control,
  };
}

/** Dropdown row. */
function obPopupRow(theme: PT, active: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '6px 8px',
    textAlign: 'left',
    borderRadius: 'var(--ob-radius-sm)',
    background: active ? theme.surfaceVariant : 'transparent',
    border: `1px solid transparent`,
    color: active ? theme.ink : theme.ink2,
    fontFamily: 'var(--ob-font-sans)',
    fontSize: OB_TEXT.control,
    cursor: 'pointer',
  };
}

function TypeIconPicker({ tileId }: { tileId: string }) {
  const theme = usePixelTheme();
  const { icons, tileIcons, assignIcon } = useTypeIcons();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const currentIconId = tileIcons[tileId] || '';
  const current = icons.find((i) => i.id === currentIconId);
  const CurrentComp = current?.icon ? AllIcons[current.icon] : null;

  useEffect(() => {
    if (!open) return;
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setDropPos({ top: r.bottom + 4, left: r.left, width: r.width });
    }
    const handler = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (dropRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (icons.length === 0) return null;

  const labelStyle = obLabel(theme);
  const popupItem = (active: boolean): React.CSSProperties => obPopupRow(theme, active);

  return (
    <div style={{ position: 'relative' }}>
      <label style={labelStyle}>{'Tipo'}</label>
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        style={{
          ...obField(theme),
          width: '100%',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          // Senza tipo impostato niente velatura: stesso fondo nero degli altri
          // campi (bg1), non `surface` che è il colore del pannello.
          background: current?.color ? `${current.color}40` : RAIL_FIELD,
          padding: '0 10px',
          height: 30,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {CurrentComp ? (
          <>
            <div
              style={{
                width: 18,
                height: 18,
                background: current?.color || theme.surfaceVariant,
                border: `1px solid ${theme.border}`,
                borderRadius: 'var(--ob-radius-sm)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <CurrentComp size={10} color={readableOn(current?.color || theme.surfaceVariant)} />
            </div>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{current!.name}</span>
          </>
        ) : (
          <span style={{ color: theme.ink3, flex: 1, fontSize: OB_TEXT.control }}>Type</span>
        )}
        {<IconChevronDown size={15} style={{ color: theme.ink3, flexShrink: 0 }} />}
      </button>
      {open && dropPos && createPortal(
        <div
          ref={dropRef}
          className="fixed"
          style={{
            top: dropPos.top,
            left: dropPos.left,
            width: dropPos.width,
            zIndex: 9999,
            background: theme.surface,
            border: `1px solid ${theme.border}`,
            borderRadius: 'var(--ob-radius-md)',
            boxShadow: 'var(--ob-shadow-card)',
            padding: 4,
            maxHeight:192,
            overflowY: 'auto',
          }}
        >
          <button onClick={() => { assignIcon(tileId, null); setOpen(false); }} style={popupItem(!currentIconId)}>
            <span style={{ width: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: theme.ink3 }}>—</span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Nessuno</span>
            {!currentIconId && (
              <svg width={12} height={12} style={{ color: theme.accent, flexShrink: 0 }} viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            )}
          </button>
          {icons.map((icon) => {
            const Comp = AllIcons[icon.icon];
            const selected = currentIconId === icon.id;
            return (
              <button
                key={icon.id}
                onClick={() => { assignIcon(tileId, icon.id); setOpen(false); }}
                style={popupItem(selected)}
              >
                {Comp && (
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      background: icon.color || theme.surfaceVariant,
                      border: `1px solid ${theme.border}`,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Comp size={10} color={readableOn(icon.color || theme.surfaceVariant)} />
                  </div>
                )}
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{icon.name}</span>
                {selected && (
                  <svg width={12} height={12} style={{ color: theme.accent, flexShrink: 0 }} viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                )}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}

/** Selettore STATUS del tile — dropdown/popup nello stile di TypeIconPicker. */
/** Swatch "default" per lo status prevalente (active): una sfumatura neutra
 *  leggerissima, senza bordo — così nel picker non sembra un badge vero e
 *  proprio (che sui tile non viene mai mostrato per gli attivi). */
function DefaultSwatch({ size = 18 }: { size?: number }) {
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: 'var(--ob-radius-sm)',
        flexShrink: 0,
        display: 'inline-block',
        background: 'linear-gradient(135deg, color-mix(in srgb, var(--ob-muted) 16%, transparent), color-mix(in srgb, var(--ob-muted) 4%, transparent))',
      }}
    />
  );
}

/** Rappresentazione visiva dello status nel picker, coerente con la colonna del
 *  tile: icona colorata (done→pallino, pausa, bloccato→lucchetto) oppure testo
 *  (cancelled→DELETE). 'active' = swatch neutro. Legge dalla config `statusGlyph`. */
function StatusGlyphView({ name, size = 18 }: { name: string; size?: number }) {
  const meta = statusMeta(name);
  const glyph = statusGlyph(name);
  const box: React.CSSProperties = { width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };
  if (glyph.kind === 'none') return <DefaultSwatch size={size} />;
  if (glyph.kind === 'dot') return <span style={box}><span style={{ width: size * 0.44, height: size * 0.44, borderRadius: '50%', background: meta.hex }} /></span>;
  if (glyph.kind === 'text') return <span style={{ ...box, width: 'auto', fontFamily: 'var(--ob-font-mono)', fontSize: OB_TEXT.meta, fontWeight: OB_WEIGHT.mono, letterSpacing: '0.1em', color: meta.hex }}>{glyph.text}</span>;
  const Icon = AllIcons[glyph.icon];
  return <span style={box}>{Icon ? <Icon size={Math.round(size * 0.72)} color={meta.hex} /> : null}</span>;
}

/**
 * Il picker dello STATUS, più l'interruttore del FOCUS.
 *
 * Focus e status stanno nello stesso menu ma NON nella stessa lista, e il filo
 * che li separa è la sostanza della cosa: gli status sono uno solo per volta e
 * si escludono a vicenda (scegliere «bloccato» toglie «attivo»), il focus è un
 * interruttore che vale insieme a qualunque di loro. Metterlo in fila con gli
 * altri lo avrebbe fatto leggere come un settimo status, cioè come qualcosa che
 * sostituisce quello che c'era — e «in focus» al posto di «bloccato» perde
 * l'unica informazione che contava.
 *
 * Sta nel menu e non fuori perché è lì che si va a dire com'è messa
 * un'attività: dover cercare il focus da un'altra parte avrebbe voluto dire due
 * viaggi per una risposta sola.
 */
function StatusPicker({ value, onChange, focused, onToggleFocus }: {
  value: string | null;
  onChange: (statusId: string) => void;
  focused?: boolean;
  /** Assente: l'interruttore non compare (anteprime senza dati veri). */
  onToggleFocus?: (next: boolean) => void;
}) {
  const theme = usePixelTheme();
  const { statuses } = useStatuses();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const current = statuses.find((s) => s.id === value) || null;

  useEffect(() => {
    if (!open) return;
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setDropPos({ top: r.bottom + 4, left: r.left, width: r.width });
    }
    const handler = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (dropRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (statuses.length === 0) return null;

  const labelStyle = obLabel(theme);
  const popupItem = (active: boolean): React.CSSProperties => obPopupRow(theme, active);
  const currentMeta = current ? statusMeta(current.name) : null;
  const check = (
    <svg width={12} height={12} style={{ color: theme.accent, flexShrink: 0 }} viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
  );

  return (
    <div style={{ position: 'relative' }}>
      <label style={labelStyle}>{'Status'}</label>
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        style={{
          ...obField(theme),
          width: '100%',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          // 'active' è il default → nessuna velatura, fondo nero come gli altri
          // campi. Quando invece uno status c'è, la tinta poggia sullo stesso nero.
          background: current && current.name !== 'active' && currentMeta ? `color-mix(in srgb, ${currentMeta.color} 16%, ${RAIL_FIELD})` : RAIL_FIELD,
          padding: '0 10px',
          height: 30,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {current && currentMeta ? (
          <>
            <StatusGlyphView name={current.name} size={18} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{currentMeta.label}</span>
          </>
        ) : (
          <span style={{ color: theme.ink3, flex: 1, fontSize: OB_TEXT.control }}>Status</span>
        )}
        <IconChevronDown size={15} style={{ color: theme.ink3, flexShrink: 0 }} />
      </button>
      {open && dropPos && createPortal(
        <div
          ref={dropRef}
          className="fixed"
          style={{
            top: dropPos.top,
            left: dropPos.left,
            width: dropPos.width,
            zIndex: 9999,
            background: theme.surface,
            border: `1px solid ${theme.border}`,
            borderRadius: 'var(--ob-radius-md)',
            boxShadow: 'var(--ob-shadow-card)',
            padding: 4,
            maxHeight: 240,
            overflowY: 'auto',
          }}
        >
          {statuses.map((s) => {
            const meta = statusMeta(s.name);
            const selected = value === s.id;
            return (
              <button key={s.id} onClick={() => { onChange(s.id); setOpen(false); }} style={popupItem(selected)}>
                <StatusGlyphView name={s.name} size={18} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta.label}</span>
                {selected && check}
              </button>
            );
          })}
          {onToggleFocus && (
            <>
              {/* Il filo: di là gli status, che si escludono a vicenda; di qua un
                  interruttore che vale insieme a qualunque di loro. */}
              <div style={{ margin: '4px 0', borderTop: `1px solid ${theme.border}` }} />
              <button
                onClick={() => { onToggleFocus(!focused); setOpen(false); }}
                style={popupItem(!!focused)}
                title={focused
                  ? 'Togli la cornice rossa: non è più l’attività di adesso'
                  : 'Segna questa come l’attività su cui stai lavorando'}
              >
                {/* La stessa cornice che finisce sulla card, in miniatura: il
                    glifo è il segno che il comando accende, non un pallino da
                    imparare a parte. La FORMA non cambia con lo stato — cambia
                    il colore, insieme a quello dell'etichetta: è un
                    interruttore, e un interruttore spento resta al suo posto. */}
                <span style={{ width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span
                    style={{
                      width: 12, height: 12, borderRadius: 3,
                      border: `2px dashed ${focused ? 'var(--ob-focus)' : theme.ink3}`,
                    }}
                  />
                </span>
                <span style={{ flex: 1, color: focused ? 'var(--ob-focus)' : undefined }}>
                  {focused ? 'Focus off' : 'Focus on'}
                </span>
              </button>
            </>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

function TagIcon({ emoji, color, size = 14 }: { emoji: string; color: string; size?: number }) {
  if (emoji.startsWith('Icon')) {
    const Comp = (TablerIcons as unknown as Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>>)[emoji];
    if (Comp) return <Comp size={size} style={{ color }} />;
  }
  if (emoji) return <span style={{ fontSize: size * 0.85, lineHeight: OB_LEADING.none }}>{emoji}</span>;
  return <span className="rounded-full shrink-0" style={{ width: size * 0.55, height: size * 0.55, backgroundColor: color }} />;
}

/** Range dei segni diacritici combinanti (U+0300–U+036F), rimossi per il match. */
const COMBINING_MARKS = /[̀-ͯ]/g;

/** Normalizza per il match locale: minuscolo, senza accenti. */
function normText(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(COMBINING_MARKS, '');
}

/**
 * Match locale "bacchetta magica": assegna un punteggio a ciascun tag in base a
 * quanto il suo nome/alias compare nel testo del tile (titolo + sparks). Nome
 * intero presente → punteggio alto; altrimenti overlap di parole (≥3 caratteri).
 * Restituisce i tag con punteggio > 0 ordinati per rilevanza (root esclusi).
 */
function suggestTagsFromText(text: string, tags: Tag[], rootIds: Set<string>): Tag[] {
  const t = normText(text);
  if (!t.trim()) return [];
  const textTokens = new Set(t.split(/[^a-z0-9]+/).filter((w) => w.length >= 3));
  const scored: { tag: Tag; score: number }[] = [];
  for (const tag of tags) {
    if (rootIds.has(tag.id)) continue;
    const names = [tag.name, ...(tag.aliases ?? [])].map(normText).filter(Boolean);
    let score = 0;
    for (const n of names) {
      if (t.includes(n)) {
        score += Math.max(2, n.length / 3); // nome/alias intero presente nel testo
      } else {
        for (const tok of n.split(/[^a-z0-9]+/)) {
          if (tok.length >= 3 && textTokens.has(tok)) score += 1;
        }
      }
    }
    if (score > 0) scored.push({ tag, score });
  }
  return scored.sort((a, b) => b.score - a.score).map((s) => s.tag);
}

function TagPicker({ tileId, tileTags, onChanged, queryClient, invalidateKeys = [], suggestText = '' }: { tileId: string; tileTags: { id: string; name: string; tag_type?: string }[]; onChanged: () => void; queryClient: ReturnType<typeof useQueryClient>; invalidateKeys?: string[]; suggestText?: string }) {
  const theme = usePixelTheme();
  const [open, setOpen] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const { getColor: getTypeColor, getEmoji: getTypeEmoji } = useTagTypes();
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number } | null>(null);
  // Ricerca testuale + modalità "suggerimenti dal testo" (bacchetta magica).
  const [query, setQuery] = useState('');
  const [suggestActive, setSuggestActive] = useState(false);

  // Position dropdown and handle outside clicks
  useEffect(() => {
    if (!open) return;
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setDropPos({ top: r.bottom + 4, left: r.left, width: r.width });
    }
    const handler = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (dropRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const { data: tagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagsApi.list(),
    staleTime: 60_000,
  });
  const allTags: Tag[] = (tagsData as { data?: Tag[] })?.data || [];
  const rootTagIds = useMemo(() => new Set(allTags.filter((t) => t.is_root).map((t) => t.id)), [allTags]);
  const selectedTag = tileTags.find((t) => !rootTagIds.has(t.id)) || tileTags[0] || null;

  // Suggerimenti "bacchetta magica": tag esistenti ricavati dal testo del tile.
  const suggested = useMemo(
    () => suggestTagsFromText(suggestText, allTags, rootTagIds),
    [suggestText, allTags, rootTagIds],
  );

  // Lista mostrata nel dropdown: suggerimenti (se attivi) → filtro testo → tutti.
  const visibleTags = useMemo(() => {
    if (suggestActive) return suggested;
    const q = normText(query.trim());
    if (!q) return allTags;
    return allTags.filter((t) =>
      [t.name, ...(t.aliases ?? [])].some((n) => normText(n).includes(q)),
    );
  }, [suggestActive, suggested, query, allTags]);

  // Alla chiusura azzera ricerca e modalità suggerimenti; all'apertura mette a
  // fuoco l'input di ricerca.
  useEffect(() => {
    if (!open) {
      setQuery('');
      setSuggestActive(false);
    } else {
      const id = requestAnimationFrame(() => searchRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [open]);

  // Optimistic update helper: patch tag in all cached tile queries
  const optimisticUpdateTag = (newTag: { id: string; name: string; tag_type?: string } | null) => {
    const newTags = newTag ? [{ id: newTag.id, name: newTag.name, tag_type: newTag.tag_type }] : [];
    // Il tag non è solo un'etichetta sulla card: le viste che filtrano per tag
    // (la board Kanban) devono vedere il tile ENTRARE o USCIRE dal filtro nello
    // stesso istante in cui lo cambi qui.
    patchTileCaches(queryClient, tileId, { tags: newTags }, invalidateKeys);
  };

  const handleSelect = async (tag: Tag) => {
    setToggling(tag.id);
    const isAssigned = selectedTag?.id === tag.id;
    // Optimistic: update UI immediately
    optimisticUpdateTag(isAssigned ? null : tag);
    setOpen(false);
    try {
      if (isAssigned) {
        await tagsApi.untagTile(tag.id, tileId);
      } else {
        if (selectedTag) {
          await tagsApi.untagTile(selectedTag.id, tileId);
        }
        await tagsApi.tagTiles(tag.id, [tileId]);
      }
      onChanged();
      // I conteggi/gruppi della Sidebar sinistra derivano da ['tags']: senza
      // questa invalidazione usage_count e appartenenza tile→tag restano stale.
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    } catch (err) {
      console.error('Tag toggle failed:', err);
      // Revert on error
      optimisticUpdateTag(isAssigned ? tag : selectedTag);
    } finally {
      setToggling(null);
    }
  };

  const labelStyle = obLabel(theme);
  const popupItem = (active: boolean, busy: boolean): React.CSSProperties => ({
    ...obPopupRow(theme, active),
    cursor: busy ? 'not-allowed' : 'pointer',
    opacity: busy ? 0.5 : 1,
  });

  return (
    <div style={{ position: 'relative' }}>
      <label style={labelStyle}>Tag</label>
      <div
        ref={triggerRef}
        style={{
          ...obField(theme),
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          height: 30,
          // Con un tag assegnato la velatura accent-soft; senza, fondo nero come
          // gli altri campi senza valore.
          background: selectedTag ? `${theme.accent}1f` : RAIL_FIELD,
          color: selectedTag ? theme.accent : theme.ink3,
          padding: '0 10px',
          cursor: 'pointer',
        }}
        onClick={() => setOpen(!open)}
      >
        {selectedTag ? (
          <>
            <TagIcon
              emoji={getTypeEmoji(selectedTag.tag_type || 'topic')}
              color={getTypeColor(selectedTag.tag_type || 'topic') || theme.ink3}
              size={14}
            />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedTag.name}</span>
          </>
        ) : (
          <span style={{ color: theme.ink3, fontSize: OB_TEXT.control }}>Seleziona tag...</span>
        )}
      </div>
      {open && dropPos && createPortal(
        <div
          ref={dropRef}
          className="fixed"
          style={{
            top: dropPos.top,
            left: dropPos.left,
            width: dropPos.width,
            zIndex: 9999,
            background: theme.surface,
            border: `1px solid ${theme.border}`,
            borderRadius: 'var(--ob-radius-md)',
            boxShadow: 'var(--ob-shadow-card)',
            padding: 4,
            maxHeight:256,
            overflowY: 'auto',
          }}
        >
          {/* Riga di ricerca: input + bacchetta magica + pulisci. */}
          <div style={{ position: 'relative', marginBottom: 4 }}>
            <IconSearch size={14} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: theme.ink3, pointerEvents: 'none' }} />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSuggestActive(false); }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setOpen(false); }
                else if (e.key === 'Enter' && visibleTags.length > 0) { e.preventDefault(); handleSelect(visibleTags[0]); }
              }}
              placeholder={suggestActive ? 'Suggeriti dal testo' : 'Cerca tag...'}
              style={{ ...obField(theme), width: '100%', height: 32, padding: '0 56px 0 28px', fontSize: OB_TEXT.control, outline: 'none' }}
            />
            {/* Bacchetta magica: propone tag esistenti ricavati dal testo del tile. */}
            <button
              type="button"
              title={suggestText.trim() ? 'Suggerisci tag dal testo' : 'Nessun testo da cui suggerire'}
              disabled={!suggestText.trim()}
              onClick={() => { setQuery(''); setSuggestActive(true); }}
              style={{ position: 'absolute', right: (suggestActive || query) ? 30 : 6, top: '50%', transform: 'translateY(-50%)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 'var(--ob-radius-sm)', border: 'none', background: suggestActive ? `${theme.accent}2a` : 'transparent', color: suggestActive ? theme.accent : theme.ink3, cursor: suggestText.trim() ? 'pointer' : 'not-allowed', opacity: suggestText.trim() ? 1 : 0.4 }}
            >
              <IconWand size={14} />
            </button>
            {/* Pulisci: azzera ricerca e suggerimenti. */}
            {(suggestActive || query) && (
              <button
                type="button"
                title="Pulisci"
                onClick={() => { setQuery(''); setSuggestActive(false); searchRef.current?.focus(); }}
                style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 'var(--ob-radius-sm)', border: 'none', background: 'transparent', color: theme.ink3, cursor: 'pointer' }}
              >
                <IconX size={14} />
              </button>
            )}
          </div>
          {allTags.length === 0 ? (
            <p style={{ fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.control, color: theme.ink3, textAlign: 'center', padding: '12px 0', margin: 0 }}>Nessun tag</p>
          ) : visibleTags.length === 0 ? (
            <p style={{ fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.control, color: theme.ink3, textAlign: 'center', padding: '12px 0', margin: 0 }}>{suggestActive ? 'Nessun tag pertinente al testo' : 'Nessun risultato'}</p>
          ) : (
            visibleTags.map((tag) => {
              const assigned = selectedTag?.id === tag.id;
              const busy = toggling === tag.id;
              const c = getTypeColor(tag.tag_type || 'topic') || theme.ink3;
              const emoji = getTypeEmoji(tag.tag_type || 'topic');
              return (
                <button
                  key={tag.id}
                  disabled={busy}
                  onClick={() => handleSelect(tag)}
                  style={popupItem(assigned, busy)}
                >
                  <TagIcon emoji={emoji} color={c} size={14} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tag.name}</span>
                  {assigned && (
                    <svg width={12} height={12} style={{ color: theme.accent, flexShrink: 0 }} viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  )}
                </button>
              );
            })
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

function SparkEditor({
  spark,
  onDelete,
  onUpdateText,
}: {
  spark: Spark;
  onDelete: () => void;
  onUpdateText: (content: string) => void;
}) {
  const theme = usePixelTheme();
  const SparkIcon = SPARK_ICONS[spark.type] || IconFile;
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [editText, setEditText] = useState(spark.content || '');
  const textDirty = useRef(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  // Markdown editor modal for the inline text spark.
  const [textModalOpen, setTextModalOpen] = useState(false);

  // Close PDF modal on Escape
  useEffect(() => {
    if (!pdfModalOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPdfModalOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [pdfModalOpen]);

  useEffect(() => {
    if (spark.storage_path && ['photo', 'image', 'video', 'file', 'audio_recording'].includes(spark.type)) {
      uploadApi.getSignedUrl(spark.storage_path).then((res) => {
        if (res.data?.url) setSignedUrl(res.data.url);
      }).catch(() => {});
    }
  }, [spark.storage_path, spark.type]);

  const handleDeleteClick = () => {
    if (confirmDelete) { onDelete(); setConfirmDelete(false); }
    else setConfirmDelete(true);
  };

  const mediaWrap: React.CSSProperties = {
    overflow: 'hidden',
    background: RAIL_FIELD,
    border: 'none',
    borderRadius: 'var(--ob-radius-md)',
    position: 'relative',
  };
  const overlayBtn = (danger: boolean): React.CSSProperties => ({
    padding: 4,
    background: danger ? 'var(--ob-danger)' : theme.surface,
    color: danger ? '#FFFFFF' : theme.ink2,
    border: `1px solid ${theme.border}`,
    borderRadius: 'var(--ob-radius-sm)',
    cursor: 'pointer',
    display: 'inline-flex',
  });

  if (spark.type === 'text') {
    return (
      <div
        className="group"
        style={{
          background: RAIL_FIELD,
          border: 'none',
          borderRadius: 'var(--ob-radius-md)',
          padding: '10px 12px',
          position: 'relative',
          height: 128,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4, flexShrink: 0 }}>
          <IconFileText size={11} style={{ color: theme.ink3 }} />
          <span style={obLabel(theme)}>
            Testo
          </span>
        </div>
        <div
          onClick={() => setTextModalOpen(true)}
          style={{
            flex: 1,
            overflow: 'auto',
            cursor: 'pointer',
            paddingRight: 4,
          }}
          title="Apri editor"
        >
          {editText.trim() ? (
            <MarkdownPreview markdown={editText} />
          ) : (
            <span style={{ color: theme.ink3, fontStyle: 'italic', fontSize: OB_TEXT.control }}>Vuoto — clicca per scrivere…</span>
          )}
        </div>
        {/* Action chips (edit + delete) appear on hover, top-right corner. */}
        <div
          className="opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 4 }}
        >
          <button
            onClick={() => setTextModalOpen(true)}
            style={{
              padding: 2,
              background: theme.surface,
              color: theme.ink2,
              border: `1px solid ${theme.border}`,
              borderRadius: 'var(--ob-radius-sm)',
              cursor: 'pointer',
              display: 'inline-flex',
            }}
            title="Modifica"
          >
            <IconMaximize size={11} />
          </button>
          <button
            onClick={handleDeleteClick}
            style={{
              padding: 2,
              background: confirmDelete ? 'var(--ob-danger)' : theme.surface,
              color: confirmDelete ? '#FFFFFF' : theme.ink2,
              border: `1px solid ${theme.border}`,
              borderRadius: 'var(--ob-radius-sm)',
              cursor: 'pointer',
              display: 'inline-flex',
            }}
            title={confirmDelete ? 'Conferma eliminazione' : 'Elimina'}
          >
            <IconTrash size={11} />
          </button>
        </div>
        <MarkdownEditorModal
          open={textModalOpen}
          initialValue={editText}
          autoSave
          onSave={(md) => {
            // Salvataggio in tempo reale: aggiorna la preview e persiste lo
            // spark a ogni modifica (debounce nella modale). Non chiude: la
            // chiusura è affidata al bottone X.
            setEditText(md);
            textDirty.current = false;
            onUpdateText(md);
          }}
          onCancel={() => setTextModalOpen(false)}
          title="Modifica testo"
        />
      </div>
    );
  }

  if ((spark.type === 'photo' || spark.type === 'image') && signedUrl) {
    return (
      <div className="group" style={mediaWrap}>
        <img src={signedUrl} alt="" style={{ width: '100%', height: 128, objectFit: 'cover', display: 'block' }} />
        <div className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 4 }}>
          <a href={signedUrl} target="_blank" rel="noopener noreferrer" style={overlayBtn(false)}>
            <IconExternalLink size={11} />
          </a>
          <button onClick={handleDeleteClick} style={overlayBtn(confirmDelete)}>
            <IconTrash size={11} />
          </button>
        </div>
      </div>
    );
  }

  if (spark.type === 'video' && signedUrl) {
    return (
      <div className="group" style={mediaWrap}>
        <video src={signedUrl} style={{ width: '100%', height: 128, objectFit: 'cover', display: 'block' }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <a
            href={signedUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: 8,
              background: theme.accent,
              color: theme.onAccent,
              border: `1px solid ${theme.border}`,
              display: 'inline-flex',
              cursor: 'pointer',
            }}
          >
            <IconPlayerPlay size={18} />
          </a>
        </div>
        <button
          onClick={handleDeleteClick}
          className="opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ position: 'absolute', top: 4, right: 4, ...overlayBtn(confirmDelete) }}
        >
          <IconTrash size={11} />
        </button>
      </div>
    );
  }

  // File: image preview if mime is image, otherwise icon thumbnail
  const isImageFile = spark.mime_type?.startsWith('image/');
  if (isImageFile && signedUrl) {
    return (
      <div className="group" style={mediaWrap}>
        <a href={signedUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}>
          <img src={signedUrl} alt={spark.file_name || ''} style={{ width: '100%', height: 128, objectFit: 'cover', display: 'block' }} />
        </a>
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            background: `linear-gradient(to top, ${theme.surface}EE, transparent)`,
            padding: '4px 8px',
          }}
        >
          <span style={{ fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.control, color: theme.ink2, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {spark.file_name}
          </span>
        </div>
        <button
          onClick={handleDeleteClick}
          className="opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ position: 'absolute', top: 4, right: 4, ...overlayBtn(confirmDelete) }}
        >
          <IconTrash size={11} />
        </button>
      </div>
    );
  }

  // PDF: compact thumbnail in the sidebar, click to open full-size modal
  const isPdfFile = spark.mime_type === 'application/pdf' || spark.file_name?.toLowerCase().endsWith('.pdf');
  if (isPdfFile && signedUrl) {
    return (
      <>
        <div
          onClick={() => setPdfModalOpen(true)}
          className="group"
          style={{
            background: RAIL_FIELD,
            border: 'none',
            borderRadius: 'var(--ob-radius-md)',
            overflow: 'hidden',
            position: 'relative',
            cursor: 'zoom-in',
          }}
        >
          {/* Thumbnail — first page, interaction blocked so click falls through to wrapper */}
          <div style={{ position: 'relative', height: 96, background: RAIL_FIELD, overflow: 'hidden', pointerEvents: 'none' }}>
            <iframe
              src={`${signedUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH&page=1`}
              title={spark.file_name || 'PDF'}
              style={{ width: '100%', height: '100%', border: 0 }}
            />
            <div style={{ position: 'absolute', inset: 0 }} />
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 8px',
              borderTop: `1px solid ${theme.border}`,
              background: theme.surface,
            }}
          >
            <IconFileText size={11} style={{ color: theme.ink2, flexShrink: 0 }} />
            <span
              style={{
                fontFamily: 'var(--ob-font-sans)',
                fontSize: OB_TEXT.control,
                color: theme.ink2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
              }}
              title={spark.file_name || ''}
            >
              {spark.file_name}
            </span>
            <IconMaximize size={11} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: theme.ink3, flexShrink: 0 }} />
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); handleDeleteClick(); }}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ position: 'absolute', top: 4, right: 4, ...overlayBtn(confirmDelete) }}
          >
            <IconTrash size={11} />
          </button>
        </div>

        {/* Expand modal */}
        {pdfModalOpen && createPortal(
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.8)',
              padding: 16,
            }}
            onClick={() => setPdfModalOpen(false)}
          >
            <div
              style={{
                background: theme.surface,
                border: `1px solid ${theme.border}`,
                borderRadius: 'var(--ob-radius-md)',
                boxShadow: 'var(--ob-shadow-modal, var(--ob-shadow-card))',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                width: 'min(95vw, 1100px)',
                height: 'min(95vh, 900px)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 14px',
                  borderBottom: `1px solid ${theme.border}`,
                  background: theme.surfaceVariant,
                  flexShrink: 0,
                }}
              >
                <IconFileText size={14} style={{ color: theme.ink2, flexShrink: 0 }} />
                <span
                  style={{
                    fontFamily: 'var(--ob-font-sans)',
                    fontSize: OB_TEXT.control,
                    fontWeight: OB_WEIGHT.emphasis,
                    letterSpacing: 0,
                    textTransform: 'none',
                    color: theme.ink,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  }}
                  title={spark.file_name || ''}
                >
                  {spark.file_name || 'PDF'}
                </span>
                <a
                  href={signedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ padding: 4, color: theme.ink2, background: 'transparent', display: 'inline-flex' }}
                  title="Apri in nuovo tab"
                >
                  <IconExternalLink size={14} />
                </a>
                <button
                  onClick={() => setPdfModalOpen(false)}
                  style={{ padding: 4, color: theme.ink2, background: 'transparent', border: 'none', cursor: 'pointer', display: 'inline-flex' }}
                  title="Chiudi"
                >
                  <IconX size={14} />
                </button>
              </div>
              <iframe
                src={signedUrl}
                title={spark.file_name || 'PDF'}
                // Il visore a tutta pagina esce dalla colonna (è in un portale su
                // `document.body`): il suo fondo è quello della vista, non quello
                // degli oggetti della sidebar.
                style={{ flex: 1, width: '100%', background: theme.bg1, border: 0 }}
              />
            </div>
          </div>,
          document.body,
        )}
      </>
    );
  }

  return (
    <a
      href={signedUrl || '#'}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => { if (!signedUrl) e.preventDefault(); }}
      className="group"
      style={{
        background: RAIL_FIELD,
        border: 'none',
        borderRadius: 'var(--ob-radius-md)',
        padding: '8px 10px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        position: 'relative',
        cursor: 'pointer',
        textDecoration: 'none',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          background: theme.surfaceVariant,
          border: 'none',
          borderRadius: 9,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <SparkIcon size={18} style={{ color: theme.ink2 }} />
      </div>
      <span style={{ fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.control, color: theme.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
        {spark.file_name || spark.type}
      </span>
      {signedUrl && (
        <IconExternalLink size={11} className="opacity-0 group-hover:opacity-100" style={{ color: theme.ink3, flexShrink: 0 }} />
      )}
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteClick(); }}
        className="opacity-0 group-hover:opacity-100 transition-opacity"
        style={{
          padding: 2,
          background: confirmDelete ? 'var(--ob-danger)' : 'transparent',
          color: confirmDelete ? '#FFFFFF' : theme.ink3,
          border: confirmDelete ? `1px solid ${theme.border}` : 'none',
          cursor: 'pointer',
          display: 'inline-flex',
          flexShrink: 0,
          ...(confirmDelete ? { opacity: 1 } : {}),
        }}
      >
        <IconTrash size={11} />
      </button>
    </a>
  );
}

export function TileSidebar({
  tileId,
  open,
  onToggle,
  invalidateKeys = [],
}: {
  tileId: string | null;
  open: boolean;
  onToggle: () => void;
  /**
   * Chiavi EXTRA da aggiornare oltre alle liste di tile (`TILE_LIST_KEYS`, che
   * sono sempre coperte). Serve alle viste con cache proprie — il canvas e i
   * suoi layout — non a ripetere qui `tiles` o `tiles-calendar`.
   */
  invalidateKeys?: string[];
}) {
  const theme = usePixelTheme();
  const queryClient = useQueryClient();
  const actionColors = useActionColors();
  // "Completato" ha come UNICA fonte di verità il menu a discesa status
  // (status_id = riga di sistema 'done'). Non c'è più il toggle sul titolo.
  const { doneStatusId } = useStatuses();
  const { data, isLoading } = useQuery({
    queryKey: ['tile-detail', tileId],
    queryFn: () => tilesApi.get(tileId!),
    enabled: !!tileId,
    staleTime: 10_000,
    // Tornando sulla finestra riprende i dati freschi (es. modifiche fatte
    // altrove mentre la sidebar restava aperta).
    refetchOnWindowFocus: true,
    // Mentre l'AI sta indicizzando qualche spark, i campi del tile (titolo,
    // descrizione, tag) vengono generati lato server: fai polling veloce finché
    // resta pendente, così la sidebar si aggiorna in tempo reale. A regime
    // (nessuna indicizzazione) niente polling.
    refetchInterval: (query) => {
      const t = query.state.data?.data as (Tile & { sparks?: Spark[] }) | undefined;
      const indexing = (t?.sparks ?? []).some((s) => s.ai_status === 'pending' || s.ai_status === 'processing');
      return indexing ? 4_000 : false;
    },
  });

  const tile = data?.data;
  const sparks: Spark[] = (tile as Tile & { sparks?: Spark[] })?.sparks || [];

  // Due tab, non più tre: i passi di un flow SONO la List.
  const [activeTab, setActiveTab] = useState<'edit' | 'list'>('edit');

  const [editTitle, setEditTitle] = useState('');
  const titleDirty = useRef(false);

  useEffect(() => {
    if (tile) {
      setEditTitle(tile.title || '');
      titleDirty.current = false;
    }
  }, [tile?.id, tile?.title]);

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['tile-detail', tileId] });
    // TUTTE le liste di tile, non solo quelle che il chiamante ricorda: la
    // sidebar è montata accanto alla vista, e la vista accanto può essere
    // un'altra rispetto a quella che ha aperto il pannello.
    invalidateTileCaches(queryClient, invalidateKeys);
  }, [queryClient, tileId, invalidateKeys]);

  // Optimistic: patch tile fields in all cached queries immediately
  const optimisticPatchTile = useCallback((updates: Record<string, unknown>) => {
    if (tileId) patchTileCaches(queryClient, tileId, updates, invalidateKeys);
  }, [queryClient, tileId, invalidateKeys]);

  const updateTileMutation = useMutation({
    mutationFn: (updates: Record<string, unknown>) =>
      tilesApi.update(tileId!, updates as Parameters<typeof tilesApi.update>[1]),
    onMutate: (updates) => optimisticPatchTile(updates),
    onSuccess: invalidateAll,
  });

  const saveTitle = useCallback(() => {
    if (!titleDirty.current || !tileId) return;
    updateTileMutation.mutate({ title: editTitle.trim() });
    titleDirty.current = false;
  }, [editTitle, tileId, updateTileMutation]);


  const updateSparkMutation = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      sparksApi.update(id, { content }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tile-detail', tileId] }),
  });

  const deleteSparkMutation = useMutation({
    mutationFn: (id: string) => sparksApi.delete(id),
    onSuccess: () => {
      invalidateAll();
      toast.success('Contenuto eliminato');
    },
    onError: () => toast.error('Errore eliminazione'),
  });

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || !tileId) return;
    for (const file of Array.from(files)) {
      const mime = file.type;
      let sparkType: string = 'file';
      let folder = 'files';
      // Import da file → 'image', mai 'photo'. La distinzione è semantica e non
      // cosmetica: 'photo' significa "catturata ora dal dispositivo", quindi con
      // timestamp attendibile; 'image' significa "contenuto preesistente, data di
      // creazione ignota". Un file scelto dal picker è per definizione il
      // secondo caso — marcarlo 'photo' sarebbe un'affermazione falsa, e
      // porterebbe fuori strada un'eventuale estrazione date sulle immagini.
      // La cattura da webcam (che produrrà 'photo') arriva in un passo separato.
      if (mime.startsWith('image/')) { sparkType = 'image'; folder = 'photos'; }
      else if (mime.startsWith('video/')) { sparkType = 'video'; folder = 'videos'; }
      else if (mime.startsWith('audio/')) { sparkType = 'audio_recording'; folder = 'audio'; }
      try {
        const uploadRes = await uploadApi.uploadFile(file, folder);
        if (!uploadRes.data) throw new Error('Upload failed');
        await sparksApi.create({
          tile_id: tileId,
          type: sparkType as Spark['type'],
          storage_path: uploadRes.data.path,
          file_name: uploadRes.data.file_name,
          mime_type: uploadRes.data.mime_type,
          file_size: uploadRes.data.file_size,
        });
        toast.success('File aggiunto');
      } catch {
        toast.error('Errore upload');
      }
    }
    invalidateAll();
  }, [tileId, invalidateAll]);

  // `null` = modale chiusa; altrimenti è anche la modalità di cattura attiva.
  const [cameraMode, setCameraMode] = useState<CaptureMode | null>(null);

  /**
   * Salva una cattura da webcam. Non passa da `handleFileSelect` di proposito:
   * quello deriva il tipo dal MIME e marcherebbe uno scatto come 'image', cioè
   * "contenuto preesistente". Qui sappiamo che il contenuto è stato creato
   * adesso, quindi scriviamo il tipo esplicitamente.
   */
  const handleCameraCapture = useCallback(async ({ file, duration }: CapturedMedia) => {
    if (!tileId || !cameraMode) return;
    const isVideo = cameraMode === 'video';
    try {
      const uploadRes = await uploadApi.uploadFile(file, isVideo ? 'videos' : 'photos');
      if (!uploadRes.data) throw new Error('Upload failed');
      await sparksApi.create({
        tile_id: tileId,
        type: isVideo ? 'video' : 'photo',
        storage_path: uploadRes.data.path,
        file_name: uploadRes.data.file_name,
        mime_type: uploadRes.data.mime_type,
        file_size: uploadRes.data.file_size,
        ...(duration ? { duration } : {}),
      });
      toast.success(isVideo ? 'Video aggiunto' : 'Foto aggiunta');
      setCameraMode(null);
      invalidateAll();
    } catch {
      // La modale resta aperta: la cattura è ancora in anteprima e si può
      // ritentare l'upload senza rifarla.
      toast.error('Errore upload');
    }
  }, [tileId, cameraMode, invalidateAll]);

  const [newTextContent, setNewTextContent] = useState('');
  // Toggles the centered markdown editor modal for the in-progress new-text spark.
  const [newTextModalOpen, setNewTextModalOpen] = useState(false);
  // Trascinamento sopra il box di cattura. `dragDepth` conta enter/leave: senza
  // contatore ogni passaggio su un figlio (i cerchi, il segnaposto) emette un
  // `dragleave` e l'evidenziazione lampeggerebbe.
  const [boxDragOver, setBoxDragOver] = useState(false);
  const dragDepth = useRef(0);
  const addTextMutation = useMutation({
    // Accept the content as a parameter so the modal can fire-and-save in one
    // gesture — otherwise we'd be reading a stale `newTextContent` from the
    // closure right after calling `setNewTextContent(md)`.
    mutationFn: async (contentOverride?: string) => {
      if (!tileId) throw new Error('Nessun tile selezionato');
      const content = (contentOverride ?? newTextContent).trim();
      if (!content) throw new Error('Testo vuoto');
      const res = await sparksApi.create({ tile_id: tileId, type: 'text', content });
      if (!res.success) throw new Error(res.error || 'Errore creazione spark');
      return res;
    },
    onSuccess: () => {
      invalidateAll();
      setNewTextContent('');
      setNewTextModalOpen(false);
      toast.success('Testo aggiunto');
    },
    onError: (err: Error) => {
      console.error('[TileSidebar] addTextMutation failed:', err);
      toast.error(err.message || 'Errore salvataggio');
    },
  });

  const labelStyle = obLabel(theme);

  return (
    <div
      style={{
        borderLeft: `1px solid ${theme.border}`,
        background: RAIL_BG,
        transition: 'width 200ms',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        width: open ? 280 : 32,
      }}
    >
      {/* Header: collapse button — alone if no tile, inlined with tabs if tile selected */}
      {(!open || !tileId) && (
        <button
          onClick={onToggle}
          style={{
            height: 'var(--ob-toolbar-height)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            borderBottom: `1px solid ${theme.border}`,
            cursor: 'pointer',
            flexShrink: 0,
            color: theme.ink2,
          }}
        >
          {open
            ? <IconLayoutSidebarRightCollapse size={16} />
            : <IconLayoutSidebarRightExpand size={16} />
          }
        </button>
      )}

      {open && (<>
        {/* Header bar — collapse button + Edit/List/Flow tabs */}
        {tileId && (
          <div
            style={{
              height: 'var(--ob-toolbar-height)',
              padding: '0 8px',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              // Barra delle linguette: INCASSATA, come `.ob-insp__top` e come
              // quella della sidebar dei tag. La hairline qui sotto è il bordo
              // superiore del pannello, e la linguetta attiva la interrompe
              // sbordando di un pixel — vedi `.ob-insp-tab--active`.
              borderBottom: `1px solid ${theme.border}`,
              background: RAIL_SUNKEN,
              flexShrink: 0,
            }}
          >
            <button
              onClick={onToggle}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                // 30 come tutti i controlli di barra (tab, toolbar, segmented).
                width: 30,
                height: 30,
                borderRadius: 'var(--ob-radius-sm)',
                background: 'transparent',
                color: theme.ink2,
                border: 'none',
                cursor: 'pointer',
                flexShrink: 0,
              }}
              title="Collassa sidebar"
            >
              <IconLayoutSidebarRightCollapse size={14} />
            </button>
            {(
              <div className="ob-insp-tabs">
                <button className={cn('ob-insp-tab', activeTab === 'edit' && 'ob-insp-tab--active')} onClick={() => setActiveTab('edit')}><IconEdit size={14} />Edit</button>
                <button className={cn('ob-insp-tab', activeTab === 'list' && 'ob-insp-tab--active')} onClick={() => setActiveTab('list')}><IconList size={14} />List</button>
              </div>
            )}
          </div>
        )}
        <div className="flex-1 overflow-hidden flex flex-col overflow-y-auto" style={{ padding: '12px' }}>
          {!tileId ? (
            <p style={{ fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.control, color: theme.ink3, marginTop: 16 }}>Seleziona un tile</p>
          ) : isLoading ? (
            <p style={{ fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.control, color: theme.ink3, marginTop: 16 }}>Caricamento...</p>
          ) : !tile ? (
            <p style={{ fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.control, color: theme.ink3, marginTop: 16 }}>Tile non trovato</p>
          ) : activeTab === 'list' ? (
            // Una sola forma di lista per ogni tipo di tile, flow compresi:
            // una riga, un campo. Vedi la nota in cima a SubtaskList.
            <SubtaskList tileId={tileId} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={labelStyle}>{'Titolo'}</label>
                <div style={{ position: 'relative' }}>
                  {(() => {
                    // "Completato" deriva SOLO dallo status (menu a discesa),
                    // non più da un toggle sul titolo.
                    const isDone = !!doneStatusId && tile.status_id === doneStatusId;
                    return (
                      <textarea
                        value={editTitle}
                        onChange={(e) => { setEditTitle(e.target.value); titleDirty.current = true; }}
                        onBlur={saveTitle}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveTitle(); } }}
                        rows={2}
                        style={{
                          ...obField(theme),
                          display: 'block',
                          width: '100%',
                          padding: '8px 10px',
                          lineHeight: OB_LEADING.text,
                          // Altezza ESPLICITA invece che dedotta da `rows`: con
                          // box-sizing border-box il browser fa rientrare il
                          // padding nell'altezza calcolata dalle righe, e l'area
                          // di testo finisce per mostrare una riga a metà.
                          // Espressa in `em` così segue il rapporto: 2 righe da
                          // 1.5em = 3em, più 8+8 di padding. Prima era 20px di
                          // interlinea e 56 fissi; con il rapporto quel 56 non
                          // tornava più e la terza riga sarebbe riaffiorata.
                          height: 'calc(3em + 16px)',
                          overflowY: 'auto',
                          outline: 'none',
                          resize: 'none',
                          textDecoration: isDone ? 'line-through' : 'none',
                          color: isDone ? theme.ink3 : theme.ink,
                        }}
                        placeholder={'Titolo…'}
                      />
                    );
                  })()}
                </div>
              </div>


              {/* Type selector */}
              <div>
                <label style={labelStyle}>{'Azione'}</label>
                {(() => {
                  const ac = actionColors;
                  // Same icon mapping used in tile renderers (kanban/calendar/canvas).
                  // Notes (none) shows no badge.
                  const TILE_ACTION_ICON: Record<string, typeof IconBolt | null> = {
                    none:     IconNote,
                    anytime:  IconCheckbox,
                    deadline: IconBolt,
                    event:    IconClock,
                    allday:   IconCalendar,
                    flow:     IconShare2,
                  };
                  // Le due righe non sono un riempimento: sono le due famiglie.
                  // Riga 1 = i tre tipi SENZA tempo, che in CHRONO hanno una
                  // colonna. Riga 2 = i tre CON tempo, che stanno nella griglia.
                  // Cambiare riga a un tile è esattamente ciò che lo sposta.
                  const allOpts = [
                    { value: 'none', label: 'NOTES' },
                    { value: 'anytime', label: 'TO DO' },
                    { value: 'flow', label: 'FLOW' },
                    { value: 'deadline', label: 'DUE' },
                    { value: 'event', label: 'ALL DAY', extra: { all_day: true } },
                    { value: 'event', label: 'TIMED', extra: { all_day: false } },
                  ] as const;
                  const row1 = allOpts.slice(0, 3);
                  const row2 = allOpts.slice(3);
                  // Etichette native Obsidian (immagine di design).
                  const OB_LABEL: Record<string, string> = {
                    'NOTES': 'Note', 'TO DO': 'To-do', 'FLOW': 'Flow', 'DUE': 'Due', 'ALL DAY': 'Daily', 'TIMED': 'Timing',
                  };
                  const renderBtn = (opt: typeof allOpts[number]) => {
                    const isActive = opt.value === 'event'
                      ? tile.action_type === 'event' && ((opt as any).extra?.all_day ? !!tile.all_day : !tile.all_day)
                      : tile.action_type === opt.value;
                    const actionKey = opt.value === 'event' && (opt as any).extra?.all_day ? 'allday' : opt.value;
                    const actionColor = (ac as Record<string, string>)[actionKey] || theme.ink3;
                    const Icon = TILE_ACTION_ICON[actionKey];
                    return (
                      <button
                        key={opt.label}
                        onClick={() => {
                          const updates: Record<string, unknown> = { action_type: opt.value };
                          if (opt.value === 'event') {
                            updates.all_day = (opt as any).extra.all_day;
                            updates.is_event = true;
                          } else {
                            updates.is_event = false;
                            updates.all_day = false;
                          }
                          updateTileMutation.mutate(updates);
                        }}
                        style={{
                          flex: 1,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          // 30 come ogni altro controllo di barra dello shell —
                          // stesso ingombro dei tab Edit/List/Flow qui sopra.
                          height: 30,
                          borderRadius: 'var(--ob-radius-sm)',
                          // Tutti i bottoni hanno un leggero sfondo violaceo (accent);
                          // l'attivo è più marcato e con contorno accent.
                          background: isActive ? `${theme.accent}2E` : `${theme.accent}14`,
                          color: isActive ? theme.accent : theme.ink,
                          // Lo stato attivo si legge dal fondo più carico e dal
                          // testo accent: niente contorno.
                          border: 'none',
                          fontFamily: 'var(--ob-font-sans)',
                          fontSize: OB_TEXT.control,
                          fontWeight: OB_WEIGHT.emphasis,
                          letterSpacing: 0,
                          textTransform: 'none',
                          cursor: 'pointer',
                          boxShadow: 'none',
                        }}
                      >
                        {Icon && ((
                          <Icon size={14} color={isActive ? theme.accent : theme.ink2} />
                        ))}
                        {(OB_LABEL[opt.label] ?? opt.label)}
                      </button>
                    );
                  };
                  return (
                    // Unico container (tutti i 6 bottoni appartengono ad AZIONE):
                    // surface + padding, come segmented control. Niente cornice.
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: RAIL_FIELD, border: 'none', borderRadius: 'var(--ob-radius-md)', padding: 6 }}>
                      <div style={{ display: 'flex', gap: 6 }}>{row1.map(renderBtn)}</div>
                      <div style={{ display: 'flex', gap: 6 }}>{row2.map(renderBtn)}</div>
                    </div>
                  );
                })()}
              </div>

              {/* Date/time fields — shown for deadline, all day, timed */}
              {(tile.action_type === 'deadline' || tile.action_type === 'event') && (() => {
                // Deadline primarily lives in end_at, but fall back to start_at so a
                // date still surfaces even when the tile is mis-scheduled (and matches
                // what the kanban column shows).
                const dateRef = tile.action_type === 'deadline'
                  ? (tile.end_at || tile.start_at)
                  : tile.start_at;
                const dateVal = dateRef ? toLocalInput(dateRef).slice(0, 10) : '';
                const startTime = tile.start_at ? toLocalInput(tile.start_at).slice(11, 16) : '';
                const endTime = tile.end_at ? toLocalInput(tile.end_at).slice(11, 16) : '';
                const isTimed = tile.action_type === 'event' && !tile.all_day;

                const safeTime = (t: string, fallback: string) => /^\d{2}:\d{2}$/.test(t) ? t : fallback;

                const updateDate = (newDate: string) => {
                  if (!newDate || !/^\d{4}-\d{2}-\d{2}$/.test(newDate)) return;
                  if (tile.action_type === 'deadline') {
                    updateTileMutation.mutate({ end_at: new Date(`${newDate}T${safeTime(endTime, '23:59')}`).toISOString() });
                  } else if (isTimed) {
                    const updates: Record<string, string> = {
                      start_at: new Date(`${newDate}T${safeTime(startTime, '09:00')}`).toISOString(),
                    };
                    if (endTime) updates.end_at = new Date(`${newDate}T${safeTime(endTime, '10:00')}`).toISOString();
                    updateTileMutation.mutate(updates);
                  } else {
                    updateTileMutation.mutate({
                      start_at: new Date(`${newDate}T00:00:00`).toISOString(),
                      end_at: new Date(`${newDate}T23:59:59`).toISOString(),
                    });
                  }
                };

                // ── Durata attività (ore): lega start/end ──
                const startMs = tile.start_at ? new Date(tile.start_at).getTime() : NaN;
                const endMs = tile.end_at ? new Date(tile.end_at).getTime() : NaN;
                const durMs = (!isNaN(startMs) && !isNaN(endMs) && endMs > startMs) ? endMs - startMs : 3600000;
                const durationHours = Math.round((durMs / 3600000) * 100) / 100;
                const curStart = safeTime(startTime, '09:00');

                // Cambio inizio: preserva la durata (sposta anche la fine).
                const setStart = (t: string) => {
                  if (!dateVal) return;
                  const ns = new Date(`${dateVal}T${t}`);
                  const ne = new Date(ns.getTime() + durMs);
                  updateTileMutation.mutate({ start_at: ns.toISOString(), end_at: ne.toISOString() });
                };
                // Cambio fine: tiene fisso l'inizio (la durata si ricalcola).
                const setEnd = (t: string) => {
                  if (!dateVal) return;
                  updateTileMutation.mutate({ end_at: new Date(`${dateVal}T${t}`).toISOString() });
                };
                // Cambio durata: tiene fisso l'inizio, ricalcola la fine.
                const setDuration = (h: number) => {
                  if (!dateVal || !(h > 0)) return;
                  const ns = new Date(`${dateVal}T${curStart}`);
                  const ne = new Date(ns.getTime() + h * 3600000);
                  updateTileMutation.mutate({ start_at: ns.toISOString(), end_at: ne.toISOString() });
                };

                // Cella generica dentro il container: sfondo surface, NESSUN bordo
                // (la cornice la dà il container del gruppo).
                const cellBase: React.CSSProperties = {
                  background: RAIL_FIELD, border: 'none',
                  // 30 come ogni altro campo/controllo della sidebar.
                  borderRadius: 'var(--ob-radius-sm)', height: 30,
                };

                return (
                  <div>
                    <label style={labelStyle}>Data e orario</label>
                    {/* Tutto raggruppato in un unico container (come AZIONE): riga data +
                        riga inizio/durata/fine. Niente label: segnaposti illustrativi inline. */}
                    {/* Contenitore trasparente: le celle sono già su bg1, un
                        gruppo dello stesso colore le farebbe sparire. */}
                    <div style={{ background: 'transparent', border: 'none', borderRadius: 'var(--ob-radius-md)', padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {/* Riga 1: data a piena larghezza. Selettore nostro e non
                          `<input type="date">`: il campo nativo disegna i segmenti
                          con cifre a larghezza fissa e non combacia col resto. */}
                      <DatePicker
                        value={dateVal}
                        onChange={updateDate}
                        icon={<IconCalendar size={14} />}
                        noBorder
                      />
                      {/* Riga 2: inizio · durata (h) · fine — solo per eventi a orario.
                          Orologio = segnaposto orario, "h" = segnaposto durata. */}
                      {isTimed && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <TimePicker value={startTime || '09:00'} icon={<IconClock size={14} />} onChange={setStart} compact noBorder />
                          <div style={{ ...cellBase, flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '0 8px' }}>
                            <input
                              type="number"
                              min={0.25}
                              step={0.25}
                              value={durationHours}
                              onChange={(e) => setDuration(parseFloat(e.target.value))}
                              aria-label="Durata in ore"
                              style={{
                                width: 44,
                                background: 'transparent',
                                border: 'none',
                                outline: 'none',
                                textAlign: 'right',
                                fontFamily: 'var(--ob-font-sans)',
                                fontSize: OB_TEXT.control,
                                fontWeight: OB_WEIGHT.body,
                                color: theme.ink,
                              }}
                            />
                            <span style={{ fontSize: OB_TEXT.control, color: theme.ink3 }}>h</span>
                          </div>
                          <TimePicker value={endTime || '10:00'} icon={<IconClock size={14} />} onChange={setEnd} compact noBorder />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Tags */}
              <TagPicker
                tileId={tile.id}
                tileTags={tile.tags || []}
                onChanged={invalidateAll}
                queryClient={queryClient}
                invalidateKeys={invalidateKeys}
                suggestText={[tile.title || '', ...sparks.map((s) => s.content || s.file_name || '')].join(' ')}
              />

              {/* Type Icon */}
              <TypeIconPicker tileId={tile.id} />

              {/* Status */}
              <StatusPicker
                value={tile.status_id ?? null}
                onChange={(statusId) => updateTileMutation.mutate({ status_id: statusId })}
                focused={!!tile.is_focused}
                onToggleFocus={(next) => updateTileMutation.mutate({ is_focused: next })}
              />

              <div style={{ borderTop: `1px solid ${theme.border}` }} />

              <div>
                <div style={{ ...obLabel(theme), marginBottom: 8 }}>
                  {`Sparks · ${sparks.length}`}
                </div>
                {/* Box di cattura: stesso fondo dell'input del titolo (bg1), due
                    righe di testo e in fondo la riga dei canali. I pulsanti sono
                    tondi come nella home dell'app mobile (glifo su disco pieno,
                    nessun bordo — vedi CaptureScreen.tsx `toolbar`).
                    Nella sidebar da 280 sei cerchi da 48 non ci starebbero in
                    riga: `flex: 0 1 48px` li tiene a 48 quando c'è spazio e li
                    stringe quanto basta, mentre `aspect-ratio` li mantiene
                    perfettamente circolari. */}
                <div
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
                  onDragEnter={(e) => { e.preventDefault(); dragDepth.current += 1; setBoxDragOver(true); }}
                  onDragLeave={() => { dragDepth.current = Math.max(0, dragDepth.current - 1); if (dragDepth.current === 0) setBoxDragOver(false); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    dragDepth.current = 0;
                    setBoxDragOver(false);
                    if (e.dataTransfer.files?.length) handleFileSelect(e.dataTransfer.files);
                  }}
                  style={{
                    background: boxDragOver ? `${theme.accent}1F` : RAIL_FIELD,
                    borderRadius: 'var(--ob-radius-md)',
                    padding: 12,
                    marginBottom: 12,
                    // Inset: un contorno esterno allargherebbe il box e farebbe
                    // sobbalzare il contenuto sotto durante il trascinamento.
                    outline: boxDragOver ? `1px dashed ${theme.accent}` : 'none',
                    outlineOffset: -1,
                    transition: 'background-color 120ms ease-out',
                  }}
                >
                  {/* Segnaposto in stile input: cliccandolo si apre direttamente
                      l'editor a modale. Nessuna bozza intermedia, quindi nessuno
                      spark vuoto: lo spark nasce solo al salvataggio. */}
                  <button
                    type="button"
                    onClick={() => setNewTextModalOpen(true)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                      cursor: 'text',
                      fontFamily: 'var(--ob-font-sans)',
                      fontSize: OB_TEXT.control,
                      // Segnaposto appena percettibile: `ink3` è il grigio più
                      // spento della scala, ulteriormente attenuato.
                      color: theme.ink3,
                      opacity: 0.6,
                    }}
                    title="Scrivi una nota"
                  >
                    Scrivi una nota o allega un file
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12 }}>
                  {[
                    // Due canali immagine con significati distinti e veri:
                    // Photo apre la webcam e produce spark 'photo' (catturata
                    // ora, timestamp attendibile); Image apre il file picker e
                    // produce 'image' (contenuto preesistente, data ignota).
                    { id: 'photo', label: 'Photo', icon: IconCamera, capKey: 'photo' as const, accept: null },
                    { id: 'image', label: 'Image', icon: IconPhoto, capKey: 'gallery' as const, accept: 'image/*' },
                    // Video registra dalla webcam, non importa: aprire un file
                    // picker qui duplicherebbe File, che l'importazione la fa già.
                    { id: 'video', label: 'Video', icon: IconVideo, capKey: 'video' as const, accept: null },
                    { id: 'text', label: 'Text', icon: IconEdit, capKey: 'text' as const, accept: null },
                    { id: 'voice', label: 'Voice', icon: IconMicrophone, capKey: 'voice' as const, accept: 'audio/*' },
                    { id: 'file', label: 'File', icon: IconPaperclip, capKey: 'file' as const, accept: '*/*' },
                  ].map((opt) => {
                    const BtnIcon = opt.icon;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => {
                          if (opt.id === 'text') {
                            // Stesso comportamento del segnaposto: modale subito.
                            setNewTextModalOpen(true);
                          } else if (opt.id === 'photo' || opt.id === 'video') {
                            setCameraMode(opt.id);
                          } else {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.multiple = true;
                            input.accept = opt.accept || '*/*';
                            input.onchange = () => { handleFileSelect(input.files); };
                            input.click();
                          }
                        }}
                        style={{
                          position: 'relative',
                          flex: '0 1 48px',
                          minWidth: 0,
                          aspectRatio: '1',
                          borderRadius: '50%',
                          padding: 0,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          // Il disco deve staccarsi dal fondo del box (bg1) in
                          // ENTRAMBI i temi: al buio schiarendo, in chiaro
                          // scurendo. `borderStrong` (n.faint) è l'unico neutro
                          // della scala che va nella direzione giusta da solo
                          // (#4a4a4a scuro / #c4c1cd chiaro), e sotto `ink`
                          // tiene il glifo leggibile in tutti e due i casi.
                          // Era fissato a #3a3a3a: in tema chiaro restava un
                          // dischetto nero in mezzo a superfici bianche.
                          // In chiaro `borderStrong` pieno pesa ancora troppo
                          // (il glifo è quasi nero, quindi il contrasto avanza):
                          // lo si stempera verso la superficie. Al buio no — lì
                          // schiarire allontana dal fondo, non avvicina.
                          background: theme.mode === 'light'
                            ? `color-mix(in srgb, ${theme.borderStrong} 68%, ${theme.surface})`
                            : theme.borderStrong,
                          border: 'none',
                          cursor: 'pointer',
                        }}
                        title={opt.label}
                      >
                        <BtnIcon size={17} stroke={1.7} style={{ color: theme.ink }} />
                      </button>
                    );
                  })}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {sparks.map((spark) => (
                    <SparkEditor
                      key={spark.id}
                      spark={spark}
                      onDelete={() => deleteSparkMutation.mutate(spark.id)}
                      onUpdateText={(content) => updateSparkMutation.mutate({ id: spark.id, content })}
                    />
                  ))}
                </div>

                {/* Unico percorso per il testo: la modale. Nessuna bozza in
                    sidebar, quindi nessuno spark vuoto — lo spark nasce solo se
                    alla chiusura c'è del contenuto. */}
                <MarkdownEditorModal
                  open={newTextModalOpen}
                  initialValue={newTextContent}
                  onSave={(md) => {
                    setNewTextContent(md);
                    if (md.trim()) addTextMutation.mutate(md);
                    else { setNewTextContent(''); setNewTextModalOpen(false); }
                  }}
                  onCancel={() => { setNewTextContent(''); setNewTextModalOpen(false); }}
                  title="Nuovo testo"
                  commitOnClose
                />
              </div>

            </div>
          )}
        </div>

        {tileId && tile && (
          <div style={{ padding: '8px 12px', flexShrink: 0, textAlign: 'right', borderTop: `1px solid ${theme.border}`, background: theme.surfaceVariant }}>
            <span
              style={{
                fontFamily: 'var(--ob-font-mono)',
                fontSize: OB_TEXT.eyebrow,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: theme.ink3,
              }}
            >
              Created: {new Date(tile.created_at).toLocaleDateString('it-IT')}
            </span>
          </div>
        )}
      </>)}

      {/* Fuori dai blocchi condizionali della barra di cattura: la modale si
          monta in un portale a `position: fixed`, quindi non dipende dallo
          stato di apertura di nessuna sezione della sidebar. */}
      <CameraCapture
        open={cameraMode !== null}
        // `key` forza il rimonto al cambio modalità: la modale acquisisce lo
        // stream all'apertura, e riusare la stessa istanza fra photo e video la
        // lascerebbe con uno stream senza traccia audio.
        key={cameraMode ?? 'closed'}
        mode={cameraMode ?? 'photo'}
        onCancel={() => setCameraMode(null)}
        onCapture={handleCameraCapture}
      />
    </div>
  );
}
