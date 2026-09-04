'use client';

/**
 * Gimmick · Contatti — la SCHEDA di un contatto.
 *
 * La tabella modifica in cella: si clicca un valore, si scrive, si esce. Va bene
 * per correggere un numero di telefono e non basta per due cose:
 *   · le NOTE, che sono un testo lungo e in tabella non hanno una colonna — si
 *     potevano scrivere solo dal pannello di una lavagna, cioè solo per i
 *     contatti che qualcuno aveva posato da qualche parte;
 *   · il LOGO, che non è un valore da digitare ma un file da caricare.
 *
 * Qui i campi stanno insieme, si compilano tutti e si salva una volta sola.
 *
 * ⚠️ Le APPARTENENZE non sono qui: restano nella colonna «Appartiene a» della
 * tabella e nel grafo. Non per dimenticanza — un'appartenenza è una relazione
 * fra due righe, e si sceglie meglio dove si vedono tutte e due che dentro la
 * scheda di una sola.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  IconTrash, IconUser, IconBuilding, IconLoader2, IconClipboard, IconPhoto,
} from '@tabler/icons-react';
import { toast } from 'sonner';
import { Modal, SegmentedControl } from '@/components/primitives';
import { usePixelTheme } from '@/components/pixel';
import { uploadApi } from '@/lib/api';
import { OB_TEXT, OB_WEIGHT } from '@/lib/theme/ob-typography';
import { contactRole, KIND_FOR_ROLE, ROLE_LABEL } from '@/types/contact';
import type { Contact, ContactKind, ContactRole } from '@/types/contact';

/** I campi che questa scheda scrive. `kind` a parte, sono tutti testo. */
export type ContactPatch = {
  name?: string;
  kind?: ContactKind;
  phone?: string;
  email?: string;
  notes?: string;
  avatar_url?: string;
};

/** Il logo si carica, non si digita: qui il tetto è quello del BUON SENSO, non
 *  quello del server (50MB). Un logo da 8 mega è una fotografia caricata per
 *  sbaglio, e rifiutarla subito è più gentile che scoprirlo dopo l'attesa. */
const MAX_LOGO_BYTES = 4 * 1024 * 1024;

export interface ContactEditModalProps {
  contact: Contact | null;
  onClose: () => void;
  onSave: (id: string, patch: ContactPatch) => void;
}

/**
 * LA PRIMA immagine di un trasferimento — appunti o trascinamento — e una sola.
 *
 * ⚠️ Qui si annida il doppio caricamento. `DataTransfer` espone lo STESSO
 * contenuto due volte, in `files` e in `items`: scorrerli entrambi carica il
 * medesimo file due volte, e le due richieste partono così ravvicinate che
 * nessun controllo sullo stato di React fa in tempo a fermarle. Si legge una
 * lista sola, e si esce alla prima immagine trovata — un contatto ha un logo,
 * non cinque.
 */
function firstImage(dt: DataTransfer | null | undefined): File | null {
  if (!dt) return null;
  for (const f of Array.from(dt.files ?? [])) {
    if (f.type.startsWith('image/')) return f;
  }
  // Solo se `files` era vuota: certi incolla (Safari, alcune app native)
  // riempiono `items` e non `files`.
  for (const it of Array.from(dt.items ?? [])) {
    if (it.kind === 'file' && it.type.startsWith('image/')) {
      const f = it.getAsFile();
      if (f) return f;
    }
  }
  return null;
}

export function ContactEditModal({ contact, onClose, onSave }: ContactEditModalProps) {
  const theme = usePixelTheme();
  const [draft, setDraft] = useState<ContactPatch>({});
  const [avatar, setAvatar] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  /** Il menu del tasto destro sul riquadro: dove aprirlo. */
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  /**
   * L'altra metà della guardia contro il doppio caricamento.
   *
   * `busy` è uno stato di React e serve a DISEGNARE l'attesa; non serve a
   * fermarla. Due gesti ravvicinati — un incolla mentre un trascinamento è
   * ancora in volo — leggerebbero `busy === false` tutti e due, perché il
   * valore nuovo arriva solo al render dopo. Un ref cambia nello stesso istante
   * in cui lo si scrive, ed è l'unica cosa che regge fra due chiamate della
   * stessa funzione.
   */
  const uploadingRef = useRef(false);
  const open = !!contact;

  // Riletti a ogni contatto nuovo: la finestra resta montata fra un'apertura e
  // l'altra, e senza questo mostrerebbe i campi di quello di prima.
  useEffect(() => {
    if (!contact) return;
    setDraft({
      name: contact.name ?? '',
      kind: contact.kind,
      phone: contact.phone ?? '',
      email: contact.email ?? '',
      notes: contact.notes ?? '',
    });
    setAvatar(contact.avatar_url ?? null);
  }, [contact?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const isOrg = contactRole(draft.kind ?? contact?.kind) === 'organization';
  const Glyph = isOrg ? IconBuilding : IconUser;

  /**
   * L'UNICA porta d'ingresso di un'immagine: ci passano il pulsante, il
   * trascinamento, l'incolla da tastiera e la voce del menu contestuale.
   *
   * Quattro strade e una sola funzione, di proposito: la validazione, il tetto
   * di dimensione e — soprattutto — la guardia contro la doppia richiesta si
   * scrivono una volta e valgono per tutte. Quattro copie sarebbero state
   * quattro occasioni di dimenticarne una.
   */
  const ingest = useCallback(async (file: File | null | undefined) => {
    if (!file) return;
    // Un caricamento alla volta. Vedi `uploadingRef`: è la guardia che regge
    // anche quando i due gesti arrivano nello stesso battito.
    if (uploadingRef.current) return;
    if (!file.type.startsWith('image/')) { toast.error('Il file deve essere un\'immagine'); return; }
    if (file.size > MAX_LOGO_BYTES) { toast.error('Immagine troppo grande: il limite è 4 MB'); return; }
    uploadingRef.current = true;
    setBusy(true);
    try {
      // Bucket `canvas-assets`, lo stesso delle immagini della lavagna: risponde
      // con un URL PUBBLICO e permanente. Un URL firmato scadrebbe dopo un'ora,
      // e una lavagna lasciata aperta mostrerebbe dei buchi al posto dei loghi.
      const res = await uploadApi.uploadFile(file, 'contacts', 'canvas-assets');
      if (!res.success || !res.data?.url) { toast.error(res.error || 'Caricamento fallito'); return; }
      setAvatar(res.data.url);
    } catch {
      toast.error('Caricamento fallito');
    } finally {
      uploadingRef.current = false;
      setBusy(false);
      // Azzerato, altrimenti riscegliendo LO STESSO file il campo non emette
      // `change` e non succede niente.
      if (fileRef.current) fileRef.current.value = '';
    }
  }, []);

  /**
   * INCOLLA da tastiera, su `document` e non sul riquadro.
   *
   * Su `document` perché nessuno clicca il riquadro prima di premere Ctrl+V:
   * si apre la scheda e si incolla. E UNO SOLO: un secondo ascoltatore sul
   * riquadro riceverebbe lo stesso evento mentre risale, e da lì il doppio
   * caricamento — quello che il ref intercetta, ma che è meglio non produrre.
   *
   * Senza immagine negli appunti la funzione non fa niente e non chiama
   * `preventDefault`: incollare del testo in un campo deve continuare a
   * funzionare come sempre.
   */
  useEffect(() => {
    if (!open) return;
    const onPaste = (e: ClipboardEvent) => {
      const f = firstImage(e.clipboardData);
      if (!f) return;
      e.preventDefault();
      ingest(f);
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [open, ingest]);

  /**
   * Un file lasciato cadere FUORI dal riquadro non deve portarsi via la pagina.
   *
   * È il comportamento predefinito del browser: aprire il file al posto del
   * documento corrente. Con una scheda aperta e a metà compilazione, un
   * trascinamento sbagliato di due centimetri costerebbe tutto quello che si è
   * scritto.
   */
  useEffect(() => {
    if (!open) return;
    const swallow = (e: DragEvent) => e.preventDefault();
    document.addEventListener('dragover', swallow);
    document.addEventListener('drop', swallow);
    return () => {
      document.removeEventListener('dragover', swallow);
      document.removeEventListener('drop', swallow);
    };
  }, [open]);

  // Il menu si chiude anche con Esc, e alla chiusura della scheda.
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menu]);
  useEffect(() => { if (!open) setMenu(null); }, [open]);

  /**
   * INCOLLA dal menu contestuale — un'altra strada, perché il tasto destro non
   * porta con sé gli appunti: l'evento `paste` nasce solo da Ctrl+V, e una voce
   * di menu deve chiederli lei.
   *
   * `navigator.clipboard.read` vuole HTTPS e un permesso che l'utente può
   * negare, e su qualche browser non esiste proprio. Quando manca lo si dice, e
   * si indica la strada che funziona sempre.
   */
  const pasteFromClipboard = async () => {
    setMenu(null);
    if (!navigator.clipboard?.read) {
      toast.error('Questo browser non legge gli appunti da un menu: usa Ctrl+V');
      return;
    }
    try {
      for (const item of await navigator.clipboard.read()) {
        const type = item.types.find((t) => t.startsWith('image/'));
        if (!type) continue;
        const blob = await item.getType(type);
        await ingest(new File([blob], 'logo', { type }));
        return;
      }
      toast.error('Negli appunti non c\'è un\'immagine');
    } catch {
      toast.error('Il browser non ha dato accesso agli appunti: usa Ctrl+V');
    }
  };

  /** Tasto destro, o Ctrl+clic — che su macOS è la stessa cosa e su Windows no,
   *  quindi si ascoltano tutti e due. */
  const openMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY });
  };

  const save = () => {
    if (!contact) return;
    const name = (draft.name ?? '').trim();
    // Il nome è l'unico campo obbligatorio: senza, la riga diventa muta ovunque.
    if (!name) { toast.error('Il nome non può restare vuoto'); return; }
    onSave(contact.id, {
      name,
      kind: draft.kind,
      phone: (draft.phone ?? '').trim(),
      email: (draft.email ?? '').trim(),
      notes: (draft.notes ?? '').trim(),
      // Stringa vuota e non `undefined` per togliere il logo: `undefined`
      // significa «non toccare questo campo», e il logo non si cancellerebbe
      // mai più.
      avatar_url: avatar ?? '',
    });
    onClose();
  };

  const field: React.CSSProperties = {
    width: '100%', padding: '8px 10px',
    background: 'var(--ob-field)', border: `1px solid ${theme.border}`,
    borderRadius: 'var(--ob-radius-sm)', color: theme.ink,
    fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.control,
    lineHeight: 1.4, outline: 'none',
  };
  const label: React.CSSProperties = {
    fontFamily: 'var(--ob-font-mono)', fontSize: OB_TEXT.eyebrow,
    letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.ink3,
  };
  const row = (l: string, node: React.ReactNode) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={label}>{l}</span>
      {node}
    </div>
  );

  return (
    <Modal open={!!contact} onClose={onClose} title="Scheda contatto" maxWidth={520}>
      {contact && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* ── LOGO ──────────────────────────────────────────────────────
              In cima e LARGO quanto la scheda: è insieme l'anteprima e il
              bersaglio del trascinamento, e un bersaglio va mancato di poco per
              essere un bersaglio. Il riquadro da 72 pixel di prima si poteva
              solo cliccare — con un file in mano si sarebbe sbagliata mira
              tre volte su quattro.

              È la sola cosa di questa scheda che si vedrà da lontano: sulla
              lavagna la figura di un contatto è alta 36 pixel, e il logo è ciò
              che la rende riconoscibile fra sei uguali. L'anteprima ha quindi
              la FORMA che avrà là — tonda un soggetto, squadrata
              un'organizzazione: un logo quadrato dentro un contorno tondo viene
              tagliato agli angoli, ed è meglio scoprirlo qui.

              Quattro modi per riempirlo, tutti sullo stesso riquadro: clic,
              trascinamento, Ctrl+V, tasto destro. Passano tutti da `ingest`. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={label}>Logo o fotografia</span>
            <div
              onClick={(e) => {
                // Ctrl/⌘+clic apre il menu e NON il selettore di file: su macOS
                // è il gesto del tasto destro, e aprire tutti e due sarebbe una
                // finestra di sistema sopra un menu.
                if (e.ctrlKey || e.metaKey) { openMenu(e); return; }
                if (!busy) fileRef.current?.click();
              }}
              onContextMenu={openMenu}
              onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={(e) => {
                // Solo uscendo davvero dal riquadro: passando sopra un figlio
                // (l'anteprima, il testo) parte comunque un `dragleave`, e
                // spegnere lì farebbe lampeggiare il bordo a ogni movimento.
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                ingest(firstImage(e.dataTransfer));
              }}
              title="Clicca, trascina un file, o premi Ctrl+V"
              style={{
                display: 'flex', alignItems: 'center', gap: 16,
                padding: 14, minHeight: 104,
                background: dragOver ? 'var(--ob-accent-soft)' : 'var(--ob-surface-2)',
                border: `1.5px dashed ${dragOver ? theme.accent : theme.border}`,
                borderRadius: 'var(--ob-radius-md)',
                cursor: busy ? 'wait' : 'pointer',
                transition: 'background-color 120ms ease-out, border-color 120ms ease-out',
                position: 'relative',
              }}
            >
              <div
                style={{
                  width: 72, height: 72, flexShrink: 0, overflow: 'hidden',
                  borderRadius: isOrg ? 10 : '50%',
                  background: 'var(--ob-surface)', border: `1px solid ${theme.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: theme.ink3,
                }}
              >
                {busy
                  ? <IconLoader2 size={24} className="animate-spin" />
                  : avatar
                    ? /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <Glyph size={30} stroke={1.6} />}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                <span
                  style={{
                    color: theme.ink, fontFamily: 'var(--ob-font-sans)',
                    fontSize: OB_TEXT.control, fontWeight: OB_WEIGHT.emphasis,
                  }}
                >
                  {busy ? 'Caricamento…' : dragOver ? 'Lascia qui' : avatar ? 'Sostituisci l\'immagine' : 'Trascina un\'immagine'}
                </span>
                <span style={{ color: theme.ink3, fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.meta, lineHeight: 1.55 }}>
                  …oppure clicca per sceglierla, o premi <strong style={{ color: theme.ink2, fontWeight: OB_WEIGHT.emphasis }}>Ctrl+V</strong> per
                  incollarla. Tasto destro per le altre opzioni.
                  <br />
                  Fino a 4 MB. Comparirà dentro la figura sulla lavagna, col nome sotto.
                </span>
              </div>

              {/* Togliere il logo sta DENTRO il riquadro, in alto a destra: è
                  un'azione su quell'immagine, non un comando della scheda.
                  `stopPropagation` perché il riquadro, cliccato, aprirebbe il
                  selettore di file. */}
              {avatar && !busy && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setAvatar(null); }}
                  title="Togli il logo: la figura torna al simbolo generico"
                  style={{
                    position: 'absolute', top: 8, right: 8,
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '4px 8px', background: 'var(--ob-surface)',
                    border: `1px solid ${theme.border}`, borderRadius: 'var(--ob-radius-sm)',
                    color: 'var(--ob-danger)', fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.meta,
                    cursor: 'pointer',
                  }}
                >
                  <IconTrash size={12} />
                  Togli
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => ingest(e.target.files?.[0])}
            />
          </div>

          {row('Nome', (
            <input
              autoFocus
              value={draft.name ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="Nome e cognome, o ragione sociale"
              style={field}
            />
          ))}

          {row('Tipo', (
            <SegmentedControl<ContactRole>
              aria-label="Tipo di contatto"
              value={contactRole(draft.kind ?? contact.kind)}
              onChange={(role) => setDraft((d) => ({ ...d, kind: KIND_FOR_ROLE[role] }))}
              items={[
                { value: 'subject', label: <><IconUser size={13} stroke={1.8} />{ROLE_LABEL.subject}</> },
                { value: 'organization', label: <><IconBuilding size={13} stroke={1.8} />{ROLE_LABEL.organization}</> },
              ]}
            />
          ))}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {row('Telefono', (
              <input
                type="tel"
                value={draft.phone ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
                placeholder="+39 …"
                style={field}
              />
            ))}
            {row('Email', (
              <input
                type="email"
                value={draft.email ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
                placeholder="nome@dominio.it"
                style={field}
              />
            ))}
          </div>

          {row('Note', (
            <textarea
              value={draft.notes ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
              placeholder="Cosa serve ricordarsi"
              rows={4}
              style={{ ...field, resize: 'vertical', minHeight: 80 }}
            />
          ))}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 2 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 14px', background: 'transparent',
                border: `1px solid ${theme.border}`, borderRadius: 'var(--ob-radius-sm)',
                color: theme.ink2, fontFamily: 'var(--ob-font-sans)',
                fontSize: OB_TEXT.control, cursor: 'pointer',
              }}
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={save}
              disabled={busy}
              style={{
                padding: '8px 14px', background: theme.accent,
                border: `1px solid ${theme.accent}`, borderRadius: 'var(--ob-radius-sm)',
                color: theme.onAccent, fontFamily: 'var(--ob-font-sans)',
                fontSize: OB_TEXT.control, fontWeight: OB_WEIGHT.emphasis,
                cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1,
              }}
            >
              Salva
            </button>
          </div>
        </div>
      )}

      {/* Il MENU del tasto destro. In un portale su `document.body`: il corpo
          della scheda ha `overflow: auto`, e un menu figlio del riquadro
          verrebbe tagliato al primo bordo. */}
      {menu && createPortal(
        <>
          <div
            className="fixed inset-0"
            style={{ zIndex: 9998 }}
            onMouseDown={() => setMenu(null)}
            onContextMenu={(e) => { e.preventDefault(); setMenu(null); }}
          />
          <div
            className="fixed"
            style={{
              top: Math.min(menu.y, window.innerHeight - 130),
              left: Math.min(menu.x, window.innerWidth - 210),
              width: 200, zIndex: 9999, padding: 4,
              background: theme.surface,
              border: `1px solid ${theme.border}`,
              borderRadius: 'var(--ob-radius-md)',
              boxShadow: 'var(--ob-shadow-card)',
            }}
          >
            {[
              { icon: <IconClipboard size={14} />, label: 'Incolla immagine', run: pasteFromClipboard, danger: false },
              { icon: <IconPhoto size={14} />, label: 'Scegli un file…', run: () => { setMenu(null); fileRef.current?.click(); }, danger: false },
              ...(avatar ? [{ icon: <IconTrash size={14} />, label: 'Togli il logo', run: () => { setMenu(null); setAvatar(null); }, danger: true }] : []),
            ].map((it) => (
              <button
                key={it.label}
                type="button"
                onClick={it.run}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  padding: '6px 10px', textAlign: 'left',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: it.danger ? 'var(--ob-danger)' : theme.ink2,
                  fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.card,
                }}
              >
                {it.icon}
                {it.label}
              </button>
            ))}
          </div>
        </>,
        document.body,
      )}
    </Modal>
  );
}
