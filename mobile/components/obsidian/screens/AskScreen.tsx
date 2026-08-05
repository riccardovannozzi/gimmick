/**
 * Gimmick · Obsidian — Mobile Ask Gimmick (chat).
 *
 * Bito-led assistant chat: user/bot bubbles, an inline tile-result + confirm
 * row and a composer. Reference: GimmickMobileAsk.dc.html.
 */
import React from 'react';
import { View, Text, Pressable, ScrollView, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import Markdown from 'react-native-markdown-display';
import {
  IconPaperclip, IconMicrophone, IconSend,
  IconTag, IconCheck, IconAlignLeft, IconX,
} from '@tabler/icons-react-native';
import { useObsidian } from '@/lib/obsidian';
import { useDictation } from '@/hooks/useDictation';
import { toast } from '@/store';
import { OB_BTN_H, type ObsidianColors } from '@/constants/obsidian';
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

export interface AskMessage { id: string; role: 'user' | 'assistant'; content: string }

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
}

export function ObsidianAskScreen({
  messages, input, onInput, onSend, isLoading,
  attachment, onAttach, onRemoveAttachment,
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

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.canvas }}>
      <ObsidianStatusBar />

      {/* Niente barra in cima: la schermata comincia dal thread.
          Si esce col tasto indietro di sistema (Android) o con lo swipe dal
          bordo (iOS), che la Stack di expo-router lascia attivo di suo — la
          rotta non dichiara opzioni proprie e eredita `headerShown: false` +
          `slide_from_right` da app/_layout.tsx.
          Lo spazio sotto la status bar lo tiene già `ObsidianStatusBar`, che
          riempie l'inset: il primo messaggio non finisce sotto l'orologio. */}

      {/* Thread */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 13 }}>
        {live ? (
          <>
            {messages!.length === 0 && !isLoading && (
              <BotWrap c={c}><Bubble c={c}>Ciao! Sono Bito. Chiedimi qualcosa sui tuoi tile e spark.</Bubble></BotWrap>
            )}
            {messages!.map((m) => (
              m.role === 'user'
                ? <UserMsg key={m.id} c={c}>{m.content}</UserMsg>
                : <BotWrap key={m.id} c={c}><Bubble c={c}>{m.content}</Bubble></BotWrap>
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
            CONSEGUENZA: l'invio da tastiera non c'è più (su un campo multilinea
            l'Invio va a capo). A mandare è il pulsante della seconda riga, che
            per questo è il solo pieno d'accento. */}
        <View style={{ backgroundColor: c.field, borderRadius: 14, borderTopLeftRadius: attachment ? 0 : 14, borderTopRightRadius: attachment ? 0 : 14, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8 }}>
          <TextInput
            value={input}
            onChangeText={onInput}
            editable={!isLoading}
            multiline
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

            <View style={{ flex: 1 }} />

            {/* Invio in fondo a destra: pieno d'accento perché è l'azione, e
                perché da quando il campo è multilinea è l'UNICO modo di mandare
                il messaggio. Spento finché non c'è niente da mandare. */}
            <Pressable
              onPress={onSend}
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
