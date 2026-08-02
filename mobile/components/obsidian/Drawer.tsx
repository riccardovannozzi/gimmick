/**
 * Gimmick · Obsidian — Drawer di navigazione.
 *
 * Pannello a scorrimento da sinistra con i collegamenti alle altre viste
 * dell'app, più Impostazioni a piè di pagina. La schermata Capture non ha
 * TopNav — il menu del suo AppHeader è l'unica navigazione che possiede — quindi
 * senza queste voci Capture sarebbe un vicolo cieco.
 *
 * Usa una Modal RN per l'overlay (gestisce il tasto Indietro di Android) con
 * scorrimento Animated.
 */
import React from 'react';
import { Animated, Image, Modal, Pressable, ScrollView, Text, View, useWindowDimensions, type TextStyle, type ViewStyle } from 'react-native';
import { IconSettings, IconRoute, IconLayoutGrid, IconCalendarTime, IconSparkles } from '@tabler/icons-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useObsidian } from '@/lib/obsidian';
import { OB_BTN_H } from '@/constants/obsidian';
import type { MobileViewId } from './TopNav';

/**
 * Striscia di schermo che il pannello NON copre, a destra.
 *
 * Nasceva per tenere scoperto l'hamburger, che ora non esiste più — il menu si
 * apre dal pulsante-marchio in alto a SINISTRA, che il pannello copre per
 * forza. Il valore resta perché la striscia serve comunque: mostra che sotto
 * c'è la pagina (il pannello è una scheda sospesa, non una schermata nuova) ed
 * è la zona da toccare per chiudere.
 */
const DRAWER_RIGHT_GAP = 72;
/** Larghezza minima sotto la quale il pannello non scende (schermi stretti). */
const PANEL_MIN = 240;
/**
 * Il pannello è una scheda FLOTTANTE, non una colonna agganciata al bordo:
 * stacca dai bordi di questi margini (oltre alle safe area, in verticale) e ha
 * angoli tondi su tutti e quattro i lati. Sinistra e verticale sono distinti:
 * a sinistra basta meno stacco perché la scheda entra da lì, mentre sopra e
 * sotto il respiro serve a farla leggere come sospesa.
 * `DRAWER_MARGIN_LEFT` entra anche nel calcolo della larghezza, altrimenti il
 * pannello scivolerebbe sotto l'hamburger di altrettanti pixel.
 */
const DRAWER_MARGIN_LEFT = 12;
const DRAWER_MARGIN_V = 22;
const DRAWER_RADIUS = 22;

/**
 * Tutte le destinazioni, nello stesso ordine della navbar.
 *
 * Tiles e Chrono stanno ANCHE qui pur avendo un quadrato proprio in
 * `HeaderActions`. È una duplicazione voluta: il menu diventa l'elenco completo
 * di dove si può andare, invece del posto dove finisce quello che non è entrato
 * in navbar — e chi apre il menu cercando "Tiles" lo trova, senza doversi
 * ricordare che quella vista si raggiunge da un'altra parte.
 */
const VIEW_LINKS: Array<{ id: MobileViewId; name: string; Icon: typeof IconRoute }> = [
  { id: 'tiles', name: 'Tiles', Icon: IconLayoutGrid },
  { id: 'chrono', name: 'Chrono', Icon: IconCalendarTime },
  { id: 'flows', name: 'Flows', Icon: IconRoute },
];

interface ObsidianDrawerProps {
  open: boolean;
  onClose: () => void;
  onSettings?: () => void;
  /** Naviga a una delle viste principali. Omesso → nessun collegamento (preview QA). */
  onNavigateView?: (id: MobileViewId) => void;
  /** Torna alla Home (la pagina di cattura). Omesso, cioè stando già sulla home
   *  → la riga resta come sola identità, non toccabile. */
  onHome?: () => void;
  /** Apre "Ask Gimmick". Omesso → la voce non compare. */
  onAsk?: () => void;
}

export function ObsidianDrawer({ open, onClose, onSettings, onNavigateView, onHome, onAsk }: ObsidianDrawerProps) {
  const c = useObsidian();
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const PANEL = Math.max(PANEL_MIN, screenW - DRAWER_RIGHT_GAP - DRAWER_MARGIN_LEFT);
  // Fuori campo = larghezza + margine sinistro, altrimenti da chiuso resterebbe
  // una fetta di pannello visibile sul bordo.
  const OFFSCREEN = PANEL + DRAWER_MARGIN_LEFT;
  const tx = React.useRef(new Animated.Value(-OFFSCREEN)).current;
  const fade = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (open) {
      Animated.parallel([
        Animated.timing(tx, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      tx.setValue(-OFFSCREEN);
      fade.setValue(0);
    }
    // OFFSCREEN fra le dipendenze: cambia con la rotazione, e la posizione
    // "chiuso" va ricalcolata o al riapri il pannello parte dal punto sbagliato.
  }, [open, tx, fade, OFFSCREEN]);

  // Tutte le righe del drawer — identità compresa — condividono forma, testo e
  // dimensione dell'icona: definirle una volta è l'unico modo perché non
  // divergano di nuovo. L'unica differenza ammessa è QUALE icona sta a sinistra.
  const rowStyle: ViewStyle = {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 10, minHeight: OB_BTN_H, borderRadius: 8,
  };
  const labelStyle: TextStyle = { flex: 1, fontSize: 17, fontWeight: '600', color: c.text };
  const ICON = 22;

  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.42)', opacity: fade }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Chiudi drawer" />
      </Animated.View>

      {/* Scheda flottante: staccata da sinistra, alto e basso, angoli tondi su
          tutti i lati e ombra che la solleva dallo sfondo velato. Le safe area
          entrano nei margini verticali, quindi il contenuto non ha più bisogno
          del proprio `paddingTop`. */}
      <Animated.View
        style={{
          position: 'absolute',
          top: insets.top + DRAWER_MARGIN_V,
          bottom: insets.bottom + DRAWER_MARGIN_V,
          left: DRAWER_MARGIN_LEFT,
          width: PANEL,
          backgroundColor: c.sidebar,
          borderRadius: DRAWER_RADIUS,
          overflow: 'hidden',
          transform: [{ translateX: tx }],
          elevation: 16,
          shadowColor: '#000',
          shadowOpacity: 0.45,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 8 },
        }}
      >
        {/* Viste — Impostazioni sta nella stessa colonna, subito sotto gli altri
            link: unica differenza un separatore che la distingue dalle viste. */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 10, paddingTop: 14, paddingBottom: 14 }}>
          {/* Home: marchio (`adaptive-icon`, il robot) come glifo, e insieme il
              collegamento alla pagina di cattura — che È la home.
              Prima erano due righe, "Gimmick" (solo identità) e "Cattura" (il
              link): due voci per una destinazione sola. Ora è una riga che porta
              dove dice. Senza `onHome` — cioè stando già sulla home — resta la
              sola identità, non toccabile: portare dove si è già non serve. */}
          {onHome ? (
            <Pressable
              onPress={() => { onHome(); onClose(); }}
              android_ripple={{ color: c.accent + '33' }}
              style={rowStyle}
            >
              <Image
                source={require('../../assets/adaptive-icon.png')}
                style={{ width: ICON, height: ICON }}
                resizeMode="contain"
                accessibilityIgnoresInvertColors
              />
              <Text style={labelStyle}>Home</Text>
            </Pressable>
          ) : (
            <View style={rowStyle}>
              <Image
                source={require('../../assets/adaptive-icon.png')}
                style={{ width: ICON, height: ICON }}
                resizeMode="contain"
                accessibilityIgnoresInvertColors
              />
              <Text style={labelStyle}>Home</Text>
            </View>
          )}
          {onNavigateView && VIEW_LINKS.map((v) => (
            // Stile statico e non `({pressed}) => …`: passato come funzione non
            // veniva applicato, e senza flexDirection la riga tornava a colonna
            // con l'icona sopra l'etichetta.
            <Pressable
              key={v.id}
              onPress={() => { onNavigateView(v.id); onClose(); }}
              android_ripple={{ color: c.accent + '33' }}
              style={rowStyle}
            >
              <v.Icon size={ICON} color={c.muted} strokeWidth={1.8} />
              <Text style={labelStyle}>{v.name}</Text>
            </Pressable>
          ))}

          {/* Ask Gimmick: unica AZIONE in mezzo a destinazioni, quindi il glifo
              è d'accento come il suo quadrato in navbar. Stessa riga di tutte
              le altre — a distinguerlo basta il colore, un fondo tinto qui
              peserebbe più di quanto la voce valga. */}
          {onAsk ? (
            <Pressable
              onPress={() => { onAsk(); onClose(); }}
              android_ripple={{ color: c.accent + '33' }}
              style={rowStyle}
            >
              <IconSparkles size={ICON} color={c.accent} strokeWidth={1.8} />
              <Text style={labelStyle}>Ask Gimmick</Text>
            </Pressable>
          ) : null}

          {/* Separatore dalle viste, poi Impostazioni con lo stesso stile dei link. */}
          <View style={{ height: 1, backgroundColor: c.line, marginHorizontal: 10, marginVertical: 6 }} />
          <Pressable
            onPress={() => { onSettings?.(); onClose(); }}
            android_ripple={{ color: c.accent + '33' }}
            style={rowStyle}
          >
            <IconSettings size={ICON} color={c.muted} strokeWidth={1.8} />
            <Text style={labelStyle}>Impostazioni</Text>
          </Pressable>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}
