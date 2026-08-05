/**
 * Gimmick · Obsidian — NavPill (striscia inferiore).
 *
 * Tiene libera la fascia in fondo allo schermo, così il contenuto non finisce
 * sotto la gesture bar di Android e i tocchi non se li prende il sistema.
 *
 * NON disegna più la barretta 128×4: veniva dai mockup HTML del design system,
 * che simulavano l'home indicator del telefono per far sembrare la pagina un
 * dispositivo. Su un telefono vero quell'indicatore lo disegna già il sistema
 * operativo, quindi era il nostro disegno sopra il suo — decorazione, non un
 * comando. Il nome resta per non toccare le nove schermate che lo usano.
 */
import React from 'react';
import { View } from 'react-native';
import { useObsidian } from '@/lib/obsidian';

/**
 * Altezza della fascia. Fissa, com'era prima: il valore comprende già la
 * gesture bar sui telefoni correnti. (L'inset di sistema NON viene sommato —
 * con un `height` esplicito il padding sta dentro l'altezza, quindi la striscia
 * misurava 40 anche prima. Cambiarlo ora sposterebbe il fondo di nove
 * schermate, che è un'altra decisione.)
 */
const STRIP_H = 40;

interface ObsidianNavPillProps {
  /** Fondo della striscia. Default: canvas. Le schermate a fondo nero (home,
   *  viste) passano il proprio, altrimenti resta una banda più chiara in basso. */
  background?: string;
}

export function ObsidianNavPill({ background }: ObsidianNavPillProps = {}) {
  const c = useObsidian();
  return <View style={{ height: STRIP_H, backgroundColor: background ?? c.canvas }} />;
}
