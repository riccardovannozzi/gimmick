/**
 * Gimmick · Obsidian — Bito mascot (RN).
 *
 * Renders the Bito beniamino via react-native-svg with the exact shapes/colors
 * from the DCs (identity pair #56C2E6 / #AB9FF2). Eye ink follows the theme.
 */
import React from 'react';
import { SvgXml } from 'react-native-svg';
import { useObsidian } from '@/lib/obsidian';

export function BitoMascot({ size = 28 }: { size?: number }) {
  const c = useObsidian();
  const ink = c.dark ? '#1b1822' : '#26212f';
  const xml = `<svg viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg"><line x1="48" y1="18" x2="48" y2="9" stroke="#56C2E6" stroke-width="4" stroke-linecap="round"/><circle cx="48" cy="7" r="4" fill="#AB9FF2"/><rect x="18" y="18" width="60" height="50" rx="16" fill="#56C2E6"/><rect x="26" y="26" width="44" height="34" rx="10" fill="#11131a" opacity="0.18"/><circle cx="40" cy="42" r="5" fill="${ink}"/><circle cx="56" cy="42" r="5" fill="${ink}"/><path d="M40 52 q8 7 16 0" stroke="#AB9FF2" stroke-width="3.5" fill="none" stroke-linecap="round"/><rect x="30" y="68" width="14" height="14" rx="6" fill="#56C2E6"/><rect x="52" y="68" width="14" height="14" rx="6" fill="#56C2E6"/></svg>`;
  return <SvgXml xml={xml} width={size} height={size} />;
}
