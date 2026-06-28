'use client';

/**
 * Gimmick · Obsidian — Settings · Personalizzazione (Fase 6, completamento).
 *
 * Porta nativamente nelle Settings Obsidian i pannelli di gestione che prima
 * vivevano solo nei modali arcade (raggiungibili dalla ArcadeSettingsPage):
 *   - Colori azioni   → useActionColorsQuery (settings 'action_colors')
 *   - Statuses        → statusesApi (forma per status di sistema)
 *   - Tipi (icone)    → useTypeIcons (CRUD type icons)
 *
 * Componenti self-contained (usano store/api direttamente) — vengono montati
 * solo dentro lo shell Obsidian dalla SettingsView, quindi va bene avere gli
 * hook dati qui. Stile via classi `ob-settings__*` + primitive Obsidian.
 */
import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as TablerIcons from '@tabler/icons-react';
import { IconArrowUp, IconBolt, IconClock, IconCalendar, IconPlus, IconTrash } from '@tabler/icons-react';
import { Select, Field, IconButton, Button } from '@/components/primitives';
import { useActionColorsQuery } from '@/store/action-colors-store';
import { useTypeIcons } from '@/store/type-icons-store';
import { statusesApi } from '@/lib/api';
import { StatusPreview, SHAPE_LABELS, ALL_SHAPES } from '@/components/statuses/status-preview';
import { readableOn } from '@/lib/palette';
import type { ActionType, Status } from '@/types';

const AllIcons = TablerIcons as unknown as Record<string, React.ComponentType<{ size?: number; color?: string }>>;

// ─── Cards (riuso le classi ob-settings) ──────────────────────────────────────
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="ob-settings__card">
      <div className="ob-settings__card-title">{title}</div>
      <div className="ob-settings__card-body">{children}</div>
    </div>
  );
}

/** Swatch + native color input, allineato a destra. */
function ColorControl({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  return (
    <label
      style={{
        position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 8,
        cursor: 'pointer',
      }}
      title="Cambia colore"
    >
      <span style={{ fontFamily: 'var(--ob-font-mono)', fontSize: 11, color: 'var(--ob-subtle)', textTransform: 'uppercase' }}>{value}</span>
      <span
        aria-hidden
        style={{
          width: 26, height: 26, borderRadius: 8, background: value,
          border: '1px solid var(--ob-line-2)', flexShrink: 0,
        }}
      />
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
      />
    </label>
  );
}

// ─── Azioni (colori) ──────────────────────────────────────────────────────────
const ACTION_DEFS: { type: ActionType; label: string; Icon: typeof IconArrowUp }[] = [
  { type: 'anytime' as ActionType, label: 'To-do', Icon: IconArrowUp },
  { type: 'deadline' as ActionType, label: 'Scadenza', Icon: IconBolt },
  { type: 'allday' as ActionType, label: 'Giornata', Icon: IconCalendar },
  { type: 'event' as ActionType, label: 'A orario', Icon: IconClock },
];

function AzioniCard() {
  const { actionColors, updateActionColor } = useActionColorsQuery();
  return (
    <Card title="COLORI AZIONI">
      {ACTION_DEFS.map(({ type, label, Icon: ActIcon }) => {
        const color = actionColors[type] || '#888780';
        return (
          <div className="ob-settings__row" key={type}>
            <span
              className="ob-settings__row-icon"
              style={{ background: color, borderColor: color }}
            >
              <ActIcon size={16} color={readableOn(color)} />
            </span>
            <div className="ob-settings__row-main">
              <div className="ob-settings__row-label">{label}</div>
            </div>
            <ColorControl value={color} onChange={(hex) => { updateActionColor(type, hex); }} />
          </div>
        );
      })}
    </Card>
  );
}

// ─── Statuses (forma) ─────────────────────────────────────────────────────────
function StatusesCard() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ['statuses'], queryFn: () => statusesApi.list() });
  const statuses = (data?.data || []) as Status[];

  const update = useMutation({
    mutationFn: ({ id, shape }: { id: string; shape: string }) => statusesApi.update(id, { shape }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['statuses'] }); toast.success('Status aggiornato'); },
    onError: () => toast.error('Errore aggiornamento'),
  });

  const shapeOptions = ALL_SHAPES.map((s) => ({ value: s, label: SHAPE_LABELS[s] }));

  if (statuses.length === 0) {
    return <Card title="STATUSES"><div className="ob-settings__row-sub" style={{ padding: '4px 2px' }}>Nessuno status.</div></Card>;
  }

  return (
    <Card title="STATUSES">
      {statuses.map((s) => (
        <div className="ob-settings__row" key={s.id}>
          <span className="ob-settings__row-icon" style={{ background: 'transparent', border: 'none', padding: 0 }}>
            <StatusPreview shape={s.shape} size={30} />
          </span>
          <div className="ob-settings__row-main">
            <div className="ob-settings__row-label" style={{ textTransform: 'capitalize' }}>{s.name}</div>
            {s.name === 'done' && <div className="ob-settings__row-sub">Applicato al completamento</div>}
          </div>
          <div style={{ minWidth: 140 }}>
            <Select
              options={shapeOptions}
              value={s.shape}
              onChange={(e) => update.mutate({ id: s.id, shape: e.target.value })}
            />
          </div>
        </div>
      ))}
    </Card>
  );
}

// ─── Tipi (type icons) ────────────────────────────────────────────────────────
const ICON_CHOICES = [
  'IconPhone', 'IconMail', 'IconBriefcase', 'IconHome', 'IconShoppingCart', 'IconHeart',
  'IconStar', 'IconBookmark', 'IconBulb', 'IconCode', 'IconCar', 'IconPlane',
  'IconBuildingBank', 'IconReceipt', 'IconTool', 'IconUsers', 'IconCalendarEvent', 'IconFileText',
];
const TYPE_COLORS = ['#4F86EE', '#E0588C', '#E0544F', '#3FAE72', '#C99220', '#8C7BE0', '#5C5868'];

function TypeIconRow({ name, icon, color, onRename, onRecolor, onIcon, onDelete }: {
  name: string; icon: string; color?: string;
  onRename: (v: string) => void; onRecolor: (hex: string) => void; onIcon: (icon: string) => void; onDelete: () => void;
}) {
  const [val, setVal] = React.useState(name);
  React.useEffect(() => { setVal(name); }, [name]);
  const c = color || '#5C5868';
  const Glyph = AllIcons[icon] || AllIcons.IconHash;
  return (
    <div className="ob-settings__row">
      <span className="ob-settings__row-icon" style={{ background: c, borderColor: c }}>
        {Glyph && <Glyph size={16} color={readableOn(c)} />}
      </span>
      <div className="ob-settings__row-main" style={{ minWidth: 0 }}>
        <Field
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={() => { const t = val.trim(); if (t && t !== name) onRename(t); }}
          aria-label={`Nome tipo ${name}`}
        />
      </div>
      <div style={{ width: 130 }}>
        <Select
          options={ICON_CHOICES.map((i) => ({ value: i, label: i.replace(/^Icon/, '') }))}
          value={icon}
          onChange={(e) => onIcon(e.target.value)}
        />
      </div>
      <ColorControl value={c} onChange={onRecolor} />
      <IconButton aria-label={`Elimina ${name}`} onClick={onDelete}><IconTrash size={15} /></IconButton>
    </div>
  );
}

function TipiCard() {
  const { icons, loaded, fetchAll, addIcon, updateIcon, removeIcon } = useTypeIcons();
  const [newName, setNewName] = React.useState('');
  const [newIcon, setNewIcon] = React.useState(ICON_CHOICES[0]);
  const [newColor, setNewColor] = React.useState(TYPE_COLORS[0]);

  React.useEffect(() => { if (!loaded) fetchAll(); }, [loaded, fetchAll]);

  const add = () => {
    const n = newName.trim();
    if (!n) { toast.error('Inserisci un nome'); return; }
    addIcon({ name: n, icon: newIcon, color: newColor });
    setNewName('');
    toast.success('Tipo aggiunto');
  };

  return (
    <Card title="TIPI">
      {icons.length === 0 && (
        <div className="ob-settings__row-sub" style={{ padding: '4px 2px' }}>Nessun tipo. Creane uno qui sotto.</div>
      )}
      {icons.map((i) => (
        <TypeIconRow
          key={i.id}
          name={i.name}
          icon={i.icon}
          color={i.color}
          onRename={(v) => updateIcon(i.id, { name: v })}
          onRecolor={(hex) => updateIcon(i.id, { color: hex })}
          onIcon={(icon) => updateIcon(i.id, { icon })}
          onDelete={() => removeIcon(i.id)}
        />
      ))}

      {/* Add new */}
      <div className="ob-settings__row" style={{ alignItems: 'flex-end', gap: 8 }}>
        <div className="ob-settings__row-main" style={{ minWidth: 0 }}>
          <Field value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nuovo tipo…" aria-label="Nuovo tipo" />
        </div>
        <div style={{ width: 130 }}>
          <Select options={ICON_CHOICES.map((i) => ({ value: i, label: i.replace(/^Icon/, '') }))} value={newIcon} onChange={(e) => setNewIcon(e.target.value)} />
        </div>
        <ColorControl value={newColor} onChange={setNewColor} />
        <Button variant="primary" onClick={add}><IconPlus size={15} /> Aggiungi</Button>
      </div>
    </Card>
  );
}

// ─── Pannello ─────────────────────────────────────────────────────────────────
export function PersonalizzazionePanel() {
  return (
    <>
      <h1 className="ob-settings__h1">Personalizzazione</h1>
      <p className="ob-settings__lead">Colori delle azioni, forme degli status e tipi (icone) dei tile.</p>
      <AzioniCard />
      <StatusesCard />
      <TipiCard />
    </>
  );
}
