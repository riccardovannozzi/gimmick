/**
 * Gimmick · Obsidian — Scorri per eliminare.
 *
 * Avvolge una card: scorrendola verso SINISTRA si scopre un pulsante rosso col
 * cestino sul fianco destro, e premendolo si elimina. Due gesti separati invece
 * di uno solo: lo scorrimento da solo non cancella niente, quindi una manata
 * sulla lista non porta via un tile.
 *
 * La direzione non è arbitraria. Su iOS (Mail, Messaggi) e in Material 3 le
 * azioni distruttive stanno sul bordo *trailing* — a destra, nelle lingue che
 * si leggono da sinistra — e si scoprono scorrendo verso sinistra. Il lato
 * opposto è per convenzione delle azioni annullabili: archivia, segna letto,
 * rispondi. Mettere qui il cestino significherebbe insegnare all'utente il
 * contrario di quello che sa da ogni altra app.
 *
 * Usa `PanResponder` e non `react-native-gesture-handler`, che pure c'è: è lo
 * stesso strumento con cui la vista Chrono cambia giorno, e la regola di presa
 * del gesto — chiaramente orizzontale, o non è nostro — è già tarata lì.
 *
 * L'apertura è CONTROLLATA dal genitore: la lista tiene aperta una card sola,
 * altrimenti se ne accumulerebbero dieci e il cestino sbagliato finirebbe sotto
 * il dito.
 */
import React from 'react';
import { Animated, PanResponder, Pressable, View } from 'react-native';
import { IconTrash } from '@tabler/icons-react-native';

/**
 * Quanto si scopre. Largo abbastanza da contenere un bersaglio da 48.
 * La card scorre di ALTRETTANTO in negativo: verso sinistra.
 */
const REVEAL_W = 76;
/** Oltre metà corsa il rilascio apre, sotto richiude. */
const OPEN_AT = REVEAL_W / 2;
/**
 * Sotto questo scostamento il gesto NON è nostro: resta alla ScrollView, così
 * lo scorrimento verticale della lista continua a funzionare. Stessa logica
 * della vista Chrono, con una soglia più bassa perché qui il gesto è più corto.
 */
const GRAB = 18;
/** Rosso di pericolo, lo stesso della sidebar web. */
const DANGER = '#E24B4A';

export interface SwipeToDeleteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
  /** Raggio della card avvolta, così il pannello rosso combacia. */
  radius?: number;
  children: React.ReactNode;
}

export function SwipeToDelete({ open, onOpenChange, onDelete, radius = 13, children }: SwipeToDeleteProps) {
  const tx = React.useRef(new Animated.Value(0)).current;
  // Il PanResponder si crea una volta e catturerebbe lo stato del primo render:
  // il ref gli dà sempre la posizione attuale.
  const openRef = React.useRef(open);
  openRef.current = open;

  const slide = React.useCallback((toOpen: boolean) => {
    Animated.spring(tx, { toValue: toOpen ? -REVEAL_W : 0, useNativeDriver: true, bounciness: 0, speed: 18 }).start();
  }, [tx]);

  // Segue anche le aperture decise da FUORI: quando un'altra card si apre, il
  // genitore chiude questa e la posizione deve adeguarsi.
  React.useEffect(() => { slide(open); }, [open, slide]);

  const pan = React.useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_e, g) =>
      Math.abs(g.dx) > GRAB && Math.abs(g.dx) > Math.abs(g.dy) * 2,
    onPanResponderMove: (_e, g) => {
      const base = openRef.current ? -REVEAL_W : 0;
      // Bloccato fra chiuso (0) e tutto aperto (-REVEAL_W): a destra non c'è
      // niente da scoprire, e oltre la corsa la card si staccherebbe dal
      // pannello lasciando una fessura sul fianco.
      tx.setValue(Math.min(0, Math.max(-REVEAL_W, base + g.dx)));
    },
    onPanResponderRelease: (_e, g) => {
      const next = (openRef.current ? -REVEAL_W : 0) + g.dx < -OPEN_AT;
      onOpenChange(next);
      slide(next);
    },
    // Gesto strappato via (arriva una modale, parte lo scroll): si torna dove
    // si era, senza cambiare stato.
    onPanResponderTerminate: () => slide(openRef.current),
  }), [onOpenChange, slide, tx]);

  return (
    <View>
      {/* Il pannello rosso sta SOTTO la card, sul fianco destro, e si scopre
          man mano che questa scorre via. Non è un pulsante che compare: è una
          cosa che c'era già, coperta. */}
      <View
        style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: REVEAL_W,
          borderRadius: radius, overflow: 'hidden', backgroundColor: DANGER,
        }}
      >
        {/* Spento da chiuso: nascosto sotto la card resterebbe comunque
            premibile lungo il bordo destro. */}
        <Pressable
          onPress={onDelete}
          disabled={!open}
          accessibilityLabel="Elimina"
          android_ripple={{ color: '#ffffff33' }}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <IconTrash size={22} color="#fff" strokeWidth={2} />
        </Pressable>
      </View>

      <Animated.View {...pan.panHandlers} style={{ transform: [{ translateX: tx }] }}>
        {children}
      </Animated.View>
    </View>
  );
}
