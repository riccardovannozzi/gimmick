/**
 * Gimmick · Obsidian — La LIST di un tile.
 *
 * Una riga = UN CAMPO. Vale per ogni tipo di tile, flow compresi: i passi di un
 * flow SONO le voci di questa lista, non una seconda entità con una schermata
 * sua. Ciò che il vecchio tab Flow diceva con tre controlli in più (contatto,
 * data, stato) è stato ripiegato nel testo al momento della migrazione
 * ("Attesa risposta — Alessandro Bisdomini · 03/06/26"), che è anche l'unico
 * modo perché due attese sulla stessa cosa ma su persone diverse restino due
 * righe distinguibili. Stessa decisione della sidebar web — vedi la nota in
 * cima a `frontend/components/tileview/SubtaskList.tsx`.
 *
 * Componente PRESENTAZIONALE: riceve le voci già lette e restituisce intenzioni.
 * Le query e le mutation stanno in `TileScreenLive`, così la preview QA statica
 * non va in rete.
 *
 * ─── Perché le frecce e non il trascinamento ─────────────────────────────────
 *
 * Sul web le voci si riordinano trascinandole. Qui no: un drag verticale dentro
 * una schermata che scorre in verticale litiga con lo scorrimento, e per
 * distinguerli servirebbe una pressione prolungata — cioè un gesto nascosto su
 * un'azione che deve restare evidente. Due frecce non si possono fraintendere.
 */
import React from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { IconCheck, IconChevronUp, IconChevronDown, IconTrash, IconPlus } from '@tabler/icons-react-native';
import { useObsidian } from '@/lib/obsidian';
import { OB_BTN_H, type ObsidianColors } from '@/constants/obsidian';
import type { Subtask } from '@/types';

/** Corpo del testo: lo stesso dei campi del dettaglio tile. */
const TEXT = 15;
const LINE = 20;

export interface ObsidianSubtaskListProps {
  /** Voci già ordinate per `sort_order`. */
  items?: Subtask[];
  loading?: boolean;
  /** Assenti (preview QA) → la lista è in sola lettura. */
  onToggle?: (id: string, isDone: boolean) => void;
  onChangeText?: (id: string, content: string) => void;
  onAdd?: () => void;
  onDelete?: (id: string) => void;
  /** Sposta la voce di una posizione. Il chiamante riscrive i `sort_order`. */
  onMove?: (from: number, to: number) => void;
}

export function ObsidianSubtaskList({
  items = [], loading, onToggle, onChangeText, onAdd, onDelete, onMove,
}: ObsidianSubtaskListProps) {
  const c = useObsidian();
  const editable = !!onChangeText;

  if (loading) {
    return <Text style={{ fontSize: 13, color: c.subtle, paddingVertical: 12 }}>Caricamento…</Text>;
  }

  return (
    <View style={{ gap: 8 }}>
      {items.length === 0 ? (
        <Text style={{ fontSize: 13, color: c.subtle, paddingVertical: 4 }}>Nessun elemento.</Text>
      ) : items.map((s, i) => (
        <SubtaskRow
          key={s.id}
          c={c}
          subtask={s}
          isFirst={i === 0}
          isLast={i === items.length - 1}
          editable={editable}
          onToggle={onToggle ? () => onToggle(s.id, !s.is_done) : undefined}
          onChangeText={onChangeText ? (text) => onChangeText(s.id, text) : undefined}
          onDelete={onDelete ? () => onDelete(s.id) : undefined}
          onUp={onMove ? () => onMove(i, i - 1) : undefined}
          onDown={onMove ? () => onMove(i, i + 1) : undefined}
        />
      ))}

      {onAdd ? (
        <Pressable
          onPress={onAdd}
          android_ripple={{ color: c.accent + '22' }}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
            minHeight: OB_BTN_H, borderRadius: 11,
            // Tratteggiato come sul web: dice "qui ci va altro", non "premi qui
            // per confermare". Un fondo pieno l'avrebbe fatto pesare quanto le
            // voci che sta sotto.
            borderWidth: 1, borderStyle: 'dashed', borderColor: c.line2,
          }}
        >
          <IconPlus size={15} color={c.muted} strokeWidth={2} />
          <Text style={{ fontSize: TEXT, fontWeight: '600', color: c.muted }}>Aggiungi elemento</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function SubtaskRow({
  c, subtask, isFirst, isLast, editable, onToggle, onChangeText, onDelete, onUp, onDown,
}: {
  c: ObsidianColors; subtask: Subtask; isFirst: boolean; isLast: boolean; editable: boolean;
  onToggle?: () => void; onChangeText?: (text: string) => void; onDelete?: () => void;
  onUp?: () => void; onDown?: () => void;
}) {
  // Testo in stato locale mentre si scrive, scritto sul server all'uscita dal
  // campo: salvare a ogni battuta manderebbe una richiesta per carattere. Stessa
  // regola del titolo del tile.
  const [value, setValue] = React.useState(subtask.content);
  const dirty = React.useRef(false);
  React.useEffect(() => {
    if (!dirty.current) setValue(subtask.content);
  }, [subtask.content]);
  const commit = () => {
    if (!dirty.current) return;
    dirty.current = false;
    onChangeText?.(value);
  };
  // Commit anche allo smontaggio: uscendo dal dettaglio col campo ancora a
  // fuoco, l'evento di blur può non arrivare mai e la modifica si perderebbe in
  // silenzio.
  const latest = React.useRef({ value, commit });
  latest.current = { value, commit };
  React.useEffect(() => () => { latest.current.commit(); }, []);

  // Eliminazione a due tocchi: il primo arma, il secondo cancella, e dopo tre
  // secondi si disarma da sé. Un dialogo di conferma per una riga di testo
  // sarebbe sproporzionato; nessuna conferma, con il cestino a un dito dal
  // testo, sarebbe un incidente che aspetta di succedere.
  const [armed, setArmed] = React.useState(false);
  React.useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);

  // Un passo annullato si legge come uno fatto — barrato e spento — perché in
  // entrambi i casi non c'è più niente da farci. Un passo BLOCCATO invece resta
  // a piena voce: è fermo, non chiuso, ed è quello che devi ancora sbloccare.
  const spent = subtask.is_done || subtask.state === 'cancelled';

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: c.field, borderRadius: 11, paddingHorizontal: 10, paddingVertical: 8 }}>
      {/* Spunta */}
      <Pressable
        onPress={onToggle}
        disabled={!onToggle}
        hitSlop={8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: subtask.is_done }}
        style={{
          width: 20, height: 20, marginTop: 3, borderRadius: 6,
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: subtask.is_done ? c.accent : 'transparent',
          borderWidth: 1.5, borderColor: subtask.is_done ? c.accent : c.subtle,
        }}
      >
        {subtask.is_done ? <IconCheck size={12} color={c.accentInk} strokeWidth={3} /> : null}
      </Pressable>

      <TextInput
        value={value}
        onChangeText={(t) => { setValue(t); dirty.current = true; }}
        onBlur={commit}
        editable={editable}
        multiline
        placeholder="Scrivi…"
        placeholderTextColor={c.subtle}
        style={{
          flex: 1, minHeight: 26, paddingTop: 3, paddingBottom: 0,
          fontSize: TEXT, lineHeight: LINE,
          color: spent ? c.subtle : c.text,
          textDecorationLine: spent ? 'line-through' : 'none',
        }}
      />

      {/* Sposta — colonna stretta: le due frecce impilate occupano la larghezza
          di un pulsante solo. Agli estremi la freccia che non ha dove andare si
          spegne invece di sparire, così la colonna non cambia larghezza da una
          riga all'altra. */}
      {onUp && onDown ? (
        <View style={{ width: 22 }}>
          <Pressable onPress={isFirst ? undefined : onUp} disabled={isFirst} hitSlop={6} accessibilityLabel="Sposta su" style={{ height: 20, alignItems: 'center', justifyContent: 'center', opacity: isFirst ? 0.25 : 1 }}>
            <IconChevronUp size={16} color={c.muted} strokeWidth={2} />
          </Pressable>
          <Pressable onPress={isLast ? undefined : onDown} disabled={isLast} hitSlop={6} accessibilityLabel="Sposta giù" style={{ height: 20, alignItems: 'center', justifyContent: 'center', opacity: isLast ? 0.25 : 1 }}>
            <IconChevronDown size={16} color={c.muted} strokeWidth={2} />
          </Pressable>
        </View>
      ) : null}

      {onDelete ? (
        <Pressable
          onPress={() => { if (armed) onDelete(); else setArmed(true); }}
          hitSlop={8}
          accessibilityLabel={armed ? 'Conferma eliminazione' : 'Elimina'}
          style={{
            width: 26, height: 26, marginTop: 3, borderRadius: 7,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: armed ? c.error : 'transparent',
          }}
        >
          <IconTrash size={15} color={armed ? '#FFFFFF' : c.subtle} strokeWidth={1.9} />
        </Pressable>
      ) : null}
    </View>
  );
}
