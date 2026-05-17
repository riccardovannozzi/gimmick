import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { GIMMICK_PALETTE } from '@/constants/palette';

interface ColorPickerGridProps {
  selectedColor: string;
  onSelect: (hex: string) => void;
  cellSize?: number;
}

const COLS = 5;
const GAP = 2;

export function ColorPickerGrid({ selectedColor, onSelect, cellSize = 34 }: ColorPickerGridProps) {
  const rows: (typeof GIMMICK_PALETTE)[] = [];
  for (let i = 0; i < GIMMICK_PALETTE.length; i += COLS) {
    rows.push(GIMMICK_PALETTE.slice(i, i + COLS));
  }

  return (
    <View style={{ borderRadius: 6, overflow: 'hidden', alignSelf: 'flex-start' }}>
      {rows.map((row, ri) => (
        <View key={ri} style={{ flexDirection: 'row', marginTop: ri > 0 ? GAP : 0 }}>
          {row.map((color, ci) => {
            const isSelected = color.hex.toLowerCase() === selectedColor.toLowerCase();
            return (
              <TouchableOpacity
                key={color.id}
                onPress={() => onSelect(color.hex)}
                activeOpacity={0.7}
                style={{
                  width: cellSize,
                  height: cellSize,
                  backgroundColor: color.hex,
                  marginLeft: ci > 0 ? GAP : 0,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {isSelected && (
                  <View
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: '#FFFFFF',
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.4,
                      shadowRadius: 2,
                      elevation: 3,
                    }}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}
