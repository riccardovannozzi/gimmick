'use client';

/**
 * Gimmick · Obsidian — Mascot suggestion ("suggerimento del beniamino").
 *
 * The accent-soft callout where a mascot proposes tags / actions. Seen on the
 * "Salva spark" screen in design_handoff_obsidian/GimmickCaptureFlows.dc.html:
 * a small Beniamino + "{name} suggerisce" + a row of one-tap suggestion chips.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { Beniamino } from './beniamino';
import { BENIAMINO_META, type BeniaminoName } from './sprites';

export interface MascotSuggestionItem {
  label: React.ReactNode;
  icon?: React.ReactNode;
  onClick?: () => void;
}

export interface MascotSuggestionProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Which mascot suggests. Defaults to Bito (the assistant). */
  name?: BeniaminoName;
  /** Headline. Defaults to "{mascot} suggerisce". */
  title?: React.ReactNode;
  /** The suggestion chips. */
  items: MascotSuggestionItem[];
  mascotSize?: number;
}

export function MascotSuggestion({
  name = 'bito',
  title,
  items,
  mascotSize = 32,
  className,
  ...rest
}: MascotSuggestionProps) {
  const heading = title ?? `${BENIAMINO_META[name].label} suggerisce`;
  return (
    <div className={cn('ob-mascot-suggestion', className)} {...rest}>
      <Beniamino name={name} size={mascotSize} title="" />
      <div className="ob-mascot-suggestion__body">
        <div className="ob-mascot-suggestion__title">{heading}</div>
        <div className="ob-mascot-suggestion__chips">
          {items.map((it, i) => {
            const interactive = typeof it.onClick === 'function';
            const Tag = interactive ? 'button' : 'span';
            return (
              <Tag
                key={i}
                type={interactive ? 'button' : undefined}
                onClick={it.onClick}
                className={cn('ob-suggestion-chip', interactive && 'ob-suggestion-chip--interactive')}
              >
                {it.icon}
                {it.label}
              </Tag>
            );
          })}
        </div>
      </div>
    </div>
  );
}
