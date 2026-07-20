'use client';

/**
 * Gimmick · Obsidian — Panopticon view (knowledge graph).
 *
 * "Flocky vede l'intero grafo dei tile dall'alto": tag hubs + tile nodes joined
 * by hairline edges. Reference: GimmickPanopticon.dc.html. Node colors map to
 * the canonical type/semantic scale; the layout is deterministic (seeded PRNG
 * ported verbatim from the DC so it matches pixel-for-pixel). Self-contained —
 * drop into the shell's ViewContainer with `hideToolbar`.
 */
import * as React from 'react';
import { IconZoomIn, IconZoomOut, IconMaximize, IconAdjustmentsHorizontal } from '@tabler/icons-react';
import { IconButton, SegmentedControl } from '@/components/primitives';
import { Beniamino } from '@/components/mascot';
import { Icon } from '@/components/shell';

// ─── Node palette → token CSS vars ────────────────────────────────────────────
type NodeType = 'blue' | 'grey' | 'green' | 'amber' | 'red' | 'violet';
const NODE_VAR: Record<NodeType, string> = {
  blue: 'var(--node-blue)',
  grey: 'var(--node-grey)',
  green: 'var(--node-green)',
  amber: 'var(--node-amber)',
  red: 'var(--node-red)',
  violet: 'var(--node-violet)',
};

interface GNode { x: number; y: number; r: number; t: NodeType; sq?: boolean }
interface GEdge { x1: number; y1: number; x2: number; y2: number; hub?: boolean }
interface GHub { x: number; y: number; r: number; t: NodeType; name: string }

// ─── Deterministic graph builder (verbatim from the DC) ───────────────────────
function buildGraph(W: number, H: number): { nodes: GNode[]; edges: GEdge[]; hubs: GHub[] } {
  let seed = 20260627;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const gauss = () => (rnd() + rnd() + rnd() - 1.5) / 1.5;
  const cx = W * 0.46, cy = H * 0.5;
  const types: Array<[NodeType, number]> = [['blue', 0.4], ['grey', 0.3], ['green', 0.12], ['amber', 0.1], ['red', 0.08]];
  const pickType = (): NodeType => { let r = rnd(); for (const [t, p] of types) { if ((r -= p) <= 0) return t; } return 'blue'; };
  const clampX = (x: number) => Math.max(26, Math.min(W - 26, x));
  const clampY = (y: number) => Math.max(22, Math.min(H - 22, y));
  const hubsDef: Array<{ name: string; t: NodeType; ang: number; dist: number; n: number }> = [
    { name: 'GOLFO DEL SOLE', t: 'violet', ang: -0.5, dist: 0.30, n: 52 },
    { name: 'ORTANO MARE', t: 'blue', ang: 0.55, dist: 0.40, n: 44 },
    { name: 'MONEY', t: 'green', ang: 1.65, dist: 0.34, n: 24 },
    { name: 'FAMIGLIA', t: 'amber', ang: 2.55, dist: 0.40, n: 30 },
    { name: 'CONTRATTI', t: 'red', ang: 3.4, dist: 0.32, n: 20 },
    { name: 'CASA', t: 'grey', ang: 4.25, dist: 0.42, n: 34 },
    { name: 'IDEE', t: 'violet', ang: 5.2, dist: 0.30, n: 26 },
  ];
  const R = Math.min(W, H);
  const nodes: GNode[] = [], edges: GEdge[] = [], hubs: GHub[] = [];
  hubs.push({ x: cx, y: cy, r: 17, t: 'violet', name: 'GIMMICK' });
  hubsDef.forEach((hd) => {
    const hx = clampX(cx + Math.cos(hd.ang) * hd.dist * R);
    const hy = clampY(cy + Math.sin(hd.ang) * hd.dist * R * 0.86);
    hubs.push({ x: hx, y: hy, r: 11, t: hd.t, name: hd.name });
    edges.push({ x1: cx, y1: cy, x2: hx, y2: hy, hub: true });
    for (let i = 0; i < hd.n; i++) {
      const a = rnd() * Math.PI * 2;
      const dd = (0.12 + Math.abs(gauss()) * 0.9) * 0.16 * R;
      const nx = clampX(hx + Math.cos(a) * dd);
      const ny = clampY(hy + Math.sin(a) * dd);
      const sub = rnd() < 0.08;
      const n: GNode = { x: nx, y: ny, r: sub ? 7 + rnd() * 3 : 3 + rnd() * 3, t: rnd() < 0.6 ? hd.t : pickType(), sq: rnd() < 0.34 };
      nodes.push(n);
      edges.push({ x1: hx, y1: hy, x2: nx, y2: ny });
      if (sub) {
        const m = 2 + Math.floor(rnd() * 4);
        for (let k = 0; k < m; k++) {
          const a2 = rnd() * Math.PI * 2; const d2 = 14 + rnd() * 30;
          const mx = clampX(nx + Math.cos(a2) * d2); const my = clampY(ny + Math.sin(a2) * d2);
          nodes.push({ x: mx, y: my, r: 3 + rnd() * 2, t: rnd() < 0.5 ? n.t : pickType(), sq: rnd() < 0.34 });
          edges.push({ x1: nx, y1: ny, x2: mx, y2: my });
        }
      }
    }
  });
  for (let i = 0; i < 34; i++) {
    const a = rnd() * Math.PI * 2; const dd = 16 + Math.abs(gauss()) * 46;
    const nx = clampX(cx + Math.cos(a) * dd), ny = clampY(cy + Math.sin(a) * dd);
    nodes.push({ x: nx, y: ny, r: 3 + rnd() * 3, t: pickType(), sq: rnd() < 0.34 });
    edges.push({ x1: cx, y1: cy, x2: nx, y2: ny });
  }
  return { nodes, edges, hubs };
}

const GW = 1318, GH = 736;

function Graph() {
  const { nodes, edges, hubs } = React.useMemo(() => buildGraph(GW, GH), []);
  return (
    <svg className="ob-pan__graph" width={GW} height={GH} viewBox={`0 0 ${GW} ${GH}`}>
      {/* edges */}
      <g>
        {edges.map((e, i) => (
          <line key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke="var(--ob-edge)" strokeWidth={e.hub ? 1.1 : 0.6} />
        ))}
      </g>
      {/* nodes */}
      <g>
        {nodes.map((n, i) => {
          const v = NODE_VAR[n.t];
          const fill = `color-mix(in srgb, ${v} 32%, transparent)`;
          if (n.sq) {
            const s = n.r * 1.8;
            return <rect key={i} x={n.x - s / 2} y={n.y - s / 2} width={s} height={s} rx={2.2} style={{ fill, stroke: v }} strokeWidth={1} />;
          }
          return <circle key={i} cx={n.x} cy={n.y} r={n.r} style={{ fill, stroke: v }} strokeWidth={1} />;
        })}
      </g>
      {/* hubs */}
      <g>
        {hubs.map((hb, i) => {
          const v = NODE_VAR[hb.t];
          return (
            <g key={i}>
              <circle cx={hb.x} cy={hb.y} r={hb.r} style={{ fill: `color-mix(in srgb, ${v} 18%, transparent)`, stroke: v }} strokeWidth={1.6} />
              <circle cx={hb.x} cy={hb.y} r={Math.max(2.4, hb.r * 0.26)} style={{ fill: v }} />
            </g>
          );
        })}
      </g>
      {/* hub labels */}
      <g>
        {hubs.map((hb, i) => (
          <g key={i}>
            <rect
              x={hb.x - (hb.name.length * 3.1 + 7)}
              y={hb.y + hb.r + 4}
              width={hb.name.length * 6.2 + 14}
              height={16}
              rx={4}
              style={{ fill: 'var(--ob-pan-label-bg)', stroke: 'var(--ob-line)' }}
            />
            <text
              x={hb.x}
              y={hb.y + hb.r + 15}
              textAnchor="middle"
              style={{ fill: 'var(--ob-text)', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em' }}
            >
              {hb.name}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}

const LEGEND: Array<{ t: NodeType; label: string }> = [
  { t: 'blue', label: 'Evento' },
  { t: 'green', label: 'Programmato' },
  { t: 'red', label: 'Scadenza' },
  { t: 'grey', label: 'Nota' },
  { t: 'amber', label: 'File' },
];

export function PanopticonView() {
  const [mode, setMode] = React.useState('navigate');
  return (
    <div className="ob-pan">
      {/* Header */}
      <div className="ob-pan__header">
        <span className="ob-pan__header-mascot"><Beniamino name="flocky" size={26} title="" /></span>
        <div>
          <div className="ob-pan__header-title">Panopticon</div>
          <div className="ob-pan__header-sub">Flocky vede l’intero grafo dei tile dall’alto</div>
        </div>
        <div style={{ flex: 1 }} />
        <span className="ob-pan__header-meta">GIMMICK · vista a grafo</span>
      </div>

      {/* Toolbar */}
      <div className="ob-pan__toolbar">
        <SegmentedControl
          value={mode}
          onChange={setMode}
          items={[
            { value: 'navigate', label: <><Icon name="send" size={13} /> Navigate</> },
            { value: 'edit', label: <><Icon name="edit" size={13} /> Edit tag</> },
          ]}
        />
        <div className="ob-pan__div" />
        <button type="button" className="ob-pan__dd">
          <span className="ob-pan__dd-icon"><Icon name="filter" size={13} /></span>Filtri
          <span className="ob-pan__dd-icon"><Icon name="chevD" size={12} /></span>
        </button>
        <button type="button" className="ob-pan__dd">
          <span className="ob-pan__dd-icon"><Icon name="tags" size={13} /></span>Tag
          <span className="ob-pan__dd-icon"><Icon name="chevD" size={12} /></span>
        </button>
        <div style={{ flex: 1 }} />
        <span className="ob-pan__meta">248 tile · 38 tag</span>
      </div>

      {/* Canvas */}
      <div className="ob-pan__canvas">
        <div className="ob-pan__graph-wrap"><Graph /></div>

        <div className="ob-pan__zoom">
          <IconButton aria-label="Zoom avanti" solid><IconZoomIn size={15} stroke={1.6} /></IconButton>
          <IconButton aria-label="Zoom indietro" solid><IconZoomOut size={15} stroke={1.6} /></IconButton>
          <IconButton aria-label="Adatta" solid><IconMaximize size={15} stroke={1.6} /></IconButton>
          <IconButton aria-label="Impostazioni grafo" solid><IconAdjustmentsHorizontal size={15} stroke={1.6} /></IconButton>
        </div>

        <div className="ob-pan__legend">
          {LEGEND.map((l) => (
            <div key={l.t} className="ob-pan__legend-row">
              <span className="ob-pan__legend-dot" style={{ background: NODE_VAR[l.t] }} />
              <span className="ob-pan__legend-label">{l.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
