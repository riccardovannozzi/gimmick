'use client';

/**
 * Gimmick · Obsidian — Surface & display primitives.
 *
 * Chip/Badge, Card, Avatar, Skeleton, ListRow, TableRow, Toast.
 * Styling in app/obsidian-primitives.css, reading `--ob-*` tokens.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

// ─── Chip / Badge ─────────────────────────────────────────────────────────────
export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  active?: boolean;
  pill?: boolean;
  /** Renders the chip as an interactive button-like element (hover + cursor). */
  interactive?: boolean;
  /** Optional leading dot/icon. */
  leading?: React.ReactNode;
}

export function Chip({ active, pill, interactive, leading, className, children, ...rest }: ChipProps) {
  return (
    <span
      className={cn(
        'ob-chip',
        pill && 'ob-chip--pill',
        active && 'ob-chip--active',
        interactive && 'ob-chip--interactive',
        className,
      )}
      {...rest}
    >
      {leading}
      {children}
    </span>
  );
}

/** Static label. Same metrics as Chip, never interactive. */
export function Badge({ className, ...rest }: ChipProps) {
  return <Chip className={cn('ob-badge', className)} {...rest} />;
}

// ─── Card ─────────────────────────────────────────────────────────────────────
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Smaller (panel) radius instead of the card radius. */
  panel?: boolean;
  /** Drop the faint card shadow. */
  flat?: boolean;
  interactive?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card(
  { panel, flat, interactive, className, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'ob-card',
        panel && 'ob-card--panel',
        flat && 'ob-card--flat',
        interactive && 'ob-card--interactive',
        className,
      )}
      {...rest}
    />
  );
});

// ─── Avatar ───────────────────────────────────────────────────────────────────
export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: number;
  src?: string;
  alt?: string;
  /** Fallback initials/glyph when no `src`. */
  fallback?: React.ReactNode;
}

export function Avatar({ size = 34, src, alt, fallback, className, style, ...rest }: AvatarProps) {
  return (
    <span
      className={cn('ob-avatar', className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4), ...style }}
      {...rest}
    >
      {src ? <img src={src} alt={alt ?? ''} /> : fallback}
    </span>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
export interface SkeletonProps extends React.HTMLAttributes<HTMLSpanElement> {
  width?: number | string;
  height?: number | string;
  /** Pill radius (e.g. avatar placeholder). */
  circle?: boolean;
}

export function Skeleton({ width, height = 14, circle, className, style, ...rest }: SkeletonProps) {
  return (
    <span
      className={cn('ob-skeleton', className)}
      style={{ width, height, borderRadius: circle ? '50%' : undefined, ...style }}
      {...rest}
    />
  );
}

// ─── ListRow ──────────────────────────────────────────────────────────────────
export interface ListRowProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  active?: boolean;
  leading?: React.ReactNode;
  /** Trailing mono meta (count, date, size). */
  meta?: React.ReactNode;
}

export function ListRow({ interactive, active, leading, meta, className, children, ...rest }: ListRowProps) {
  return (
    <div
      className={cn(
        'ob-listrow',
        interactive && 'ob-listrow--interactive',
        active && 'ob-listrow--active',
        className,
      )}
      {...rest}
    >
      {leading}
      <div className="ob-listrow__main">{children}</div>
      {meta != null && <div className="ob-listrow__meta">{meta}</div>}
    </div>
  );
}

// ─── Table + TableRow ─────────────────────────────────────────────────────────
export function Table({ className, ...rest }: React.TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cn('ob-table', className)} {...rest} />;
}

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  interactive?: boolean;
  active?: boolean;
}

export function TableRow({ interactive, active, className, ...rest }: TableRowProps) {
  return (
    <tr
      className={cn(
        'ob-tablerow',
        interactive && 'ob-tablerow--interactive',
        active && 'ob-tablerow--active',
        className,
      )}
      {...rest}
    />
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
export type ToastTone = 'default' | 'success' | 'error' | 'info';

export interface ToastProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  tone?: ToastTone;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Trailing action (e.g. an Undo button). */
  action?: React.ReactNode;
}

export function Toast({ tone = 'default', title, description, action, className, ...rest }: ToastProps) {
  return (
    <div className={cn('ob-toast', tone !== 'default' && `ob-toast--${tone}`, className)} role="status" {...rest}>
      <span className="ob-toast__accent" aria-hidden />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="ob-toast__title">{title}</div>
        {description && <div className="ob-toast__desc">{description}</div>}
      </div>
      {action}
    </div>
  );
}
