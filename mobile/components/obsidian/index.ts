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
export { ObsidianDrawer } from './Drawer';

export { ObsidianCaptureScreen } from './screens/CaptureScreen';
export type { ObsidianCaptureScreenProps } from './screens/CaptureScreen';
export { ObsidianCaptureScreenLive } from './screens/CaptureScreenLive';
export { ObsidianViewsTabHost } from './ViewsTabHost';
export {
  ObsidianCaptureFlowsHub,
  CameraFlow, VideoFlow, VoiceFlow, TextFlow, GalleryFlow, FileFlow, SaveSparkScreen,
} from './screens/CaptureFlows';
export { ObsidianViewsScreen } from './screens/ViewsScreen';
export type { ObsidianViewsScreenProps } from './screens/ViewsScreen';
export { ObsidianViewsScreenLive } from './screens/ViewsScreenLive';
export { ObsidianSparksScreen } from './screens/SparksScreen';
export type { ObsidianSparksScreenProps } from './screens/SparksScreen';
export { ObsidianSparksScreenLive } from './screens/SparksScreenLive';
export { ObsidianBufferScreen } from './screens/BufferScreen';
export type { ObsidianBufferScreenProps } from './screens/BufferScreen';
export { ObsidianBufferScreenLive } from './screens/BufferScreenLive';
export { ObsidianTileScreen } from './screens/TileScreen';
export type { ObsidianTileScreenProps } from './screens/TileScreen';
export { ObsidianTileScreenLive } from './screens/TileScreenLive';
export { ObsidianAskScreen } from './screens/AskScreen';
export type { ObsidianAskScreenProps, AskMessage } from './screens/AskScreen';
export { ObsidianAskScreenLive } from './screens/AskScreenLive';
export { ObsidianAuthScreen } from './screens/AuthScreen';
export type { ObsidianAuthScreenProps } from './screens/AuthScreen';
export { ObsidianAuthScreenLive } from './screens/AuthScreenLive';
export { BitoMascot } from './Mascot';
