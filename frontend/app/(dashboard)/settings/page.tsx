'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { IconUser, IconBell, IconShield, IconPalette, IconLogout, IconBrush, IconMoodSmile, IconDeviceGamepad2, IconUsersGroup, IconAlertTriangle, IconTrash } from '@tabler/icons-react';
import { Header } from '@/components/layout/header';
import { usePixelTheme, PixelToggle } from '@/components/pixel';
import { PixelArcadeModal } from '@/components/pixel/PixelArcadeModal';
import { useAuthStore } from '@/store/auth-store';
import { ActionsModal } from '@/components/actions/actions-modal';
import { StatusesModal } from '@/components/statuses/statuses-modal';
import { TypeIconsModal } from '@/components/type-icons/type-icons-modal';
import { CardRosterModal } from '@/components/cards/card-roster-modal';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { authApi } from '@/lib/api';

type IconComp = React.ComponentType<{ size?: number; style?: React.CSSProperties }>;

function PixelSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: IconComp;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const theme = usePixelTheme();
  return (
    <div
      style={{
        background: theme.surface,
        border: `2px solid ${theme.border}`,
        boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 14px',
          background: theme.surfaceVariant,
          borderBottom: `2px solid ${theme.border}`,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: theme.surface,
            border: `2px solid ${theme.border}`,
            color: theme.accent,
            flexShrink: 0,
          }}
        >
          <Icon size={14} />
        </div>
        <div>
          <h2
            style={{
              fontFamily: 'var(--font-pixel-head)',
              fontSize: 11,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: theme.ink,
              margin: 0,
            }}
          >
            {title}
          </h2>
          <p
            style={{
              fontFamily: 'var(--font-pixel-body)',
              fontSize: 11,
              color: theme.ink3,
              margin: '2px 0 0',
            }}
          >
            {description}
          </p>
        </div>
      </div>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {children}
      </div>
    </div>
  );
}

function PixelManageButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  const theme = usePixelTheme();
  return (
    <button
      onClick={onClick}
      className="px-press"
      style={{
        alignSelf: 'flex-start',
        display: 'inline-flex',
        alignItems: 'center',
        height: 28,
        padding: '0 12px',
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
      {children}
    </button>
  );
}

function PixelRow({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  const theme = usePixelTheme();
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <div>
        <p
          style={{
            fontFamily: 'var(--font-pixel-head)',
            fontSize: 10,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: theme.ink2,
            margin: 0,
          }}
        >
          {title}
        </p>
        <p
          style={{
            fontFamily: 'var(--font-pixel-body)',
            fontSize: 11,
            color: theme.ink3,
            margin: '2px 0 0',
          }}
        >
          {description}
        </p>
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const theme = usePixelTheme();
  const router = useRouter();
  const { user, signOut } = useAuthStore();
  const [notifications, setNotifications] = useState(true);
  const [autoSync, setAutoSync] = useState(true);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [statusesOpen, setStatusesOpen] = useState(false);
  const [typeIconsOpen, setTypeIconsOpen] = useState(false);
  const [pixelArcadeOpen, setPixelArcadeOpen] = useState(false);
  const [cardRosterOpen, setCardRosterOpen] = useState(false);
  const [dangerZoneOpen, setDangerZoneOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
    toast.success('Logout effettuato');
    router.push('/login');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: theme.bg1 }}>
      <Header title="Impostazioni" />

      <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Profile */}
          <PixelSection icon={IconUser} title="Profilo" description="Gestisci le informazioni del tuo account">
            <div>
              <label
                htmlFor="email"
                style={{
                  display: 'block',
                  fontFamily: 'var(--font-pixel-head)',
                  fontSize: 9,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: theme.ink3,
                  marginBottom: 6,
                }}
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={user?.email || ''}
                disabled
                style={{
                  width: '100%',
                  background: theme.surfaceVariant,
                  border: `2px solid ${theme.border}`,
                  padding: '8px 10px',
                  color: theme.ink3,
                  fontFamily: 'var(--font-pixel-body)',
                  fontSize: 12,
                  outline: 'none',
                }}
              />
              <p style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 11, color: theme.ink3, marginTop: 6 }}>
                L&apos;email non può essere modificata
              </p>
            </div>
          </PixelSection>

          {/* Pixel Arcade theme */}
          <PixelSection icon={IconDeviceGamepad2} title="Pixel Arcade" description="Palette, modalità, ombre e sfondo del design system 16-bit">
            <PixelManageButton onClick={() => setPixelArcadeOpen(true)}>Gestisci Pixel Arcade</PixelManageButton>
          </PixelSection>

          {/* Action Colors */}
          <PixelSection icon={IconPalette} title="Style of actions" description="Associa un colore a ogni tipo di azione">
            <PixelManageButton onClick={() => setActionsOpen(true)}>Gestisci actions</PixelManageButton>
          </PixelSection>

          {/* Statuses */}
          <PixelSection icon={IconBrush} title="Tile Statuses" description="Gestisci gli status visivi dei tile">
            <PixelManageButton onClick={() => setStatusesOpen(true)}>Gestisci statuses</PixelManageButton>
          </PixelSection>

          {/* Tile Type Icons */}
          <PixelSection icon={IconMoodSmile} title="Tile Type Icons" description="Gestisci le icone di tipo da assegnare ai tile">
            <PixelManageButton onClick={() => setTypeIconsOpen(true)}>Gestisci type icons</PixelManageButton>
          </PixelSection>

          {/* Card Roster */}
          <PixelSection icon={IconUsersGroup} title="Card Roster" description="I 10 personaggi pixel-art di Gimmick e le aree dell'app in cui appaiono">
            <PixelManageButton onClick={() => setCardRosterOpen(true)}>Gestisci Card Roster</PixelManageButton>
          </PixelSection>

          {/* Notifications */}
          <PixelSection icon={IconBell} title="Notifiche" description="Configura le preferenze di notifica">
            <PixelRow title="Notifiche push" description="Ricevi notifiche per nuovi memo">
              <PixelToggle on={notifications} onChange={setNotifications} />
            </PixelRow>
            <div style={{ borderTop: `2px solid ${theme.border}` }} />
            <PixelRow title="Sincronizzazione automatica" description="Sincronizza automaticamente i memo in background">
              <PixelToggle on={autoSync} onChange={setAutoSync} />
            </PixelRow>
          </PixelSection>

          {/* Security */}
          <PixelSection icon={IconShield} title="Sicurezza" description="Gestisci la sicurezza del tuo account">
            <PixelManageButton onClick={() => {}}>Cambia Password</PixelManageButton>
            <div style={{ borderTop: `2px solid ${theme.border}` }} />
            <button
              onClick={handleLogout}
              className="px-press"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                width: '100%',
                height: 32,
                padding: '0 12px',
                background: '#E24B4A',
                color: '#FFFFFF',
                border: `2px solid ${theme.border}`,
                fontFamily: 'var(--font-pixel-head)',
                fontSize: 10,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
              }}
            >
              <IconLogout size={14} />
              Logout
            </button>
          </PixelSection>

          {/* Danger Zone — irreversible actions */}
          <PixelSection icon={IconAlertTriangle} title="Danger Zone" description="Azioni permanenti e irreversibili">
            <button
              onClick={() => setDangerZoneOpen(true)}
              className="px-press"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                width: '100%',
                height: 32,
                padding: '0 12px',
                background: '#E24B4A',
                color: '#FFFFFF',
                border: `2px solid ${theme.border}`,
                fontFamily: 'var(--font-pixel-head)',
                fontSize: 10,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
              }}
            >
              <IconTrash size={14} />
              Elimina account
            </button>
          </PixelSection>
        </div>
      </div>

      {/* Modals */}
      <ActionsModal open={actionsOpen} onOpenChange={setActionsOpen} />
      <StatusesModal open={statusesOpen} onOpenChange={setStatusesOpen} />
      <TypeIconsModal open={typeIconsOpen} onOpenChange={setTypeIconsOpen} />
      <PixelArcadeModal open={pixelArcadeOpen} onOpenChange={setPixelArcadeOpen} />
      <CardRosterModal open={cardRosterOpen} onOpenChange={setCardRosterOpen} />
      <DangerZoneDialog open={dangerZoneOpen} onOpenChange={setDangerZoneOpen} />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Danger zone — eliminazione account permanente
// ──────────────────────────────────────────────────────────────────────────
function DangerZoneDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const theme = usePixelTheme();
  const router = useRouter();
  const signOut = useAuthStore((s) => s.signOut);
  const [password, setPassword] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset stato ogni volta che la modale viene chiusa.
  const reset = () => { setPassword(''); setConfirmed(false); setError(null); };

  const handleDelete = async () => {
    if (!password || !confirmed) return;
    setSubmitting(true);
    setError(null);
    const res = await authApi.deleteAccount(password);
    setSubmitting(false);
    if (!res.success) {
      setError(res.error || 'Eliminazione fallita');
      toast.error(res.error || 'Eliminazione fallita');
      return;
    }
    toast.success('Account eliminato');
    // Cleanup locale del client store: i token sono già stati svuotati da
    // authApi.deleteAccount, ma signOut chiama anche la stessa cleanup e
    // l'API /signout (che ora fallirà perché user è già eliminato) — la
    // skippiamo facendo solo un router.replace.
    await signOut().catch(() => null);
    onOpenChange(false);
    router.replace('/login');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent
        showCloseButton={false}
        className="!gap-0 !p-0 !rounded-none"
        style={{
          maxWidth: 420,
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
        <DialogTitle className="sr-only">Elimina account</DialogTitle>
        <DialogDescription className="sr-only">Conferma eliminazione permanente dell&apos;account</DialogDescription>

        <div style={{ padding: '12px 14px', background: '#E24B4A', borderBottom: `2px solid ${theme.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconAlertTriangle size={16} style={{ color: '#FFFFFF', flexShrink: 0 }} />
            <h2 style={{
              fontFamily: 'var(--font-pixel-head)',
              fontSize: 11,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#FFFFFF',
              margin: 0,
            }}>
              Elimina account
            </h2>
          </div>
          <p style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 11, color: '#FFFFFF', margin: '6px 0 0', lineHeight: 1.5 }}>
            Tutti i tuoi tile, spark, tag, flow e impostazioni verranno eliminati
            permanentemente. Questa azione è irreversibile.
          </p>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{
              fontFamily: 'var(--font-pixel-head)',
              fontSize: 9,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: theme.ink3,
              display: 'block',
              marginBottom: 4,
            }}>
              Conferma con la tua password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%',
                background: theme.surfaceVariant,
                border: `2px solid ${theme.border}`,
                padding: '8px 10px',
                color: theme.ink,
                fontFamily: 'var(--font-pixel-body)',
                fontSize: 12,
                outline: 'none',
              }}
            />
          </div>

          <label style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            cursor: 'pointer',
            fontFamily: 'var(--font-pixel-body)',
            fontSize: 12,
            color: theme.ink2,
            lineHeight: 1.5,
          }}>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              style={{ accentColor: '#E24B4A', marginTop: 2, flexShrink: 0 }}
            />
            <span>Capisco che <strong>l&apos;eliminazione è irreversibile</strong> e che perderò tutti i miei dati.</span>
          </label>

          {error && (
            <p style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 11, color: '#E24B4A', margin: 0 }}>
              {error}
            </p>
          )}

          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              style={{
                padding: '8px 12px',
                background: theme.surfaceVariant,
                color: theme.ink2,
                border: `2px solid ${theme.border}`,
                fontFamily: 'var(--font-pixel-head)',
                fontSize: 10,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={!password || !confirmed || submitting}
              className="px-press"
              style={{
                padding: '8px 12px',
                background: '#E24B4A',
                color: '#FFFFFF',
                border: `2px solid ${theme.border}`,
                fontFamily: 'var(--font-pixel-head)',
                fontSize: 10,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: !password || !confirmed || submitting ? 'not-allowed' : 'pointer',
                opacity: !password || !confirmed || submitting ? 0.5 : 1,
                boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
              }}
            >
              {submitting ? 'Eliminazione…' : 'Conferma eliminazione'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
