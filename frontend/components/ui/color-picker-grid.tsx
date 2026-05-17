'use client';

import { IconX } from '@tabler/icons-react';
import { GIMMICK_PALETTE } from '@/lib/palette';
import { cn } from '@/lib/utils';

interface ColorPickerGridProps {
  selectedColor: string | null;
  onSelect: (hex: string | null) => void;
  /** Pixel size of each color swatch (square). Default 24. */
  size?: number;
  /** Number of columns in the grid. Default 10 (matches GIMMICK_PALETTE 10×4 layout). */
  cols?: number;
  /** Gap in px between swatches. Default 2. */
  gap?: number;
  /** Show a leading "reset" swatch that clears the selection (calls onSelect(null)). */
  showReset?: boolean;
}

/**
 * Shared color picker backed by GIMMICK_PALETTE.
 * Default layout: 10 columns × 4 rows (Airtable SDK palette).
 * Used in settings (action colors), kanban (column background), etc.
 */
export function ColorPickerGrid({
  selectedColor,
  onSelect,
  size = 24,
  cols = 10,
  gap = 2,
  showReset = false,
}: ColorPickerGridProps) {
  const normalizedSelected = (selectedColor || '').toLowerCase();

  return (
    <div
      className="inline-grid rounded-md overflow-hidden"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap }}
    >
      {showReset && (
        <button
          onClick={() => onSelect(null)}
          title="Default"
          className={cn(
            'relative border flex items-center justify-center transition-colors bg-zinc-900',
            !selectedColor ? 'border-white' : 'border-zinc-700 hover:border-zinc-500',
          )}
          style={{ width: size, height: size }}
        >
          <IconX className="text-zinc-400" style={{ width: size * 0.45, height: size * 0.45 }} />
        </button>
      )}
      {GIMMICK_PALETTE.map((color) => {
        const isSelected = color.hex.toLowerCase() === normalizedSelected;
        return (
          <button
            key={color.id}
            onClick={() => onSelect(color.hex)}
            title={color.name}
            className={cn('relative border transition-colors', isSelected ? 'border-white' : 'border-zinc-700 hover:border-zinc-500')}
            style={{ width: size, height: size, backgroundColor: color.hex }}
          >
            {isSelected && (
              <span className="absolute inset-0 flex items-center justify-center">
                <span
                  className="rounded-full bg-white"
                  style={{
                    width: Math.max(8, size * 0.35),
                    height: Math.max(8, size * 0.35),
                    boxShadow: '0 0 3px rgba(0,0,0,0.5)',
                  }}
                />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}