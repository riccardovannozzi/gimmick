'use client';

import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { usePixelTheme } from '@/components/pixel';
import { useCardRoster, DEFAULT_SOUND_BASE, SUPPORTED_AUDIO_EXTS, type MascotFrequency, type MascotSoundConfig } from '@/store/card-roster-store';
import { MASCOTS, resolveToken, type Mascot } from '@/lib/mascots';
import { MascotSprite } from './mascot-sprite';
import { IconChevronLeft, IconCheck, IconPlayerPlay, IconPlayerStop, IconRefresh, IconUpload } from '@tabler/icons-react';

interface CardRosterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FREQUENCY_OPTIONS: { value: MascotFrequency; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'rare', label: 'Rare' },
  { value: 'normal', label: 'Normal' },
  { value: 'often', label: 'Often' },
];

/**
 * CARD ROSTER · MASCOT settings — see /MASCOT.md.
 * Layout:
 *   Header: title + back-arrow when an individual mascot is open
 *   Body (list view):  global preferences (Frequency / Animations / Dialog)
 *                      + 5×2 grid of MascotPreviewCard
 *   Body (detail view): full sprite + stats + sample dialog + enable toggle
 */
export function CardRosterModal({ open, onOpenChange }: CardRosterModalProps) {
  const theme = usePixelTheme();
  const [editingId, setEditingId] = useState<string | null>(null);

  const editing = editingId ? MASCOTS.find((m) => m.id === editingId) ?? null : null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setEditingId(null); onOpenChange(o); }}>
      <DialogContent
        showCloseButton={false}
        className="!gap-0 !p-0 !rounded-none"
        style={{
          maxWidth: 'min(92vw, 760px)',
          width: 'min(92vw, 760px)',
          background: theme.surface,
          border: `2px solid ${theme.border}`,
          borderRadius: 0,
          color: theme.ink,
          boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
          padding: 0,
          gap: 0,
          display: 'block',
        }}
      >
        <DialogTitle className="sr-only">Card Roster · Mascot</DialogTitle>
        <DialogDescription className="sr-only">
          Gestisci i 10 personaggi pixel-art di Gimmick: attivazione, frequenza, animazioni e dialog.
        </DialogDescription>

        <div style={{ padding: '10px 14px', background: theme.surfaceVariant, borderBottom: `2px solid ${theme.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {editing && (
              <button
                type="button"
                onClick={() => setEditingId(null)}
                aria-label="Indietro"
                style={{
                  width: 22, height: 22,
                  background: theme.surface,
                  border: `2px solid ${theme.border}`,
                  color: theme.ink2,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <IconChevronLeft size={12} />
              </button>
            )}
            <h2
              style={{
                flex: 1,
                fontFamily: 'var(--font-pixel-head)',
                fontSize: 11,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: theme.ink,
                margin: 0,
              }}
            >
              {editing ? `${editing.name} · ${editing.role}` : 'Card Roster · Mascot'}
            </h2>
          </div>
          <p style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 11, color: theme.ink3, margin: '4px 0 0' }}>
            {editing ? editing.description : 'I 10 beniamini pixel-art di Gimmick e le loro preferenze.'}
          </p>
        </div>

        <div style={{ padding: 14, maxHeight: '70vh', overflowY: 'auto' }}>
          {editing ? <MascotDetail mascot={editing} /> : <RosterList onPick={setEditingId} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RosterList({ onPick }: { onPick: (id: string) => void }) {
  const theme = usePixelTheme();
  const { settings, setFrequency, setAnimations, setDialog, enableAll, disableAll } = useCardRoster();

  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-pixel-head)',
    fontSize: 9,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: theme.ink3,
    display: 'block',
    marginBottom: 6,
  };

  const segBtn = (active: boolean): React.CSSProperties => ({
    padding: '6px 10px',
    background: active ? theme.accent : theme.surfaceVariant,
    color: active ? theme.onAccent : theme.ink2,
    border: `2px solid ${theme.border}`,
    fontFamily: 'var(--font-pixel-head)',
    fontSize: 9,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    flex: 1,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Global preferences */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <label style={labelStyle}>Frequenza apparizioni</label>
          <div style={{ display: 'flex', gap: 4 }}>
            {FREQUENCY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFrequency(opt.value)}
                style={segBtn(settings.frequency === opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <ToggleRow label="Animazioni" value={settings.animations} onChange={setAnimations} />
          <ToggleRow label="Dialog box" value={settings.dialog} onChange={setDialog} />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            onClick={enableAll}
            style={{
              padding: '4px 10px',
              background: theme.surfaceVariant,
              color: theme.ink2,
              border: `2px solid ${theme.border}`,
              fontFamily: 'var(--font-pixel-head)',
              fontSize: 9,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Attiva tutti
          </button>
          <button
            type="button"
            onClick={disableAll}
            style={{
              padding: '4px 10px',
              background: theme.surfaceVariant,
              color: theme.ink2,
              border: `2px solid ${theme.border}`,
              fontFamily: 'var(--font-pixel-head)',
              fontSize: 9,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Disattiva tutti
          </button>
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-pixel-body)', fontSize: 11, color: theme.ink3, alignSelf: 'center' }}>
            {settings.enabled.length}/{MASCOTS.length} attivi
          </span>
        </div>
      </div>

      <div style={{ borderTop: `2px solid ${theme.border}` }} />

      {/* Mascot grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        {MASCOTS.map((m) => (
          <MascotPreviewCard
            key={m.id}
            mascot={m}
            onClick={() => onPick(m.id)}
          />
        ))}
      </div>
    </div>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const theme = usePixelTheme();
  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        background: theme.surfaceVariant,
        border: `2px solid ${theme.border}`,
        fontFamily: 'var(--font-pixel-head)',
        fontSize: 9,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: theme.ink2,
        cursor: 'pointer',
      }}
    >
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        style={{ accentColor: theme.accent }}
      />
      {label}
    </label>
  );
}

function MascotPreviewCard({ mascot, onClick }: { mascot: Mascot; onClick: () => void }) {
  const theme = usePixelTheme();
  const { isEnabled, toggleMascot, settings } = useCardRoster();
  const enabled = isEnabled(mascot.id);

  return (
    <div
      style={{
        position: 'relative',
        background: theme.surfaceVariant,
        border: `2px solid ${enabled ? theme.border : theme.border}`,
        opacity: enabled ? 1 : 0.5,
        padding: 10,
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        cursor: 'pointer',
      }}
      onClick={onClick}
    >
      <div
        style={{
          width: 64, height: 64,
          background: theme.surface,
          border: `2px solid ${theme.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <MascotSprite mascot={mascot} cell={3} animated={settings.animations && enabled} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: 'var(--font-pixel-head)',
            fontSize: 10,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: theme.ink,
          }}
        >
          {mascot.name}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-pixel-head)',
            fontSize: 8,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: theme.accent,
            marginTop: 2,
          }}
        >
          {mascot.role}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-pixel-body)',
            fontSize: 10,
            color: theme.ink3,
            marginTop: 4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {mascot.context.where.toLowerCase()}
        </div>
      </div>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); toggleMascot(mascot.id); }}
        aria-label={enabled ? 'Disattiva' : 'Attiva'}
        title={enabled ? 'Disattiva' : 'Attiva'}
        style={{
          width: 22, height: 22,
          background: enabled ? theme.accent : theme.surface,
          color: enabled ? theme.onAccent : theme.ink3,
          border: `2px solid ${theme.border}`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        {enabled && <IconCheck size={12} />}
      </button>
    </div>
  );
}

function MascotDetail({ mascot }: { mascot: Mascot }) {
  const theme = usePixelTheme();
  const { isEnabled, toggleMascot, settings } = useCardRoster();
  const enabled = isEnabled(mascot.id);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* Big sprite */}
        <div
          style={{
            width: 192, height: 192,
            background: theme.surface,
            border: `2px solid ${theme.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <MascotSprite mascot={mascot} cell={10} animated={settings.animations && enabled} />
        </div>

        {/* Right column */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
          <Field label="Apparizione">
            <span style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 12, color: theme.ink }}>
              {mascot.context.where}
            </span>
          </Field>
          <Field label="Animazione">
            <span style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 12, color: theme.ink, textTransform: 'capitalize' }}>
              {mascot.animation}
            </span>
          </Field>
          <Field label="Stats">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {mascot.stats.map((s) => {
                const c = resolveToken(s.colorToken, theme);
                return (
                  <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        width: 64,
                        fontFamily: 'var(--font-pixel-head)',
                        fontSize: 9,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: theme.ink2,
                      }}
                    >
                      {s.label}
                    </span>
                    <div style={{ flex: 1, height: 8, background: theme.surface, border: `2px solid ${theme.border}`, position: 'relative' }}>
                      <div style={{ width: `${s.val * 10}%`, height: '100%', background: c }} />
                    </div>
                    <span
                      style={{
                        width: 18,
                        textAlign: 'right',
                        fontFamily: 'var(--font-pixel-head)',
                        fontSize: 9,
                        color: theme.ink,
                      }}
                    >
                      {s.val}
                    </span>
                  </div>
                );
              })}
            </div>
          </Field>
        </div>
      </div>

      {/* Sample dialog */}
      {settings.dialog && (
        <div>
          <label
            style={{
              fontFamily: 'var(--font-pixel-head)',
              fontSize: 9,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: theme.ink3,
              display: 'block',
              marginBottom: 4,
            }}
          >
            Dialog
          </label>
          <div
            style={{
              padding: '10px 12px',
              background: theme.surfaceVariant,
              border: `2px solid ${theme.border}`,
              borderLeft: `4px solid ${theme.accent}`,
              fontFamily: 'var(--font-pixel-body)',
              fontSize: 12,
              color: theme.ink,
              fontStyle: 'italic',
            }}
          >
            {mascot.context.msg}
          </div>
        </div>
      )}

      {/* Mascot-specific settings — switches on id. */}
      {mascot.id === 'kron' && <KronSettings />}
      {mascot.id === 'flocky' && <FlockySettings />}

      <div>
        <button
          type="button"
          onClick={() => toggleMascot(mascot.id)}
          className="px-press"
          style={{
            padding: '8px 14px',
            background: enabled ? theme.surfaceVariant : theme.accent,
            color: enabled ? theme.ink2 : theme.onAccent,
            border: `2px solid ${theme.border}`,
            fontFamily: 'var(--font-pixel-head)',
            fontSize: 10,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            boxShadow: enabled ? 'none' : `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
          }}
        >
          {enabled ? 'Disattiva mascot' : 'Attiva mascot'}
        </button>
      </div>
    </div>
  );
}

// ─── Per-mascot settings panels ──────────────────────────────────────────

function SettingsSection({ label, children }: { label: string; children: React.ReactNode }) {
  const theme = usePixelTheme();
  return (
    <div
      style={{
        padding: 12,
        background: theme.surfaceVariant,
        border: `2px solid ${theme.border}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-pixel-head)',
          fontSize: 10,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: theme.ink,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function pixelInputStyle(theme: ReturnType<typeof usePixelTheme>): React.CSSProperties {
  return {
    background: theme.surface,
    border: `2px solid ${theme.border}`,
    padding: '4px 8px',
    color: theme.ink,
    fontFamily: 'var(--font-pixel-body)',
    fontSize: 12,
    outline: 'none',
  };
}

function pixelLabelStyle(theme: ReturnType<typeof usePixelTheme>): React.CSSProperties {
  return {
    fontFamily: 'var(--font-pixel-head)',
    fontSize: 9,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: theme.ink3,
  };
}

function KronSettings() {
  const theme = usePixelTheme();
  const { getKron, updateKron } = useCardRoster();
  const kron = getKron();

  const updateAt = (idx: number, patch: Partial<typeof kron.notifications[number]>) => {
    const next = kron.notifications.map((n, i) => (i === idx ? { ...n, ...patch } : n));
    updateKron({ notifications: next });
  };

  return (
    <>
    <SettingsSection label="Notifiche timed">
      <p style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 11, color: theme.ink3, margin: 0 }}>
        Avvisa quando manca poco a un appuntamento timed. Configura due notifiche separate.
      </p>
      {kron.notifications.slice(0, 2).map((n, i) => (
        <div
          key={i}
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr auto',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              ...pixelLabelStyle(theme),
              color: theme.ink,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={n.enabled}
              onChange={(e) => updateAt(i, { enabled: e.target.checked })}
              style={{ accentColor: theme.accent }}
            />
            Notifica {i + 1}
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: n.enabled ? 1 : 0.5 }}>
            <input
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
              style={{ ...pixelInputStyle(theme), width: 80 }}
            />
            <span style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 12, color: theme.ink2 }}>
              minuti prima
            </span>
          </div>
          <span style={{ ...pixelLabelStyle(theme), color: theme.ink3 }}>
            {formatMinutesHint(n.minutesBefore)}
          </span>
        </div>
      ))}
    </SettingsSection>
    <SoundSection
      mascotId="kron"
      sound={kron.sound}
      onChange={(patch) => updateKron({ sound: { ...kron.sound, ...patch } })}
    />
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
  const theme = usePixelTheme();
  const { getFlocky, updateFlocky } = useCardRoster();
  const flocky = getFlocky();

  // The times list is kept in state as the raw text the user typed so they
  // can intermediate-state-edit (e.g. trailing comma). We only validate &
  // normalize on blur — invalid entries silently dropped.
  const [timesDraft, setTimesDraft] = useState(flocky.morning.times.join(', '));
  // Keep draft in sync when the underlying value changes from elsewhere.
  useEffect(() => { setTimesDraft(flocky.morning.times.join(', ')); }, [flocky.morning.times]);

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
        <p style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 11, color: theme.ink3, margin: 0 }}>
          Annuncia tutti gli appuntamenti della giornata.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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
          <label style={{ ...pixelLabelStyle(theme), display: 'block', marginBottom: 4 }}>
            Orari (HH:MM separati da virgola)
          </label>
          <input
            type="text"
            value={timesDraft}
            disabled={flocky.morning.mode !== 'scheduled'}
            onChange={(e) => setTimesDraft(e.target.value)}
            onBlur={commitTimes}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            placeholder="es. 08:30, 13:00, 19:00"
            style={{ ...pixelInputStyle(theme), width: '100%' }}
          />
          <p style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 10, color: theme.ink3, margin: '4px 0 0' }}>
            Punto o due punti, formato 24h. Entrate non valide vengono ignorate.
          </p>
        </div>
      </SettingsSection>

      <SettingsSection label="Recap fine giornata">
        <p style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 11, color: theme.ink3, margin: 0 }}>
          Avviso a fine giornata su appuntamenti completati e non.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              ...pixelLabelStyle(theme),
              color: theme.ink,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={flocky.recap.enabled}
              onChange={(e) => updateFlocky({ recap: { ...flocky.recap, enabled: e.target.checked } })}
              style={{ accentColor: theme.accent }}
            />
            Abilitato
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: flocky.recap.enabled ? 1 : 0.5 }}>
            <input
              type="time"
              value={flocky.recap.time}
              disabled={!flocky.recap.enabled}
              onChange={(e) => updateFlocky({ recap: { ...flocky.recap, time: e.target.value } })}
              style={{ ...pixelInputStyle(theme), width: 100, colorScheme: 'dark' }}
            />
            <span style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 12, color: theme.ink2 }}>orario</span>
          </div>
        </div>
      </SettingsSection>

      <SoundSection
        mascotId="flocky"
        sound={flocky.sound}
        onChange={(patch) => updateFlocky({ sound: { ...flocky.sound, ...patch } })}
      />
    </>
  );
}

function ModeRadio({ checked, label, onChange }: { checked: boolean; label: string; onChange: () => void }) {
  const theme = usePixelTheme();
  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        cursor: 'pointer',
        fontFamily: 'var(--font-pixel-body)',
        fontSize: 12,
        color: theme.ink,
      }}
    >
      <span
        style={{
          width: 14, height: 14,
          background: theme.surface,
          border: `2px solid ${theme.border}`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {checked && (
          <span style={{ width: 6, height: 6, background: theme.accent }} />
        )}
      </span>
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
      />
      <span onClick={onChange}>{label}</span>
    </label>
  );
}

/**
 * SoundSection — toggle on/off, picker per file custom, preview e reset.
 * Riusato da Kron, Flocky e (in futuro) qualunque mascot con audio.
 *
 * Persistenza file custom: il File caricato dall'utente diventa una data URL
 * salvata nel config del mascot. Vincolo localStorage ~5 MB → tagliamo a 2 MB
 * per non riempire lo storage con un singolo file.
 */
// Module-level cache of resolved default sound URLs, keyed by mascotId.
// Avoids re-probing on every preview click.
const defaultSrcCache: Record<string, string | null | undefined> = {};

/** Probe mp3/wav/ogg/m4a in order and return the first existing URL. */
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
  mascotId,
  sound,
  onChange,
}: {
  mascotId: 'kron' | 'flocky';
  sound: MascotSoundConfig;
  onChange: (patch: Partial<MascotSoundConfig>) => void;
}) {
  const theme = usePixelTheme();
  const [playing, setPlaying] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isCustom = sound.src !== null && sound.src.startsWith('data:');
  const base = DEFAULT_SOUND_BASE[mascotId];

  // Stop any playback on unmount or when the active src changes.
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const togglePreview = async () => {
    if (playing) {
      audioRef.current?.pause();
      audioRef.current = null;
      setPlaying(false);
      return;
    }
    setUploadError(null);

    // Resolve the actual URL: custom data URL if uploaded, else probe
    // public/sounds/<mascot>-default.{mp3,wav,ogg,m4a} for the first match.
    let src: string | null = sound.src;
    if (!src) {
      src = await resolveDefaultSrc(mascotId);
      if (!src) {
        setUploadError(
          `File di default mancante: aggiungi public${base}.{mp3|wav|ogg|m4a} oppure carica un file custom`,
        );
        return;
      }
    }

    const a = new Audio(src);
    a.addEventListener('ended', () => setPlaying(false));
    a.addEventListener('error', () => {
      setPlaying(false);
      const code = a.error?.code;
      if (code === 3) {
        setUploadError('Errore di decoding (formato non supportato dal browser)');
      } else if (code === 2 || code === 4) {
        setUploadError('File audio non trovato o formato non supportato');
      } else {
        setUploadError('Errore nel caricamento del file audio');
      }
    });
    audioRef.current = a;
    a.play().then(() => setPlaying(true)).catch((err: DOMException) => {
      setPlaying(false);
      if (err.name === 'NotAllowedError') {
        setUploadError('Riproduzione bloccata dal browser (autoplay policy)');
      }
      // Other errors are already reported by the 'error' event listener.
    });
  };

  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setUploadError('File troppo grande (max 2 MB)');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl === 'string') onChange({ src: dataUrl });
    };
    reader.onerror = () => setUploadError('Errore lettura file');
    reader.readAsDataURL(file);
    e.target.value = '';  // allow re-picking the same file later
  };

  const resetDefault = () => {
    onChange({ src: null });
    setUploadError(null);
  };

  return (
    <SettingsSection label="Suono notifica">
      <p style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 11, color: theme.ink3, margin: 0 }}>
        Jingle riprodotto quando la notifica scatta. File di default in <code style={{ fontSize: 11 }}>public{base}.{`{mp3|wav|ogg|m4a}`}</code>.
      </p>
      <label
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          ...pixelLabelStyle(theme),
          color: theme.ink,
          cursor: 'pointer',
        }}
      >
        <input
          type="checkbox"
          checked={sound.enabled}
          onChange={(e) => onChange({ enabled: e.target.checked })}
          style={{ accentColor: theme.accent }}
        />
        Suono attivo
      </label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', opacity: sound.enabled ? 1 : 0.5 }}>
        <button
          type="button"
          onClick={togglePreview}
          disabled={!sound.enabled}
          className="px-press"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            background: playing ? theme.accent : theme.surface,
            color: playing ? theme.onAccent : theme.ink2,
            border: `2px solid ${theme.border}`,
            fontFamily: 'var(--font-pixel-head)',
            fontSize: 9,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            cursor: sound.enabled ? 'pointer' : 'not-allowed',
          }}
        >
          {playing ? <IconPlayerStop size={11} /> : <IconPlayerPlay size={11} />}
          {playing ? 'Stop' : 'Ascolta'}
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={!sound.enabled}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            background: theme.surface,
            color: theme.ink2,
            border: `2px solid ${theme.border}`,
            fontFamily: 'var(--font-pixel-head)',
            fontSize: 9,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            cursor: sound.enabled ? 'pointer' : 'not-allowed',
          }}
        >
          <IconUpload size={11} />
          {isCustom ? 'Cambia file' : 'Carica file'}
        </button>
        {isCustom && (
          <button
            type="button"
            onClick={resetDefault}
            disabled={!sound.enabled}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              background: theme.surface,
              color: theme.ink2,
              border: `2px solid ${theme.border}`,
              fontFamily: 'var(--font-pixel-head)',
              fontSize: 9,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: sound.enabled ? 'pointer' : 'not-allowed',
            }}
          >
            <IconRefresh size={11} />
            Default
          </button>
        )}
        <span
          style={{
            fontFamily: 'var(--font-pixel-body)',
            fontSize: 10,
            color: theme.ink3,
            marginLeft: 4,
          }}
        >
          {isCustom ? 'file personalizzato attivo' : 'file di default'}
        </span>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handlePick}
          style={{ display: 'none' }}
        />
      </div>
      {uploadError && (
        <p
          style={{
            fontFamily: 'var(--font-pixel-body)',
            fontSize: 10,
            color: '#E24B4A',
            margin: 0,
          }}
        >
          {uploadError}
        </p>
      )}
    </SettingsSection>
  );
}

/** Accept "13.00", "13:00", "9.5" and normalize to "HH:MM". Returns null
 *  on garbage so the caller can drop the entry. */
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const theme = usePixelTheme();
  return (
    <div>
      <div
        style={{
          fontFamily: 'var(--font-pixel-head)',
          fontSize: 9,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: theme.ink3,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}
