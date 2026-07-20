'use client';

/**
 * Gimmick · Obsidian — Desktop shell preview.
 *
 * Full AppShell (Header · ViewTabs · Sidebar · ViewContainer · Inspector) in
 * light and dark, with a faithful sample tag tree and tile-detail inspector.
 * Mirrors GimmickApp.dc.html. Standalone QA route at /obsidian-shell.
 */
import * as React from 'react';
import {
  AppShell, Sidebar, ViewContainer, Inspector,
  InspectorSection, InspectorField, InspectorTagPill, InspectorDivider, InspectorCaps,
  Icon, type ViewId, type SidebarGroup,
} from '@/components/shell';
import { Button, SegmentedControl } from '@/components/primitives';
import { TilesView, SparksView, CanvasView, KanbanView, ChronoView, PanopticonView, FlowsView } from '@/components/views';
import type { ObsidianMode } from '@/lib/theme/obsidian';

const GROUPS: SidebarGroup[] = [
  { id: 'home', name: 'Home', icon: 'home', color: '#6FCF97' },
  { id: 'lavoro', name: 'Lavoro', icon: 'briefcase', color: '#5B8DEF' },
  { id: 'persona', name: 'Persona', icon: 'person', color: '#AB9FF2' },
  { id: 'progetto', name: 'Progetto', icon: 'folder', color: '#E0B341' },
  {
    id: 'gds', name: 'Golfo del Sole', icon: 'sun', color: '#E0B341', defaultOpen: true,
    children: [
      { id: 'gds-fv', name: 'GDS_Fotovoltaico' },
      { id: 'gds-permuta', name: 'GDS_Permuta Viale I…' },
      { id: 'gds-report', name: 'GDS_Report', pinned: true },
      { id: 'gds-varie', name: 'GDS_Varie' },
    ],
  },
  {
    id: 'om', name: 'Ortano Mare', icon: 'wave', color: '#5B8DEF', defaultOpen: true,
    children: [
      { id: 'om-villa1', name: 'OM La Villa 1' },
      { id: 'om-cartelli', name: 'OM Cartelli Rotonda' },
      { id: 'om-ville', name: 'OM Le ville 26/27' },
      { id: 'om-report', name: 'OM Report', pinned: true },
      { id: 'om-unicoop', name: 'OM Unicoop' },
      { id: 'om-varie', name: 'OM Varie' },
    ],
  },
  {
    id: 'money', name: 'Money', icon: 'euro', color: '#6FCF97', defaultOpen: true,
    children: [
      { id: 'ade', name: 'Agenzia Entrate' },
      { id: 'commercialista', name: 'Commercialista' },
    ],
  },
];

function TileDetail() {
  const [when, setWhen] = React.useState('timed');
  return (
    <>
      <InspectorSection eyebrow="TITOLO" style={{ marginTop: 2 }}>
        <InspectorField value="OM/call con barbini" />
      </InspectorSection>

      <InspectorSection eyebrow="AZIONE">
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" icon={<Icon name="note" size={15} />} style={{ flex: 1 }}>Note</Button>
          <Button variant="secondary" icon={<Icon name="todo" size={15} />} style={{ flex: 1 }}>To-do</Button>
        </div>
        <div style={{ marginTop: 12 }}>
          <SegmentedControl
            value={when}
            onChange={setWhen}
            items={[
              { value: 'due', label: <><Icon name="due" size={13} /> Scadenza</> },
              { value: 'allday', label: <><Icon name="allday" size={13} /> Giornata</> },
              { value: 'timed', label: <><Icon name="timed" size={13} /> A orario</> },
            ]}
          />
        </div>
      </InspectorSection>

      <InspectorSection eyebrow="DATA E ORARIO">
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1.4 }}><InspectorField value="22/06/2026" icon="calendar" /></div>
          <div style={{ flex: 1 }}><InspectorField value="11:00" icon="clock" /></div>
          <div style={{ flex: 1 }}><InspectorField value="12:00" /></div>
        </div>
      </InspectorSection>

      <InspectorSection eyebrow="TAG">
        <InspectorTagPill>Golfo del Sole</InspectorTagPill>
      </InspectorSection>

      <InspectorSection eyebrow="TIPO">
        <InspectorField value="Call" icon="call" chevron />
      </InspectorSection>

      <InspectorSection eyebrow="STATO">
        <InspectorField value="Done" icon="check" iconColor="var(--ob-success)" chevron />
      </InspectorSection>

      <InspectorDivider />

      <InspectorSection eyebrow="SPARKS · 3">
        <InspectorCaps />
      </InspectorSection>
    </>
  );
}

function ShellDemo({ mode }: { mode: ObsidianMode }) {
  const [view, setView] = React.useState<ViewId>('tiles');
  const [active, setActive] = React.useState('gds-report');

  return (
    <AppShell
      mode={mode}
      framed
      activeView={view}
      onViewChange={setView}
      sidebar={
        <Sidebar
          groups={GROUPS}
          count={26}
          pinnedLabel="Pinned · 2"
          activeChildId={active}
          onSelectChild={setActive}
        />
      }
      inspector={<Inspector><TileDetail /></Inspector>}
      style={{ height: 760 }}
    >
      {view === 'tiles' ? (
        <ViewContainer hideToolbar>
          <TilesView />
        </ViewContainer>
      ) : view === 'sparks' ? (
        <ViewContainer hideToolbar>
          <SparksView />
        </ViewContainer>
      ) : view === 'canvas' ? (
        <ViewContainer hideToolbar>
          <CanvasView />
        </ViewContainer>
      ) : view === 'kanban' ? (
        <ViewContainer hideToolbar>
          <KanbanView />
        </ViewContainer>
      ) : view === 'chrono' ? (
        <ViewContainer hideToolbar>
          <ChronoView />
        </ViewContainer>
      ) : view === 'panopticon' ? (
        <ViewContainer hideToolbar>
          <PanopticonView />
        </ViewContainer>
      ) : view === 'flows' ? (
        <ViewContainer hideToolbar>
          <FlowsView />
        </ViewContainer>
      ) : (
        <ViewContainer
          toolbar={<Button variant="primary" size="sm" icon={<Icon name="plus" size={13} />}>Tile</Button>}
          meta="5 tile · 19 spark"
        >
          <div
            style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--ob-subtle)',
              fontSize: 13,
              backgroundImage: 'radial-gradient(var(--ob-line) 1px, transparent 1px)',
              backgroundSize: '22px 22px',
            }}
          >
            Contenuto vista «{view}» (Chrono / Canvas / Kanban / …)
          </div>
        </ViewContainer>
      )}
    </AppShell>
  );
}

export default function ObsidianShellPreview() {
  return (
    <div style={{ background: '#e7e6ea', minHeight: '100vh', padding: 32 }}>
      <div style={{ maxWidth: 1640, margin: '0 auto', fontFamily: 'var(--ob-font-sans)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 20, color: '#1b1923' }}>
          <div style={{ width: 24, height: 24, borderRadius: 7, background: '#7C5CCB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 8, height: 8, borderRadius: 2.5, background: '#fff' }} />
          </div>
          <span style={{ fontFamily: 'var(--ob-font-mono)', fontSize: 12, fontWeight: 600, letterSpacing: '0.16em', color: '#7a7589' }}>
            GIMMICK · SHELL DESKTOP
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', color: '#9a96a4', marginBottom: 12, fontFamily: 'var(--ob-font-mono)' }}>OBSIDIAN LIGHT</div>
            <ShellDemo mode="light" />
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', color: '#9a96a4', marginBottom: 12, fontFamily: 'var(--ob-font-mono)' }}>OBSIDIAN DARK</div>
            <ShellDemo mode="dark" />
          </div>
        </div>
      </div>
    </div>
  );
}
