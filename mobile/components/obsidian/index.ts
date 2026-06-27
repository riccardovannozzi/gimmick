/**
 * Gimmick · Obsidian — Mobile shell barrel.
 *
 * StatusBar · TopNav · NavPill · Drawer. These read the Obsidian RN tokens
 * (constants/obsidian.ts via useObsidian) and live alongside the legacy pixel
 * components during the strangler migration. Reference: the mobile DCs.
 */
export { ObsidianStatusBar } from './StatusBar';
export { ObsidianNavPill } from './NavPill';
export { ObsidianTopNav } from './TopNav';
export type { MobileViewId } from './TopNav';
export { ObsidianAppHeader } from './AppHeader';
export { ObsidianDrawer, DEFAULT_DRAWER_GROUPS } from './Drawer';
export type { DrawerGroup, DrawerChild } from './Drawer';

export { ObsidianCaptureScreen } from './screens/CaptureScreen';
export {
  ObsidianCaptureFlowsHub,
  CameraFlow, VideoFlow, VoiceFlow, TextFlow, GalleryFlow, FileFlow, SaveSparkScreen,
} from './screens/CaptureFlows';
export { ObsidianViewsScreen } from './screens/ViewsScreen';
export { ObsidianSparksScreen } from './screens/SparksScreen';
export { ObsidianBufferScreen } from './screens/BufferScreen';
export { ObsidianTileScreen } from './screens/TileScreen';
export { ObsidianAskScreen } from './screens/AskScreen';
export { ObsidianAuthScreen } from './screens/AuthScreen';
export { BitoMascot } from './Mascot';
