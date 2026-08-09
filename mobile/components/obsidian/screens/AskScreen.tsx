/**
 * Gimmick · Obsidian — Mobile Ask Gimmick (chat).
 *
 * Bito-led assistant chat: user/bot bubbles, an inline tile-result + confirm
 * row and a composer. Reference: GimmickMobileAsk.dc.html.
 */
import React from 'react';
import { View, Text, Pressable, ScrollView, TextInput, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import Markdown from 'react-native-markdown-display';
import {
  IconPaperclip, IconMicrophone, IconSend,
  IconTag, IconCheck, IconAlignLeft, IconX, IconArrowLeft, IconEraser,
  IconCornerDownLeft,
} from '@tabler/icons-react-native';
import { useObsidian } from '@/lib/obsidian';
import { useDictation } from '@/hooks/useDictation';
import { toast } from '@/store';
import { OB_BTN_H, type ObsidianColors } from '@/constants/obsidian';
import { DEFAULT_ACTION_COLORS, type TileActionKey } from '@/constants/tile-colors';
import { chatTileToVM } from '@/lib/obsidian-adapters';
import type { ChatTile } from '@/lib/api';
import { TileCard } from './ViewsScreen';
import { ObsidianStatusBar } from '../StatusBar';
import { ObsidianNavPill } from '../NavPill';
import { BitoMascot } from '../Mascot';

/**
 * Corpo del testo della conversazione. Una costante sola per le bolle del bot,
 * quelle dell'utente e il campo di scrittura: sono lo stesso discorso letto in
 * tre punti, e se divergono la chat sembra composta da pezzi diversi.
 *
 * 15.5 e non i 13.5 di prima: a quel corpo le risposte lunghe — che qui sono la
 * norma, perché Bito elenca — si leggevano a fatica. L'interlinea sale in
 * proporzione (~1,48) o il testo si impacca.
 */
const MSG_FONT = 15.5;
const MSG_LINE = 23;

/**
 * Altezza della casella di scrittura, contata in RIGHE e non in dp: legata a
 * `MSG_LINE`, resta di tre righe anche se un domani il corpo del testo cambia.
 * Oltre le sei righe il campo smette di crescere e scorre — più in alto
 * mangerebbe la conversazione, che è ciò che si sta leggendo mentre si scrive.
 */
const INPUT_MIN_LINES = 3;
const INPUT_MAX_LINES = 6;

/**
 * Fondo del pulsante Invia: l'accento PROFONDO della palette (è il valore che
 * `accent` ha nel tema chiaro). Fisso e non `c.accent` perché in tema scuro
 * l'accento è un lavanda chiaro, sotto al quale una freccia bianca si legge
 * appena. Così il pulsante è lo stesso nei due temi.
 */
const SEND_BG = '#7C5CCB';

function UserMsg({ c, children }: { c: ObsidianColors; children: React.ReactNode }) {
  return (
    <View style={{ alignSelf: 'flex-end', maxWidth: '82%', backgroundColor: c.accent, borderRadius: 14, borderBottomRightRadius: 4, paddingHorizontal: 13, paddingVertical: 10 }}>
      <Text style={{ fontSize: MSG_FONT, lineHeight: MSG_LINE, color: c.accentInk }}>{children}</Text>
    </View>
  );
}
/**
 * Stili Markdown mappati sui token Obsidian.
 *
 * `paragraph` azzerato e spaziatura affidata al `gap` di `body`: i margini di
 * default della libreria lascerebbero un margine anche DOPO l'ultimo blocco, e
 * in RN non esiste `:last-child` per toglierlo — la bolla si ritroverebbe un
 * vuoto in fondo. Col gap lo spazio esiste solo TRA i blocchi.
 *
 * `body` usa `MSG_FONT`/`MSG_LINE`, gli stessi della bolla dell'utente: il
 * Markdown cambia la forma del testo, non la sua misura.
 */
function mdStyles(c: ObsidianColors) {
  const mono = Platform.OS === 'ios' ? 'Menlo' : 'monospace';
  return {
    body: { fontSize: MSG_FONT, lineHeight: MSG_LINE, color: c.text, gap: 8 },
    paragraph: { marginTop: 0, marginBottom: 0 },
    strong: { fontWeight: '700' as const, color: c.text },
    em: { fontStyle: 'italic' as const },
    s: { textDecorationLine: 'line-through' as const, color: c.muted },
    // I titoli salgono col corpo, ma restano compressi: in una bolla di chat un
    // h1 tipografico spezzerebbe la lettura invece di ordinarla.
    heading1: { fontSize: 19, lineHeight: 26, fontWeight: '700' as const, color: c.text },
    heading2: { fontSize: 17.5, lineHeight: 24, fontWeight: '700' as const, color: c.text },
    heading3: { fontSize: 16.5, lineHeight: 23, fontWeight: '700' as const, color: c.text },
    heading4: { fontSize: MSG_FONT, lineHeight: MSG_LINE, fontWeight: '700' as const, color: c.text },
    heading5: { fontSize: MSG_FONT, lineHeight: MSG_LINE, fontWeight: '700' as const, color: c.muted },
    heading6: { fontSize: 14.5, lineHeight: 21, fontWeight: '700' as const, color: c.muted },
    // Le liste sono il motivo per cui il Markdown qui serve: le risposte di
    // Bito sono quasi sempre elenchi. Rientro contenuto, pallino d'accento.
    bullet_list: { marginVertical: 0 },
    ordered_list: { marginVertical: 0 },
    list_item: { flexDirection: 'row' as const, marginBottom: 3 },
    bullet_list_icon: { color: c.accent, marginLeft: 2, marginRight: 8, fontSize: MSG_FONT, lineHeight: MSG_LINE },
    ordered_list_icon: { color: c.accent, marginLeft: 2, marginRight: 8, fontSize: MSG_FONT, lineHeight: MSG_LINE },
    bullet_list_content: { flex: 1 },
    ordered_list_content: { flex: 1 },
    // Il monospazio resta un punto sotto il testo: a parità di corpo "pesa" di
    // più, e allineato al resto sembrerebbe più grande.
    code_inline: { backgroundColor: c.surface2, color: c.text, fontFamily: mono, fontSize: 14.5, borderRadius: 4, paddingHorizontal: 4 },
    fence: { backgroundColor: c.surface2, color: c.text, fontFamily: mono, fontSize: 14, borderWidth: 0, borderRadius: 8, padding: 10 },
    code_block: { backgroundColor: c.surface2, color: c.text, fontFamily: mono, fontSize: 14, borderWidth: 0, borderRadius: 8, padding: 10 },
    link: { color: c.accent, textDecorationLine: 'underline' as const },
    blockquote: { backgroundColor: 'transparent', borderLeftWidth: 2, borderLeftColor: c.line2, paddingLeft: 10, marginLeft: 0 },
    hr: { backgroundColor: c.line2, height: 1, marginVertical: 2 },
    table: { borderWidth: 1, borderColor: c.line2, borderRadius: 8 },
    th: { padding: 6 },
    td: { padding: 6 },
  };
}

function Bubble({ c, children }: { c: ObsidianColors; children: React.ReactNode }) {
  const styles = React.useMemo(() => mdStyles(c), [c]);
  return (
    // Niente bordo: la bolla si stacca già dal fondo per colore, e il contorno
    // le dava un peso che il messaggio dell'utente (fondo accent, mai bordato)
    // non ha — le due parti della conversazione erano disegnate con due regole.
    <View style={{ backgroundColor: c.surface, borderRadius: 14, borderBottomLeftRadius: 4, paddingHorizontal: 13, paddingVertical: 10 }}>
      {/* Le risposte di Claude arrivano in Markdown: senza interprete gli
          asterischi e i trattini finivano a schermo come caratteri. Il
          Markdown si applica SOLO alle bolle del bot — quelle dell'utente
          restano testo puro, o un asterisco digitato sparirebbe dal proprio
          messaggio. Se il contenuto non è una stringa (nodi già montati, come
          nel thread di prova) si ricade sul testo semplice. */}
      {typeof children === 'string'
        ? <Markdown style={styles}>{children}</Markdown>
        : <Text style={{ fontSize: MSG_FONT, lineHeight: MSG_LINE, color: c.text }}>{children}</Text>}
    </View>
  );
}
function BotWrap({ c, children }: { c: ObsidianColors; children: React.ReactNode }) {
  return (
    <View style={{ alignSelf: 'flex-start', maxWidth: '90%', flexDirection: 'row', gap: 8 }}>
      <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' }}>
        <BitoMascot size={21} />
      </View>
      <View style={{ flex: 1, gap: 8 }}>{children}</View>
    </View>
  );
}

function TileResult({ c }: { c: ObsidianColors }) {
  return (
    // La barra colorata a sinistra resta: non è un bordo, è il marcatore del
    // tipo di tile. A sparire è il contorno.
    <View style={{ backgroundColor: c.surface, borderLeftWidth: 2.5, borderLeftColor: c.timed, borderRadius: 12, padding: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 5, flexWrap: 'wrap' }}>
        <Text style={{ fontSize: 10, fontWeight: '600', color: c.accent, backgroundColor: c.accentSoft, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 }}>Oggi · 16:00</Text>
        <Text style={{ fontSize: 13.5, fontWeight: '600', color: c.text }}>Call Marco</Text>
      </View>
      <Text style={{ fontSize: 12, color: c.muted, lineHeight: 17, marginBottom: 9 }}>Brief Teleport · creato dalla nota vocale.</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flexDirection: 'row', gap: 5 }}>
          <View style={{ width: 17, height: 17, borderRadius: 5, backgroundColor: c.cap.voice + (c.dark ? '2e' : '1c'), alignItems: 'center', justifyContent: 'center' }}><IconMicrophone size={10} color={c.cap.voice} strokeWidth={1.8} /></View>
          <View style={{ width: 17, height: 17, borderRadius: 5, backgroundColor: c.cap.text + (c.dark ? '2e' : '1c'), alignItems: 'center', justifyContent: 'center' }}><IconAlignLeft size={10} color={c.cap.text} strokeWidth={1.8} /></View>
        </View>
        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <IconTag size={11} color={c.accent} strokeWidth={1.8} />
          <Text style={{ fontSize: 11, fontWeight: '600', color: c.muted }}>GDS</Text>
        </View>
      </View>
    </View>
  );
}
function ConfirmRow({ c }: { c: ObsidianColors }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Pressable style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: OB_BTN_H, borderRadius: 9, backgroundColor: c.accent }}>
        <IconCheck size={13} color={c.accentInk} strokeWidth={2.2} />
        <Text style={{ fontSize: 12.5, fontWeight: '600', color: c.accentInk }}>Conferma</Text>
      </Pressable>
      {/* Riempito invece che contornato: senza bordo un pulsante trasparente
          sparirebbe, e il fondo `surface2` è come si disegnano i secondari
          altrove nell'app. */}
      <Pressable style={{ flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: OB_BTN_H, borderRadius: 9, backgroundColor: c.surface2 }}>
        <Text style={{ fontSize: 12.5, fontWeight: '600', color: c.muted }}>Modifica</Text>
      </Pressable>
    </View>
  );
}

export interface AskMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** Tile trovate dall'AI per questo turno: si disegnano sotto la risposta. */
  tiles?: ChatTile[];
}

/**
 * Le tile della risposta, con la card VERA della lista.
 *
 * Non una card della chat: un tile trovato dall'AI e lo stesso tile visto in
 * elenco sono la stessa cosa, e disegnarli diversi costringerebbe a impararli
 * due volte. Quello che la chat non sa — anteprime, passi, tag, status — la card
 * semplicemente non lo disegna, perché è costruita per tacere sui dati assenti.
 */
function TileResults({ c, tiles, actionColors, onOpenTile }: {
  c: ObsidianColors;
  tiles: ChatTile[];
  actionColors: Record<TileActionKey, string>;
  onOpenTile?: (id: string) => void;
}) {
  return (
    <View style={{ gap: 9 }}>
      {tiles.map((t) => (
        <TileCard key={t.id} c={c} t={chatTileToVM(t)} actionColors={actionColors} onPress={onOpenTile} />
      ))}
    </View>
  );
}

export interface ObsidianAskScreenProps {
  /** Live conversation. Omit to render the static demo thread (QA preview). */
  messages?: AskMessage[];
  input?: string;
  onInput?: (t: string) => void;
  onSend?: () => void;
  isLoading?: boolean;
  /** File scelto e in attesa d'invio. Null → la riga dell'allegato non c'è. */
  attachment?: { name: string } | null;
  /** Apre il selettore di file. Omessa → graffetta spenta (mock QA). */
  onAttach?: () => void;
  onRemoveAttachment?: () => void;
  /** Torna alla schermata precedente. Omessa → nessuna riga in cima. */
  onBack?: () => void;
  /** Apre una tile trovata dall'AI. Omessa → card mostrate ma non toccabili. */
  onOpenTile?: (id: string) => void;
  /** Colori azione dell'utente. Omessi → i default, come in lista. */
  actionColors?: Record<TileActionKey, string>;
  /** Svuota la conversazione. Omessa → nessun pulsante (anteprima statica). */
  onClear?: () => void;
}

export function ObsidianAskScreen({
  messages, input, onInput, onSend, isLoading,
  attachment, onAttach, onRemoveAttachment, onBack,
  onOpenTile, actionColors, onClear,
}: ObsidianAskScreenProps = {}) {
  const c = useObsidian();
  const live = messages !== undefined;
  // Dettatura vocale nel campo di scrittura, come nella nota di cattura. Se il
  // modulo nativo non c'è (build non ricostruita) `toggle` avvisa e basta.
  const dictation = useDictation({
    onText: (t) => onInput?.(t),
    onError: (m) => toast.warning(m),
  });
  /** Invio possibile: non è già in corso una risposta e c'è del testo. */
  const canSend = !isLoading && !!(input ?? '').trim();
  const tileColors = actionColors ?? DEFAULT_ACTION_COLORS;
  const hasMessages = (messages?.length ?? 0) > 0;

  // ── Il thread resta incollato in fondo ──────────────────────────────────────
  const threadRef = React.useRef<ScrollView>(null);
  const scrollToEnd = React.useCallback(() => {
    // Un frame di attesa: nel tick in cui lo stato cambia il nuovo contenuto non
    // è ancora misurato, e uno `scrollToEnd` fatto adesso si fermerebbe
    // all'altezza vecchia — cioè poco sopra il punto giusto, che è il modo più
    // fastidioso di sbagliare.
    requestAnimationFrame(() => threadRef.current?.scrollToEnd({ animated: true }));
  }, []);

  // Mentre scrivi o detti, il compositore CRESCE (fino a sei righe) e mangia
  // altezza al thread da sotto: senza questo, l'ultimo messaggio scivola fuori
  // vista proprio mentre stai parlando.
  React.useEffect(() => {
    scrollToEnd();
  }, [input, attachment, isLoading, scrollToEnd]);

  // La tastiera che si apre riduce la finestra: stesso effetto, altra causa.
  React.useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', scrollToEnd);
    return () => sub.remove();
  }, [scrollToEnd]);

  /**
   * Invio: chiude la dettatura PRIMA di mandare.
   *
   * Prima non la toccava nessuno, e il microfono sembrava spegnersi da sé —
   * in realtà era Android che chiude il riconoscitore dopo il silenzio con cui
   * smetti di parlare per premere invio. Sembrava una nostra scelta e non lo era.
   *
   * `reset` e non `stop`: `stop` lascia in piedi gli accumulatori della sessione
   * (il testo di partenza e i segmenti già finalizzati), e al primo risultato che
   * arriva in ritardo `compose` li riscriverebbe nel campo — cioè il messaggio
   * appena inviato RICOMPARIVA sotto le dita. `reset` annulla e azzera, quindi
   * il campo resta vuoto e la dettatura successiva riparte da zero.
   */
  // L'Invio da tastiera arriva per due strade diverse a seconda della
  // piattaforma (vedi `handleChangeText`), e non c'è modo di sapere in anticipo
  // quale. Le lasciamo attive entrambe e ci difendiamo qui: una finestra breve
  // scarta il secondo colpo se per caso scattassero insieme, senza toccare in
  // alcun modo l'invio normale.
  const lastSentAt = React.useRef(0);
  const handleSend = React.useCallback(() => {
    const now = Date.now();
    if (now - lastSentAt.current < 300) return;
    lastSentAt.current = now;
    dictation.reset();
    onSend?.();
  }, [dictation, onSend]);

  /**
   * Invio da tastiera = freccia di invio.
   *
   * Su un campo `multiline` non si può usare `onSubmitEditing`: su iOS non
   * scatta proprio, su Android è incostante. L'unico segnale affidabile è il
   * testo stesso — l'a capo appena comparso in fondo.
   *
   * La condizione è stretta di proposito: UN carattere in più, ed è "\n", e il
   * resto è identico a prima. Un incollaggio multiriga ne aggiunge molti in una
   * volta e NON deve partire da solo: è il modo più facile di mandare per
   * sbaglio un testo che si stava solo preparando.
   *
   * Se non c'è niente da mandare l'a capo viene ingoiato invece che scritto: il
   * pulsante in quel momento è spento, e una tastiera che si comporta
   * diversamente dal pulsante accanto è peggio di una che non fa nulla.
   */
  const handleChangeText = React.useCallback((next: string) => {
    const prev = input ?? '';
    const isEnter = next.length === prev.length + 1 && next.endsWith('\n') && next.slice(0, -1) === prev;
    if (!isEnter) { onInput?.(next); return; }
    if (canSend) handleSend();
  }, [input, canSend, handleSend, onInput]);

  /**
   * A capo esplicito, dato che l'Invio ora manda.
   *
   * Su tastiera software non esiste un equivalente affidabile di Maiusc+Invio,
   * e comunque sarebbe una scorciatoia invisibile: qui l'a capo è un tasto che
   * si vede. Senza, scrivere un messaggio su più righe diventerebbe impossibile
   * — e non è un caso di nicchia, è come si scrive una richiesta articolata.
   *
   * Inserisce nel punto del cursore, non in fondo: l'ultima posizione nota
   * arriva da `onSelectionChange`. Chiama `onInput` DIRETTAMENTE e non
   * `handleChangeText`, altrimenti l'a capo appena aggiunto verrebbe scambiato
   * per un Invio e manderebbe il messaggio.
   */
  const selection = React.useRef({ start: 0, end: 0 });
  const insertNewline = React.useCallback(() => {
    const text = input ?? '';
    const s = Math.min(Math.max(selection.current.start, 0), text.length);
    const e = Math.min(Math.max(selection.current.end, s), text.length);
    const next = `${text.slice(0, s)}\n${text.slice(e)}`;
    selection.current = { start: s + 1, end: s + 1 };
    onInput?.(next);
  }, [input, onInput]);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.canvas }}>
      <ObsidianStatusBar />

      {/* Indietro in alto a sinistra. Prima si contava solo sul tasto di
          sistema e sullo swipe dal bordo: gesti che esistono, ma che non si
          vedono — su una schermata aperta a tutto campo dall'header non c'è
          nessun segno di come tornare indietro.
          Riga leggera e senza bordo, non una barra piena: la schermata resta
          quella che comincia dal thread. Metriche del canone «indietro su
          schermata secondaria» (SparksScreen, BufferScreen), non quelle
          dell'header principale, che sono per i quadrati di navigazione.
          Lo spazio sotto la status bar lo tiene già `ObsidianStatusBar`, che
          riempie l'inset. */}
      {onBack ? (
        <View style={{ height: 54, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 }}>
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Indietro"
            hitSlop={6}
            style={({ pressed }) => ({ width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
          >
            <IconArrowLeft size={19} color={c.muted} strokeWidth={1.8} />
          </Pressable>
        </View>
      ) : null}

      {/* Thread */}
      <ScrollView
        ref={threadRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 13 }}
        // Il contenuto cresce anche DOPO il cambio di stato: il markdown di una
        // risposta lunga si misura in un secondo momento, e uno scroll legato al
        // solo arrivo del messaggio si fermerebbe all'altezza di prima. Questo
        // evento scatta ad altezza definitiva.
        onContentSizeChange={scrollToEnd}
      >
        {live ? (
          <>
            {messages!.length === 0 && !isLoading && (
              <BotWrap c={c}><Bubble c={c}>Ciao! Sono Bito. Chiedimi qualcosa sui tuoi tile e spark.</Bubble></BotWrap>
            )}
            {messages!.map((m) => (
              m.role === 'user'
                ? <UserMsg key={m.id} c={c}>{m.content}</UserMsg>
                : (
                  <BotWrap key={m.id} c={c}>
                    <Bubble c={c}>{m.content}</Bubble>
                    {/* Le card DENTRO il wrapper del bot, non sotto: sono parte
                        della risposta, e allineate al testo si leggono come un
                        unico turno invece che come un blocco a sé. */}
                    {m.tiles?.length ? (
                      <TileResults c={c} tiles={m.tiles} actionColors={tileColors} onOpenTile={onOpenTile} />
                    ) : null}
                  </BotWrap>
                )
            ))}
            {isLoading && <BotWrap c={c}><Bubble c={c}>…</Bubble></BotWrap>}
          </>
        ) : (
          <>
            <BotWrap c={c}><Bubble c={c}>Ciao Ruslan. 5 tile per oggi e 4 spark nel buffer. Da dove partiamo?</Bubble></BotWrap>
            <UserMsg c={c}>Trasforma la nota vocale di stamattina in un evento per la call con Marco alle 16.</UserMsg>
            <BotWrap c={c}>
              <Bubble c={c}>Fatto. Ho creato questo evento — lo confermi?</Bubble>
              <TileResult c={c} />
              <ConfirmRow c={c} />
            </BotWrap>
            <UserMsg c={c}>Perfetto. Cosa scade questa settimana?</UserMsg>
            <BotWrap c={c}><Bubble c={c}>Una scadenza: certificato Aruba, lun 30/06. Ti ricordo domenica sera?</Bubble></BotWrap>
          </>
        )}
      </ScrollView>

      {/* Composer */}
      <View style={{ paddingHorizontal: 14, paddingBottom: 12 }}>
        {/* Allegato scelto e non ancora inviato: sta SOPRA il campo, dentro la
            stessa pastiglia. Deve vedersi prima di premere invio — un file che
            parte senza che si sappia quale è il modo peggiore di allegare. */}
        {attachment && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.field, borderTopLeftRadius: 14, borderTopRightRadius: 14, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8 }}>
            <IconPaperclip size={16} color={c.accent} strokeWidth={1.9} />
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 13.5, fontWeight: '600', color: c.text }}>{attachment.name}</Text>
            {/* La X toglie l'allegato: a 14 in `subtle` era il glifo meno
                visibile della schermata, ed è l'unico modo di annullare. */}
            <Pressable onPress={onRemoveAttachment} hitSlop={12} accessibilityLabel="Togli l'allegato">
              <IconX size={18} color={c.muted} strokeWidth={2} />
            </Pressable>
          </View>
        )}
        {/* Casella a due righe: sopra si scrive, sotto stanno i comandi.
            Il campo ora è `multiline` — con una riga sola un testo lungo
            scorreva via mentre lo si scriveva, e dopo una dettatura non si
            riusciva a rileggere quello che era finito nel campo. Cresce fino a
            120dp e poi scorre da sé.
            L'Invio da tastiera MANDA, come la freccia: lo intercetta
            `handleChangeText` qui sotto. Il pulsante resta, ed è il solo pieno
            d'accento perché è l'azione. */}
        <View style={{ backgroundColor: c.field, borderRadius: 14, borderTopLeftRadius: attachment ? 0 : 14, borderTopRightRadius: attachment ? 0 : 14, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8 }}>
          <TextInput
            value={input}
            onChangeText={handleChangeText}
            editable={!isLoading}
            multiline
            // Il tasto mostra "invia" invece del glifo di a capo, dove la
            // piattaforma lo consente: l'aspetto della tastiera deve dire cosa
            // farà davvero premerla.
            returnKeyType="send"
            // `submitBehavior="submit"` fa sì che il tasto INVII invece di
            // andare a capo, tenendo il fuoco nel campo. Dove è onorato l'a capo
            // non arriva mai al testo, quindi serve anche questo aggancio: le
            // due strade si escludono a vicenda in pratica, e `handleSend` si
            // difende comunque dal doppio colpo.
            submitBehavior="submit"
            onSubmitEditing={() => { if (canSend) handleSend(); }}
            // Serve al tasto a capo per sapere DOVE inserire. In un ref e non
            // in stato: cambia a ogni tocco nel campo, e non deve far
            // ridisegnare la schermata a ogni spostamento del cursore.
            onSelectionChange={(e) => { selection.current = e.nativeEvent.selection; }}
            placeholder={dictation.listening ? 'Sto ascoltando…' : 'Chiedi a Gimmick…'}
            placeholderTextColor={c.subtle}
            // Stesso corpo delle bolle: quello che scrivi e quello che leggi
            // devono avere la stessa misura, o il campo sembra una didascalia.
            // `textAlignVertical` serve solo ad Android, dove un multilinea
            // centrerebbe la prima riga invece di ancorarla in alto.
            textAlignVertical="top"
            style={{
              fontSize: MSG_FONT, lineHeight: MSG_LINE, color: c.text, padding: 0,
              minHeight: MSG_LINE * INPUT_MIN_LINES,
              maxHeight: MSG_LINE * INPUT_MAX_LINES,
            }}
          />

          {/* Seconda riga — comandi. I glifi sono a 22 e in colore TESTO, non
              più a 16 in `subtle`: erano corretti come icone di contorno, ma
              qui sono gli unici comandi della schermata e a quel contrasto si
              intuivano più che vedersi. Riquadri da 40 con `hitSlop`: sopra la
              soglia di tocco senza gonfiare la barra.

              ATTENZIONE — i fondi stanno su una `View` INTERNA e i `Pressable`
              hanno stile STATICO. Con lo stile a funzione (`({ pressed }) =>`)
              su Android il `backgroundColor` non viene disegnato: qui il tondo
              accent dell'invio spariva e restava la sola freccia in `accentInk`
              (#1b0d2e in tema scuro, quasi nero) su fondo scuro — sembrava un
              problema di contrasto ed era un problema di layout. È lo stesso
              schema del FAB in CaptureScreen, che per questo funziona. Il
              feedback al tocco lo dà `android_ripple`. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
            {/* Graffetta: sceglie un file e lo allega al PROSSIMO messaggio.
                Accesa quando c'è già un allegato — se ne porta uno per volta, e
                un secondo tocco serve a sostituirlo. */}
            <Pressable
              onPress={onAttach}
              disabled={!onAttach || isLoading}
              accessibilityRole="button"
              accessibilityLabel={attachment ? 'Sostituisci allegato' : 'Allega un file'}
              android_ripple={{ color: c.accent + '33', borderless: true }}
              hitSlop={6}
            >
              <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: attachment ? c.accentSoft : 'transparent', opacity: onAttach ? 1 : 0.35 }}>
                <IconPaperclip size={22} color={attachment ? c.accent : c.text} strokeWidth={1.9} />
              </View>
            </Pressable>

            {/* Microfono = DETTATURA, non messaggio vocale: scrive nel campo e
                il testo resta modificabile prima dell'invio. Stesso motore
                della nota in cattura (useDictation), stesso comportamento. */}
            <Pressable
              onPress={() => dictation.toggle(input ?? '')}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel={dictation.listening ? 'Ferma la dettatura' : 'Detta il messaggio'}
              android_ripple={{ color: c.accent + '33', borderless: true }}
              hitSlop={6}
            >
              <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: dictation.listening ? c.accentSoft : 'transparent' }}>
                <IconMicrophone size={22} color={dictation.listening ? c.accent : c.text} strokeWidth={1.9} />
              </View>
            </Pressable>

            {/* A capo. Da quando l'Invio manda, questo è l'UNICO modo di andare
                a capo su tastiera software: Maiusc+Invio lì non esiste, e una
                scorciatoia invisibile non sarebbe una risposta. Sta con gli
                altri comandi di scrittura, a sinistra, non con le azioni. */}
            <Pressable
              onPress={insertNewline}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel="Vai a capo"
              android_ripple={{ color: c.accent + '33', borderless: true }}
              hitSlop={6}
            >
              <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', opacity: isLoading ? 0.35 : 1 }}>
                <IconCornerDownLeft size={22} color={c.text} strokeWidth={1.9} />
              </View>
            </Pressable>

            <View style={{ flex: 1 }} />

            {/* Svuota la conversazione. Da quando la chat è persistente non se
                ne va più da sé uscendo dalla schermata, quindi ci vuole un modo
                esplicito di chiuderla. Spento a chat vuota: un pulsante che non
                ha niente da fare non deve sembrare premibile.
                Accanto all'invio ma NON pieno d'accento — l'azione della barra
                resta una sola, e questa è di servizio. */}
            {onClear ? (
              <Pressable
                onPress={onClear}
                disabled={!hasMessages || isLoading}
                accessibilityRole="button"
                accessibilityLabel="Svuota la conversazione"
                accessibilityState={{ disabled: !hasMessages }}
                android_ripple={{ color: c.deadline + '33', borderless: true }}
                hitSlop={6}
              >
                <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', opacity: hasMessages && !isLoading ? 1 : 0.35 }}>
                  <IconEraser size={22} color={c.text} strokeWidth={1.9} />
                </View>
              </Pressable>
            ) : null}

            {/* Invio in fondo a destra: pieno d'accento perché è l'azione, e
                perché da quando il campo è multilinea è l'UNICO modo di mandare
                il messaggio. Spento finché non c'è niente da mandare. */}
            <Pressable
              onPress={handleSend}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel="Invia"
              accessibilityState={{ disabled: !canSend }}
              android_ripple={{ color: '#ffffff33', borderless: true }}
            >
              {/* Freccia BIANCA e tondo ACCENT PROFONDO, gli stessi in
                  entrambi i temi. `c.accent` in tema scuro è il lavanda
                  #AB9FF2: sotto un glifo bianco ha poco stacco, e `accentInk`
                  (#1b0d2e) è un quasi-nero tarato sul viola del tema chiaro.
                  `SEND_BG` è quel viola profondo — bianco sopra, contrasto
                  pieno, e il pulsante è identico in chiaro e in scuro. */}
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: SEND_BG, alignItems: 'center', justifyContent: 'center', opacity: canSend ? 1 : 0.4 }}>
                <IconSend size={20} color="#FFFFFF" strokeWidth={2.6} />
              </View>
            </Pressable>
          </View>
        </View>
      </View>

      <ObsidianNavPill />
    </KeyboardAvoidingView>
  );
}
