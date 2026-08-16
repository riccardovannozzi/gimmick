/**
 * Gimmick · Obsidian — Come si legge l'"azione" di un tile, e come si disegna.
 *
 * Stava dentro la vista Tiles: `toAction`/`toSchedule` in `tiles-live.tsx` e
 * `actionMeta` in `tiles.tsx`, tutte private. Poi la chat ha cominciato a
 * disegnare le tile trovate, e ricopiarle là avrebbe voluto dire vedere la
 * STESSA tile resa in due modi a seconda che arrivi dalla lista o da Ask
 * Gimmick — la data in un formato diverso, il colore dell'azione un altro.
 *
 * Qui la regola sta scritta una volta sola. L'input è volutamente largo (un
 * sottoinsieme di `Tile`), così ci passa anche `ChatTile`, che di colonne ne
 * porta poche.
 */
import type { ShellIconName } from '@/components/shell';

export type ActionKind = 'timed' | 'allday' | 'notes';

/** Le sole colonne che servono a decidere azione e data. */
export interface TileActionInput {
  action_type?: string | null;
  start_at?: string | null;
  end_at?: string | null;
  all_day?: boolean | null;
}

export function tileActionKind(t: TileActionInput): ActionKind {
  if (t.action_type === 'event') return t.all_day ? 'allday' : 'timed';
  if (t.action_type === 'deadline') return 'allday';
  return 'notes'; // none / anytime
}

export interface ActionMeta { label: string; icon: ShellIconName; color: string }

export function actionMeta(a: ActionKind): ActionMeta {
  if (a === 'timed') return { label: 'Timed', icon: 'clock', color: 'var(--ob-info)' };
  if (a === 'allday') return { label: 'All Day', icon: 'calendar', color: 'var(--ob-warning)' };
  return { label: 'Notes', icon: 'note', color: 'var(--ob-muted)' };
}

/** Data e ora già formattate per la lettura (it-IT). Vuoto se il tile non è schedulato. */
export function tileSchedule(t: TileActionInput): { date?: string; time?: string } {
  if (t.action_type === 'event' && t.start_at) {
    const d = new Date(t.start_at);
    const date = d.toLocaleDateString('it-IT');
    if (t.all_day) return { date };
    const start = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    const end = t.end_at
      ? new Date(t.end_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
      : null;
    return { date, time: end ? `${start} – ${end}` : start };
  }
  if (t.action_type === 'deadline' && t.end_at) {
    return { date: new Date(t.end_at).toLocaleDateString('it-IT') };
  }
  return {};
}
