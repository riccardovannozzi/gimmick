'use client';

/**
 * Gimmick · Obsidian — Meta-row del tile (Variante A).
 *
 * Mostra, nel piede delle card, il TIPO (chip colorato con il glifo Tabler del
 * type-icon) e lo STATUS (swatch con la forma dello status). Riutilizzabile da
 * Kanban, Chrono e altre viste a card. I dati arrivano già risolti dai mapper
 * live (icon+color del tipo, shape+color+label dello status).
 */
import * as React from 'react';
import * as TablerIcons from '@tabler/icons-react';
import { readableOn } from '@/lib/palette';
import { StatusSwatch } from '@/components/statuses/status-swatch';
import type { StatusShape } from '@/types';

const AllIcons = TablerIcons as unknown as Record<string, React.ComponentType<{ size?: number; color?: string }>>;

export interface TileMetaType {
  /** Nome del glifo Tabler (es. "IconHome"). */
  icon: string;
  /** Colore esadecimale del type-icon (per lo sfondo del chip). */
  color: string;
}

export interface TileMetaStatus {
  shape: StatusShape;
  /** Colore dello status (token `--ob-*` o hex). */
  color: string;
  label: string;
}

export function TileMeta({ type, status, compact }: { type?: TileMetaType; status?: TileMetaStatus; compact?: boolean }) {
  if (!type && !status) return null;
  const TypeGlyph = type ? (AllIcons[type.icon] ?? AllIcons.IconHash) : null;
  // Blocchi molto bassi (eventi a riga singola): badge ridotti così stanno
  // dentro l'altezza disponibile senza essere tagliati.
  const chip = compact ? 13 : 16;
  const glyph = compact ? 9 : 11;
  const swatch = compact ? 12 : 14;
  return (
    <span className="ob-tilemeta">
      {type && TypeGlyph && (
        <span className="ob-tilemeta__type" style={{ background: type.color, width: chip, height: chip }} title="Tipo">
          <TypeGlyph size={glyph} color={readableOn(type.color)} />
        </span>
      )}
      {status && (
        <span title={status.label} style={{ display: 'inline-flex' }}>
          <StatusSwatch shape={status.shape} color={status.color} size={swatch} />
        </span>
      )}
    </span>
  );
}
