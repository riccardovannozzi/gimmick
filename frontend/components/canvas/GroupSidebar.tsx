'use client';

/**
 * Gimmick · Canvas — GroupSidebar.
 *
 * Pannello destro (analogo a TileSidebar) con le proprietà del gruppo
 * selezionato: nome, elenco tile, e i controlli di stile — colore di sfondo,
 * colore/spessore/tipologia del bordo. I colori usano la palette di sistema
 * (GIMMICK_PALETTE). La selezione evidenzia anche i punti di aggancio sul canvas.
 */
import { useState, useEffect, useRef } from 'react';
import { IconLayoutSidebarRightCollapse, IconLayoutSidebarRightExpand, IconBoxOff, IconBoxMultiple, IconLine, IconLineDashed, IconLineDotted, IconArticle, IconUser } from '@tabler/icons-react';
import { usePixelTheme } from '@/components/pixel';
import { OB_WEIGHT, OB_TEXT, obLabel } from '@/lib/theme/ob-typography';
import { GIMMICK_PALETTE } from '@/lib/palette';
import type { CanvasGroup, GroupBorderStyle } from '@/components/canvas/CanvasBoard';

// C'era qui `GROUP_BG_PALETTE`: dieci toni scuri e desaturati, scelti perché
// un pastello chiaro dietro i tile li faceva "sparire". È stata ritirata — il
// gruppo usa ora la palette generale dell'app come ogni altro campo colore,
// così la scelta è la stessa ovunque. Il vecchio motivo però non è sparito con
// lei: vedi l'avvertenza sul campo "Colore sfondo", più in basso.

interface GroupSidebarProps {
  group: CanvasGroup;
  tiles: { id: string; title?: string }[];
  /** Tutti i box del canvas che possono essere membri (testo, immagini e
   *  soggetti): il pannello pesca quelli del gruppo (membri `tb:<id>`) e li
   *  elenca accanto ai tile. `label` è già pronta da mostrare — ricavarla qui
   *  avrebbe voluto dire ripulire l'HTML di una nota dentro un pannello di
   *  stile. */
  boxes?: { id: string; type: 'text' | 'image' | 'subject'; src?: string; label: string }[];
  open: boolean;
  onToggle: () => void;
  onUpdate: (patch: Partial<CanvasGroup>) => void;
  /** Scioglie il gruppo: toglie il contenitore, i membri restano sul canvas. */
  onDelete: () => void;
  onSelectTile: (id: string) => void;
  /** Sfila un singolo membro dal gruppo. Id nel formato dei membri: id nudo =
   *  tile, `tb:<id>` = box. */
  onUngroupMember?: (memberId: string) => void;
}

/** Eyebrow di sezione — alias locale della ricetta condivisa, per non toccare
 *  i tre punti che la chiamano già con questo nome. */
const eyebrowStyle = obLabel;

/** Campo colore: swatch cliccabile che apre una palette (GIMMICK_PALETTE). */
export function ColorField({ label, value, onChange, allowNone, palette = GIMMICK_PALETTE }: {
  /** Omessa sotto un'intestazione di sezione — vedi `Segmented`. */
  label?: string;
  value: string | null | undefined;
  onChange: (hex: string | null) => void;
  allowNone?: boolean;
  palette?: typeof GIMMICK_PALETTE;
}) {
  const theme = usePixelTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && <span style={eyebrowStyle(theme)}>{label}</span>}
      <div ref={ref} style={{ position: 'relative' }}>
        <button
          onClick={() => setOpen((o) => !o)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            width: '100%', padding: '6px 8px',
            // Nessun contorno: l'oggetto si distingue per il fondo (vedi TextSidebar).
            background: 'var(--ob-rail-field)', border: 'none', borderRadius: 'var(--ob-radius-sm)',
            cursor: 'pointer', color: theme.ink2, fontFamily: 'var(--ob-font-mono)', fontSize: OB_TEXT.meta,
          }}
        >
          <span
            style={{
              width: 20, height: 20, borderRadius: 'var(--ob-radius-sm)', flexShrink: 0,
              border: `1px solid ${theme.border}`,
              // Solo proprietà longhand: mischiare `background` (shorthand) con
              // backgroundImage/Size/Position genera un warning React.
              backgroundColor: value || 'transparent',
              ...(value ? {} : {
                backgroundImage: 'linear-gradient(45deg,#8884 25%,transparent 25%,transparent 75%,#8884 75%),linear-gradient(45deg,#8884 25%,transparent 25%,transparent 75%,#8884 75%)',
                backgroundSize: '8px 8px',
                backgroundPosition: '0 0,4px 4px',
              }),
            }}
          />
          {/* "Default" e non "Nessuno": l'assenza di un colore scelto non
              lascia l'oggetto senza colore, gli fa prendere quello di sistema —
              `EDGE_COLOR_DEFAULT` per un collegamento, `--ob-group-bg` per un
              gruppo, la superficie per un box di testo. "Nessuno" prometteva
              una trasparenza che non c'è mai stata.
              La scacchiera resta: dice che qui non c'è una SCELTA, ed è vero.
              Mostrare il colore effettivo vorrebbe dire che questo campo sappia
              qual è il default di chi lo ospita, e non lo sa. */}
          {value ? value.toUpperCase() : 'Default'}
        </button>
        {open && (
          <div
            style={{
              position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 50, width: 'max-content',
              background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 'var(--ob-radius-md)',
              boxShadow: 'var(--ob-shadow-card)', padding: 8,
              display: 'flex', flexDirection: 'column', gap: 6,
            }}
          >
            {/* Colonne a misura FISSA e non `1fr`: con `1fr` la swatch valeva
                quanto il campo che apre il menu, e nella TextSidebar quel campo
                divide la riga con "Dimensione" — restavano poco più di 8px per
                colore, illeggibili. Ora la misura la decide la swatch e il menu
                si dimensiona di conseguenza (`width: max-content`).
                20 × 10 + 4 di gap + 8+8 di padding = 252, che sta nei 256 utili
                della sidebar (280 meno 12+12): è il massimo possibile senza far
                uscire il menu dal pannello, che lo ritaglierebbe — il corpo ha
                `overflowY: auto`, e basta un asse non-visible a ritagliare
                anche l'altro. */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 20px)', gap: 4 }}>
              {palette.map((c) => {
                const on = (value || '').toLowerCase() === c.hex.toLowerCase();
                return (
                  <button
                    key={c.id}
                    type="button"
                    title={c.name}
                    onClick={() => { onChange(c.hex); setOpen(false); }}
                    style={{
                      width: '100%', aspectRatio: '1', borderRadius: 'var(--ob-radius-sm)',
                      background: c.hex,
                      border: `2px solid ${on ? theme.ink : 'transparent'}`,
                      cursor: 'pointer',
                    }}
                  />
                );
              })}
            </div>
            {allowNone && (
              <button
                type="button"
                onClick={() => { onChange(null); setOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 8px',
                  background: 'transparent', border: `1px solid ${theme.border}`, borderRadius: 'var(--ob-radius-sm)',
                  cursor: 'pointer', color: theme.ink2, fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.card,
                }}
              >
                <span style={{ width: 20, height: 20, borderRadius: 'var(--ob-radius-sm)', border: `1px solid ${theme.border}`, position: 'relative', overflow: 'hidden' }}>
                  <span style={{ position: 'absolute', inset: 0, background: `linear-gradient(to top right, transparent 46%, #E24B4A 46%, #E24B4A 54%, transparent 54%)` }} />
                </span>
                Default
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Gruppo di pulsanti segmentati. */
export function Segmented<T extends string | number>({ label, value, options, onChange }: {
  /** Omessa quando il controllo sta sotto un'intestazione di sezione che dice
   *  già la stessa parola: ripeterla è rumore. */
  label?: string;
  value: T;
  options: { value: T; content: React.ReactNode; title?: string }[];
  onChange: (v: T) => void;
}) {
  const theme = usePixelTheme();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && <span style={eyebrowStyle(theme)}>{label}</span>}
      <div style={{ display: 'flex', gap: 4 }}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={String(o.value)}
              type="button"
              title={o.title}
              onClick={() => onChange(o.value)}
              style={{
                flex: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: 30,
                // Stato attivo: viola scuro (accent-soft) + testo accent, come i
                // tab della navbar — non il lavanda pieno.
                background: active ? 'var(--ob-accent-soft)' : 'var(--ob-rail-field)',
                border: `1px solid ${active ? 'transparent' : theme.border}`,
                borderRadius: 'var(--ob-radius-sm)',
                color: active ? 'var(--ob-accent)' : theme.ink2,
                fontFamily: 'var(--ob-font-mono)', fontSize: OB_TEXT.card, fontWeight: OB_WEIGHT.emphasis,
                cursor: 'pointer',
              }}
            >
              {o.content}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Sfila un singolo membro dal gruppo (tile o immagine). Sta accanto alla riga
 *  del membro: l'ungroup di uno solo non è un'azione da menu contestuale
 *  soltanto — se il pannello elenca i membri, deve poterli anche far uscire. */
function UngroupButton({ onClick }: { onClick: () => void }) {
  const theme = usePixelTheme();
  return (
    <button
      onClick={onClick}
      title="Sfila dal gruppo"
      aria-label="Sfila dal gruppo"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 28, flexShrink: 0,
        background: 'var(--ob-rail-field)', border: `1px solid ${theme.border}`,
        borderRadius: 'var(--ob-radius-sm)', color: theme.ink3, cursor: 'pointer',
      }}
    >
      <IconBoxOff size={14} />
    </button>
  );
}

export function GroupSidebar({ group, tiles, boxes = [], open, onToggle, onUpdate, onDelete, onSelectTile, onUngroupMember }: GroupSidebarProps) {
  const theme = usePixelTheme();
  const [name, setName] = useState(group.label || '');

  useEffect(() => { setName(group.label || ''); }, [group.id, group.label]);

  const groupTiles = group.nodeIds
    .map((id) => tiles.find((t) => t.id === id))
    .filter((t): t is { id: string; title?: string } => !!t);
  // I box stanno nei gruppi come i tile, solo identificati da `tb:<id>`. Non
  // hanno un titolo proprio: si elencano per miniatura (immagini) o per la prima
  // riga del contenuto (testi).
  const groupBoxes = group.nodeIds
    .filter((id) => id.startsWith('tb:'))
    .map((id) => boxes.find((b) => b.id === id.slice(3)))
    .filter((b): b is NonNullable<typeof b> => !!b);

  const eyebrow = eyebrowStyle(theme);
  // Stesso default del disegno (`gBw` in CanvasBoard.tsx): un gruppo nasce con
  // la sua hairline. Con 0 qui il pannello avrebbe mostrato «nessun bordo» su un
  // gruppo che il canvas disegna col bordo.
  const width = group.borderWidth ?? 1;
  const style: GroupBorderStyle = group.borderStyle ?? 'solid';

  const commitName = () => {
    const trimmed = name.trim();
    if (trimmed !== (group.label || '')) onUpdate({ label: trimmed });
  };

  return (
    <div
      style={{
        borderLeft: `1px solid ${theme.border}`,
        background: 'var(--ob-rail-bg)',
        transition: 'width 200ms',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        width: open ? 280 : 32,
      }}
    >
      {/* Header: collapse + titolo */}
      <div
        style={{
          height: 'var(--ob-toolbar-height)',
          padding: open ? '0 8px' : 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: open ? 'flex-start' : 'center',
          gap: 8,
          borderBottom: `1px solid ${theme.border}`,
          flexShrink: 0,
        }}
      >
        <button
          onClick={onToggle}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent', border: 'none', cursor: 'pointer', color: theme.ink2, padding: 4,
          }}
          aria-label={open ? 'Comprimi' : 'Espandi'}
        >
          {open ? <IconLayoutSidebarRightCollapse size={16} /> : <IconLayoutSidebarRightExpand size={16} />}
        </button>
        {open && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: theme.ink, fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.control, fontWeight: OB_WEIGHT.emphasis }}>
            <IconBoxMultiple size={15} style={{ color: theme.accent }} />
            Gruppo
          </div>
        )}
      </div>

      {open && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Nome */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={eyebrow}>Nome</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur(); } }}
              placeholder="Nome del gruppo"
              style={{
                width: '100%', padding: '8px 10px',
                background: 'var(--ob-rail-field)', border: `1px solid ${theme.border}`, borderRadius: 'var(--ob-radius-sm)',
                color: theme.ink, fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.control, outline: 'none',
              }}
            />
          </div>

          {/* Stile: sfondo / bordo / spessore / tipologia */}
          {/* ⚠️ Palette GENERALE (default di `ColorField`), come i box di testo.
              Da sapere: il fondo del gruppo è pieno, non velato, e i tile che ci
              stanno sopra hanno il loro fondo chiaro. Con un colore della riga
              Light2 in tema chiaro il gruppo e i tile finiscono quasi dello
              stesso valore, e a separarli resta solo la hairline del tile. */}
          <ColorField
            label="Colore sfondo"
            value={group.bgColor}
            allowNone
            onChange={(hex) => onUpdate({ bgColor: hex })}
          />
          <ColorField
            label="Colore bordo"
            value={group.borderColor}
            onChange={(hex) => onUpdate({ borderColor: hex, borderWidth: width > 0 ? width : 1 })}
          />
          <Segmented
            label="Spessore bordo"
            value={width}
            onChange={(w) => onUpdate({ borderWidth: w })}
            options={[
              { value: 0, content: 'No', title: 'Nessun bordo' },
              { value: 1, content: '1', title: '1 px' },
              { value: 2, content: '2', title: '2 px' },
              { value: 3, content: '3', title: '3 px' },
              { value: 4, content: '4', title: '4 px' },
            ]}
          />
          <Segmented<GroupBorderStyle>
            label="Tipologia bordo"
            value={style}
            onChange={(s) => onUpdate({ borderStyle: s })}
            options={[
              { value: 'solid', content: <IconLine size={16} />, title: 'Continuo' },
              { value: 'dashed', content: <IconLineDashed size={16} />, title: 'Tratteggiato' },
              { value: 'dotted', content: <IconLineDotted size={16} />, title: 'Puntinato' },
            ]}
          />

          {/* Tile contenuti */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={eyebrow}>Tile ({groupTiles.length})</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {groupTiles.map((t) => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'stretch', gap: 4 }}>
                  <button
                    onClick={() => onSelectTile(t.id)}
                    title={t.title || 'Senza titolo'}
                    style={{
                      display: 'flex', alignItems: 'center', flex: 1, minWidth: 0, padding: '7px 10px',
                      textAlign: 'left', background: 'var(--ob-rail-field)', border: `1px solid ${theme.border}`,
                      borderRadius: 'var(--ob-radius-sm)', color: theme.ink2, fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.control,
                      cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}
                  >
                    {t.title || 'Senza titolo'}
                  </button>
                  {onUngroupMember && <UngroupButton onClick={() => onUngroupMember(t.id)} />}
                </div>
              ))}
            </div>
          </div>

          {/* Box contenuti — membri come i tile: testi e immagini in UNA sola
              lista, perché nel gruppo valgono la stessa cosa e due sezioni
              separate avrebbero suggerito due regole diverse. Li distingue la
              miniatura (immagine) o il glifo della nota (testo). */}
          {groupBoxes.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={eyebrow}>Box ({groupBoxes.length})</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {groupBoxes.map((b) => (
                  <div key={b.id} style={{ display: 'flex', alignItems: 'stretch', gap: 4 }}>
                    <div
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, padding: '5px 8px',
                        background: 'var(--ob-rail-field)', border: `1px solid ${theme.border}`,
                        borderRadius: 'var(--ob-radius-sm)', color: theme.ink2,
                        fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.control,
                      }}
                      title={b.label}
                    >
                      {b.type === 'image' && b.src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={b.src}
                          alt=""
                          style={{ width: 36, height: 24, objectFit: 'cover', borderRadius: 2, flexShrink: 0, background: theme.bg1 }}
                        />
                      ) : (
                        // Stessa impronta della miniatura (36×24) così le righe
                        // si incolonnano invece di sfalsarsi. Il glifo dice il
                        // tipo: la nota o la persona.
                        <span
                          style={{
                            width: 36, height: 24, flexShrink: 0, borderRadius: 2, background: theme.bg1,
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: theme.ink3,
                          }}
                        >
                          {b.type === 'subject' ? <IconUser size={14} /> : <IconArticle size={14} />}
                        </span>
                      )}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.label}</span>
                    </div>
                    {onUngroupMember && <UngroupButton onClick={() => onUngroupMember(`tb:${b.id}`)} />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Azioni — sciogliere NON cancella: il contenitore va via, i membri
              restano dove sono. Per questo non è un'azione rossa. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button
              onClick={onDelete}
              title="Toglie il gruppo: i membri restano sul canvas"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                width: '100%', padding: '9px 12px', background: 'transparent',
                border: `1px solid ${theme.border}`, borderRadius: 'var(--ob-radius-sm)', color: theme.ink2,
                fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.control, cursor: 'pointer',
              }}
            >
              <IconBoxOff size={14} />
              Sciogli gruppo (Ungroup)
            </button>
            <span style={{ color: theme.ink3, fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.meta }}>
              I tile, i testi e le immagini restano sul canvas.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
