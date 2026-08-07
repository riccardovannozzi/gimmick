'use client';

/**
 * Gimmick · Obsidian — Assi del Kanban: colonne verticali e corsie orizzontali.
 *
 * Si sceglie UNA modalità fra cinque, e sono alternative fra loro:
 *
 *   Azione · Status · Tipo · Data · Personalizzate
 *
 * Le prime quattro sono dimensioni dei dati: le voci si generano da sole, tutte,
 * e non c'è niente da selezionare a mano. La quinta è un elenco che scrivi tu.
 *
 * ─── Perché non si mescolano ─────────────────────────────────────────────────
 *
 * Prima si potevano comporre — due colonne per status, una per tag, una a mano —
 * e il risultato erano board in cui un tile cadeva in due colonne o in nessuna.
 * Un asse deve PARTIZIONARE: una domanda, una risposta per ogni tile. Da qui
 * anche l'altro vincolo, che nasce da sé: i due assi non possono avere la stessa
 * modalità, perché riga e colonna si intersecherebbero in una sola cella piena
 * e tutto il resto della fascia sarebbe vuoto per costruzione.
 *
 * La modalità sta nelle impostazioni utente, non in una tabella: cambiarla non
 * crea né distrugge righe, e le colonne personalizzate restano dove sono, pronte
 * a ricomparire appena riselezioni "Personalizzate".
 */
import { useMemo, useState } from 'react';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { Modal } from '@/components/primitives';
import { usePixelTheme } from '@/components/pixel';
import { useStatuses } from '@/store/statuses-store';
import { useTypeIcons } from '@/store/type-icons-store';
import { OB_TEXT } from '@/lib/theme/ob-typography';
import { AXIS_MODES, AXIS_MODE_LABEL, ACTION_ITEMS, type AxisMode } from '@/lib/kanban-axis';
import type { KanbanFilter, KanbanFilterType, Tag } from '@/types';

/** Una voce personalizzata già salvata. */
export interface AxisEntry {
  id: string;
  title: string;
  filters: KanbanFilter[];
}

export interface AxisModalProps {
  open: boolean;
  onClose: () => void;
  axis: 'column' | 'lane';
  mode: AxisMode;
  /** La modalità dell'ALTRO asse: quella non si può riusare qui. */
  otherMode: AxisMode;
  onModeChange: (m: AxisMode) => void;
  /** Le voci personalizzate di questo asse (usate solo in modalità `custom`). */
  entries: AxisEntry[];
  /**
   * TUTTE le voci che la modalità corrente produce, anche quelle spente. Le
   * calcola il chiamante — qui servono solo per mostrarle e commutarle, e
   * riderivarle sarebbe una seconda verità da tenere allineata.
   */
  items: { id: string; title: string }[];
  /** Gli id spenti: presenti nell'elenco, assenti dalla board. */
  hidden: Set<string>;
  onToggleHidden: (id: string) => void;
  onShowAll: () => void;
  tags: Tag[];
  onCreate: (items: { title: string; filters: KanbanFilter[] }[]) => void;
  onDelete: (id: string) => void;
}

const AXIS_WORDS = {
  column: { title: 'Colonne', one: 'colonna', many: 'colonne', other: 'corsie' },
  lane: { title: 'Corsie', one: 'corsia', many: 'corsie', other: 'colonne' },
} as const;

/** Cosa mostra ogni modalità, detto in una riga sotto i pulsanti. */
const MODE_HINT: Record<AxisMode, string> = {
  action: 'Una voce per tipo di azione: Note, To-do, Flow, Due, Daily, Timing.',
  status: 'Una voce per status.',
  type: 'Una voce per tipo assegnato ai tile.',
  date: 'Una voce per giorno. I giorni non finiscono: la board si allarga da sola quando arrivi al bordo.',
  custom: 'Un elenco che scrivi tu, ognuno col suo filtro.',
  none: 'Nessuna corsia: i tile stanno tutti in una fascia sola.',
};

export function AxisModal({
  open, onClose, axis, mode, otherMode, onModeChange, entries, items, hidden, onToggleHidden, onShowAll,
  tags, onCreate, onDelete,
}: AxisModalProps) {
  const W = AXIS_WORDS[axis];
  const theme = usePixelTheme();
  const { statuses } = useStatuses();
  const icons = useTypeIcons((s) => s.icons);

  const [customTitle, setCustomTitle] = useState('');
  const [customType, setCustomType] = useState<KanbanFilterType | ''>('');
  const [customValue, setCustomValue] = useState('');

  // Le corsie possono anche non esserci; le colonne no — una board senza
  // colonne non ha dove mettere i tile.
  const modes: AxisMode[] = axis === 'lane' ? ['none', ...AXIS_MODES] : AXIS_MODES;

  const createCustom = () => {
    const title = customTitle.trim();
    if (!title) return;
    // Senza filtro la voce raccoglie tutto: legittimo (una "Inbox"), ma dev'essere
    // una scelta, non il risultato di un campo lasciato vuoto.
    const filters: KanbanFilter[] = customType && customValue ? [{ type: customType, value: customValue }] : [];
    onCreate([{ title, filters }]);
    setCustomTitle(''); setCustomType(''); setCustomValue('');
  };

  const customValues = useMemo(() => {
    switch (customType) {
      case 'type_icon': return icons.map((i) => ({ value: i.id, label: i.name }));
      case 'status': return statuses.map((s) => ({ value: s.id, label: s.name }));
      case 'tag': return tags.filter((t) => !t.is_root).map((t) => ({ value: t.id, label: t.name }));
      case 'action_type': return ACTION_ITEMS;
      case 'completion': return [{ value: 'completed', label: 'Completati' }, { value: 'active', label: 'Non completati' }];
      default: return [];
    }
  }, [customType, icons, statuses, tags]);

  const label: React.CSSProperties = {
    display: 'block',
    fontFamily: 'var(--ob-font-mono)', fontSize: OB_TEXT.micro,
    letterSpacing: '0.08em', textTransform: 'uppercase',
    color: theme.ink3, marginBottom: 6,
  };
  const field: React.CSSProperties = {
    height: 30, background: theme.bg1, border: 'none',
    borderRadius: 'var(--ob-radius-sm)', padding: '0 8px', color: theme.ink,
    fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.control, outline: 'none',
  };
  const btn = (primary?: boolean): React.CSSProperties => ({
    height: 30, padding: '0 12px', display: 'inline-flex', alignItems: 'center', gap: 6,
    background: primary ? theme.accent : theme.surfaceVariant,
    color: primary ? theme.onAccent : theme.ink,
    border: 'none', borderRadius: 'var(--ob-radius-sm)', cursor: 'pointer',
    fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.control,
  });

  return (
    <Modal open={open} onClose={onClose} title={W.title} maxWidth={520}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* ── La modalità ── */}
        <section>
          <span style={label}>{W.title} per</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {modes.map((m) => {
              const active = mode === m;
              // La modalità dell'altro asse non si può riusare: due assi sulla
              // stessa dimensione si incrociano in una cella sola.
              const busy = !active && m !== 'custom' && m !== 'none' && m === otherMode;
              return (
                <button
                  key={m}
                  type="button"
                  disabled={busy}
                  onClick={() => onModeChange(m)}
                  title={busy ? `Già usata dalle ${W.other}` : undefined}
                  style={{
                    ...btn(),
                    ...(active ? { background: 'var(--ob-accent-soft)', color: 'var(--ob-accent)' } : {}),
                    ...(busy ? { opacity: 0.35, cursor: 'not-allowed', textDecoration: 'line-through' } : {}),
                  }}
                >{AXIS_MODE_LABEL[m]}</button>
              );
            })}
          </div>
          <p style={{ fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.card, color: theme.ink3, margin: '8px 0 0' }}>
            {MODE_HINT[mode]}
          </p>
        </section>

        {/* ── Quali voci mostrare ──
            Una dimensione produce tutte le sue voci, ma non tutte servono
            sempre: uno status che non usi occupa una colonna per niente. Qui si
            spengono senza cambiare i dati — restano nell'elenco, spente, e si
            riaccendono quando servono.

            La modalità DATA non ha un elenco: i giorni non finiscono, e
            spegnerne uno in mezzo lascerebbe un buco nella sequenza. */}
        {mode !== 'custom' && mode !== 'none' && mode !== 'date' && items.length > 0 && (
          <section>
            <span style={label}>Voci mostrate · {items.length - items.filter((i) => hidden.has(i.id)).length} di {items.length}</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {items.map((it) => {
                const off = hidden.has(it.id);
                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => onToggleHidden(it.id)}
                    title={off ? 'Spenta: non compare nella board' : 'Clicca per nasconderla'}
                    style={{
                      ...btn(),
                      ...(off
                        ? { opacity: 0.4, textDecoration: 'line-through' }
                        : { background: 'var(--ob-accent-soft)', color: 'var(--ob-accent)' }),
                    }}
                  >{it.title}</button>
                );
              })}
            </div>
            {items.some((i) => hidden.has(i.id)) && (
              <button type="button" style={{ ...btn(), marginTop: 8 }} onClick={onShowAll}>
                Mostra tutte
              </button>
            )}
          </section>
        )}

        {/* ── L'elenco personalizzato: solo in quella modalità ── */}
        {mode === 'custom' && (
          <>
            <section>
              <span style={label}>Aggiungi una {W.one}</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <input
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') createCustom(); }}
                  placeholder={`Titolo della ${W.one}`}
                  style={{ ...field, flex: '1 1 150px', minWidth: 130 }}
                />
                <select
                  value={customType}
                  onChange={(e) => { setCustomType(e.target.value as KanbanFilterType | ''); setCustomValue(''); }}
                  style={{ ...field, cursor: 'pointer' }}
                >
                  <option value="">Nessun filtro</option>
                  <option value="type_icon">Tipo</option>
                  <option value="status">Status</option>
                  <option value="action_type">Azione</option>
                  <option value="tag">Tag</option>
                  <option value="completion">Completamento</option>
                </select>
                <select
                  value={customValue}
                  onChange={(e) => setCustomValue(e.target.value)}
                  disabled={!customType}
                  style={{ ...field, cursor: customType ? 'pointer' : 'not-allowed', opacity: customType ? 1 : 0.4 }}
                >
                  <option value="">Valore…</option>
                  {customValues.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
                </select>
                <button type="button" style={{ ...btn(true), opacity: customTitle.trim() ? 1 : 0.4 }} disabled={!customTitle.trim()} onClick={createCustom}>
                  <IconPlus size={14} />Aggiungi
                </button>
              </div>
            </section>

            <section>
              <span style={label}>{W.title} · {entries.length}</span>
              {entries.length === 0 ? (
                <p style={{ fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.card, color: theme.ink3, margin: 0 }}>
                  Nessuna {W.one} ancora.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 200, overflowY: 'auto' }}>
                  {entries.map((c) => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 30, padding: '0 8px', background: theme.bg1, borderRadius: 'var(--ob-radius-sm)' }}>
                      <span style={{ fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.card, color: theme.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.title}
                      </span>
                      <span style={{ fontFamily: 'var(--ob-font-mono)', fontSize: OB_TEXT.micro, color: theme.ink3, marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                        {c.filters.length ? `${c.filters.length} filtr${c.filters.length === 1 ? 'o' : 'i'}` : 'tutto'}
                      </span>
                      <button
                        type="button"
                        onClick={() => onDelete(c.id)}
                        title={`Elimina la ${W.one} (i tile restano)`}
                        style={{ padding: 2, background: 'transparent', border: 'none', color: theme.ink3, cursor: 'pointer', display: 'inline-flex' }}
                      >
                        <IconTrash size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </Modal>
  );
}
