'use client';

/**
 * Gimmick · Canvas — ContactSidebar.
 *
 * Pannello destro di un SOGGETTO o di un'ORGANIZZAZIONE appuntati sulla
 * lavagna. Un file solo per due oggetti, perché dietro c'è una cosa sola: una
 * riga di `contacts`. Il soggetto è un contatto `person`, l'organizzazione un
 * contatto `company` — stessi quattro campi, stesso pannello.
 *
 * ⚠️ Qui si modifica la RUBRICA, non il disegno. Rinominare da questo pannello
 * cambia quel contatto ovunque compaia: su ogni altra lavagna, nella modale dei
 * contatti, nei passi dei tile che lo referenziano. È il punto di averli messi
 * in un posto solo, ma va detto — un pannello che sembra locale e scrive globale
 * sarebbe una trappola. Per questo il pulsante in fondo dice «togli dalla
 * lavagna» e non «elimina»: da qui si toglie il segno, non la persona.
 *
 * Sulla lavagna si legge solo la denominazione; gli altri campi si leggono da
 * qui. È deliberato: una lavagna è fatta di oggetti che si guardano da lontano,
 * e un indirizzo email sotto ogni figura sarebbe rumore per il 99% del tempo in
 * cui la si guarda per capire com'è messo il lavoro.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  IconLayoutSidebarRightCollapse, IconLayoutSidebarRightExpand, IconTrash,
  IconUser, IconBuilding, IconCheck, IconChevronDown, IconSearch,
} from '@tabler/icons-react';
import { usePixelTheme } from '@/components/pixel';
import { OB_WEIGHT, OB_TEXT, obLabel } from '@/lib/theme/ob-typography';
import type { CanvasContact } from '@/components/canvas/CanvasBoard';

/** I campi dell'anagrafica. `notes` è l'unico multiriga: gli altri sono dati di
 *  una riga sola per definizione.
 *
 *  La DENOMINAZIONE non è in questo elenco: è l'unico campo che oltre a
 *  scriversi si cerca — vedi `NameField` — e disegnarla col ciclo avrebbe voluto
 *  dire un ramo `if (key === 'name')` dentro il ciclo, che è il modo lungo di
 *  dire che non ci appartiene. */
type FieldKey = 'name' | 'email' | 'phone' | 'notes';
const NAME_PLACEHOLDER = 'Nome e cognome, o ragione sociale';
const FIELDS: { key: Exclude<FieldKey, 'name'>; label: string; placeholder: string; area?: boolean }[] = [
  { key: 'email', label: 'Mail', placeholder: 'nome@dominio.it' },
  { key: 'phone', label: 'Telefono', placeholder: '+39 …' },
  { key: 'notes', label: 'Note', placeholder: 'Cosa serve ricordarsi', area: true },
];

/** Quanto può essere alto un menù, e quindi se si apre in giù o in su. */
const MENU_MAX_H = 260;

/**
 * UN MENÙ ANCORATO A UN CAMPO: dove si apre, e che cosa lo chiude.
 *
 * Serve a due campi di questo pannello (le organizzazioni e la denominazione) e
 * sta scritto una volta perché le tre regole che contiene si sbagliano tutte
 * allo stesso modo se copiate:
 *   · in GIÙ se ci sta, in SU altrimenti — il pannello è alto quanto la finestra
 *     e i suoi campi in fondo aprirebbero fuori schermo;
 *   · il clic FUORI chiude, ma non quello sul campo stesso (che lo riaprirebbe
 *     un istante dopo averlo chiuso) né quello dentro il menù;
 *   · lo SCORRIMENTO chiude. Il menù vive in un portale con coordinate fisse —
 *     l'unica forma che il corpo del pannello, che ha `overflow`, non taglia al
 *     primo bordo — e scorrendo resterebbe appeso a un punto che non è più
 *     quello del campo. `capture`: lo scroll è di un contenitore interno e a
 *     `document` per bolla non arriva.
 */
function useAnchoredMenu(
  open: boolean,
  anchorRef: React.RefObject<HTMLElement | null>,
  menuRef: React.RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  // In un ref: la funzione cambia identità a ogni render del genitore, e nelle
  // dipendenze rimonterebbe i listener di continuo.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const r = anchorRef.current?.getBoundingClientRect();
    if (r) {
      const below = r.bottom + 4;
      setPos({
        top: below + MENU_MAX_H > window.innerHeight - 8
          ? Math.max(8, r.top - MENU_MAX_H - 4)
          : below,
        left: r.left,
        width: r.width,
      });
    }
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      closeRef.current();
    };
    const onScroll = () => closeRef.current();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [open, anchorRef, menuRef]);

  return pos;
}

/** La scatola del menù: stessa forma per i due che ci sono. */
function menuBox(theme: ReturnType<typeof usePixelTheme>, pos: { top: number; left: number; width: number }): React.CSSProperties {
  return {
    top: pos.top, left: pos.left, width: pos.width, zIndex: 9999,
    background: theme.surface,
    border: `1px solid ${theme.border}`,
    borderRadius: 'var(--ob-radius-md)',
    boxShadow: 'var(--ob-shadow-card)',
    padding: 4,
    maxHeight: MENU_MAX_H, overflowY: 'auto',
  };
}

/** Una voce di menù. Costante e non funzione del tema: il colore del testo lo
 *  decide chi la usa, in base a se la voce è spuntata o no. */
const MENU_ROW: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
  padding: '6px 8px', textAlign: 'left',
  background: 'transparent', border: '1px solid transparent',
  borderRadius: 'var(--ob-radius-sm)',
  fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.control,
  cursor: 'pointer', minWidth: 0,
};

/**
 * DENOMINAZIONE — si scrive per rinominare, si cerca per collegare.
 *
 * Sono due gesti diversi sullo stesso campo, e vanno tenuti distinti perché
 * scrivono in due posti diversi:
 *   · SCRIVERE un nome rinomina il contatto in RUBRICA — ovunque compaia, su
 *     ogni lavagna e in ogni passo di flow che lo cita;
 *   · SCEGLIERE una voce del menù non tocca la rubrica: sposta questa FIGURA su
 *     un altro contatto.
 *
 * ⚠️ Ed è la ragione per cui questo campo, solo lui, non salva mentre si
 * digita come gli altri tre: scrivere «Mar» per cercare Mario Rossi avrebbe
 * rinominato «Mar» il contatto che si stava per abbandonare — e quel contatto
 * può essere condiviso da altre cinque lavagne. Qui il nome si scrive nel
 * momento in cui si esce dal campo o si preme Invio; scegliendo dal menù non si
 * esce (è il `preventDefault` sul mousedown) e quindi non si scrive niente.
 */
function NameField({ value, onValue, currentName, linkable, Glyph, onCommit, onRelink }: {
  value: string;
  onValue: (v: string) => void;
  /** Il nome com'è in rubrica adesso: serve a non riscrivere ciò che non è
   *  cambiato, e a rimettere le cose a posto con Esc. */
  currentName: string;
  /** I contatti su cui questa figura può essere spostata — già filtrati dal
   *  genitore: stesso ruolo, non sé stesso, non già posati su questa lavagna. */
  linkable: CanvasContact[];
  /** Tondo una persona, squadrato un insieme: la stessa forma della lavagna. */
  Glyph: React.ComponentType<{ size?: number; stroke?: number }>;
  onCommit: (name: string) => void;
  onRelink: (contactId: string) => void;
}) {
  const theme = usePixelTheme();
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const pos = useAnchoredMenu(open, inputRef, menuRef, () => setOpen(false));

  /**
   * ⚠️ La finestra fra lo spostamento e il suo effetto.
   *
   * Scegliendo dal menù il campo mostra SUBITO il nome scelto, ma `currentName`
   * arriva dal genitore un istante dopo — la PATCH sul box, poi il rifetch. In
   * quella finestra un `blur` confronterebbe il nome NUOVO col nome VECCHIO, li
   * vedrebbe diversi, e rinominerebbe col nome del nuovo il contatto appena
   * lasciato: che può essere su altre cinque lavagne.
   * Quindi la prima uscita dal campo dopo uno spostamento non scrive niente. Si
   * torna a scrivere appena il genitore si allinea, o appena si ridigita
   * qualcosa — la seconda condizione copre anche il caso in cui lo spostamento
   * fallisca e il genitore non si allinei mai.
   */
  const skipCommit = useRef(false);
  useEffect(() => { skipCommit.current = false; }, [currentName]);

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    const hit = q ? linkable.filter((c) => c.name.toLowerCase().includes(q)) : linkable;
    return [...hit].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 40);
  }, [linkable, value]);

  const commit = () => {
    if (skipCommit.current) return;
    const v = value.trim();
    // Il nome è l'unico campo obbligatorio: svuotarlo lascerebbe una figura
    // muta, quindi il campo vuoto torna al valore di prima invece di salvarsi.
    if (!v) { onValue(currentName); return; }
    if (v === currentName) return;
    onCommit(v);
  };

  const relink = (c: CanvasContact) => {
    skipCommit.current = true;
    // Il nome mostrato passa subito a quello scelto: la figura sulla lavagna ci
    // arriva un istante dopo, quando la PATCH è tornata.
    onValue(c.name);
    setOpen(false);
    onRelink(c.id);
  };

  return (
    <>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => { skipCommit.current = false; onValue(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => { commit(); setOpen(false); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
          else if (e.key === 'Escape') { e.preventDefault(); onValue(currentName); setOpen(false); }
        }}
        placeholder={NAME_PLACEHOLDER}
        style={{
          width: '100%', padding: '8px 10px',
          background: 'var(--ob-rail-field)', border: `1px solid ${open ? theme.accent : theme.border}`,
          borderRadius: 'var(--ob-radius-sm)', color: theme.ink,
          fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.control,
          lineHeight: 1.4, outline: 'none',
        }}
      />

      {open && pos && createPortal(
        <div ref={menuRef} className="fixed" style={menuBox(theme, pos)}>
          {/* L'occhiello dice a che cosa serve il menù, ed è necessario: senza,
              un elenco di nomi sotto un campo che si sta scrivendo si legge come
              un suggerimento di completamento, e queste voci fanno tutt'altro. */}
          <div
            style={{
              padding: '5px 8px 6px', color: theme.ink3,
              fontFamily: 'var(--ob-font-mono)', fontSize: OB_TEXT.eyebrow,
              letterSpacing: '0.08em', textTransform: 'uppercase',
            }}
          >
            Collega a un contatto esistente
          </div>
          {matches.length === 0 ? (
            <p
              style={{
                margin: 0, padding: '4px 8px 8px',
                color: theme.ink3, fontFamily: 'var(--ob-font-sans)',
                fontSize: OB_TEXT.meta, lineHeight: 1.5,
              }}
            >
              {value.trim()
                ? 'Nessuno con questo nome: quello che scrivi rinomina questo contatto.'
                : 'Nessun altro contatto disponibile.'}
            </p>
          ) : matches.map((c) => (
            <button
              key={c.id}
              type="button"
              // `mousedown` con `preventDefault`, non `click`: così il campo NON
              // perde il fuoco, e non perdendolo non scatta la rinomina con il
              // testo che si stava usando per cercare.
              onMouseDown={(e) => { e.preventDefault(); relink(c); }}
              title={`Sposta questa figura su ${c.name}`}
              style={{ ...MENU_ROW, color: theme.ink2 }}
            >
              <span style={{ display: 'inline-flex', flexShrink: 0, color: theme.ink3 }}>
                <Glyph size={13} stroke={1.8} />
              </span>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.name}
              </span>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}

/**
 * FA PARTE DI — le organizzazioni di questo contatto, dietro un pulsante.
 *
 * Erano un elenco di caselle sempre aperto. Funzionava con tre organizzazioni in
 * rubrica; con venti, la voce successiva del pannello — i membri — finiva sotto
 * uno schermo di spunte quasi tutte spente, e per leggere a quali due un
 * soggetto appartiene bisognava scorrere tutte e venti. Un pulsante mostra la
 * RISPOSTA (a quali appartiene) e tiene le opzioni dove servono: dentro il menù,
 * quando lo si apre.
 *
 * Il menù ha la stessa forma di quello dei tag: la ricerca è la prima riga, e
 * sotto le voci. Ma qui resta APERTO a ogni spunta — le organizzazioni sono
 * più d'una per definizione (è il senso della tabella `contact_organizations`),
 * e chiudersi dopo la prima costringerebbe a riaprire per la seconda.
 *
 * ⚠️ Vive in un PORTALE su `document.body`, come tutti i menù di questa app: il
 * corpo del pannello scorre dentro un contenitore con `overflow`, e un menù
 * figlio del pulsante verrebbe tagliato al primo bordo. Il prezzo è che le
 * coordinate sono fisse una volta aperto — per questo scorrere lo chiude.
 */
function OrganizationPicker({ options, selected, onToggle }: {
  options: CanvasContact[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const theme = usePixelTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const pos = useAnchoredMenu(open, triggerRef, menuRef, () => setOpen(false));

  const chosen = useMemo(
    () => options.filter((o) => selected.includes(o.id)),
    [options, selected],
  );
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const hit = q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options;
    // Alfabetico e basta: mettere le spuntate in cima le farebbe SALTARE sotto
    // il dito a ogni clic, che è il difetto peggiore in un menù che resta aperto
    // proprio per farne spuntare più d'una.
    return [...hit].sort((a, b) => a.name.localeCompare(b.name));
  }, [options, query]);

  // Aperto, la ricerca prende il fuoco; chiuso, si azzera — riaprendo non si
  // deve trovare il testo cercato la volta prima.
  useEffect(() => {
    if (!open) { setQuery(''); return; }
    const id = requestAnimationFrame(() => searchRef.current?.focus());
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={chosen.length ? chosen.map((o) => o.name).join(', ') : 'Scegli le organizzazioni'}
        style={{
          // `flex-start` e non `center`: con quattro organizzazioni il pulsante
          // è alto quattro righe, e una freccia a metà altezza si leggerebbe come
          // se appartenesse alla riga di mezzo.
          display: 'flex', alignItems: 'flex-start', gap: 8, width: '100%',
          padding: '7px 10px', textAlign: 'left',
          background: 'var(--ob-rail-field)',
          // Il bordo si accende quando c'è una risposta: in una colonna di campi
          // tutti uguali è ciò che distingue «compilato» da «da compilare» senza
          // doverlo leggere.
          border: `1px solid ${chosen.length ? theme.accent : theme.border}`,
          borderRadius: 'var(--ob-radius-sm)',
          color: chosen.length ? theme.ink : theme.ink3,
          fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.control,
          lineHeight: 1.4, cursor: 'pointer',
        }}
      >
        {/* Una PASTIGLIA per organizzazione, che va a capo: il pulsante cresce
            con le risposte invece di troncarle.
            Prima erano i nomi uniti da virgole su una riga sola, e con due
            organizzazioni si leggeva «Comune di Follonica, Comune di Gros…» —
            cioè la metà esatta dell'informazione, per giunta senza far capire
            che la seconda voce era una voce a sé e non la coda della prima. */}
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexWrap: 'wrap', gap: 4, paddingTop: 1 }}>
          {chosen.length ? chosen.map((o) => (
            <span
              key={o.id}
              style={{
                maxWidth: '100%',
                padding: '1px 7px',
                background: 'var(--ob-surface-2)',
                border: `1px solid ${theme.border}`,
                borderRadius: 'var(--ob-radius-pill)',
                color: theme.ink,
                fontSize: OB_TEXT.meta, lineHeight: 1.6,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
            >
              {o.name}
            </span>
          )) : 'Nessuna'}
        </span>
        <IconChevronDown
          size={14}
          style={{ flexShrink: 0, marginTop: 2, color: theme.ink3, transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 120ms ease-out' }}
        />
      </button>

      {open && pos && createPortal(
        <div ref={menuRef} className="fixed" style={menuBox(theme, pos)}>
          {/* La ricerca è la PRIMA riga del menù, non un campo separato sopra il
              pulsante: con poche organizzazioni non la si usa e non deve
              occupare spazio nel pannello; con molte è l'unico modo di
              arrivarci, ed è già a fuoco appena si apre. */}
          <div style={{ position: 'relative', marginBottom: 4 }}>
            <IconSearch
              size={13}
              style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: theme.ink3, pointerEvents: 'none' }}
            />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
                // Invio spunta la prima della lista: cercare per nome e dover
                // poi puntare il mouse sull'unica riga rimasta è mezzo gesto di
                // troppo.
                else if (e.key === 'Enter' && shown.length > 0) { e.preventDefault(); onToggle(shown[0].id); }
              }}
              placeholder="Cerca organizzazione…"
              style={{
                width: '100%', height: 30, padding: '0 8px 0 26px',
                background: 'var(--ob-rail-field)', border: `1px solid ${theme.border}`,
                borderRadius: 'var(--ob-radius-sm)', color: theme.ink,
                fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.control,
                outline: 'none',
              }}
            />
          </div>

          {shown.length === 0 ? (
            <p
              style={{
                margin: 0, padding: '10px 8px', textAlign: 'center',
                color: theme.ink3, fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.meta,
              }}
            >
              Nessun risultato
            </p>
          ) : shown.map((o) => {
            const on = selected.includes(o.id);
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => onToggle(o.id)}
                title={o.name}
                style={{ ...MENU_ROW, color: on ? theme.ink : theme.ink2 }}
              >
                {/* La spunta occupa il posto anche da spenta: senza, le righe
                    scorrerebbero di lato a ogni clic. */}
                <span
                  style={{
                    width: 14, height: 14, flexShrink: 0, borderRadius: 3,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    border: `1px solid ${on ? theme.accent : theme.border}`,
                    background: on ? theme.accent : 'transparent',
                    color: 'var(--ob-canvas)',
                  }}
                >
                  {on && <IconCheck size={10} stroke={3} />}
                </span>
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {o.name}
                </span>
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </>
  );
}

export interface ContactSidebarProps {
  /** Box selezionato. Fa da chiave allo specchio locale dei campi. */
  boxId: string;
  /** Che cosa è stato POSATO sulla lavagna. Decide il glifo e il vocabolario,
   *  e non cambia se un domani quel contatto viene riclassificato in rubrica. */
  variant: 'subject' | 'organization';
  /** L'anagrafica puntata. `null` nella finestra fra la posa e la comparsa del
   *  contatto nell'elenco, o se il contatto è stato cancellato altrove. */
  contact: CanvasContact | null;
  /** Le organizzazioni fra cui scegliere — già filtrate ed escluso sé stesso. */
  organizations: CanvasContact[];
  /** I contatti su cui questa FIGURA può essere spostata: stesso ruolo, non sé
   *  stesso, non già posati su questa lavagna. Alimenta la ricerca della
   *  denominazione — vedi `NameField`. */
  linkable: CanvasContact[];
  /** Id delle organizzazioni di cui questo contatto fa parte. */
  memberOf: string[];
  /** Solo per un'organizzazione: chi ne fa parte. Sola lettura. */
  members?: CanvasContact[];
  open: boolean;
  onToggle: () => void;
  /** Risale a ogni battuta: è il parent a ritardare specchio e salvataggio. */
  onChange: (patch: Partial<Record<FieldKey, string>>) => void;
  /** L'insieme INTERO, non un'aggiunta: è la forma del gesto (un elenco con
   *  delle spunte) ed è la forma dell'endpoint che lo riceve. */
  onOrganizationsChange: (orgIds: string[]) => void;
  /** Sposta questa figura su un ALTRO contatto. Non tocca la rubrica: cambia a
   *  chi punta il box, e il contatto lasciato resta dov'era. */
  onRelink: (contactId: string) => void;
  /** Toglie il box dalla lavagna. Il contatto resta in rubrica. */
  onRemoveFromBoard: () => void;
}

export function ContactSidebar({
  boxId, variant, contact, organizations, linkable, memberOf, members = [],
  open, onToggle, onChange, onOrganizationsChange, onRelink, onRemoveFromBoard,
}: ContactSidebarProps) {
  const theme = usePixelTheme();
  const isOrg = variant === 'organization';
  const Glyph = isOrg ? IconBuilding : IconUser;

  // Campi controllati in LOCALE: il valore del parent torna con lo specchio
  // ritardato (il canvas si ridisegna a fine digitazione, non a ogni tasto), e
  // legarli direttamente farebbe saltare il cursore a metà parola.
  const [draft, setDraft] = useState<Record<FieldKey, string>>({
    name: contact?.name ?? '', email: contact?.email ?? '',
    phone: contact?.phone ?? '', notes: contact?.notes ?? '',
  });
  // Su `boxId` E sull'id del contatto: rileggere a ogni cambio del contatto
  // riporterebbe indietro il campo mentre lo si sta scrivendo, ma passare a un
  // altro contatto senza rileggere mostrerebbe i dati del precedente.
  useEffect(() => {
    setDraft({
      name: contact?.name ?? '', email: contact?.email ?? '',
      phone: contact?.phone ?? '', notes: contact?.notes ?? '',
    });
  }, [boxId, contact?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const write = (key: FieldKey, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }));
    onChange({ [key]: value });
  };

  const toggleOrg = (id: string) => {
    const next = memberOf.includes(id) ? memberOf.filter((o) => o !== id) : [...memberOf, id];
    onOrganizationsChange(next);
  };

  const eyebrow = obLabel(theme);
  const fieldStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px',
    background: 'var(--ob-rail-field)', border: `1px solid ${theme.border}`,
    borderRadius: 'var(--ob-radius-sm)', color: theme.ink,
    fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.control,
    lineHeight: 1.4, outline: 'none',
  };
  const rowStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
    padding: '6px 8px', textAlign: 'left',
    background: 'var(--ob-rail-field)', border: `1px solid ${theme.border}`,
    borderRadius: 'var(--ob-radius-sm)', color: theme.ink2,
    fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.control,
    minWidth: 0,
  };
  /** Il testo di servizio che spiega un elenco vuoto. Stessa forma nei due
   *  posti che ne hanno uno. */
  const hint: React.CSSProperties = {
    color: theme.ink3, fontFamily: 'var(--ob-font-sans)',
    fontSize: OB_TEXT.meta, lineHeight: 1.5,
  };

  return (
    <div
      style={{
        borderLeft: `1px solid ${theme.border}`,
        background: 'var(--ob-rail-bg)',
        transition: 'width 200ms',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        width: open ? 280 : 32,
      }}
    >
      {/* Header: collapse + di chi stiamo parlando. Il titolo è la
          denominazione appena c'è: aperti tre pannelli di fila, «Soggetto»
          ripetuto tre volte non distingue i tre. */}
      <div
        style={{
          height: 'var(--ob-toolbar-height)',
          padding: open ? '0 8px' : 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: open ? 'flex-start' : 'center',
          gap: 8,
          borderBottom: `1px solid ${theme.border}`,
          flexShrink: 0,
        }}
      >
        <button
          onClick={onToggle}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent', border: 'none', cursor: 'pointer', color: theme.ink2, padding: 4,
          }}
          aria-label={open ? 'Comprimi' : 'Espandi'}
        >
          {open ? <IconLayoutSidebarRightCollapse size={16} /> : <IconLayoutSidebarRightExpand size={16} />}
        </button>
        {open && (
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 6, minWidth: 0,
              color: theme.ink, fontFamily: 'var(--ob-font-sans)',
              fontSize: OB_TEXT.control, fontWeight: OB_WEIGHT.emphasis,
            }}
          >
            {/* Stessa forma della lavagna, in piccolo: tondo una persona,
                squadrato un insieme di persone. */}
            <span
              style={{
                width: 18, height: 18, flexShrink: 0, overflow: 'hidden',
                borderRadius: isOrg ? 3 : '50%',
                background: 'var(--ob-surface-2)', border: `1px solid ${theme.border}`,
                color: theme.ink2, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {/* Il logo se c'è, il glifo altrimenti: la stessa regola della
                  figura sulla lavagna, così il pannello e il segno che descrive
                  si somigliano. Il logo si CARICA dalla rubrica, non da qui —
                  vedi `ContactEditModal`. */}
              {contact?.avatar_url
                /* eslint-disable-next-line @next/next/no-img-element */
                ? <img src={contact.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <Glyph size={11} stroke={1.8} />}
            </span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {draft.name.trim() || (isOrg ? 'Organizzazione' : 'Soggetto')}
            </span>
          </div>
        )}
      </div>

      {open && (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* DENOMINAZIONE — l'unico campo che si può anche NON scrivere: cercando
              si sceglie un contatto che c'è già, e la figura passa a lui. Le due
              cose sono distinte apposta — vedi la nota su `NameField`. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
            <span style={eyebrow}>Denominazione</span>
            <NameField
              value={draft.name}
              onValue={(v) => setDraft((d) => ({ ...d, name: v }))}
              currentName={contact?.name ?? ''}
              linkable={linkable}
              Glyph={Glyph}
              onCommit={(name) => onChange({ name })}
              onRelink={onRelink}
            />
          </div>

          {FIELDS.map((f) => (
            <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
              <span style={eyebrow}>{f.label}</span>
              {f.area ? (
                <textarea
                  value={draft[f.key]}
                  onChange={(e) => write(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  rows={4}
                  style={{ ...fieldStyle, resize: 'vertical', minHeight: 72 }}
                />
              ) : (
                <input
                  value={draft[f.key]}
                  onChange={(e) => write(f.key, e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                  placeholder={f.placeholder}
                  // `type` giusto: su desktop non cambia niente, ma è ciò che
                  // dà la tastiera con la @ e quella numerica sul touch.
                  type={f.key === 'email' ? 'email' : f.key === 'phone' ? 'tel' : 'text'}
                  style={fieldStyle}
                />
              )}
            </div>
          ))}

          {/* ── FA PARTE DI ──────────────────────────────────────────────────
              L'appartenenza, in entrambi i versi. Vale anche per
              un'organizzazione: una controllata fa parte di una capogruppo, e
              lo schema non lo vieta — vietarlo qui sarebbe stato inventare una
              regola che il modello non ha.
              Il conteggio nell'occhiello sta anche su «Membri»: sono le due
              facce della stessa tabella, e si leggono con lo stesso colpo
              d'occhio. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
            <span style={eyebrow}>Fa parte di ({memberOf.length})</span>
            {organizations.length === 0 ? (
              <span style={hint}>
                Nessuna organizzazione in rubrica. Posane una sulla lavagna, o
                creala fra i contatti.
              </span>
            ) : (
              <OrganizationPicker
                options={organizations}
                selected={memberOf}
                onToggle={toggleOrg}
              />
            )}
          </div>

          {/* ── MEMBRI ───────────────────────────────────────────────────────
              Solo per un'organizzazione, e in sola lettura: l'appartenenza si
              mette dalla parte di chi appartiene. Averla modificabile da tutti e
              due i lati avrebbe voluto dire due schermate che si contraddicono
              a vicenda sulla stessa riga. */}
          {isOrg && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
              <span style={eyebrow}>Membri ({members.length})</span>
              {members.length === 0 ? (
                <span style={hint}>
                  Nessuno, per ora. Si aggiungono dal pannello del soggetto, alla
                  voce «Fa parte di».
                </span>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {members.map((m) => (
                    <div key={m.id} style={rowStyle} title={m.name}>
                      <span style={{ display: 'inline-flex', flexShrink: 0, color: theme.ink3 }}>
                        <IconUser size={14} />
                      </span>
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.name}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Toglie il SEGNO, non la persona: il contatto resta in rubrica, con
              le sue appartenenze, e si può riappuntare quando serve. Cancellarlo
              davvero si fa dai contatti, che è dove si vede che cos'altro lo
              referenzia. */}
          <button
            onClick={onRemoveFromBoard}
            title={`Toglie ${isOrg ? "l'organizzazione" : 'il soggetto'} da questa lavagna. Il contatto resta in rubrica.`}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              width: '100%', padding: '9px 12px', background: 'var(--ob-rail-field)',
              border: 'none', borderRadius: 'var(--ob-radius-sm)', color: 'var(--ob-danger)',
              fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.control, cursor: 'pointer',
              flexShrink: 0, marginTop: 'auto',
            }}
          >
            <IconTrash size={14} />
            Togli dalla lavagna
          </button>
        </div>
      )}
    </div>
  );
}
