'use client';

/**
 * Gimmick · Obsidian — Design system showcase / validation page.
 *
 * Mirrors design_handoff_obsidian/GimmickObsidian.dc.html: tokens, type scale,
 * primitives (light + dark side by side) and the 10 beniamini. Not part of the
 * app shell — a standalone route at /obsidian-preview for visual QA.
 */
import * as React from 'react';
import {
  Button, IconButton, Field, Select, Toggle, SegmentedControl,
  Chip, Badge, Card, Avatar, Skeleton, ListRow, Table, TableRow, Toast,
  Modal, Sheet,
} from '@/components/primitives';
import { Beniamino, MascotSuggestion, BENIAMINO_NAMES, BENIAMINO_META } from '@/components/mascot';
import type { ObsidianMode } from '@/lib/theme/obsidian';

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function TagIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
      <path d="M2 2h5l7 7-5 5-7-7V2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="5" cy="5" r="1" fill="currentColor" />
    </svg>
  );
}

const eyebrow: React.CSSProperties = {
  fontFamily: 'var(--ob-font-mono)',
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--ob-subtle)',
  marginBottom: 12,
};

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 26 }}>
      <div style={eyebrow}>{title}</div>
      {children}
    </div>
  );
}

/** The full primitive gallery, themed by the wrapping `data-theme`. */
function Gallery({ mode }: { mode: ObsidianMode }) {
  const [seg, setSeg] = React.useState('tiles');
  const [on, setOn] = React.useState(mode === 'dark');
  const [sel, setSel] = React.useState('');
  const [modal, setModal] = React.useState(false);
  const [sheet, setSheet] = React.useState(false);

  return (
    <div
      data-theme={mode}
      style={{
        background: 'var(--ob-canvas)',
        color: 'var(--ob-text)',
        border: '1px solid var(--ob-line)',
        borderRadius: 14,
        padding: 24,
        fontFamily: 'var(--ob-font-sans)',
      }}
    >
      <div style={{ ...eyebrow, fontSize: 10, letterSpacing: '0.18em', marginBottom: 18 }}>
        {mode.toUpperCase()}
      </div>

      <Block title="Pulsanti">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Button variant="primary" icon={<PlusIcon />}>Crea</Button>
          <Button variant="secondary">Annulla</Button>
          <Button variant="ghost">Modifica</Button>
          <Button variant="danger">Elimina</Button>
          <Button variant="primary" size="sm">Small</Button>
          <Button variant="primary" disabled>Disabled</Button>
        </div>
      </Block>

      <Block title="Icon button">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <IconButton aria-label="Cerca"><SearchIcon /></IconButton>
          <IconButton aria-label="Aggiungi" solid><PlusIcon /></IconButton>
          <IconButton aria-label="Attivo" active><TagIcon /></IconButton>
          <IconButton aria-label="Piccolo" size="sm"><PlusIcon /></IconButton>
        </div>
      </Block>

      <Block title="Field / Input">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Field leading={<SearchIcon />} placeholder="Idea da catturare" hint="⏎" />
          <Field placeholder="Campo non valido" invalid />
        </div>
      </Block>

      <Block title="Select">
        <Select
          options={[
            { value: 'recent', label: 'Più recenti' },
            { value: 'name', label: 'Nome A–Z' },
            { value: 'size', label: 'Dimensione' },
          ]}
          placeholder="Ordina per…"
          value={sel}
          onChange={(e) => setSel(e.target.value)}
        />
      </Block>

      <Block title="Toggle · Segmented">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <Toggle checked={on} onChange={setOn} aria-label="Tinta" />
          <SegmentedControl
            value={seg}
            onChange={setSeg}
            items={[
              { value: 'tiles', label: 'Tiles' },
              { value: 'flows', label: 'Flows' },
              { value: 'chrono', label: 'Chrono' },
            ]}
          />
        </div>
      </Block>

      <Block title="Tag / Badge">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          <Chip active interactive>lavoro</Chip>
          <Chip interactive>idee</Chip>
          <Chip interactive>viaggio</Chip>
          <Badge pill>3 nuovi</Badge>
        </div>
      </Block>

      <Block title="Card · Avatar">
        <div style={{ display: 'flex', gap: 8 }}>
          {['Brief Marco', 'Spesa casa', 'Note call'].map((t, i) => (
            <Card key={t} interactive style={{ flex: 1, minWidth: 0, padding: '10px 11px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t}</div>
              <div style={{ display: 'flex', gap: 5, marginTop: 8, alignItems: 'center' }}>
                <span style={{ width: 11, height: 11, borderRadius: 3, background: ['var(--ob-type-photo)', 'var(--ob-type-text)', 'var(--ob-type-voice)'][i] }} />
                <span style={{ width: 11, height: 11, borderRadius: 3, background: 'var(--ob-type-file)' }} />
                <Avatar size={20} fallback="M" style={{ marginLeft: 'auto' }} />
              </div>
            </Card>
          ))}
        </div>
      </Block>

      <Block title="List row">
        <Card flat panel style={{ padding: 4 }}>
          <ListRow interactive leading={<span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--ob-type-text)' }} />} meta="2 spark">
            Call Marco · brief
          </ListRow>
          <ListRow interactive active leading={<span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--ob-type-voice)' }} />} meta="00:14">
            Memo · preventivo
          </ListRow>
        </Card>
      </Block>

      <Block title="Table">
        <Card flat panel style={{ padding: '4px 8px' }}>
          <Table>
            <thead>
              <tr><th>Nome</th><th>Tipo</th><th>Data</th></tr>
            </thead>
            <tbody>
              <TableRow interactive><td>Brief Marco</td><td>Testo</td><td>27 giu</td></TableRow>
              <TableRow interactive active><td>Spesa casa</td><td>File</td><td>26 giu</td></TableRow>
            </tbody>
          </Table>
        </Card>
      </Block>

      <Block title="Toast">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Toast tone="success" title="Spark salvato" description="Archiviato nel tile «Casa»." action={<Button variant="ghost" size="sm">Annulla</Button>} />
          <Toast tone="error" title="Upload fallito" description="Riprova tra poco." />
        </div>
      </Block>

      <Block title="Skeleton">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Skeleton width={34} height={34} circle />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Skeleton width="60%" height={12} />
            <Skeleton width="40%" height={10} />
          </div>
        </div>
      </Block>

      <Block title="Overlay">
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" onClick={() => setModal(true)}>Apri modal</Button>
          <Button variant="secondary" onClick={() => setSheet(true)}>Apri sheet</Button>
        </div>
        <Modal open={modal} onClose={() => setModal(false)} title="Nuovo tile">
          <p style={{ margin: '0 0 14px', color: 'var(--ob-muted)' }}>Dai un nome al tile e scegli un tag.</p>
          <Field placeholder="Titolo" />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <Button variant="ghost" onClick={() => setModal(false)}>Annulla</Button>
            <Button variant="primary" onClick={() => setModal(false)}>Crea</Button>
          </div>
        </Modal>
        <Sheet open={sheet} onClose={() => setSheet(false)} title="Dettaglio tile">
          <p style={{ margin: 0, color: 'var(--ob-muted)' }}>Pannello laterale (Sidebar Destra).</p>
        </Sheet>
      </Block>

      <Block title="Suggerimento del beniamino">
        <MascotSuggestion
          name="bito"
          items={[
            { icon: <TagIcon />, label: 'Casa', onClick: () => {} },
            { icon: <TagIcon />, label: 'To-do', onClick: () => {} },
          ]}
        />
      </Block>
    </div>
  );
}

export default function ObsidianPreviewPage() {
  return (
    <div style={{ background: '#eceaef', minHeight: '100vh', padding: '48px 32px 96px' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', fontFamily: 'var(--ob-font-sans)', color: '#1b1923' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 12 }}>
          <div style={{ width: 26, height: 26, borderRadius: 8, background: '#7C5CCB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 9, height: 9, borderRadius: 3, background: '#fff' }} />
          </div>
          <span style={{ fontFamily: 'var(--ob-font-mono)', fontSize: 12, fontWeight: 600, letterSpacing: '0.16em', color: '#7a7589' }}>
            GIMMICK · OBSIDIAN PREVIEW
          </span>
        </div>
        <h1 style={{ margin: '0 0 28px', fontSize: 40, fontWeight: 700, letterSpacing: '-0.03em' }}>Obsidian</h1>

        {/* Type scale swatches */}
        <div style={{ ...eyebrow }}>SCALA COLORI-TIPO</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 12, marginBottom: 36, maxWidth: 720 }}>
          {(['photo', 'video', 'voice', 'text', 'file', 'gallery'] as const).map((t) => (
            <div key={t} style={{ textAlign: 'center' }}>
              <div style={{ height: 44, borderRadius: 10, background: `var(--ob-type-${t})` }} data-theme="light" />
              <div style={{ fontSize: 11, fontWeight: 600, marginTop: 6, textTransform: 'capitalize' }}>{t}</div>
            </div>
          ))}
        </div>

        {/* Beniamini grid */}
        <div style={{ ...eyebrow }}>BENIAMINI</div>
        <div data-theme="light" style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 16 }}>
          {BENIAMINO_NAMES.map((name) => (
            <div key={name} style={{ background: '#fff', border: '1px solid rgba(24,20,38,0.08)', borderRadius: 14, padding: '16px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 72, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f6f6f8', borderRadius: '50%' }}>
                <Beniamino name={name} size={54} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{BENIAMINO_META[name].label}</div>
              <div style={{ fontFamily: 'var(--ob-font-mono)', fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', color: '#9a96a4' }}>{BENIAMINO_META[name].role}</div>
            </div>
          ))}
        </div>
        {/* Beniamini on dark */}
        <div data-theme="dark" style={{ background: '#161616', borderRadius: 14, padding: '20px 22px', display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 40 }}>
          {BENIAMINO_NAMES.map((name) => (
            <Beniamino key={name} name={name} size={44} />
          ))}
        </div>

        {/* Components light + dark */}
        <div style={{ ...eyebrow }}>COMPONENTI · LIGHT + DARK</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
          <Gallery mode="light" />
          <Gallery mode="dark" />
        </div>
      </div>
    </div>
  );
}
