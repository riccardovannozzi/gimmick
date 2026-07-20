/**
 * Gimmick · Obsidian — Beniamini roster metadata.
 *
 * Descrizione + contesto d'apparizione di ciascun beniamino, INDIPENDENTE dal
 * vecchio `lib/mascots.ts` (arcade, sprite pixel). Le coppie colore + label +
 * role vivono in `./sprites`; qui aggiungiamo la descrizione e il contesto
 * (dove appare + frase d'esempio) per la card roster nelle Settings Obsidian.
 *
 * Le `surface` corrispondono ai punti dell'app dove il beniamino può
 * affiorare (la stessa logica usata da `useCardRoster.isEnabled`).
 */
import type { BeniaminoName } from './sprites';

export type RosterSurface =
  | 'splash'
  | 'flow-hub'
  | 'tiles-archive'
  | 'chrono-reminder'
  | 'buffer-full'
  | 'ai-chat'
  | 'focus-mode'
  | 'good-morning'
  | 'photo-capture'
  | 'motion-transition';

export interface RosterEntry {
  description: string;
  /** Dove appare (label leggibile). */
  where: string;
  /** Frase d'esempio del dialog. */
  msg: string;
  surface: RosterSurface;
}

export const BENIAMINO_ROSTER: Record<BeniaminoName, RosterEntry> = {
  gimmick: {
    description: "Il beniamino ufficiale del brand. Piccolo robot dalle antenne sempre attive, dice 'bip' quando lo tocchi.",
    where: 'Splash / Empty state',
    msg: 'BIP. Sono qui. Premi su di me ogni volta che hai un’idea da catturare.',
    surface: 'splash',
  },
  surfer: {
    description: 'Cavalca i Flow di Gimmick. Ogni volta che un’azione passa da un nodo al successivo, lui ci scivola sopra. Sempre in equilibrio.',
    where: 'Flow hub',
    msg: 'Onda in arrivo: 3 nodi pronti per il salto. Sali a bordo, scivoliamo insieme.',
    surface: 'flow-hub',
  },
  tilo: {
    description: 'Fantasmino-archivio. Custodisce idee, foto e note vecchie. Galleggia leggero come uno spirito.',
    where: 'Tiles archive',
    msg: 'Ho ritrovato 3 spark sepolti. Vuoi rivederli?',
    surface: 'tiles-archive',
  },
  kron: {
    description: 'Il guardiano del Chrono. Scandisce i giorni, ricorda le scadenze, segnala quando un evento si avvicina.',
    where: 'Chrono reminder',
    msg: 'Tra 15 minuti: ‘Call Marco — Teleport flow’. Vuoi che apra la tile?',
    surface: 'chrono-reminder',
  },
  buffy: {
    description: 'Il portatore del buffer. Tiene tra le sue braccine tutto quello che cattura prima di archiviarlo. Sgranchisce i muscoli quando il buffer è pieno.',
    where: 'Buffer full',
    msg: 'Ho in braccio 8 spark. Li archiviamo come tile o continuiamo?',
    surface: 'buffer-full',
  },
  bito: {
    description: 'Il robot AI. Vive nella chat. Risponde a comandi vocali e testuali, propone azioni. Pacato, mai invadente.',
    where: 'AI chat',
    msg: 'Ho letto la tua nota. Vuoi che la trasformi in 3 sub-task?',
    surface: 'ai-chat',
  },
  sloth: {
    description: 'Compare nel focus mode. Ti ricorda di rallentare, di non riempire tutti i blocchi di Chrono. Se lo ignori, sbadiglia.',
    where: 'Focus mode',
    msg: 'Slow down. Tre tile bastano oggi. Vuoi spegnere le notifiche?',
    surface: 'focus-mode',
  },
  flocky: {
    description: 'Il pollo mattutino. Annuncia l’inizio della giornata, propone una pianificazione veloce.',
    where: 'Good morning',
    msg: 'Buongiorno! Hai 3 eventi e 1 deadline oggi. Iniziamo dal caffè?',
    surface: 'good-morning',
  },
  snappy: {
    description: 'La macchina fotografica del team. Vive nei capture button di tipo PHOTO. Quando scatti, fa “click” e archivia con riflessi.',
    where: 'Photo capture',
    msg: 'Click! Pronto a inquadrare. Premi e tieni per video.',
    surface: 'photo-capture',
  },
  ballerina: {
    description: 'Quando un’azione si compie con grazia, è lei che la coreografa. Vive nelle transizioni, nei tween, in ogni piccolo movimento che rende l’app fluida.',
    where: 'Motion transition',
    msg: 'Una pausa elegante? Solo un momento.',
    surface: 'motion-transition',
  },
};
