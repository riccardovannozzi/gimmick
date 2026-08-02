/**
 * Gimmick · Obsidian — Miniatura mostrata per intero.
 *
 * `<Image>` non conosce le proporzioni di un file remoto finché non lo legge, e
 * senza `aspectRatio` l'unico modo di riempire un riquadro fisso è tagliare —
 * di un ritratto resta una fascia centrale. Qui `Image.getSize` chiede la misura
 * vera (l'immagine finisce in cache, quindi il disegno successivo non ripaga lo
 * scaricamento) e da quella si ricava la larghezza: fissa è l'ALTEZZA, la
 * larghezza segue.
 *
 * Finché la misura non arriva si tiene un riquadro quadrato dello stesso
 * colore, così la riga non sussulta quando arriva.
 *
 * Condivisa fra la lista Tiles (60) e il dettaglio (120): la regola su come si
 * guarda una foto è la stessa, cambia solo quanto spazio c'è.
 */
import React from 'react';
import { View, Image } from 'react-native';
import type { ObsidianColors } from '@/constants/obsidian';

/**
 * Limiti alle proporzioni. Senza, una panoramica verrebbe larga dieci volte
 * l'altezza e sfonderebbe la riga; un'immagine altissima resterebbe uno spillo.
 * Oltre questi rapporti l'immagine viene contenuta con due bande, non tagliata:
 * si vede comunque tutta.
 */
const ASPECT_MIN = 0.5;
const ASPECT_MAX = 2.2;

export function PreviewImage({ c, uri, height, radius = 8 }: {
  c: ObsidianColors;
  uri: string;
  height: number;
  radius?: number;
}) {
  const [aspect, setAspect] = React.useState<number | null>(null);
  React.useEffect(() => {
    let alive = true;
    Image.getSize(
      uri,
      (w, h) => { if (alive && h > 0) setAspect(Math.min(ASPECT_MAX, Math.max(ASPECT_MIN, w / h))); },
      () => { if (alive) setAspect(1); },
    );
    return () => { alive = false; };
  }, [uri]);

  const box = {
    height,
    aspectRatio: aspect ?? 1,
    borderRadius: radius,
    backgroundColor: c.dark ? 'rgba(255,255,255,0.07)' : c.canvas,
  };
  if (aspect === null) return <View style={box} />;
  // `contain` e non `cover`: alle proporzioni vere i due coincidono, ma sui
  // rapporti fuori scala `cover` taglierebbe — e qui si vuole vedere tutto.
  return <Image source={{ uri }} style={box} resizeMode="contain" />;
}
