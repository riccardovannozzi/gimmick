'use client';

/**
 * Gimmick · Obsidian — Schermata di ultima istanza.
 *
 * `global-error` scatta quando a rompersi è il layout radice: React smonta
 * tutto, quindi questo file deve rendere `<html>` e `<body>` da sé e non può
 * contare su niente di `app/layout.tsx` — provider, font e fogli di stile
 * compresi. Per questo i CSS sono importati qui: senza, i token `--ob-*` non
 * esisterebbero e la schermata verrebbe fuori bianca e scomposta proprio nel
 * momento in cui deve rassicurare.
 *
 * `data-theme="dark"` è fissato perché il tema vero vive nel provider, che qui
 * non c'è: si sceglie il default dell'app (il layout radice monta `dark`), che
 * è meglio di un lampo bianco a chi usa Gimmick di sera.
 */
import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import './globals.css';
import './obsidian.css';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="it" data-theme="dark" style={{ colorScheme: 'dark' }}>
      <body style={{ margin: 0, background: 'var(--ob-canvas)' }}>
        <main
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            padding: 24,
            fontFamily: 'var(--ob-font-sans)',
            color: 'var(--ob-text)',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              maxWidth: 460,
              width: '100%',
              background: 'var(--ob-surface)',
              border: '1px solid var(--ob-line)',
              borderLeft: '2.5px solid var(--ob-error)',
              borderRadius: 'var(--ob-radius-md)',
              padding: '24px 26px',
              textAlign: 'left',
            }}
          >
            <h1
              style={{
                margin: '0 0 8px',
                fontSize: 'var(--ob-text-title)',
                fontWeight: 'var(--ob-weight-emphasis)',
              }}
            >
              Qualcosa si è rotto
            </h1>
            <p
              style={{
                margin: '0 0 18px',
                fontSize: 'var(--ob-text-control)',
                lineHeight: 'var(--ob-leading-text)',
                color: 'var(--ob-muted)',
              }}
            >
              I tuoi spark e i tuoi tile sono al sicuro: l&apos;errore è nell&apos;interfaccia,
              non nell&apos;archivio. Abbiamo ricevuto la segnalazione.
            </p>

            <button
              type="button"
              onClick={reset}
              style={{
                padding: '9px 16px',
                borderRadius: 'var(--ob-radius-sm)',
                border: 'none',
                background: 'var(--ob-accent)',
                color: 'var(--ob-accent-ink)',
                fontFamily: 'var(--ob-font-sans)',
                fontSize: 'var(--ob-text-control)',
                fontWeight: 'var(--ob-weight-emphasis)',
                cursor: 'pointer',
              }}
            >
              Riprova
            </button>

            {/* Il digest è l'unico aggancio fra ciò che vede l'utente e ciò che
                è arrivato a Sentry: senza, una segnalazione non è rintracciabile.
                Non contiene dati, è un'impronta dell'errore. */}
            {error.digest && (
              <p
                style={{
                  margin: '18px 0 0',
                  fontFamily: 'var(--ob-font-mono)',
                  fontSize: 'var(--ob-text-meta)',
                  color: 'var(--ob-subtle)',
                }}
              >
                Riferimento: {error.digest}
              </p>
            )}
          </div>
        </main>
      </body>
    </html>
  );
}
