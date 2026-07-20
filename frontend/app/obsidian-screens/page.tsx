'use client';

/**
 * Gimmick · Obsidian — Non-tab screens preview.
 *
 * Full-window screens that aren't ViewTabs (reached from the gear / chat / a
 * modal): Settings, Ask, Modals. Shown framed, light + dark. QA route at
 * /obsidian-screens.
 */
import * as React from 'react';
import { SettingsView, AskView, IconPickerModal, ColorPickerModal } from '@/components/views';
import type { ObsidianMode } from '@/lib/theme/obsidian';

function Frame({ mode, height, children }: { mode: ObsidianMode; height: number; children: React.ReactNode }) {
  return (
    <div
      data-theme={mode}
      style={{
        background: 'var(--ob-canvas)',
        border: '1px solid var(--ob-line-2)',
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: '0 30px 80px -40px rgba(0,0,0,0.45)',
        height,
      }}
    >
      {children}
    </div>
  );
}

function Section({ title, height, render }: { title: string; height: number; render: () => React.ReactNode }) {
  return (
    <div style={{ marginBottom: 44 }}>
      <div style={{ fontFamily: 'var(--ob-font-mono)', fontSize: 12, fontWeight: 600, letterSpacing: '0.16em', color: '#7a7589', marginBottom: 16 }}>
        {title}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', color: '#9a96a4', marginBottom: 10, fontFamily: 'var(--ob-font-mono)' }}>LIGHT</div>
          <Frame mode="light" height={height}>{render()}</Frame>
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', color: '#9a96a4', marginBottom: 10, fontFamily: 'var(--ob-font-mono)' }}>DARK</div>
          <Frame mode="dark" height={height}>{render()}</Frame>
        </div>
      </div>
    </div>
  );
}

export default function ObsidianScreensPreview() {
  return (
    <div style={{ background: '#e7e6ea', minHeight: '100vh', padding: 32 }}>
      <div style={{ maxWidth: 1500, margin: '0 auto', fontFamily: 'var(--ob-font-sans)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 24, color: '#1b1923' }}>
          <div style={{ width: 24, height: 24, borderRadius: 7, background: '#7C5CCB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 8, height: 8, borderRadius: 2.5, background: '#fff' }} />
          </div>
          <span style={{ fontFamily: 'var(--ob-font-mono)', fontSize: 12, fontWeight: 600, letterSpacing: '0.16em', color: '#7a7589' }}>
            GIMMICK · SCHERMATE (Settings · Ask · Modali)
          </span>
        </div>

        <Section title="SETTINGS · GimmickSettings" height={680} render={() => <SettingsView />} />
        <Section title="ASK · GimmickAsk" height={680} render={() => <AskView />} />

        {/* Modals — shown on a dimmed backdrop, both pickers side by side */}
        <div style={{ marginBottom: 44 }}>
          <div style={{ fontFamily: 'var(--ob-font-mono)', fontSize: 12, fontWeight: 600, letterSpacing: '0.16em', color: '#7a7589', marginBottom: 16 }}>
            MODALI · GimmickModals
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
            {(['light', 'dark'] as const).map((mode) => (
              <div key={mode}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', color: '#9a96a4', marginBottom: 10, fontFamily: 'var(--ob-font-mono)' }}>{mode.toUpperCase()}</div>
                <div
                  data-theme={mode}
                  className="ob-mbackdrop"
                  style={{ display: 'flex', gap: 22, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-start', borderRadius: 16 }}
                >
                  <IconPickerModal />
                  <ColorPickerModal />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
