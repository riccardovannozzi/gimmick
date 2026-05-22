'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { IconUser, IconBell, IconShield, IconPalette, IconLogout, IconBrush, IconMoodSmile, IconDeviceGamepad2 } from '@tabler/icons-react';
import { Header } from '@/components/layout/header';
import { usePixelTheme, PixelToggle } from '@/components/pixel';
import { PixelSettingsPanel } from '@/components/pixel/PixelSettingsPanel';
import { useAuthStore } from '@/store/auth-store';
import { ActionsModal } from '@/components/actions/actions-modal';
import { StatusesModal } from '@/components/statuses/statuses-modal';
import { TypeIconsModal } from '@/components/type-icons/type-icons-modal';

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
            <PixelSettingsPanel />
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
        </div>
      </div>

      {/* Modals */}
      <ActionsModal open={actionsOpen} onOpenChange={setActionsOpen} />
      <StatusesModal open={statusesOpen} onOpenChange={setStatusesOpen} />
      <TypeIconsModal open={typeIconsOpen} onOpenChange={setTypeIconsOpen} />
    </div>
  );
}
