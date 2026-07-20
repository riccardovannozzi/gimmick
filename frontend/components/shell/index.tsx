/**
 * Gimmick · Obsidian — Desktop shell barrel.
 *
 * AppShell + Header, ViewTabs, Sidebar, Inspector, ViewContainer. Reads the
 * `--ob-*` tokens and uses the Prompt 2 primitives. Styling in
 * app/obsidian-shell.css. Reference: GimmickApp.dc.html and the isolated
 * GimmickHeader/Sidebar/Inspector DCs.
 */
export { AppShell } from './AppShell';
export type { AppShellProps } from './AppShell';

export { Header } from './Header';
export type { HeaderProps } from './Header';

export {
  ViewTabs,
  DEFAULT_LEFT_VIEWS,
  DEFAULT_RIGHT_VIEWS,
} from './ViewTabs';
export type { ViewTabsProps, ViewTab, ViewId } from './ViewTabs';

export { Sidebar } from './Sidebar';
export type { SidebarProps, SidebarGroup, SidebarChild } from './Sidebar';

export {
  Inspector,
  InspectorSection,
  InspectorField,
  InspectorTagPill,
  InspectorDivider,
  InspectorCaps,
} from './Inspector';
export type { InspectorProps, InspectorMode, InspectorCap } from './Inspector';

export { ViewContainer } from './ViewContainer';
export type { ViewContainerProps } from './ViewContainer';

export { Icon } from './icons';
export type { IconProps, ShellIconName } from './icons';
