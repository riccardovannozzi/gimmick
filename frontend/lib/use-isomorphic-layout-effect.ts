import { useEffect, useLayoutEffect } from 'react';

/**
 * `useLayoutEffect` sul client, `useEffect` durante il render sul server.
 *
 * Serve per ripristinare stato persistito in localStorage senza flash. Il
 * pattern `useState(default)` + `useEffect(() => setState(fromStorage))` è
 * corretto per l'idratazione (il primo render client combacia con l'HTML SSR)
 * ma `useEffect` gira DOPO il paint: il browser disegna il default e solo dopo
 * il valore vero → si vede saltare (es. il Chrono che mostra "Week" prima di
 * "3 Days"). `useLayoutEffect` gira PRIMA del paint, quindi React applica la
 * correzione nello stesso frame e il default non viene mai disegnato.
 *
 * L'alias è necessario perché `useLayoutEffect` non ha effetto durante l'SSR e
 * React logga un warning se lo trova in un componente renderizzato sul server.
 */
export const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;
