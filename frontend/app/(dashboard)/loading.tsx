/**
 * Fallback di Suspense per il cambio vista dentro lo shell.
 *
 * Senza questo file, `router.push` dentro `useTransition` tiene visibile la
 * PAGINA VECCHIA finché la nuova non è pronta (dati inclusi): la navigazione
 * sembra "bloccata". Con un loading.tsx Next monta subito questo fallback nello
 * slot della pagina — la shell (header/tab/sidebar) resta ferma e cambia solo
 * l'area contenuto, così il passaggio è percepito come immediato.
 */
export default function DashboardLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Caricamento vista"
      style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: 16,
        background: 'var(--ob-canvas)',
      }}
    >
      {/* Barra toolbar fittizia */}
      <div className="ob-skeleton" style={{ height: 32, width: 260, borderRadius: 10 }} />
      {/* Blocchi contenuto */}
      <div style={{ display: 'flex', gap: 10, flex: 1, minHeight: 0 }}>
        <div className="ob-skeleton" style={{ width: 210, borderRadius: 12 }} />
        <div className="ob-skeleton" style={{ flex: 1, borderRadius: 12 }} />
      </div>
    </div>
  );
}
