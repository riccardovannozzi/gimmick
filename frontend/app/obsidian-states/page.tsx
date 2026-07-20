'use client';

/**
 * Gimmick · Obsidian — Service states preview.
 *
 * Empty · loading skeleton · offline/error · toasts (success/undo/AI/error) ·
 * notification center. Mirrors GimmickStates.dc.html. QA route at /obsidian-states.
 */
import * as React from 'react';
import {
  IconInbox, IconWifiOff, IconCheck, IconArrowBackUp, IconSparkles, IconAlertTriangle,
  IconShare3, IconTag, IconRefresh,
} from '@tabler/icons-react';
import { Button } from '@/components/primitives';
import { Icon } from '@/components/shell';
import { EmptyState, LoadingList, Toast, NotificationCenter, type NotificationItem } from '@/components/states';
import type { ObsidianMode } from '@/lib/theme/obsidian';

function Frame({ mode, width, height, children }: { mode: ObsidianMode; width: number; height?: number; children: React.ReactNode }) {
  return (
    <div data-theme={mode} className="ob-states-frame" style={{ width, height }}>
      {children}
    </div>
  );
}

function Label({ children }: { children: string }) {
  return <div style={{ fontSize: 13, fontWeight: 600, color: '#6e6a78', marginBottom: 10 }}>{children}</div>;
}

const NOTIFS: NotificationItem[] = [
  { id: '1', color: 'var(--ob-accent)', icon: <IconSparkles size={15} stroke={1.8} />, title: 'Bito ha smistato 4 spark', body: 'Mentre eri via, ha proposto tile e tag.', time: '5 min fa', unread: true },
  { id: '2', color: 'var(--ob-info)', icon: <IconShare3 size={15} stroke={1.8} />, title: 'Flusso aggiornato', body: 'OM/Richiesta preventivo → in attesa di L. Anichini.', time: '1 ora fa', unread: true },
  { id: '3', color: 'var(--ob-success)', icon: <IconCheck size={15} stroke={1.8} />, title: 'Sincronizzazione completata', body: '12 tile e 3 flussi aggiornati su tutti i dispositivi.', time: 'Oggi · 08:40' },
  { id: '4', color: 'var(--ob-warning)', icon: <IconTag size={15} stroke={1.8} />, title: 'Nuovo tag dal pattern', body: 'Bito suggerisce “Galaxia” per 6 tile.', time: 'Ieri' },
];

function EmptyTiles({ mode }: { mode: ObsidianMode }) {
  return (
    <Frame mode={mode} width={520} height={360}>
      <EmptyState
        icon={<IconInbox size={34} stroke={1.6} />}
        title="Ancora nessun tile"
        description="Cattura una foto, una nota o un memo vocale: Gimmick lo trasforma in un tile pronto da organizzare."
        actions={
          <>
            <Button variant="primary" icon={<Icon name="plus" size={15} />}>Nuova cattura</Button>
            <Button variant="secondary" icon={<Icon name="voice" size={15} />}>Registra memo</Button>
          </>
        }
      />
    </Frame>
  );
}

function Offline({ mode }: { mode: ObsidianMode }) {
  return (
    <Frame mode={mode} width={520} height={360}>
      <EmptyState
        tone="error"
        icon={<IconWifiOff size={34} stroke={1.6} />}
        title="Sei offline"
        description="Le tue catture restano salvate sul dispositivo e verranno sincronizzate appena torni online."
        actions={<Button variant="secondary" icon={<IconRefresh size={15} stroke={1.8} />}>Riprova</Button>}
      />
    </Frame>
  );
}

function Toasts({ mode }: { mode: ObsidianMode }) {
  return (
    <div data-theme={mode} style={{ background: mode === 'dark' ? '#0c0a12' : '#e7e6ea', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Toast tone="success" title="Tile creato" sub="OM/Sopralluogo Galaxia" />
      <Toast tone="undo" title="Spark scartato" sub="Memo vocale · 02:14" action="Annulla" actionIcon={<IconArrowBackUp size={12} stroke={1.8} />} />
      <Toast tone="ai" title="Bito ha proposto 3 tile" sub="dal tuo ultimo memo" action="Vedi" />
      <Toast tone="error" title="Cattura non riuscita" sub="File troppo grande (max 50MB)" action="Riprova" />
    </div>
  );
}

export default function ObsidianStatesPreview() {
  return (
    <div style={{ background: '#e7e6ea', minHeight: '100vh', padding: 32 }}>
      <div style={{ maxWidth: 1500, margin: '0 auto', fontFamily: 'var(--ob-font-sans)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 28, color: '#1b1923' }}>
          <div style={{ width: 24, height: 24, borderRadius: 7, background: '#7C5CCB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 8, height: 8, borderRadius: 2.5, background: '#fff' }} />
          </div>
          <span style={{ fontFamily: 'var(--ob-font-mono)', fontSize: 12, fontWeight: 600, letterSpacing: '0.16em', color: '#7a7589' }}>
            GIMMICK · STATI DI SERVIZIO
          </span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 40 }}>
          <div><Label>Empty · vista Tiles</Label><EmptyTiles mode="light" /></div>
          <div><Label>Loading · skeleton</Label><Frame mode="light" width={520} height={360}><LoadingList /></Frame></div>
          <div><Label>Offline / error</Label><Offline mode="light" /></div>

          <div><Label>Toasts (sfondo chiaro)</Label><Toasts mode="light" /></div>
          <div><Label>Toasts (sfondo scuro)</Label><Toasts mode="dark" /></div>

          <div><Label>Centro notifiche · Light</Label><Frame mode="light" width={380}><NotificationCenter items={NOTIFS} /></Frame></div>
          <div><Label>Centro notifiche · Dark</Label><Frame mode="dark" width={380}><NotificationCenter items={NOTIFS} /></Frame></div>

          <div><Label>Empty · Dark</Label><EmptyTiles mode="dark" /></div>
          <div><Label>Offline · Dark</Label><Offline mode="dark" /></div>
        </div>
      </div>
    </div>
  );
}
