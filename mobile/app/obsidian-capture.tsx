/**
 * Gimmick · Obsidian — Capture screen route (QA preview).
 *
 * Routable at /obsidian-capture. Renders the Obsidian mobile Capture screen
 * standalone, alongside the existing pixel screens (strangler). Theme follows
 * the app setting (toggle in Settings to see light/dark).
 */
import React from 'react';
import { ObsidianCaptureScreen } from '@/components/obsidian';

export default function ObsidianCaptureRoute() {
  return <ObsidianCaptureScreen />;
}
