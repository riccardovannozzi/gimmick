/**
 * Le PROPORZIONI di un'immagine, misurate una volta sola.
 *
 * Serve a chi deve dare una forma a un riquadro prima di disegnarci dentro
 * un'immagine: la lavagna, per i loghi dei contatti. Un logo largo dentro un
 * riquadro quadrato viene tagliato ai lati, e un logo tagliato non è più un
 * logo.
 *
 * ⚠️ La cache è a livello di MODULO e non si svuota. È voluto: un URL del bucket
 * `canvas-assets` è immutabile — cambiare il logo di un contatto produce un URL
 * nuovo, non riscrive quello vecchio — quindi una misura presa una volta resta
 * valida per sempre. Il costo è qualche decina di numeri in memoria.
 */
const cache = new Map<string, number>();

/** La misura se è già stata presa. Sincrona: serve a chi disegna e non può
 *  aspettare. `null` = non ancora nota (o immagine irraggiungibile). */
export function cachedAspect(url?: string | null): number | null {
  if (!url) return null;
  return cache.get(url) ?? null;
}

/**
 * Misura l'immagine, o restituisce la misura già presa.
 *
 * Un'immagine che non si carica dà `null` e NON viene messa in cache: può
 * essere un guasto di rete passeggero, e ricordarlo come «senza proporzioni»
 * condannerebbe quel logo per tutta la sessione.
 */
export function imageAspect(url?: string | null): Promise<number | null> {
  if (!url) return Promise.resolve(null);
  const hit = cache.get(url);
  if (hit !== undefined) return Promise.resolve(hit);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const a = img.naturalHeight > 0 ? img.naturalWidth / img.naturalHeight : 1;
      cache.set(url, a);
      resolve(a);
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}
