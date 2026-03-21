import type { ActionType } from '@/types';

export interface PaletteColor {
  id: string;
  hex: string;
  name: string;
}

export const GIMMICK_PALETTE: PaletteColor[] = [
  // Riga 1
  { id: 'lavanda',    hex: '#8B5CF6', name: 'Lavanda' },
  { id: 'pervinca',   hex: '#6C6CF5', name: 'Pervinca' },
  { id: 'zaffiro',    hex: '#3B82F6', name: 'Zaffiro' },
  { id: 'oceano',     hex: '#1DA8D8', name: 'Oceano' },
  { id: 'acqua',      hex: '#06B6D4', name: 'Acqua' },
  // Riga 2
  { id: 'menta',      hex: '#0BC4A0', name: 'Menta' },
  { id: 'smeraldo',   hex: '#10B981', name: 'Smeraldo' },
  { id: 'erba',       hex: '#4AB84A', name: 'Erba' },
  { id: 'lime',       hex: '#84CC16', name: 'Lime' },
  { id: 'cedro',      hex: '#C8C014', name: 'Cedro' },
  // Riga 3
  { id: 'sole',       hex: '#FACC15', name: 'Sole' },
  { id: 'miele',      hex: '#F59E0B', name: 'Miele' },
  { id: 'mandarino',  hex: '#F97316', name: 'Mandarino' },
  { id: 'terracotta', hex: '#C45C2A', name: 'Terracotta' },
  { id: 'terra',      hex: '#92400E', name: 'Terra' },
  // Riga 4
  { id: 'corallo',    hex: '#EF4444', name: 'Corallo' },
  { id: 'fiamma',     hex: '#F43F72', name: 'Fiamma' },
  { id: 'ciclamino',  hex: '#EC4899', name: 'Ciclamino' },
  { id: 'peonia',     hex: '#E879C8', name: 'Peonia' },
  { id: 'quarzo',     hex: '#F9A8D4', name: 'Quarzo' },
  // Riga 5 — Grigi Slate
  { id: 'neve',       hex: '#F8FAFC', name: 'Neve' },
  { id: 'nebbia',     hex: '#CBD5E1', name: 'Nebbia' },
  { id: 'fumo',       hex: '#94A3B8', name: 'Fumo' },
  { id: 'pietra',     hex: '#64748B', name: 'Pietra' },
  { id: 'ardesia',    hex: '#1E293B', name: 'Ardesia' },
];

export const DEFAULT_ACTION_COLORS: Record<ActionType, string> = {
  none:     '#EC4899', // Rosa (Appunto)
  anytime:  '#F59E0B', // Ambra (Da fare)
  deadline: '#EF4444', // Rosso (Scadenza)
  event:    '#3B82F6', // Blu (Evento)
};

export function getColorName(hex: string): string {
  const found = GIMMICK_PALETTE.find((c) => c.hex.toLowerCase() === hex.toLowerCase());
  return found?.name ?? hex;
}
