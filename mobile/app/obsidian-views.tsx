/**
 * Gimmick · Obsidian — Mobile views route (QA preview).
 *
 * Routable at /obsidian-views. The primary mobile screens (Tiles / Flows /
 * Chrono / Settings) behind the TopNav switcher.
 */
import React from 'react';
import { ObsidianViewsScreen } from '@/components/obsidian';

export default function ObsidianViewsRoute() {
  return <ObsidianViewsScreen />;
}
