'use client';

/**
 * Gimmick · Obsidian — Assi del Kanban: colonne verticali e corsie orizzontali.
 *
 * Un asse del Kanban è un insieme di filtri con un titolo. La board è la
 * GRIGLIA dei due: ogni cella è l'incrocio fra una colonna e una corsia, e ci
 * finiscono i tile che soddisfano entrambi i gruppi di filtri.
 *
 * La modale fa due cose diverse, e la distinzione è il punto:
 *
 *   GENERA DA UN CAMPO — scegli una dimensione (Tipo, Status, Azione, Tag) e
 *   ottieni una voce per ciascun valore. È il caso normale: una board si
 *   costruisce quasi sempre affettando i tile lungo UN campo, e farlo a mano
 *   significa creare otto voci e scrivere otto filtri identici.
 *
 *   PERSONALIZZATA — un titolo tuo e un filtro scelto a mano, per le voci che
 *   non nascono da una dimensione ("Urgenti", "Da rivedere").
 *
 * ⚠️ UN VALORE SI USA UNA VOLTA SOLA, SU TUTTA LA BOARD. Un valore già usato
 * viene mostrato barrato e non si può selezionare — e il controllo guarda
 * ENTRAMBI gli assi, non solo quello che stai modificando. Due voci con lo
 * stesso filtro non sono un errore per il database, ma sulla board sono due
 * copie della stessa cosa; e lo stesso valore su assi incrociati è peggio: la
 * riga e la colonna si intersecherebbero in una sola cella piena, con tutto il
 * resto vuoto per costruzione.
 */
import { useMemo, useState } from 'react';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { Modal } from '@/components/primitives';
import { usePixelTheme } from '@/components/pixel';
import { useStatuses } from '@/store/statuses-store';
import { useTypeIcons } from '@/store/type-icons-store';
import { statusMeta } from '@/lib/status-meta';
import { OB_TEXT } from '@/lib/theme/ob-typography';
import type { KanbanFilter, KanbanFilterType, Tag } from '@/types';

/** I campi lungo cui una board si può affettare. */
type Dimension = 'type_icon' | 'status' | 'action_type' | 'tag';

const DIMENSION_LABEL: Record<Dimension, string> = {
  type_icon: 'Tipo',
  status: 'Status',
  action_type: 'Azione',
  tag: 'Tag',
};

/**
 * I sei valori dell'azione. `allday` non è un `action_type` memorizzato — è
 * `event` con `all_day` — ma il matcher dei filtri lo riconosce e lo distingue
 * da `event`, quindi come colonna è legittimo.
 */
const ACTION_VALUES: { value: string; label: string }[] = [
  { value: 'none', label: 'Note' },
  { value: 'anytime', label: 'To-do' },
  { value: 'flow', label: 'Flow' },
  { value: 'deadline', label: 'Due' },
  { value: 'allday', label: 'Daily' },
  { value: 'event', label: 'Timing' },
];

/** Una voce di un asse: colonna o corsia. Al modale servono solo questi campi. */
export interface AxisEntry {
  id: string;
  title: string;
  filters: KanbanFilter[];
}

export interface AxisModalProps {
  open: boolean;
  onClose: () => void;
  /** 'column' = colonne verticali · 'lane' = corsie orizzontali. */
  axis: 'column' | 'lane';
  /** Le voci dell'asse che si sta modificando. */
  entries: AxisEntry[];
  /**
   * Le voci dell'ALTRO asse. Non si modificano da qui: servono a sapere quali
   * valori sono già impegnati, perché il vincolo vale sulla board intera.
   */
  otherEntries: AxisEntry[];
  tags: Tag[];
  onCreate: (items: { title: string; filters: KanbanFilter[] }[]) => void;
  onDelete: (id: string) => void;
}

const AXIS_WORDS = {
  column: { title: 'Colonne', one: 'colonna', many: 'colonne', other: 'corsia' },
  lane: { title: 'Corsie', one: 'corsia', many: 'corsie', other: 'colonna' },
} as const;

export function AxisModal({ open, onClose, axis, entries, otherEntries, tags, onCreate, onDelete }: AxisModalProps) {
  const W = AXIS_WORDS[axis];
  const theme = usePixelTheme();
  const { statuses } = useStatuses();
  const icons = useTypeIcons((s) => s.icons);

  const [dimension, setDimension] = useState<Dimension>('status');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [customTitle, setCustomTitle] = useState('');
  const [customType, setCustomType] = useState<KanbanFilterType | ''>('');
  const [customValue, setCustomValue] = useState('');

  /** I valori della dimensione scelta, con l'indicazione di chi ha già una colonna. */
  const values = useMemo(() => {
    const raw: { value: string; label: string }[] =
      dimension === 'type_icon' ? icons.map((i) => ({ value: i.id, label: i.name }))
      : dimension === 'status' ? statuses.map((s) => ({ value: s.id, label: statusMeta(s.name).label }))
      : dimension === 'tag' ? tags.filter((t) => !t.is_root).map((t) => ({ value: t.id, label: t.name }))
      : ACTION_VALUES;
    // "Già usato" = esiste una voce — su QUESTO asse o sull'altro — con
    // ESATTAMENTE quel filtro. Non una che per caso lo contiene fra altri:
    // quella è una voce diversa, e le tue colonne composite restano valide.
    const used = (v: string) =>
      [...entries, ...otherEntries].find(
        (c) => c.filters.length === 1 && c.filters[0].type === dimension && c.filters[0].value === v,
      );
    return raw.map((v) => {
      const owner = used(v.value);
      return {
        ...v,
        taken: !!owner,
        // Dire DOVE è già usato evita il vicolo cieco "è barrato e non capisco
        // perché", che con due assi capiterebbe di continuo.
        takenBy: owner ? (entries.includes(owner) ? W.one : W.other) : null,
      };
    });
  }, [dimension, icons, statuses, tags, entries, otherEntries, W]);

  const selectable = values.filter((v) => !v.taken);
  const chosen = values.filter((v) => picked.has(v.value) && !v.taken);

  const switchDimension = (d: Dimension) => { setDimension(d); setPicked(new Set()); };
  const toggle = (v: string) => setPicked((p) => {
    const n = new Set(p);
    if (n.has(v)) n.delete(v); else n.add(v);
    return n;
  });

  const generate = () => {
    if (!chosen.length) return;
    onCreate(chosen.map((v) => ({ title: v.label, filters: [{ type: dimension, value: v.value }] })));
    setPicked(new Set());
  };

  const createCustom = () => {
    const title = customTitle.trim();
    if (!title) return;
    // Senza filtro la voce raccoglie tutto: è legittimo (una "Inbox"), ma
    // deve essere una scelta, non il risultato di un campo lasciato vuoto.
    const filters: KanbanFilter[] = customType && customValue ? [{ type: customType, value: customValue }] : [];
    onCreate([{ title, filters }]);
    setCustomTitle(''); setCustomType(''); setCustomValue('');
  };

  /** I valori disponibili per il filtro della colonna personalizzata. */
  const customValues = useMemo(() => {
    switch (customType) {
      case 'type_icon': return icons.map((i) => ({ value: i.id, label: i.name }));
      case 'status': return statuses.map((s) => ({ value: s.id, label: statusMeta(s.name).label }));
      case 'tag': return tags.filter((t) => !t.is_root).map((t) => ({ value: t.id, label: t.name }));
      case 'action_type': return ACTION_VALUES;
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

        {/* ── Genera da un campo ── */}
        <section>
          <span style={label}>Genera da un campo</span>
          <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
            {(Object.keys(DIMENSION_LABEL) as Dimension[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => switchDimension(d)}
                style={{
                  ...btn(),
                  ...(dimension === d ? { background: 'var(--ob-accent-soft)', color: 'var(--ob-accent)' } : {}),
                }}
              >{DIMENSION_LABEL[d]}</button>
            ))}
          </div>

          {values.length === 0 ? (
            <p style={{ fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.card, color: theme.ink3, margin: 0 }}>
              Nessun valore per questo campo.
            </p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
              {values.map((v) => (
                <button
                  key={v.value}
                  type="button"
                  disabled={v.taken}
                  onClick={() => toggle(v.value)}
                  title={v.taken ? `Già usato da una ${v.takenBy}` : undefined}
                  style={{
                    ...btn(),
                    ...(picked.has(v.value) && !v.taken ? { background: 'var(--ob-accent-soft)', color: 'var(--ob-accent)' } : {}),
                    ...(v.taken ? { opacity: 0.35, cursor: 'not-allowed', textDecoration: 'line-through' } : {}),
                  }}
                >{v.label}</button>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <button type="button" style={{ ...btn(true), opacity: chosen.length ? 1 : 0.4 }} disabled={!chosen.length} onClick={generate}>
              <IconPlus size={14} />
              {chosen.length ? `Crea ${chosen.length} ${chosen.length === 1 ? W.one : W.many}` : `Crea ${W.many}`}
            </button>
            {selectable.length > 0 && (
              <button type="button" style={btn()} onClick={() => setPicked(new Set(selectable.map((v) => v.value)))}>
                Seleziona tutti
              </button>
            )}
          </div>
        </section>

        {/* ── Colonna personalizzata ── */}
        <section>
          <span style={label}>{axis === 'column' ? 'Colonna personalizzata' : 'Corsia personalizzata'}</span>
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

        {/* ── Colonne attuali ── */}
        <section>
          <span style={label}>{W.title} attuali · {entries.length}</span>
          {entries.length === 0 ? (
            <p style={{ fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.card, color: theme.ink3, margin: 0 }}>
              {axis === 'column' ? 'La board non ha ancora colonne.' : 'La board non ha corsie: i tile stanno tutti in una fascia sola.'}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 170, overflowY: 'auto' }}>
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
      </div>
    </Modal>
  );
}
