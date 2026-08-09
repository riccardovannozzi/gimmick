/**
 * Gimmick — Gli assi del Kanban.
 *
 * Un asse (le colonne verticali o le corsie orizzontali) ha UNA modalità, scelta
 * fra cinque. Le modalità sono ALTERNATIVE, non componibili:
 *
 *   azione · status · tipo · data · personalizzate
 *
 * ─── Perché alternative e non un insieme libero ──────────────────────────────
 *
 * Prima si potevano mescolare: due colonne per status, una per tag, una scritta
 * a mano. Sembra più potente, e invece è il modo di costruire board che non
 * dicono niente — un tile può cadere in due colonne o in nessuna, e l'asse
 * smette di essere una domanda con una risposta sola. Scegliendo UNA dimensione
 * l'asse torna a partizionare: ogni tile sta in una casella e in una soltanto.
 *
 * Le colonne PERSONALIZZATE restano, ma come quinta alternativa: o l'asse è una
 * dimensione dei dati, o è un elenco che decidi tu. Non entrambi insieme.
 *
 * ─── Derivate, non memorizzate ───────────────────────────────────────────────
 *
 * Le quattro modalità-dimensione NON scrivono righe: le voci si calcolano dai
 * dati a ogni render. Cambiare modalità non distrugge niente e non crea dieci
 * colonne da cancellare dopo; le tue colonne personalizzate restano al loro
 * posto, e tornano appena riselezioni quella modalità.
 *
 * Solo `custom` usa le tabelle `kanban_columns` / `kanban_lanes`.
 */
import type { KanbanFilter, Status, Tag } from '@/types';

export type AxisMode = 'action' | 'status' | 'type' | 'date' | 'custom' | 'none';

/** Una voce dell'asse, comunque sia nata. */
export interface AxisItem {
  /** Id della riga per `custom`; chiave sintetica per le derivate. */
  id: string;
  title: string;
  filters: KanbanFilter[];
}

export const AXIS_MODE_LABEL: Record<AxisMode, string> = {
  action: 'Azione',
  status: 'Status',
  type: 'Tipo',
  date: 'Data',
  custom: 'Personalizzate',
  none: 'Nessuna',
};

/** Le cinque scelte offerte. `none` è in più, e solo per le corsie. */
export const AXIS_MODES: AxisMode[] = ['action', 'status', 'type', 'date', 'custom'];

/**
 * I sei valori dell'azione. `allday` non è un `action_type` memorizzato — è
 * `event` con `all_day` — ma il matcher dei filtri lo distingue da `event`,
 * quindi come voce d'asse è legittimo.
 */
export const ACTION_ITEMS: { value: string; label: string }[] = [
  { value: 'none', label: 'Note' },
  { value: 'anytime', label: 'To-do' },
  { value: 'flow', label: 'Flow' },
  { value: 'deadline', label: 'Due' },
  { value: 'allday', label: 'Daily' },
  { value: 'event', label: 'Timing' },
];

// ─── Finestra di giorni ──────────────────────────────────────────────────────

/**
 * La modalità `data` non ha un insieme finito di valori: i giorni non finiscono.
 * L'asse mostra quindi una FINESTRA che si allarga quando arrivi al bordo —
 * scorrimento infinito in orizzontale sulle colonne, in verticale sulle corsie.
 *
 * `offset` è il primo giorno rispetto a oggi (negativo = passato), `count` la
 * larghezza della finestra.
 */
export interface DateWindow { offset: number; count: number }

export const DEFAULT_DATE_WINDOW: DateWindow = { offset: -3, count: 14 };

/** Quanti giorni si aggiungono ogni volta che si tocca un bordo. */
export const DATE_WINDOW_STEP = 7;

function addDays(base: Date, n: number): Date {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setDate(d.getDate() + n);
  return d;
}

/** `YYYY-MM-DD` in ora LOCALE: `toISOString` slitterebbe di un giorno a est. */
function isoDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Etichetta breve del giorno: `gio 9 lug`, oppure `Oggi`/`Ieri`/`Domani`. */
function dayLabel(d: Date, todayKey: string): string {
  const key = isoDay(d);
  if (key === todayKey) return 'Oggi';
  const t = new Date();
  if (key === isoDay(addDays(t, -1))) return 'Ieri';
  if (key === isoDay(addDays(t, 1))) return 'Domani';
  return d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', '');
}

export function dateItems(win: DateWindow, today = new Date()): AxisItem[] {
  const todayKey = isoDay(today);
  return Array.from({ length: win.count }, (_, i) => {
    const d = addDays(today, win.offset + i);
    const key = isoDay(d);
    return {
      id: `date:${key}`,
      title: dayLabel(d, todayKey),
      // Il filtro `date_range` assoluto vuole `da|a`: stesso giorno da entrambi
      // i lati significa "quel giorno e basta".
      filters: [{ type: 'date_range', value: `${key}|${key}` }] as KanbanFilter[],
    };
  });
}

// ─── Voci derivate ───────────────────────────────────────────────────────────

export function axisItems(
  mode: AxisMode,
  src: {
    statuses: Status[];
    icons: { id: string; name: string }[];
    tags: Tag[];
    custom: AxisItem[];
    dateWindow: DateWindow;
  },
): AxisItem[] {
  switch (mode) {
    case 'action':
      return ACTION_ITEMS.map((a) => ({ id: `action:${a.value}`, title: a.label, filters: [{ type: 'action_type', value: a.value }] }));
    case 'status':
      return src.statuses.map((s) => ({ id: `status:${s.id}`, title: s.name, filters: [{ type: 'status', value: s.id }] }));
    case 'type':
      return src.icons.map((i) => ({ id: `type:${i.id}`, title: i.name, filters: [{ type: 'type_icon', value: i.id }] }));
    case 'date':
      return dateItems(src.dateWindow);
    case 'custom':
      return src.custom;
    default:
      return [];
  }
}
