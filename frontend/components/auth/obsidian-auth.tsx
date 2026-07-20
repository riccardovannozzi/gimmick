'use client';

/**
 * Gimmick · Obsidian — Scaffold per le pagine di autenticazione (Fase 10).
 *
 * Card centrata + campi/bottone in stile Obsidian (token --ob, Geist). Usato dai
 * branch `isObsidianShellEnabled()` delle pagine (auth) per restyle senza
 * duplicare la logica dei form (react-hook-form resta nelle pagine).
 */
import * as React from 'react';
import Link from 'next/link';

export function AuthLayout({
  title, subtitle, children,
}: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--ob-canvas)',
        padding: 16,
        fontFamily: 'var(--ob-font-sans)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 384,
          background: 'var(--ob-surface)',
          border: '1px solid var(--ob-line-2)',
          borderRadius: 'var(--ob-radius-card)',
          boxShadow: 'var(--ob-shadow-card)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '26px 22px 18px', textAlign: 'center', borderBottom: '1px solid var(--ob-line)' }}>
          <div
            aria-hidden
            style={{
              width: 30, height: 30, borderRadius: 9, background: 'var(--ob-accent)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12,
            }}
          >
            <div style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--ob-accent-ink)' }} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.015em', color: 'var(--ob-text)', margin: 0 }}>{title}</h1>
          {subtitle && <p style={{ fontSize: 13, color: 'var(--ob-muted)', margin: '6px 0 0' }}>{subtitle}</p>}
        </div>
        <div style={{ padding: 22 }}>{children}</div>
      </div>
    </div>
  );
}

export function AuthField({
  label, htmlFor, error, action, children,
}: { label: string; htmlFor?: string; error?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
        <label htmlFor={htmlFor} style={{ fontFamily: 'var(--ob-font-mono)', fontSize: 11, letterSpacing: '0.04em', color: 'var(--ob-muted)' }}>
          {label}
        </label>
        {action}
      </div>
      {children}
      {error && <p style={{ fontSize: 12, color: 'var(--ob-error)', margin: '5px 0 0' }}>{error}</p>}
    </div>
  );
}

export function AuthError({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 12, color: 'var(--ob-error)', textAlign: 'center', margin: 0 }}>{children}</p>;
}

export function AuthFoot({ children }: { children: React.ReactNode }) {
  return <p style={{ marginTop: 2, textAlign: 'center', fontSize: 13, color: 'var(--ob-muted)' }}>{children}</p>;
}

export function AuthLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} style={{ color: 'var(--ob-accent-text)', fontWeight: 600, textDecoration: 'none' }}>{children}</Link>;
}
