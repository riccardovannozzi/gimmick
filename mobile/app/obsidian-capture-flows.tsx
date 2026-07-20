/**
 * Gimmick · Obsidian — Capture flows route (QA preview).
 *
 * Routable at /obsidian-capture-flows. A hub that opens each capture flow
 * (Camera / Video / Voice / Text / Gallery / File / Save spark).
 */
import React from 'react';
import { ObsidianCaptureFlowsHub } from '@/components/obsidian';

export default function ObsidianCaptureFlowsRoute() {
  return <ObsidianCaptureFlowsHub />;
}
