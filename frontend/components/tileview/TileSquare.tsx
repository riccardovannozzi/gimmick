'use client';

import { IconCamera, IconPhoto, IconVideo, IconMicrophone, IconEdit, IconPaperclip } from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import { isLightColor } from '@/lib/tile-helpers';
import { ShapePattern } from './ShapePattern';
import type { PatternShape } from '@/types';

function TagTypeIcon({ emoji, size = 10 }: { emoji: string; size?: number }) {
  if (emoji && emoji.startsWith('Icon')) {
    const TablerIcons = require('@tabler/icons-react');
    const Comp = TablerIcons[emoji];
    if (Comp) return <Comp size={size} className="shrink-0" style={{ color: 'rgba(255,255,255,0.85)' }} />;
  }
  if (emoji) return <span style={{ fontSize: size * 0.8 }}>{emoji}</span>;
  return null;
}

const SPARK_TYPE_ICONS: Record<string, { icon: typeof IconCamera; color: string }> = {
  photo: { icon: IconCamera, color: '#5B8DEF' },
  image: { icon: IconPhoto, color: '#AB9FF2' },
  video: { icon: IconVideo, color: '#E87DA0' },
  audio_recording: { icon: IconMicrophone, color: '#EF4444' },
  text: { icon: IconEdit, color: '#6FCF97' },
  file: { icon: IconPaperclip, color: '#F2C94C' },
};

export interface TileSquareProps {
  title: string;
  subtitle?: string;
  color: string;
  completed: boolean;
  highlight?: boolean;
  tagIcon?: string;
  tagName?: string;
  selected?: boolean;
  dimmed?: boolean;
  onClick?: () => void;
  sparkCounts?: Record<string, number>;
  patternShape?: PatternShape;
  size?: number;
}

export function TileSquare({
  title,
  subtitle,
  color,
  completed,
  highlight,
  tagIcon,
  tagName,
  selected,
  dimmed,
  onClick,
  sparkCounts,
  patternShape = 'solid',
  size = 96,
}: TileSquareProps) {
  const countEntries = sparkCounts ? Object.entries(sparkCounts).filter(([, c]) => c > 0) : [];

  return (
    <div
      onClick={onClick}
      className={cn(
        'relative rounded-sm overflow-hidden shrink-0 cursor-pointer hover:scale-105 transition-all duration-200',
        completed && 'opacity-50',
        selected && 'ring-2 ring-blue-500',
        dimmed && !selected && 'opacity-20 saturate-0'
      )}
      style={{
        width: size,
        height: size,
        border: highlight ? '1.5px solid #E24B4A' : '0.5px solid #3f3f46',
      }}
    >
      {/* Color stripe with tag icon + name */}
      <div className="absolute top-0 left-0 right-0 flex items-center gap-0.5 px-1" style={{ height: Math.max(10, size * 0.16), backgroundColor: color }}>
        {size >= 64 && tagIcon && <TagTypeIcon emoji={tagIcon} size={size < 72 ? 8 : 10} />}
        {tagName && <span className="truncate font-semibold" style={{ fontSize: size < 72 ? 7 : 9, color: isLightColor(color) ? '#1a1a1a' : '#ffffff' }}>{tagName}</span>}
      </div>
      {/* Pattern */}
      <ShapePattern shape={patternShape} color={color} />
      {/* Text */}
      <div className="absolute inset-0 flex flex-col justify-start" style={{ padding: size < 72 ? 3 : 6, paddingTop: size < 72 ? size * 0.22 : size * 0.2 }}>
        <span className={cn('font-medium text-zinc-400 leading-tight', completed && 'line-through')} style={{ fontSize: size < 72 ? 8 : 10, WebkitLineClamp: size < 72 ? 2 : 3, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {title}
        </span>
        {subtitle && size >= 64 && (
          <span className="text-zinc-400 leading-tight truncate" style={{ fontSize: size < 72 ? 7 : 9 }}>{subtitle}</span>
        )}
      </div>
      {/* Footer — spark type icons + counts */}
      {countEntries.length > 0 && size >= 48 && (
        <div className="absolute bottom-0 left-0 right-0 flex items-center gap-0.5 px-1 py-0.5">
          {countEntries.map(([type, count]) => {
            const cfg = SPARK_TYPE_ICONS[type];
            if (!cfg) return null;
            const SIcon = cfg.icon;
            const iconSize = size < 72 ? 8 : 10;
            return (
              <div key={type} className="flex items-center gap-px">
                <SIcon style={{ color: cfg.color, width: iconSize, height: iconSize }} />
                {count > 1 && <span style={{ fontSize: size < 72 ? 6 : 8 }} className="text-zinc-500">{count}</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
