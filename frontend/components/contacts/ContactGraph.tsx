'use client';

/**
 * Gimmick · Contatti — LA VISTA A GRAFO.
 *
 * La tabella risponde a «chi c'è». Questa risponde a «come sono messi»: Giovanni
 * sta nell'Ufficio lavori pubblici, che sta nel Comune di Grosseto. Sono due
 * domande diverse sugli stessi dati, e la seconda in una tabella non si legge —
 * la colonna «Appartiene a» dice il primo passo e tace sul secondo.
 *
 * ⚠️ È un GRAFO ORIENTATO E ACICLICO, non un albero: `contact_organizations` non
 * vieta a un contatto di appartenere a due organizzazioni insieme (uno studio e
 * un consorzio), quindi un nodo può avere più genitori. Per questo il livello di
 * un nodo è il CAMMINO PIÙ LUNGO dalla radice e non «la profondità»: con due
 * genitori a livelli diversi, un nodo deve stare sotto il più basso dei due,
 * altrimenti una delle due linee andrebbe all'insù.
 *
 * I cicli invece sono vietati QUI e non dallo schema (che ferma solo
 * l'auto-appartenenza): un ciclo non ha un livello, e la disposizione non
 * finirebbe mai di cercarlo.
 *
 * ── Le due zone ────────────────────────────────────────────────────────────
 * A SINISTRA i non collegati, in una colonna che scorre. Sono la maggioranza —
 * dei contatti in rubrica quasi nessuno ha un'appartenenza — e messi nel
 * disegno sarebbero trenta puntini appoggiati alla prima riga, che affollano il
 * grafo senza dirne niente. In colonna sono un magazzino, e insieme il punto da
 * cui si parte per collegarli.
 * A DESTRA il grafo, che si sposta e si ingrandisce.
 *
 * ── Che cosa si può fare col mouse ─────────────────────────────────────────
 *   · trascinare un nodo dalla COLONNA su un'organizzazione → ne diventa membro
 *   · trascinare un NODO del grafo → lo sposta; sopra un'organizzazione ne
 *     diventa membro, sulla colonna esce da tutte
 *   · trascinare il CAPO di una linea attaccato all'organizzazione → lo porta su
 *     un'altra (l'appartenenza si sposta) o nel vuoto (si stacca)
 *   · rotella o pulsanti → ingrandisce; trascinando il fondo → sposta la vista
 *
 * Le posizioni non si salvano: questa è una vista sui dati, non una lavagna. A
 * decidere dove sta un nodo è la struttura, e la struttura si cambia spostando
 * le linee — che è l'unica cosa qui dentro che scrive davvero qualcosa.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { toast } from 'sonner';
import { IconUser, IconBuilding, IconPlus, IconMinus, IconFocusCentered } from '@tabler/icons-react';
import { usePixelTheme } from '@/components/pixel';
import { OB_TEXT } from '@/lib/theme/ob-typography';
import { isOrganizationKind } from '@/types/contact';
import type { Contact } from '@/types/contact';
import type { ContactMembership } from '@/lib/hooks/useContacts';

/** Gronda attorno al disegno. */
const PAD = 40;
/** Distanza verticale fra un livello e quello sotto. */
const LEVEL_H = 96;
/** Raggio del nodo: il cerchio del soggetto e il mezzo-lato del quadrato
 *  dell'organizzazione sono lo STESSO numero, così le linee arrivano alla
 *  stessa distanza dal centro e le due forme si incolonnano. */
const R = 13;
/** Quanto vicino al centro di un nodo deve stare il puntatore perché il nodo
 *  conti come bersaglio, in pixel di SCHERMO: diviso per l'ingrandimento
 *  diventa una distanza nelle coordinate del disegno, così la mira resta
 *  ugualmente comoda a qualunque zoom. */
const HIT = 24;
/** La colonna dei non collegati. */
const COL_W = 198;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 2.5;

type Pt = { x: number; y: number };
type Node = Contact & { org: boolean; level: number; x: number; y: number };
type Link = { member: string; org: string };
type View = { k: number; x: number; y: number };

/** Che cosa si sta trascinando. */
type Drag =
  /** Un nodo. `loose` quando viene dalla colonna: non ha una posizione nel
   *  disegno, quindi lo segue un fantasma sotto il puntatore. */
  | { kind: 'node'; id: string; grab: Pt; loose: boolean }
  /** Il capo della linea attaccato all'ORGANIZZAZIONE. L'altro capo non si
   *  stacca: una linea è «X fa parte di Y» e cambiare X ne farebbe un'altra. */
  | { kind: 'edge'; member: string; org: string }
  | null;

export interface ContactGraphProps {
  contacts: Contact[];
  memberships: ContactMembership[];
  /** Sostituisce l'INSIEME delle organizzazioni di un contatto: è la forma
   *  dell'endpoint, e qui si passa sempre l'insieme già ricalcolato. */
  onSetOrganizations: (memberId: string, orgIds: string[]) => void;
  /** Il testo della barra: qui non filtra, ACCENDE. Togliere nodi da un grafo
   *  ne toglie anche le linee, e resterebbe un disegno che afferma cose false
   *  su ciò che resta. */
  query: string;
  height: number | string;
}

export function ContactGraph({
  contacts, memberships, onSetOrganizations, query, height,
}: ContactGraphProps) {
  const theme = usePixelTheme();
  const boxRef = useRef<HTMLDivElement>(null);
  const colRef = useRef<HTMLElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [view, setView] = useState<View>({ k: 1, x: 0, y: 0 });
  const [drag, setDrag] = useState<Drag>(null);
  /** Il puntatore nelle coordinate del DISEGNO, non dello schermo. */
  const [pointer, setPointer] = useState<Pt | null>(null);
  /** Il puntatore è sulla colonna? Lasciarci un nodo lo scollega da tutto. */
  const [overCol, setOverCol] = useState(false);
  const [hoverId, setHoverId] = useState<string | null>(null);
  /** La linea sotto il puntatore, per mostrarne la maniglia. In stato e non
   *  scritta a mano nel DOM: React ridisegna a ogni movimento del puntatore, e
   *  un attributo cambiato di nascosto verrebbe rimesso a posto un istante
   *  dopo — la maniglia sparirebbe proprio mentre la si sta puntando. */
  const [hoverEdge, setHoverEdge] = useState<string | null>(null);
  /** Spostamenti fatti a mano, per nodo. Vivono quanto la finestra: sono un
   *  modo di guardare, non un dato. */
  const [moved, setMoved] = useState<Record<string, Pt>>({});
  /** L'ultima posizione calcolata di ogni nodo, per far ripartire il calcolo da
   *  lì: senza, ogni cambio di appartenenza rimescolerebbe tutto il disegno e
   *  si perderebbe di vista il nodo che si stava guardando. */
  const seeds = useRef<Record<string, Pt>>({});

  useLayoutEffect(() => {
    const el = svgRef.current?.parentElement;
    if (!el) return;
    const read = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver(read);
    ro.observe(el);
    read();
    return () => ro.disconnect();
  }, []);

  // ── LO ZOOM ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const z = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([ZOOM_MIN, ZOOM_MAX])
      // ⚠️ Estensione ESPLICITA. Quella predefinita di d3-zoom legge
      // `svg.width.baseVal.value`, che su un SVG dimensionato dal CSS è una
      // lunghezza relativa e non si risolve: `NotSupportedError` al primo
      // gesto. Il rettangolo vero lo sa il DOM, e glielo diciamo. (Qui la
      // larghezza è anche un attributo, ma la regola vale lo stesso: è già
      // costata un errore in produzione sulla lavagna.)
      .extent((): [[number, number], [number, number]] => {
        const r = svg.getBoundingClientRect();
        return [[0, 0], [r.width, r.height]];
      })
      .filter((ev: MouseEvent | WheelEvent) => {
        if (ev.type === 'wheel') return true;
        // Partendo da un nodo o da una maniglia si trascina QUELLO, non la
        // vista: senza il filtro, spostare un nodo trascinerebbe anche il fondo
        // sotto di lui e il nodo resterebbe fermo rispetto al disegno.
        if ((ev.target as Element | null)?.closest?.('[data-grab]')) return false;
        return !('button' in ev) || ev.button === 0;
      })
      .on('zoom', (ev: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        const t = ev.transform;
        setView({ k: t.k, x: t.x, y: t.y });
      });
    d3.select(svg).call(z);
    zoomRef.current = z;
    return () => { d3.select(svg).on('.zoom', null); };
  }, []);

  const zoomBy = (f: number) => {
    const svg = svgRef.current, z = zoomRef.current;
    if (svg && z) z.scaleBy(d3.select<SVGSVGElement, unknown>(svg), f);
  };

  // ── LA STRUTTURA ─────────────────────────────────────────────────────────
  const byId = useMemo(() => new Map(contacts.map((c) => [c.id, c])), [contacts]);

  /** Le organizzazioni di ciascuno. Solo coppie in cui ESISTONO tutti e due i
   *  capi: un'appartenenza a un contatto cancellato altrove disegnerebbe una
   *  linea verso il nulla. */
  const parents = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const { member_id, org_id } of memberships) {
      if (!byId.has(member_id) || !byId.has(org_id) || member_id === org_id) continue;
      m.set(member_id, [...(m.get(member_id) ?? []), org_id]);
    }
    return m;
  }, [memberships, byId]);

  const links = useMemo<Link[]>(
    () => [...parents.entries()].flatMap(([member, orgs]) => orgs.map((org) => ({ member, org }))),
    [parents],
  );

  /** Y appartiene a X? Risalita fra i genitori, con guardia sui cicli. Serve
   *  prima di ogni collegamento nuovo: aggiungere «A fa parte di B» chiude un
   *  anello se B, risalendo, arriva ad A. */
  const belongsTo = useCallback((from: string, target: string): boolean => {
    const seen = new Set<string>();
    const stack = [from];
    while (stack.length) {
      const cur = stack.pop()!;
      if (cur === target) return true;
      if (seen.has(cur)) continue;
      seen.add(cur);
      stack.push(...(parents.get(cur) ?? []));
    }
    return false;
  }, [parents]);

  /** Il LIVELLO: 0 chi non appartiene a nessuno, altrimenti uno sotto il più
   *  basso dei suoi genitori. Memoizzato, e con la stessa guardia sui cicli —
   *  se i dati ne contenessero uno (scritto da un'altra strada) il disegno
   *  regge lo stesso invece di piantarsi. */
  const levels = useMemo(() => {
    const out = new Map<string, number>();
    const walking = new Set<string>();
    const of = (id: string): number => {
      const done = out.get(id);
      if (done !== undefined) return done;
      if (walking.has(id)) return 0;
      walking.add(id);
      const ps = parents.get(id) ?? [];
      const lv = ps.length === 0 ? 0 : 1 + Math.max(...ps.map(of));
      walking.delete(id);
      out.set(id, lv);
      return lv;
    };
    for (const c of contacts) of(c.id);
    return out;
  }, [contacts, parents]);

  /** Chi ha almeno una linea: sono questi a fare il grafo. */
  const wired = useMemo(() => {
    const s = new Set<string>();
    for (const l of links) { s.add(l.member); s.add(l.org); }
    return s;
  }, [links]);

  /** I non collegati, in colonna. In alfabeto: è un elenco da consultare, e
   *  quello è l'unico ordine in cui si trova un nome che si sta cercando. */
  const loose = useMemo(
    () => contacts.filter((c) => !wired.has(c.id)).sort((a, b) => a.name.localeCompare(b.name)),
    [contacts, wired],
  );

  // ── LA DISPOSIZIONE ──────────────────────────────────────────────────────
  const nodes = useMemo<Node[]>(() => {
    const inGraph = contacts.filter((c) => wired.has(c.id));
    if (size.w <= 0 || inGraph.length === 0) return [];

    // La Y la decide il livello (fissata, `fy`), la X la trova la simulazione.
    // Le linee tirano verso l'incolonnamento, `collide` tiene i nodi staccati,
    // `forceX` impedisce che un ramo scivoli via per conto suo.
    type Sim = d3.SimulationNodeDatum & { id: string; fy: number };
    const cx = size.w / 2;
    const sim: Sim[] = inGraph.map((c) => {
      const lv = levels.get(c.id) ?? 0;
      const seed = seeds.current[c.id];
      return {
        id: c.id,
        x: seed?.x ?? cx + (Math.random() - 0.5) * Math.min(size.w * 0.6, 400),
        y: PAD + lv * LEVEL_H,
        fy: PAD + lv * LEVEL_H,
      };
    });
    const idx = new Map(sim.map((n) => [n.id, n]));
    const simLinks = links
      .filter((l) => idx.has(l.member) && idx.has(l.org))
      .map((l) => ({ source: l.member, target: l.org }));

    d3.forceSimulation<Sim>(sim)
      .force('link', d3.forceLink<Sim, { source: string; target: string }>(simLinks)
        .id((d) => d.id).distance(LEVEL_H).strength(0.5))
      .force('x', d3.forceX<Sim>(cx).strength(0.03))
      .force('collide', d3.forceCollide<Sim>(R * 2.6))
      .stop()
      // A colpi, non animata: il disegno appare fermo. Un'animazione qui
      // sarebbe un balletto a ogni cambio di appartenenza, sotto il dito di chi
      // ha appena spostato una linea.
      .tick(280);

    const minX = PAD + R;
    const maxX = Math.max(minX + 1, size.w - PAD - R);
    return inGraph.map((c) => {
      const s = idx.get(c.id)!;
      const p = { x: Math.min(maxX, Math.max(minX, s.x ?? cx)), y: s.fy };
      seeds.current[c.id] = p;
      return { ...c, org: isOrganizationKind(c.kind), level: levels.get(c.id) ?? 0, ...p };
    });
  }, [contacts, links, levels, wired, size.w]);

  const pos = useMemo(() => {
    const m = new Map<string, Pt>();
    for (const n of nodes) m.set(n.id, moved[n.id] ?? { x: n.x, y: n.y });
    if (drag?.kind === 'node' && !drag.loose && pointer) {
      m.set(drag.id, { x: pointer.x - drag.grab.x, y: pointer.y - drag.grab.y });
    }
    return m;
  }, [nodes, moved, drag, pointer]);

  // Cambiando la forma del grafo gli spostamenti a mano decadono: erano
  // aggiustamenti su una disposizione che non c'è più.
  const shape = links.map((l) => `${l.member}>${l.org}`).sort().join('|');
  useEffect(() => { setMoved({}); }, [shape]);

  // ── I BERSAGLI ───────────────────────────────────────────────────────────
  const movingId = drag?.kind === 'node' ? drag.id : drag?.kind === 'edge' ? drag.member : null;

  /** Un nodo può ricevere il trascinamento in corso? */
  const canDrop = useCallback((n: Node): boolean => {
    if (!movingId || n.id === movingId || !n.org) return false;
    if (drag?.kind === 'edge' && n.id === drag.org) return false;
    if (drag?.kind === 'node' && (parents.get(movingId) ?? []).includes(n.id)) return false;
    // L'anello: se il bersaglio, risalendo, arriva a chi si sta spostando.
    return !belongsTo(n.id, movingId);
  }, [movingId, drag, parents, belongsTo]);

  /** Il nodo sotto il puntatore che può ricevere il trascinamento. */
  const target = useMemo(() => {
    if (!drag || !pointer || overCol) return null;
    let best: Node | null = null;
    // Il raggio di mira è costante sullo SCHERMO: rimpicciolito il disegno,
    // servirebbe altrimenti una precisione che a quel corpo non si ha.
    let bestD = (HIT / view.k) ** 2;
    for (const n of nodes) {
      if (!canDrop(n)) continue;
      const p = pos.get(n.id)!;
      const d = (p.x - pointer.x) ** 2 + (p.y - pointer.y) ** 2;
      if (d < bestD) { bestD = d; best = n; }
    }
    return best;
  }, [drag, pointer, overCol, nodes, pos, canDrop, view.k]);

  /** La colonna accetta il nodo che si sta trascinando? Solo se ha qualcosa da
   *  perdere: lasciarci un nodo che non appartiene a niente non farebbe nulla,
   *  e accendere una zona che non fa nulla è peggio che non accenderla. */
  const colTakes = drag?.kind === 'node' && !drag.loose && (parents.get(drag.id)?.length ?? 0) > 0;

  // ── IL MOUSE ─────────────────────────────────────────────────────────────
  /** Dal punto dello schermo alle coordinate del disegno. */
  const at = useCallback((e: React.PointerEvent): Pt => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left - view.x) / view.k, y: (e.clientY - r.top - view.y) / view.k };
  }, [view]);

  /** La cattura sta sul CONTENITORE e non sull'elemento premuto: si comincia a
   *  trascinare da una riga della colonna (HTML) o da un nodo (SVG), e gli
   *  eventi devono continuare ad arrivare qui in tutti e due i casi. */
  const capture = (e: React.PointerEvent) => boxRef.current?.setPointerCapture(e.pointerId);

  const startNode = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    capture(e);
    const p = at(e);
    const from = pos.get(id)!;
    setPointer(p);
    setDrag({ kind: 'node', id, grab: { x: p.x - from.x, y: p.y - from.y }, loose: false });
  };

  const startLoose = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    capture(e);
    setPointer(at(e));
    // Nessuno scarto: il nodo che arriva dalla colonna nasce sotto il puntatore.
    setDrag({ kind: 'node', id, grab: { x: 0, y: 0 }, loose: true });
  };

  const startEdge = (e: React.PointerEvent, l: Link) => {
    e.stopPropagation();
    capture(e);
    setPointer(at(e));
    setDrag({ kind: 'edge', member: l.member, org: l.org });
  };

  const move = (e: React.PointerEvent) => {
    if (!drag) return;
    setPointer(at(e));
    const r = colRef.current?.getBoundingClientRect();
    setOverCol(!!r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom);
  };

  const stop = () => { setDrag(null); setPointer(null); setOverCol(false); };

  const finish = () => {
    if (!drag) return;
    const hit = target;

    if (drag.kind === 'node') {
      if (hit) {
        // Si AGGIUNGE: un contatto può stare in due organizzazioni, e
        // trascinarlo sulla seconda non deve fargli lasciare la prima. Per
        // SPOSTARE un'appartenenza si trascina la linea.
        onSetOrganizations(drag.id, [...(parents.get(drag.id) ?? []), hit.id]);
      } else if (overCol && colTakes) {
        onSetOrganizations(drag.id, []);
        toast.success(`${byId.get(drag.id)?.name ?? 'Contatto'} non fa più parte di nessuna organizzazione`);
      } else if (pointer && !drag.loose) {
        // Nessun bersaglio: era solo un modo di riordinare il disegno.
        setMoved((m) => ({ ...m, [drag.id]: { x: pointer.x - drag.grab.x, y: pointer.y - drag.grab.y } }));
      }
    } else {
      const now = parents.get(drag.member) ?? [];
      const next = hit
        ? [...now.filter((o) => o !== drag.org), hit.id]
        : now.filter((o) => o !== drag.org);
      if (!hit) {
        toast.success(`${byId.get(drag.member)?.name ?? 'Contatto'} non fa più parte di ${byId.get(drag.org)?.name ?? 'quella organizzazione'}`);
      }
      onSetOrganizations(drag.member, next);
    }
    stop();
  };

  // Esc annulla: si lascia il tasto dove capita e non è successo niente.
  useEffect(() => {
    if (!drag) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') stop(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drag]);

  const fit = () => {
    const svg = svgRef.current, z = zoomRef.current;
    if (!svg || !z || nodes.length === 0) return;
    const pts = nodes.map((n) => pos.get(n.id)!);
    const x1 = Math.min(...pts.map((p) => p.x)) - PAD;
    const x2 = Math.max(...pts.map((p) => p.x)) + PAD;
    const y1 = Math.min(...pts.map((p) => p.y)) - PAD;
    const y2 = Math.max(...pts.map((p) => p.y)) + PAD;
    const r = svg.getBoundingClientRect();
    const k = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.min(r.width / (x2 - x1), r.height / (y2 - y1))));
    z.transform(
      d3.select<SVGSVGElement, unknown>(svg),
      d3.zoomIdentity
        .translate((r.width - (x2 - x1) * k) / 2 - x1 * k, (r.height - (y2 - y1) * k) / 2 - y1 * k)
        .scale(k),
    );
  };

  // ── L'EVIDENZA ───────────────────────────────────────────────────────────
  const q = query.trim().toLowerCase();
  /** L'intorno del nodo sotto il puntatore: lui, le sue organizzazioni, i suoi
   *  membri. Serve a leggere UNA appartenenza in un disegno che ne mostra
   *  trenta. */
  const near = useMemo(() => {
    if (!hoverId || drag) return null;
    const s = new Set<string>([hoverId]);
    for (const l of links) {
      if (l.member === hoverId) s.add(l.org);
      if (l.org === hoverId) s.add(l.member);
    }
    return s;
  }, [hoverId, links, drag]);

  const nodeDim = (n: Node): number => {
    if (drag) return n.id === movingId || canDrop(n) ? 1 : 0.3;
    if (near) return near.has(n.id) ? 1 : 0.25;
    if (q) return n.name.toLowerCase().includes(q) ? 1 : 0.25;
    return 1;
  };
  const linkDim = (l: Link): number => {
    if (drag?.kind === 'edge' && l.member === drag.member && l.org === drag.org) return 1;
    if (drag) return 0.15;
    if (near) return near.has(l.member) && near.has(l.org) ? 1 : 0.15;
    if (q) return 0.35;
    return 1;
  };

  const eyebrow: React.CSSProperties = {
    fontFamily: 'var(--ob-font-mono)', fontSize: OB_TEXT.eyebrow,
    letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.ink3,
  };

  return (
    <div
      ref={boxRef}
      style={{
        height, minHeight: 0, display: 'flex',
        background: 'var(--ob-surface)',
        border: `1px solid ${theme.border}`,
        overflow: 'hidden', touchAction: 'none',
      }}
      onPointerMove={move}
      onPointerUp={finish}
      onPointerCancel={stop}
    >
      {/* ── I NON COLLEGATI ─────────────────────────────────────────────────
          Una colonna e non una fascia in basso: l'elenco è lungo quanto la
          rubrica, e in orizzontale sarebbe finito su quattro righe mangiandosi
          il grafo. In verticale scorre, e la sua larghezza non cambia mai. */}
      <aside
        ref={colRef}
        style={{
          width: COL_W, flexShrink: 0,
          display: 'flex', flexDirection: 'column',
          borderRight: `1px solid ${theme.border}`,
          background: 'var(--ob-surface-2)',
          // Accesa quando accetta ciò che si sta trascinando: qui un nodo esce
          // da TUTTE le sue organizzazioni, ed è bene vederlo prima di mollare.
          boxShadow: overCol && colTakes ? `inset 0 0 0 2px ${theme.accent}` : undefined,
        }}
      >
        <div style={{ ...eyebrow, padding: '10px 10px 8px', borderBottom: `1px solid ${theme.border}`, flexShrink: 0 }}>
          Non collegati ({loose.length})
        </div>
        <div className="ob-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 4 }}>
          {loose.length === 0 ? (
            <p style={{ margin: 0, padding: '10px 6px', color: theme.ink3, fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.meta, lineHeight: 1.5 }}>
              Nessuno: ogni contatto ha almeno un&apos;appartenenza.
            </p>
          ) : loose.map((c) => {
            const org = isOrganizationKind(c.kind);
            const Glyph = org ? IconBuilding : IconUser;
            const held = drag?.kind === 'node' && drag.id === c.id;
            const dim = !drag && q && !c.name.toLowerCase().includes(q) ? 0.35 : 1;
            return (
              <div
                key={c.id}
                data-grab
                onPointerDown={(e) => startLoose(e, c.id)}
                title={`Trascina ${c.name} su un'organizzazione per collegarlo`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '5px 6px', borderRadius: 'var(--ob-radius-sm)',
                  cursor: 'grab', opacity: held ? 0.35 : dim,
                  color: theme.ink2, fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.card,
                  background: held ? theme.surfaceVariant : 'transparent',
                }}
              >
                <span
                  style={{
                    width: 20, height: 20, flexShrink: 0,
                    borderRadius: org ? 4 : '50%',
                    background: 'var(--ob-surface)', border: `1px solid ${theme.border}`,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    color: theme.ink3,
                  }}
                >
                  <Glyph size={12} stroke={1.8} />
                </span>
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.name}
                </span>
              </div>
            );
          })}
        </div>
      </aside>

      {/* ── IL GRAFO ────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
        <svg
          ref={svgRef}
          width={size.w}
          height={size.h}
          style={{ display: 'block', cursor: drag ? 'grabbing' : 'grab' }}
        >
          <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
            {/* ── LINEE ──────────────────────────────────────────────────── */}
            {links.map((l) => {
              const a = pos.get(l.member);
              const b = pos.get(l.org);
              if (!a || !b) return null;
              const key = `${l.member}->${l.org}`;
              const held = drag?.kind === 'edge' && drag.member === l.member && drag.org === l.org;
              // Il capo trascinato segue il puntatore, o si aggancia al
              // bersaglio sotto di lui: la linea mostra dove finirà PRIMA che
              // ci finisca.
              const end = held ? (target ? pos.get(target.id)! : (pointer ?? b)) : b;
              // Staccata: il capo è in mano e non punta a niente. Il tratteggio
              // dice che lasciandolo qui l'appartenenza sparisce.
              const loosely = held && !target;
              const dx = end.x - a.x, dy = end.y - a.y;
              const len = Math.hypot(dx, dy) || 1;
              const ux = dx / len, uy = dy / len;
              const x1 = a.x + ux * R, y1 = a.y + uy * R;
              const gap = loosely ? 0 : R + 3;
              const x2 = end.x - ux * gap, y2 = end.y - uy * gap;
              const lit = held || hoverEdge === key;
              const col = lit ? theme.accent : theme.border;
              return (
                <g key={key} opacity={linkDim(l)}>
                  <line
                    x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke={col} strokeWidth={lit ? 1.8 : 1.2}
                    strokeDasharray={loosely ? '4 3' : undefined}
                  />
                  {/* La punta sta dalla parte dell'ORGANIZZAZIONE: è ciò che
                      rende leggibile il verso — «fa parte di», non
                      «contiene». */}
                  <path
                    d={`M ${x2} ${y2} L ${x2 - ux * 7 - uy * 3.6} ${y2 - uy * 7 + ux * 3.6} L ${x2 - ux * 7 + uy * 3.6} ${y2 - uy * 7 - ux * 3.6} Z`}
                    fill={col}
                  />
                  {/* La MANIGLIA: il capo che si stacca. Invisibile finché non
                      ci si passa sopra, ma con un bersaglio generoso — una
                      linea di un pixel non si prende al primo colpo. */}
                  <circle
                    data-grab
                    cx={x2} cy={y2} r={7}
                    fill={lit ? theme.accent : 'transparent'}
                    style={{ cursor: 'grab' }}
                    onPointerDown={(e) => startEdge(e, l)}
                    onMouseEnter={() => { if (!drag) setHoverEdge(key); }}
                    onMouseLeave={() => setHoverEdge((h) => (h === key ? null : h))}
                  />
                </g>
              );
            })}

            {/* Il collegamento che si sta per fare, da chi è in mano al
                bersaglio: tratteggiato perché non esiste ancora. */}
            {drag?.kind === 'node' && pointer && target && (() => {
              const a = pos.get(drag.id) ?? pointer;
              const b = pos.get(target.id)!;
              return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={theme.accent} strokeWidth={1.8} strokeDasharray="5 3" />;
            })()}

            {/* ── NODI ───────────────────────────────────────────────────── */}
            {nodes.map((n) => {
              const p = pos.get(n.id)!;
              const isTarget = target?.id === n.id;
              const held = movingId === n.id;
              const Glyph = n.org ? IconBuilding : IconUser;
              const stroke = isTarget || held ? theme.accent : theme.border;
              return (
                <g
                  key={n.id}
                  data-grab
                  opacity={nodeDim(n)}
                  transform={`translate(${p.x},${p.y})`}
                  style={{ cursor: 'grab' }}
                  onPointerDown={(e) => startNode(e, n.id)}
                  onMouseEnter={() => setHoverId(n.id)}
                  onMouseLeave={() => setHoverId((h) => (h === n.id ? null : h))}
                >
                  {/* Un alone quando è il bersaglio: dice «lasciandolo qui, si
                      aggancia» prima che il tasto venga rilasciato. */}
                  {isTarget && (
                    n.org
                      ? <rect x={-R - 5} y={-R - 5} width={(R + 5) * 2} height={(R + 5) * 2} rx={8} fill="none" stroke={theme.accent} strokeWidth={1.5} strokeDasharray="3 2" />
                      : <circle r={R + 5} fill="none" stroke={theme.accent} strokeWidth={1.5} strokeDasharray="3 2" />
                  )}
                  {/* Tondo una persona, squadrato un insieme di persone: la
                      stessa forma della lavagna, così le due viste si leggono
                      insieme. */}
                  {n.org
                    ? <rect x={-R} y={-R} width={R * 2} height={R * 2} rx={5} fill="var(--ob-surface-2)" stroke={stroke} strokeWidth={1.2} />
                    : <circle r={R} fill="var(--ob-surface-2)" stroke={stroke} strokeWidth={1.2} />}
                  <g transform="translate(-7,-7)" style={{ pointerEvents: 'none', color: theme.ink2 }}>
                    <Glyph size={14} stroke={1.8} />
                  </g>
                  <text
                    y={R + 13} textAnchor="middle" fill={theme.ink2}
                    style={{ fontFamily: 'var(--ob-font-sans)', fontSize: 10.5, pointerEvents: 'none' }}
                  >
                    {n.name.length > 18 ? `${n.name.slice(0, 17)}…` : n.name}
                  </text>
                </g>
              );
            })}

            {/* Il fantasma di chi arriva dalla colonna: nel disegno non ha
                ancora un posto, quindi il posto è dov'è il puntatore. */}
            {drag?.kind === 'node' && drag.loose && pointer && !overCol && (() => {
              const c = byId.get(drag.id);
              const org = isOrganizationKind(c?.kind);
              return (
                <g transform={`translate(${pointer.x},${pointer.y})`} style={{ pointerEvents: 'none' }} opacity={0.9}>
                  {org
                    ? <rect x={-R} y={-R} width={R * 2} height={R * 2} rx={5} fill="var(--ob-surface-2)" stroke={theme.accent} strokeWidth={1.4} />
                    : <circle r={R} fill="var(--ob-surface-2)" stroke={theme.accent} strokeWidth={1.4} />}
                  <text y={R + 13} textAnchor="middle" fill={theme.ink2} style={{ fontFamily: 'var(--ob-font-sans)', fontSize: 10.5 }}>
                    {(c?.name ?? '').slice(0, 18)}
                  </text>
                </g>
              );
            })()}
          </g>
        </svg>

        {nodes.length === 0 && (
          <p
            style={{
              position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
              margin: 0, padding: 24, textAlign: 'center', pointerEvents: 'none',
              color: theme.ink3, fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.control, lineHeight: 1.6,
            }}
          >
            Nessuna appartenenza, per ora.<br />
            Trascina un contatto dalla colonna su un&apos;organizzazione.
          </p>
        )}

        {/* ── COMANDI DELLA VISTA ─────────────────────────────────────────
            In basso a destra, sopra il disegno. La rotella basta a chi la
            conosce, ma un grafo senza un modo VISIBILE di rimpicciolirlo si
            perde alla prima trascinata: «inquadra tutto» è la via di ritorno. */}
        <div
          style={{
            position: 'absolute', right: 10, bottom: 10,
            display: 'flex', alignItems: 'center', gap: 2, padding: 2,
            background: 'var(--ob-surface)', border: `1px solid ${theme.border}`,
            borderRadius: 'var(--ob-radius-pill)', boxShadow: 'var(--ob-shadow-card)',
          }}
        >
          {[
            { key: 'out', icon: <IconMinus size={13} stroke={2} />, run: () => zoomBy(1 / 1.3), label: 'Rimpicciolisci' },
            { key: 'fit', icon: <IconFocusCentered size={13} stroke={1.8} />, run: fit, label: 'Inquadra tutto' },
            { key: 'in', icon: <IconPlus size={13} stroke={2} />, run: () => zoomBy(1.3), label: 'Ingrandisci' },
          ].map((b) => (
            <button
              key={b.key}
              type="button"
              onClick={b.run}
              title={b.label}
              aria-label={b.label}
              style={{
                width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: 'transparent', border: 'none', borderRadius: '50%',
                color: theme.ink2, cursor: 'pointer',
              }}
            >
              {b.icon}
            </button>
          ))}
          <span
            style={{
              padding: '0 7px 0 4px', color: theme.ink3,
              fontFamily: 'var(--ob-font-mono)', fontSize: OB_TEXT.micro,
            }}
          >
            {Math.round(view.k * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
}
