'use client';

/**
 * Gimmick · Obsidian — Canvas view.
 *
 * "Surfer dispone i tile nello spazio": a left Staging panel + a dotted board
 * of tile nodes joined by dashed edges. Reference: GimmickCanvas.dc.html.
 * Tile fill = Tint; cap/tag colors from the canonical `--ob-type-*` scale.
 * Self-contained — drop into the shell's ViewContainer with `hideToolbar`.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { IconPhoto, IconFileText } from '@tabler/icons-react';
import { Beniamino } from '@/components/mascot';
import { Icon } from '@/components/shell';

// ─── Cap glyphs (canvas spark chips) ──────────────────────────────────────────
type CapKind = 'photo' | 'image' | 'file' | 'doc' | 'text' | 'voice';
const CAP_COLOR: Record<CapKind, string> = {
  photo: 'var(--ob-type-photo)',
  image: 'var(--ob-type-photo)',
  file: 'var(--ob-type-file)',
  doc: 'var(--ob-type-text)',
  text: 'var(--ob-type-text)',
  voice: 'var(--ob-type-voice)',
};
function CapGlyph({ kind }: { kind: CapKind }) {
  if (kind === 'image') return <IconPhoto size={12} stroke={1.6} />;
  if (kind === 'doc') return <IconFileText size={12} stroke={1.6} />;
  return <Icon name={kind} size={12} />;
}

function SparkRow({ caps, meta }: { caps: CapKind[]; meta?: string }) {
  return (
    <div className="ob-canvas__sparkrow">
      {caps.map((c, i) => (
        <span key={i} className="ob-canvas__cap" style={{ ['--cap-c' as string]: CAP_COLOR[c] }}>
          <CapGlyph kind={c} />
        </span>
      ))}
      <div style={{ flex: 1 }} />
      {meta && <span className="ob-canvas__meta">{meta}</span>}
    </div>
  );
}

interface TileData {
  id: string;
  title: string;
  caps?: CapKind[];
  meta?: string;
  amber?: boolean;
  sel?: boolean;
}
interface CanvasNode extends TileData { x: number; y: number; w: number }
interface CanvasLink { from: string; to: string; sy?: number; ty?: number }

function cardColor(t: TileData) {
  return t.amber ? 'var(--ob-type-file)' : 'var(--ob-accent)';
}

function Card({
  t, clamp, style,
}: { t: TileData; clamp?: boolean; style?: React.CSSProperties }) {
  return (
    <div
      className={cn('ob-canvas__card', t.sel && 'ob-canvas__card--sel')}
      style={{ ['--card-c' as string]: cardColor(t), ...style }}
    >
      <div className={cn('ob-canvas__card-title', clamp && 'ob-canvas__card-title--clamp')}>{t.title}</div>
      {t.caps && <SparkRow caps={t.caps} meta={t.meta} />}
    </div>
  );
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const STAGE_TILES: TileData[] = [
  { id: 's1', title: 'OM/meeting Le Ville OM', caps: ['photo'], meta: '1' },
  { id: 's2', title: 'OM inviare foto ad Ilaria', caps: ['file'], meta: '1', amber: true },
  { id: 's3', title: 'GDS/meeting VP ville 2026', caps: ['photo', 'doc'], meta: '2', sel: true },
  { id: 's4', title: 'Restyling Tabellina Prezzi…', caps: ['file'], meta: '1', amber: true },
];

const NODES: CanvasNode[] = [
  { id: 'dafare', title: 'Da fare', x: 70, y: 150, w: 150 },
  { id: 'rendering', title: 'Rendering', x: 350, y: 60, w: 160, caps: ['image'], meta: '4' },
  { id: 'excel', title: 'Excel raccolta dati', x: 350, y: 230, w: 160, caps: ['file'], meta: '4' },
  { id: 'ppt', title: 'PPT di sintesi', x: 600, y: 230, w: 160, caps: ['doc'], meta: '1' },
  { id: 'prog', title: 'Programmazione lavori', x: 450, y: 410, w: 175, caps: ['text'], meta: '2' },
  { id: 'contratti', title: 'Contratti', x: 450, y: 590, w: 165 },
  { id: 'contr1', title: 'Contratto contractor: OM/Ciesse', x: 700, y: 520, w: 175, caps: ['file'], meta: '5', amber: true },
  { id: 'contr2', title: 'Contratto: Subappaltatori Ciesse', x: 700, y: 670, w: 175, caps: ['file'], meta: '2', amber: true },
];
const LINKS: CanvasLink[] = [
  { from: 'dafare', to: 'rendering', sy: 45, ty: 32 },
  { from: 'dafare', to: 'excel', sy: 45, ty: 32 },
  { from: 'excel', to: 'ppt', sy: 32, ty: 32 },
  { from: 'contratti', to: 'contr1', sy: 32, ty: 32 },
  { from: 'contratti', to: 'contr2', sy: 32, ty: 32 },
];

function Edges({ nodes, links }: { nodes: CanvasNode[]; links: CanvasLink[] }) {
  const byId = React.useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);
  return (
    <svg className="ob-canvas__edges" width={1180} height={880}>
      {links.map((l, i) => {
        const a = byId[l.from], b = byId[l.to];
        if (!a || !b) return null;
        const sx = a.x + a.w, sy = a.y + (l.sy ?? 32);
        const tx = b.x, ty = b.y + (l.ty ?? 32);
        const d = `M${sx},${sy} C${sx + 40},${sy} ${tx - 40},${ty} ${tx},${ty}`;
        return <path key={i} d={d} fill="none" stroke="var(--ob-edge)" strokeWidth={1.3} strokeDasharray="4 4" />;
      })}
    </svg>
  );
}

// ─── Toolbar ──────────────────────────────────────────────────────────────────
function ToolBtn({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button type="button" className="ob-canvas__toolbtn">
      <span className="ob-canvas__toolbtn-icon">{icon}</span>
      {label}
    </button>
  );
}

const FILE_TABS = ['OM le ville 26/27', 'GDS_Report', 'OM Report'];

export interface CanvasViewProps {
  nodes?: CanvasNode[];
  links?: CanvasLink[];
  stageTiles?: TileData[];
}

export function CanvasView({ nodes = NODES, links = LINKS, stageTiles = STAGE_TILES }: CanvasViewProps) {
  return (
    <div className="ob-canvas">
      {/* Header */}
      <div className="ob-canvas__header">
        <span className="ob-canvas__header-mascot"><Beniamino name="surfer" size={26} title="" /></span>
        <div>
          <div className="ob-canvas__header-title">Canvas</div>
          <div className="ob-canvas__header-sub">Surfer dispone i tile nello spazio</div>
        </div>
        <div style={{ flex: 1 }} />
        <span className="ob-canvas__header-meta">GIMMICK · {nodes.length} tile sul canvas</span>
      </div>

      <div className="ob-canvas__body">
        {/* Staging */}
        <aside className="ob-canvas__stage">
          <div className="ob-canvas__stage-head">
            <Icon name="collapse" size={15} color="var(--ob-muted)" style={{ color: 'var(--ob-muted)' }} />
            <span className="ob-canvas__stage-label">STAGING</span>
            <span className="ob-canvas__stage-count">{stageTiles.length}</span>
          </div>
          <div className="ob-canvas__stage-group">
            <span className="ob-canvas__stage-group-label">NESSUN GRUPPO</span>
            <Icon name="chevD" size={12} />
            <Icon name="sort" size={12} />
          </div>
          <div className="ob-canvas__stage-list ob-scroll">
            {stageTiles.map((t) => <Card key={t.id} t={t} clamp />)}
          </div>
        </aside>

        {/* Main: toolbar + board */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div className="ob-canvas__toolbar">
            {FILE_TABS.map((label, i) => (
              <div key={label} className={cn('ob-canvas__tab', i === 0 && 'ob-canvas__tab--active')}>
                <span className="ob-canvas__tab-dot" />
                {label}
              </div>
            ))}
            <div className="ob-canvas__toolbar-spacer" />
            <div className="ob-canvas__tools">
              <ToolBtn icon={<Icon name="tiles" size={13} />} label="Tile" />
              <ToolBtn icon={<Icon name="text" size={13} />} label="Testo" />
              <ToolBtn icon={<IconPhoto size={13} stroke={1.6} />} label="Image" />
              <div className="ob-canvas__tooldiv" />
              <ToolBtn icon={<Icon name="panopticon" size={13} />} label="Fit" />
              <div className="ob-canvas__zoom">100%</div>
            </div>
          </div>

          <div className="ob-canvas__board ob-scroll">
            <div className="ob-canvas__board-inner">
              <Edges nodes={nodes} links={links} />
              {nodes.map((n) => (
                <div key={n.id} className="ob-canvas__node" style={{ left: n.x, top: n.y, width: n.w }}>
                  <Card t={n} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
