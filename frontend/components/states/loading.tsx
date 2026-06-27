'use client';

/**
 * Gimmick · Obsidian — Loading states.
 *
 * Spinner + a skeleton list (shimmer rows under a "loading…" header).
 * Reference: GimmickStates.dc.html (loading skeleton). Reuses the Skeleton
 * primitive; styling in app/obsidian-states.css.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/primitives';

export function Spinner({ className, ...rest }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn('ob-spinner', className)} role="status" aria-label="Caricamento" {...rest} />;
}

function SkeletonRow() {
  return (
    <div className="ob-skrow">
      <Skeleton width={32} height={32} style={{ borderRadius: 9, flexShrink: 0 }} />
      <div className="ob-skrow__main">
        <Skeleton width="62%" height={13} />
        <Skeleton width="38%" height={10} />
      </div>
      <Skeleton width={64} height={22} />
      <Skeleton width={40} height={22} />
    </div>
  );
}

export interface LoadingListProps {
  rows?: number;
  label?: string;
}

export function LoadingList({ rows = 5, label = 'Carico i tuoi tile…' }: LoadingListProps) {
  return (
    <div>
      <div className="ob-loading__head">
        <Spinner />
        <span className="ob-loading__head-label">{label}</span>
      </div>
      {Array.from({ length: rows }).map((_, i) => <SkeletonRow key={i} />)}
    </div>
  );
}
