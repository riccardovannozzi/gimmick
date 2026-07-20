'use client';

/**
 * Gimmick · Obsidian — Roster dei Beniamini (Settings · Personalizzazione).
 *
 * Versione nativa Obsidian del vecchio `card-roster-modal` (arcade, sprite
 * pixel). Usa gli sprite SVG <Beniamino> + i metadati di `./roster` + lo store
 * `useCardRoster` (persistenza id-based, condivisa con l'arcade in transizione).
 *
 * Struttura:
 *   - Preferenze globali: Frequenza (SegmentedControl), Animazioni / Dialog
 *     (Toggle), Attiva/Disattiva tutti, contatore.
 *   - Griglia dei 10 beniamini (card cliccabile + toggle attivazione).
 *   - Modal di dettaglio: sprite grande, descrizione, contesto, dialog
 *     d'esempio, impostazioni specifiche di Kron / Flocky (notifiche + suono).
 *
 * Tutto lo styling legge i token `--ob-*` così segue il `data-theme`.
 */
import * as React from 'react';
import {
  IconPlayerPlay, IconPlayerStop, IconRefresh, IconUpload, IconCheck,
} from '@tabler/icons-react';
import { Beniamino } from './beniamino';
import { BENIAMINO_NAMES, BENIAMINO_META, type BeniaminoName } from './sprites';
import { BENIAMINO_ROSTER } from './roster';
import { Modal } from '@/components/primitives/overlays';
import { Button, IconButton, Toggle, SegmentedControl, Field } from '@/components/primitives';
import {
  useCardRoster, DEFAULT_SOUND_BASE, SUPPORTED_AUDIO_EXTS,
  type MascotFrequency, type MascotSoundConfig,
} from '@/store/card-roster-store';

const FREQUENCY_OPTIONS: { value: MascotFrequency; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'rare', label: 'Raro' },
  { value: 'normal', label: 'Normale' },
  { value: 'often', label: 'Spesso' },
];

// ─── Pannello ─────────────────────────────────────────────────────────────────
export function MascotRosterPanel() {
  const [editing, setEditing] = React.useState<BeniaminoName | null>(null);

  return (
    <>
      <h1 className="ob-settings__h1">Beniamini</h1>
      <p className="ob-settings__lead">I 10 beniamini di Gimmick e le aree dell’app in cui possono affiorare.</p>

      <GlobalPrefs />

      <div className="ob-settings__card">
        <div className="ob-settings__card-title">ROSTER</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {BENIAMINO_NAMES.map((name) => (
            <MascotCard key={name} name={name} onOpen={() => setEditing(name)} />
          ))}
        </div>
      </div>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        maxWidth={560}
        title={editing ? `${BENIAMINO_META[editing].label} · ${BENIAMINO_META[editing].role}` : ''}
      >
        {editing && <MascotDetail name={editing} />}
      </Modal>
    </>
  );
}

// ─── Preferenze globali ─────────────────────────────────────────────────────────
function GlobalPrefs() {
  const { settings, setFrequency, setAnimations, setDialog, enableAll, disableAll } = useCardRoster();
  return (
    <div className="ob-settings__card">
      <div className="ob-settings__card-title">PREFERENZE</div>
      <div className="ob-settings__card-body">
        <div className="ob-settings__row">
          <div className="ob-settings__row-main">
            <div className="ob-settings__row-label">Frequenza apparizioni</div>
            <div className="ob-settings__row-sub">Quanto spesso i beniamini compaiono</div>
          </div>
          <SegmentedControl
            value={settings.frequency}
            onChange={(v) => setFrequency(v as MascotFrequency)}
            items={FREQUENCY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          />
        </div>
        <div className="ob-settings__row">
          <div className="ob-settings__row-main">
            <div className="ob-settings__row-label">Animazioni</div>
            <div className="ob-settings__row-sub">Sprite animati quando affiorano</div>
          </div>
          <Toggle checked={settings.animations} onChange={setAnimations} aria-label="Animazioni" />
        </div>
        <div className="ob-settings__row">
          <div className="ob-settings__row-main">
            <div className="ob-settings__row-label">Dialog box</div>
            <div className="ob-settings__row-sub">Frasi e suggerimenti dei beniamini</div>
          </div>
          <Toggle checked={settings.dialog} onChange={setDialog} aria-label="Dialog box" />
        </div>
        <div className="ob-settings__row">
          <div className="ob-settings__row-main">
            <div className="ob-settings__row-label">Attivazione</div>
            <div className="ob-settings__row-sub">{settings.enabled.length}/{BENIAMINO_NAMES.length} attivi</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" size="sm" onClick={enableAll}>Attiva tutti</Button>
            <Button variant="ghost" size="sm" onClick={disableAll}>Disattiva tutti</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Card singola ───────────────────────────────────────────────────────────────
function MascotCard({ name, onOpen }: { name: BeniaminoName; onOpen: () => void }) {
  const { isEnabled, toggleMascot, settings } = useCardRoster();
  const enabled = isEnabled(name);
  const meta = BENIAMINO_META[name];
  const entry = BENIAMINO_ROSTER[name];

  return (
    <div
      onClick={onOpen}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        background: 'var(--ob-surface)',
        border: '1px solid var(--ob-line)',
        borderRadius: 14,
        cursor: 'pointer',
        opacity: enabled ? 1 : 0.55,
        transition: 'border-color 140ms ease-out, opacity 140ms ease-out',
      }}
      className={settings.animations && enabled ? 'ob-beniamino-anim' : undefined}
    >
      <div
        style={{
          width: 56, height: 56, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--ob-surface-2)',
          borderRadius: 12,
        }}
      >
        <Beniamino name={name} size={42} title="" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--ob-font-sans)', fontSize: 14, fontWeight: 600, color: 'var(--ob-text)' }}>
          {meta.label}
        </div>
        <div style={{ fontFamily: 'var(--ob-font-mono)', fontSize: 9.5, letterSpacing: '0.08em', color: 'var(--ob-accent)', marginTop: 2 }}>
          {meta.role}
        </div>
        <div
          style={{
            fontFamily: 'var(--ob-font-sans)', fontSize: 12, color: 'var(--ob-subtle)', marginTop: 4,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          {entry.where}
        </div>
      </div>
      <IconButton
        aria-label={enabled ? `Disattiva ${meta.label}` : `Attiva ${meta.label}`}
        active={enabled}
        onClick={(e) => { e.stopPropagation(); toggleMascot(name); }}
      >
        {enabled ? <IconCheck size={16} /> : <span style={{ width: 16, height: 16 }} />}
      </IconButton>
    </div>
  );
}

// ─── Dettaglio ──────────────────────────────────────────────────────────────────
function MascotDetail({ name }: { name: BeniaminoName }) {
  const { isEnabled, toggleMascot, settings } = useCardRoster();
  const enabled = isEnabled(name);
  const meta = BENIAMINO_META[name];
  const entry = BENIAMINO_ROSTER[name];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div
          style={{
            width: 132, height: 132, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--ob-surface-2)',
            border: '1px solid var(--ob-line)',
            borderRadius: 16,
          }}
          className={settings.animations && enabled ? 'ob-beniamino-anim' : undefined}
        >
          <Beniamino name={name} size={96} title={meta.label} />
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <DetailField label="Descrizione">
            <span style={{ fontFamily: 'var(--ob-font-sans)', fontSize: 13, lineHeight: 1.45, color: 'var(--ob-text)' }}>
              {entry.description}
            </span>
          </DetailField>
          <DetailField label="Apparizione">
            <span style={{ fontFamily: 'var(--ob-font-sans)', fontSize: 13, color: 'var(--ob-text)' }}>
              {entry.where}
            </span>
          </DetailField>
        </div>
      </div>

      {settings.dialog && (
        <DetailField label="Dialog">
          <div
            style={{
              padding: '11px 13px',
              background: 'var(--ob-accent-soft)',
              border: '1px solid color-mix(in srgb, var(--ob-accent) 20%, transparent)',
              borderRadius: 12,
              fontFamily: 'var(--ob-font-sans)', fontSize: 13, fontStyle: 'italic',
              color: 'var(--ob-accent-text)',
            }}
          >
            {entry.msg}
          </div>
        </DetailField>
      )}

      {name === 'kron' && <KronSettings />}
      {name === 'flocky' && <FlockySettings />}

      <div>
        <Button variant={enabled ? 'secondary' : 'primary'} onClick={() => toggleMascot(name)}>
          {enabled ? 'Disattiva beniamino' : 'Attiva beniamino'}
        </Button>
      </div>
    </div>
  );
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--ob-font-mono)', fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ob-subtle)', marginBottom: 5 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

// ─── Sezioni impostazioni per-mascot ─────────────────────────────────────────────
function SettingsSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: 14,
        background: 'var(--ob-surface-2)',
        border: '1px solid var(--ob-line)',
        borderRadius: 14,
        display: 'flex', flexDirection: 'column', gap: 12,
      }}
    >
      <div style={{ fontFamily: 'var(--ob-font-sans)', fontSize: 13, fontWeight: 600, color: 'var(--ob-text)' }}>{label}</div>
      {children}
    </div>
  );
}

const subText: React.CSSProperties = { fontFamily: 'var(--ob-font-sans)', fontSize: 12, color: 'var(--ob-subtle)', margin: 0 };
const inlineLabel: React.CSSProperties = { fontFamily: 'var(--ob-font-sans)', fontSize: 13, color: 'var(--ob-text)', display: 'inline-flex', alignItems: 'center', gap: 8 };

function KronSettings() {
  const { getKron, updateKron } = useCardRoster();
  const kron = getKron();

  const updateAt = (idx: number, patch: Partial<typeof kron.notifications[number]>) => {
    const next = kron.notifications.map((n, i) => (i === idx ? { ...n, ...patch } : n));
    updateKron({ notifications: next });
  };

  return (
    <>
      <SettingsSection label="Notifiche timed">
        <p style={subText}>Avvisa quando manca poco a un appuntamento timed. Due notifiche separate.</p>
        {kron.notifications.slice(0, 2).map((n, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Toggle checked={n.enabled} onChange={(v) => updateAt(i, { enabled: v })} aria-label={`Notifica ${i + 1}`} />
            <span style={inlineLabel}>Notifica {i + 1}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: n.enabled ? 1 : 0.5, marginLeft: 'auto' }}>
              <Field
                type="number"
                min={1}
                max={1440}
                step={1}
                value={n.minutesBefore}
                disabled={!n.enabled}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (Number.isFinite(v) && v > 0) updateAt(i, { minutesBefore: v });
                }}
                wrapperClassName="ob-roster-numfield"
              />
              <span style={{ ...subText, whiteSpace: 'nowrap' }}>minuti prima ({formatMinutesHint(n.minutesBefore)})</span>
            </div>
          </div>
        ))}
      </SettingsSection>
      <SoundSection mascotId="kron" sound={kron.sound} onChange={(patch) => updateKron({ sound: { ...kron.sound, ...patch } })} />
    </>
  );
}

function formatMinutesHint(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function FlockySettings() {
  const { getFlocky, updateFlocky } = useCardRoster();
  const flocky = getFlocky();

  const [timesDraft, setTimesDraft] = React.useState(flocky.morning.times.join(', '));
  React.useEffect(() => { setTimesDraft(flocky.morning.times.join(', ')); }, [flocky.morning.times]);

  const commitTimes = () => {
    const parsed = timesDraft
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .map(normalizeTimeString)
      .filter((t): t is string => t !== null);
    updateFlocky({ morning: { ...flocky.morning, times: parsed } });
  };

  return (
    <>
      <SettingsSection label="Riepilogo mattutino">
        <p style={subText}>Annuncia tutti gli appuntamenti della giornata.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <ModeRadio
            checked={flocky.morning.mode === 'first-open'}
            label="Alla prima apertura dell'app"
            onChange={() => updateFlocky({ morning: { ...flocky.morning, mode: 'first-open' } })}
          />
          <ModeRadio
            checked={flocky.morning.mode === 'scheduled'}
            label="A orari specifici"
            onChange={() => updateFlocky({ morning: { ...flocky.morning, mode: 'scheduled' } })}
          />
        </div>
        <div style={{ opacity: flocky.morning.mode === 'scheduled' ? 1 : 0.5 }}>
          <div style={{ ...subText, marginBottom: 5 }}>Orari (HH:MM separati da virgola)</div>
          <Field
            type="text"
            value={timesDraft}
            disabled={flocky.morning.mode !== 'scheduled'}
            onChange={(e) => setTimesDraft(e.target.value)}
            onBlur={commitTimes}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            placeholder="es. 08:30, 13:00, 19:00"
          />
          <p style={{ ...subText, marginTop: 5 }}>Formato 24h. Entrate non valide vengono ignorate.</p>
        </div>
      </SettingsSection>

      <SettingsSection label="Recap fine giornata">
        <p style={subText}>Avviso a fine giornata su appuntamenti completati e non.</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Toggle checked={flocky.recap.enabled} onChange={(v) => updateFlocky({ recap: { ...flocky.recap, enabled: v } })} aria-label="Recap abilitato" />
          <span style={inlineLabel}>Abilitato</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: flocky.recap.enabled ? 1 : 0.5, marginLeft: 'auto' }}>
            <Field
              type="time"
              value={flocky.recap.time}
              disabled={!flocky.recap.enabled}
              onChange={(e) => updateFlocky({ recap: { ...flocky.recap, time: e.target.value } })}
              wrapperClassName="ob-roster-timefield"
            />
          </div>
        </div>
      </SettingsSection>

      <SoundSection mascotId="flocky" sound={flocky.sound} onChange={(patch) => updateFlocky({ sound: { ...flocky.sound, ...patch } })} />
    </>
  );
}

function ModeRadio({ checked, label, onChange }: { checked: boolean; label: string; onChange: () => void }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 9, cursor: 'pointer', fontFamily: 'var(--ob-font-sans)', fontSize: 13, color: 'var(--ob-text)' }}>
      <span
        style={{
          width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
          background: 'var(--ob-surface)',
          border: `1.5px solid ${checked ? 'var(--ob-accent)' : 'var(--ob-line-2)'}`,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {checked && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ob-accent)' }} />}
      </span>
      <input type="radio" checked={checked} onChange={onChange} style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} />
      <span onClick={onChange}>{label}</span>
    </label>
  );
}

// ─── Sezione suono ──────────────────────────────────────────────────────────────
const defaultSrcCache: Record<string, string | null | undefined> = {};

async function resolveDefaultSrc(mascotId: string): Promise<string | null> {
  if (mascotId in defaultSrcCache) return defaultSrcCache[mascotId] ?? null;
  const base = DEFAULT_SOUND_BASE[mascotId];
  if (!base) { defaultSrcCache[mascotId] = null; return null; }
  for (const ext of SUPPORTED_AUDIO_EXTS) {
    const url = `${base}.${ext}`;
    try {
      const r = await fetch(url, { method: 'HEAD' });
      if (r.ok) { defaultSrcCache[mascotId] = url; return url; }
    } catch { /* probe next ext */ }
  }
  defaultSrcCache[mascotId] = null;
  return null;
}

function SoundSection({
  mascotId, sound, onChange,
}: {
  mascotId: 'kron' | 'flocky';
  sound: MascotSoundConfig;
  onChange: (patch: Partial<MascotSoundConfig>) => void;
}) {
  const [playing, setPlaying] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const isCustom = sound.src !== null && sound.src.startsWith('data:');
  const base = DEFAULT_SOUND_BASE[mascotId];

  React.useEffect(() => () => { if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; } }, []);

  const togglePreview = async () => {
    if (playing) { audioRef.current?.pause(); audioRef.current = null; setPlaying(false); return; }
    setUploadError(null);
    let src: string | null = sound.src;
    if (!src) {
      src = await resolveDefaultSrc(mascotId);
      if (!src) { setUploadError(`File di default mancante: aggiungi public${base}.{mp3|wav|ogg|m4a} oppure carica un file custom`); return; }
    }
    const a = new Audio(src);
    a.addEventListener('ended', () => setPlaying(false));
    a.addEventListener('error', () => {
      setPlaying(false);
      const code = a.error?.code;
      if (code === 3) setUploadError('Errore di decoding (formato non supportato dal browser)');
      else if (code === 2 || code === 4) setUploadError('File audio non trovato o formato non supportato');
      else setUploadError('Errore nel caricamento del file audio');
    });
    audioRef.current = a;
    a.play().then(() => setPlaying(true)).catch((err: DOMException) => {
      setPlaying(false);
      if (err.name === 'NotAllowedError') setUploadError('Riproduzione bloccata dal browser (autoplay policy)');
    });
  };

  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setUploadError('File troppo grande (max 2 MB)'); e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = () => { const d = reader.result; if (typeof d === 'string') onChange({ src: d }); };
    reader.onerror = () => setUploadError('Errore lettura file');
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <SettingsSection label="Suono notifica">
      <p style={subText}>Jingle riprodotto quando la notifica scatta.</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Toggle checked={sound.enabled} onChange={(v) => onChange({ enabled: v })} aria-label="Suono attivo" />
        <span style={inlineLabel}>Suono attivo</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', opacity: sound.enabled ? 1 : 0.5 }}>
        <Button
          variant={playing ? 'primary' : 'secondary'}
          size="sm"
          disabled={!sound.enabled}
          onClick={togglePreview}
          icon={playing ? <IconPlayerStop size={14} /> : <IconPlayerPlay size={14} />}
        >
          {playing ? 'Stop' : 'Ascolta'}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={!sound.enabled}
          onClick={() => fileInputRef.current?.click()}
          icon={<IconUpload size={14} />}
        >
          {isCustom ? 'Cambia file' : 'Carica file'}
        </Button>
        {isCustom && (
          <Button
            variant="ghost"
            size="sm"
            disabled={!sound.enabled}
            onClick={() => { onChange({ src: null }); setUploadError(null); }}
            icon={<IconRefresh size={14} />}
          >
            Default
          </Button>
        )}
        <span style={{ ...subText, marginLeft: 4 }}>{isCustom ? 'file personalizzato attivo' : 'file di default'}</span>
        <input ref={fileInputRef} type="file" accept="audio/*" onChange={handlePick} style={{ display: 'none' }} />
      </div>
      {uploadError && <p style={{ ...subText, color: 'var(--ob-danger, #E24B4A)' }}>{uploadError}</p>}
    </SettingsSection>
  );
}

function normalizeTimeString(s: string): string | null {
  const cleaned = s.replace(/\./g, ':').trim();
  const m = cleaned.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}
