/**
 * Fallback di Suspense per il cambio vista dentro lo shell.
 *
 * Next lo monta nello slot della pagina appena la navigazione si committa: le
 * sponde e la barra dei tab restano ferme, cambia solo l'area centrale. È una
 * scelta esplicita fra due esperienze opposte — trattenere la vista vecchia
 * finché la nuova non è pronta (e il clic sembra non essere arrivato) oppure
 * mostrare subito che sta succedendo qualcosa. Vince la seconda, ed è per questo
 * che la navigazione nello shell NON è avvolta in `startTransition`: una
 * transizione servirebbe a fare l'opposto di questo file.
 *
 * ⚠️ Lo scheletro deve avere la GEOMETRIA della vista che sta arrivando, non un
 * layout suo. Prima disegnava un blocco stretto a sinistra e uno largo a destra,
 * con dodici pixel di margine attorno: dentro un'area già fiancheggiata dalla
 * sidebar dei tag e dal pannello destro, quel disegno ridipingeva in piccolo la
 * stessa struttura che lo conteneva — una shell dentro la shell, che appariva e
 * spariva a ogni cambio vista. Ora è la stessa cornice di `.ob-view`: fascia dei
 * comandi in cima all'altezza del token, corpo sotto. Quando la vista vera
 * arriva, la cornice non si muove — si riempie.
 */
export default function DashboardLoading() {
  return (
    <main className="ob-view" aria-busy="true" aria-label="Caricamento vista">
      {/* La fascia dei comandi: ogni vista ne disegna una, e sta qui perché il
          bordo inferiore non salti su e giù quando la vista prende il posto. */}
      <div className="ob-view__skel-bar">
        <div className="ob-skeleton" style={{ height: 13, width: 172, borderRadius: 4 }} />
        <div style={{ flex: 1 }} />
        <div className="ob-skeleton" style={{ height: 22, width: 88, borderRadius: 6 }} />
      </div>
      <div className="ob-view__body" style={{ padding: 12 }}>
        {/* Un blocco solo. Lo scintillio è il segnale che qualcosa sta
            arrivando; suddividerlo in finte colonne significherebbe promettere
            una forma che la vista in arrivo probabilmente non ha. */}
        <div className="ob-skeleton" style={{ height: '100%', borderRadius: 12 }} />
      </div>
    </main>
  );
}
