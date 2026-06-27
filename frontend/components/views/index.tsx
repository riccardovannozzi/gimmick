/**
 * Gimmick · Obsidian — Desktop views barrel.
 *
 * Self-contained views designed to drop into the shell's ViewContainer.
 * Reference DCs in design_handoff_obsidian/.
 */
export { TilesView } from './tiles';
export type { TilesViewProps, TileRow } from './tiles';

export { SparksView } from './sparks';
export type { SparksViewProps, SparkItem } from './sparks';

export { CanvasView } from './canvas';
export type { CanvasViewProps } from './canvas';

export { KanbanView } from './kanban';
export type { KanbanViewProps } from './kanban';

export { ChronoView } from './chrono';
export type { ChronoViewProps } from './chrono';

export { PanopticonView } from './panopticon';

export { FlowsView } from './flows';
export type { FlowsViewProps } from './flows';

export { SettingsView } from './settings';

export { AskView } from './ask';

export { IconPickerModal, ColorPickerModal } from './modals';
