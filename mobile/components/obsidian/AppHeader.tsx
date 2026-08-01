/**
 * Gimmick · Obsidian — AppHeader (views header) e i suoi pezzi condivisi.
 *
 * Impaginazione della navbar, uguale in home (CaptureScreen) e nelle viste:
 *   · Sinistra — PULSANTE con l'etichetta della finestra e una freccetta: apre
 *     il Drawer. Non c'è più un hamburger: il titolo È il menu.
 *   · Destra   — tre quadrati: Tiles, Chrono, "Ask Gimmick". Tiles e Chrono
 *     stanno qui e non nel Drawer perché sono le due destinazioni che si
 *     raggiungono di continuo; il Drawer resta per il resto (Flows, Cattura,
 *     Impostazioni).
 *
 * `HeaderMenuButton` e `HeaderActions` sono esportati e usati anche
 * dall'header della home: sono lo stesso oggetto in due schermate, e duplicarli
 * significherebbe vederli divergere alla prima modifica.
 *
 * Navigation-agnostic: tutto passa dai callback.
 */
import React from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import {
  IconSparkles, IconChevronDown, IconLayoutGrid, IconCalendarTime,
} from '@tabler/icons-react-native';
import { useObsidian } from '@/lib/obsidian';
import type { MobileViewId } from './TopNav';

// Spazio tra la status bar (spacer safe-area) e la navbar. Uguale alla home.
const HEADER_GAP = 20;

/**
 * Lato dei pulsanti quadrati della navbar e spazio fra loro.
 *
 * 48 raggiunge da solo la soglia di tocco Material, senza `hitSlop` — e con
 * `hitSlop` le tre aree sensibili finirebbero per sovrapporsi, dato che il gap
 * è 8. Con tre quadrati la riga a destra misura 3×48 + 2×8 = 160: su uno
 * schermo da 360dp restano ~150 per il pulsante-menu, quindi l'etichetta ha
 * `numberOfLines={1}` e `flexShrink` — in RN, senza, sconfinerebbe.
 */
export const OB_HEADER_BTN = 48;
const HEADER_BTN_GAP = 8;

/**
 * Pulsante-marchio a sinistra: etichetta della finestra + freccetta, apre il
 * Drawer. `brand` aggiunge il robot davanti (solo in home).
 *
 * Sul marchio si usa `adaptive-icon`, non `icon`: sono lo stesso robot, ma
 * `icon.png` ha lo sfondo BIANCO OPACO (è la piastrella per il launcher) e su
 * header scuro diventerebbe un quadrato bianco; l'adattiva è il solo primo
 * piano, su fondo trasparente. 30px per un glifo che pesa quanto il titolo a
 * 22: l'asset ha un margine interno generoso, quindi il robot ne occupa meno.
 */
export function HeaderMenuButton({ label, brand, onPress }: { label: string; brand?: boolean; onPress?: () => void }) {
  const c = useObsidian();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label} — apri il menu`}
      android_ripple={{ color: c.line }}
      hitSlop={{ top: 8, bottom: 8 }}
      // `flexShrink: 1` sul contenitore E sul testo: i Pressable in RN non si
      // comprimono di default, e con i tre quadrati a destra questo pulsante è
      // il solo elemento che può cedere spazio.
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, minHeight: 44, paddingRight: 2, borderRadius: 10 }}
    >
      {brand && (
        <Image
          source={require('../../assets/adaptive-icon.png')}
          style={{ width: 30, height: 30 }}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      )}
      <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 22, fontWeight: '700', color: c.text }}>{label}</Text>
      <IconChevronDown size={18} color={c.muted} strokeWidth={2.2} />
    </Pressable>
  );
}

const NAV_BTNS: Array<{ id: MobileViewId; label: string; Icon: typeof IconLayoutGrid }> = [
  { id: 'tiles', label: 'Tiles', Icon: IconLayoutGrid },
  { id: 'chrono', label: 'Chrono', Icon: IconCalendarTime },
];

/**
 * Blocco di destra: Tiles, Chrono, Ask Gimmick.
 *
 * I tre quadrati hanno lo stesso fondo neutro tranne Ask, tinto d'accento: Ask
 * è un'azione, gli altri due sono navigazione. Fra i due di navigazione la
 * distinzione la fa il GLIFO — accento sulla vista in cui ci si trova — non il
 * fondo, che li renderebbe indistinguibili da Ask.
 */
export function HeaderActions({ active, onNavigateView, onAsk }: {
  active?: MobileViewId;
  onNavigateView?: (id: MobileViewId) => void;
  onAsk?: () => void;
}) {
  const c = useObsidian();
  const sqBtn = {
    width: OB_HEADER_BTN, height: OB_HEADER_BTN, borderRadius: 12,
    alignItems: 'center' as const, justifyContent: 'center' as const,
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: HEADER_BTN_GAP }}>
      {onNavigateView && NAV_BTNS.map((v) => {
        const on = active === v.id;
        return (
          <Pressable
            key={v.id}
            onPress={() => onNavigateView(v.id)}
            accessibilityRole="button"
            accessibilityLabel={v.label}
            accessibilityState={{ selected: on }}
            android_ripple={{ color: c.line, borderless: true }}
            style={[sqBtn, { backgroundColor: c.surface2 }]}
          >
            <v.Icon size={19} color={on ? c.accent : c.text} strokeWidth={1.9} />
          </Pressable>
        );
      })}
      <Pressable
        onPress={onAsk}
        accessibilityRole="button"
        accessibilityLabel="Ask Gimmick"
        android_ripple={{ color: c.accent + '40', borderless: true }}
        style={[sqBtn, { backgroundColor: c.accent + '2E' }]}
      >
        <IconSparkles size={19} color={c.accent} strokeWidth={1.9} />
      </Pressable>
    </View>
  );
}

interface ObsidianAppHeaderProps {
  /** Etichetta a sinistra: la vista corrente. */
  title?: string;
  /** Vista attiva: accende il glifo del quadrato corrispondente. */
  active?: MobileViewId;
  /** Freccetta sul titolo → Drawer (Flows, Cattura, impostazioni). */
  onMenu?: () => void;
  /** Quadrati Tiles / Chrono → cambio vista. */
  onNavigateView?: (id: MobileViewId) => void;
  /** "Ask Gimmick" a destra → chat. */
  onAsk?: () => void;
}

export function ObsidianAppHeader({ title = 'Gimmick', active, onMenu, onNavigateView, onAsk }: ObsidianAppHeaderProps) {
  const c = useObsidian();

  return (
    <View style={{ marginTop: HEADER_GAP, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, backgroundColor: c.dark ? '#000000' : c.canvas, zIndex: 10 }}>
      <HeaderMenuButton label={title} onPress={onMenu} />
      <HeaderActions active={active} onNavigateView={onNavigateView} onAsk={onAsk} />
    </View>
  );
}
