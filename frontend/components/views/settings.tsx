'use client';

/**
 * Gimmick · Obsidian — Settings view.
 *
 * Settings nav + cards. The Aspetto panel: Tema / Colore tile (SegmentedControl),
 * Interfaccia (Toggle + language row), Beniamino (Bito), Dati. Reference:
 * GimmickSettings.dc.html. Reuses the SegmentedControl + Toggle primitives.
 */
import * as React from 'react';
import {
  IconPalette, IconPlug, IconShield, IconLogout,
  IconDeviceMobileVibration, IconTrash, IconWorld, IconDownload,
} from '@tabler/icons-react';
import { SegmentedControl, Toggle } from '@/components/primitives';
import { Beniamino } from '@/components/mascot';
import { Icon, type ShellIconName } from '@/components/shell';

// ─── Settings nav ─────────────────────────────────────────────────────────────
type NavId = 'account' | 'aspetto' | 'notifiche' | 'cattura' | 'integrazioni' | 'privacy';
interface NavDef { id: NavId; label: string; render: () => React.ReactNode }

function NavRow({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button type="button" className={`ob-settings__nav-item${active ? ' ob-settings__nav-item--active' : ''}`} onClick={onClick}>
      <span className="ob-settings__nav-icon">{icon}</span>
      <span className="ob-settings__nav-label">{label}</span>
    </button>
  );
}

// ─── Setting row + card ───────────────────────────────────────────────────────
function Row({ icon, label, sub, control }: { icon: ShellIconName | React.ReactNode; label: string; sub?: string; control: React.ReactNode }) {
  return (
    <div className="ob-settings__row">
      <span className="ob-settings__row-icon">
        {typeof icon === 'string' ? <Icon name={icon as ShellIconName} size={17} /> : icon}
      </span>
      <div className="ob-settings__row-main">
        <div className="ob-settings__row-label">{label}</div>
        {sub && <div className="ob-settings__row-sub">{sub}</div>}
      </div>
      {control}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="ob-settings__card">
      <div className="ob-settings__card-title">{title}</div>
      <div className="ob-settings__card-body">{children}</div>
    </div>
  );
}

function ChevLink({ children }: { children: React.ReactNode }) {
  return (
    <button type="button" className="ob-settings__row-link">
      {children}
      <span className="ob-settings__row-link-chev"><Icon name="chevR" size={14} /></span>
    </button>
  );
}

// ─── Aspetto panel ────────────────────────────────────────────────────────────
function AspettoPanel() {
  const [theme, setTheme] = React.useState('light');
  const [tileColor, setTileColor] = React.useState('tint');
  const [haptic, setHaptic] = React.useState(true);
  const [confirmDelete, setConfirmDelete] = React.useState(true);

  return (
    <>
      <h1 className="ob-settings__h1">Aspetto</h1>
      <p className="ob-settings__lead">Tema, colore dei tile e densità dell’interfaccia.</p>

      <Card title="TEMA">
        <Row
          icon={<IconPalette size={17} stroke={1.6} />}
          label="Tema"
          sub="Chiaro, scuro o automatico"
          control={
            <SegmentedControl
              value={theme}
              onChange={setTheme}
              items={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }, { value: 'system', label: 'Sistema' }]}
            />
          }
        />
        <Row
          icon="sparkles"
          label="Colore tile"
          sub="Velatura o pieno saturo"
          control={
            <SegmentedControl
              value={tileColor}
              onChange={setTileColor}
              items={[{ value: 'tint', label: 'Tinta' }, { value: 'solid', label: 'Pieno' }]}
            />
          }
        />
      </Card>

      <Card title="INTERFACCIA">
        <Row icon={<IconDeviceMobileVibration size={17} stroke={1.6} />} label="Feedback aptico" sub="Vibrazione su cattura e invio" control={<Toggle checked={haptic} onChange={setHaptic} aria-label="Feedback aptico" />} />
        <Row icon={<IconTrash size={17} stroke={1.6} />} label="Conferma eliminazione" sub="Chiedi prima di scartare uno spark" control={<Toggle checked={confirmDelete} onChange={setConfirmDelete} aria-label="Conferma eliminazione" />} />
        <Row icon={<IconWorld size={17} stroke={1.6} />} label="Lingua" control={<ChevLink>Italiano</ChevLink>} />
      </Card>

      <Card title="BENIAMINO">
        <Row
          icon="sparkles"
          label="Assistente"
          sub="Il beniamino che ti aiuta"
          control={
            <button type="button" className="ob-settings__beniamino">
              <Beniamino name="bito" size={28} title="" />
              <span className="ob-settings__beniamino-name">Bito</span>
              <span className="ob-settings__row-link-chev"><Icon name="chevR" size={14} /></span>
            </button>
          }
        />
      </Card>

      <Card title="DATI">
        <Row icon={<IconDownload size={17} stroke={1.6} />} label="Esporta i tuoi dati" sub="Scarica tile, spark e tag" control={<span className="ob-settings__row-link-chev"><Icon name="chevR" size={15} /></span>} />
      </Card>
    </>
  );
}

export function SettingsView() {
  const [active, setActive] = React.useState<NavId>('aspetto');

  const NAV: NavDef[] = [
    { id: 'account', label: 'Account', render: () => null },
    { id: 'aspetto', label: 'Aspetto', render: () => <AspettoPanel /> },
    { id: 'notifiche', label: 'Notifiche', render: () => null },
    { id: 'cattura', label: 'Cattura & AI', render: () => null },
    { id: 'integrazioni', label: 'Integrazioni', render: () => null },
    { id: 'privacy', label: 'Privacy & dati', render: () => null },
  ];

  return (
    <div className="ob-settings">
      <nav className="ob-settings__sidebar">
        <div className="ob-settings__nav-eyebrow">IMPOSTAZIONI</div>
        <NavRow icon={<Icon name="person" size={17} />} label="Account" active={active === 'account'} onClick={() => setActive('account')} />
        <NavRow icon={<IconPalette size={17} stroke={1.6} />} label="Aspetto" active={active === 'aspetto'} onClick={() => setActive('aspetto')} />
        <NavRow icon={<Icon name="bell" size={17} />} label="Notifiche" active={active === 'notifiche'} onClick={() => setActive('notifiche')} />
        <NavRow icon={<Icon name="sparkles" size={17} />} label="Cattura & AI" active={active === 'cattura'} onClick={() => setActive('cattura')} />
        <NavRow icon={<IconPlug size={17} stroke={1.6} />} label="Integrazioni" active={active === 'integrazioni'} onClick={() => setActive('integrazioni')} />
        <NavRow icon={<IconShield size={17} stroke={1.6} />} label="Privacy & dati" active={active === 'privacy'} onClick={() => setActive('privacy')} />
        <div style={{ flex: 1 }} />
        <NavRow icon={<IconLogout size={17} stroke={1.6} />} label="Esci" />
      </nav>

      <main className="ob-settings__main ob-scroll">
        <div className="ob-settings__inner">
          {NAV.find((n) => n.id === active)?.render() ?? <AspettoPanel />}
        </div>
      </main>
    </div>
  );
}
