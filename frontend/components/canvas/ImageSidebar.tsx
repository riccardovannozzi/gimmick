'use client';

/**
 * Gimmick · Canvas — ImageSidebar.
 *
 * Pannello destro (analogo a TextSidebar) per un box IMMAGINE selezionato:
 * anteprima, titolo, flag "mostra il titolo sul canvas" e note in editor
 * ricco (lo stesso TipTap dei box di testo).
 *
 * Titolo e note si digitano: risalgono al parent a ogni battuta e sono LUI a
 * ritardare lo specchio in cache (il canvas si ridisegna a fine digitazione,
 * non a ogni tasto). Il flag invece è discreto → effetto immediato.
 */
import { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import {
  IconLayoutSidebarRightCollapse, IconLayoutSidebarRightExpand, IconTrash, IconPhoto,
  IconBold, IconItalic, IconStrikethrough, IconH2, IconList, IconListNumbers, IconCode, IconBlockquote,
  IconCheck, IconAspectRatio,
} from '@tabler/icons-react';
import { usePixelTheme } from '@/components/pixel';
import { OB_WEIGHT, OB_TEXT, obLabel } from '@/lib/theme/ob-typography';

interface ImageSidebarProps {
  /** Box immagine selezionato (già ristretto a type 'image' dal parent). */
  boxId: string;
  src: string;
  initialTitle: string;
  initialNotes: string;
  showTitle: boolean;
  open: boolean;
  onToggle: () => void;
  onTitleChange: (title: string) => void;
  onNotesChange: (html: string) => void;
  onShowTitleChange: (show: boolean) => void;
  /** Rimette il box nelle proporzioni vere della foto (rapporto naturale letto
   *  dall'anteprima). Il ridimensionamento sul canvas non le cambia mai: se un
   *  box è deformato, viene da prima — o dal ritaglio scelto a mano. */
  onFitAspect?: (aspect: number) => void;
  onDelete: () => void;
}

export function ImageSidebar({
  boxId, src, initialTitle, initialNotes, showTitle, open, onToggle,
  onTitleChange, onNotesChange, onShowTitleChange, onFitAspect, onDelete,
}: ImageSidebarProps) {
  const theme = usePixelTheme();
  // L'anteprima è già l'immagine caricata: le sue dimensioni naturali sono la
  // fonte del rapporto, senza scaricarla una seconda volta.
  const previewRef = useRef<HTMLImageElement>(null);
  // Il campo è controllato in locale: il valore che arriva dal parent torna con
  // lo specchio ritardato, e legarlo direttamente farebbe saltare il cursore.
  const [title, setTitle] = useState(initialTitle);
  useEffect(() => { setTitle(initialTitle); }, [boxId]); // eslint-disable-line react-hooks/exhaustive-deps

  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3] } })],
    content: initialNotes || '',
    editable: true,
    editorProps: { attributes: { class: 'tiptap-md focus:outline-none' } },
    onUpdate: ({ editor: ed }) => onNotesChange(ed.getHTML()),
    immediatelyRender: false,
  });

  // Cambio immagine selezionata → ricarica le note (il componente non viene
  // rimontato se il parent non lo re-key-a).
  useEffect(() => {
    if (!editor) return;
    if ((initialNotes || '') !== editor.getHTML()) {
      editor.commands.setContent(initialNotes || '', { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boxId, editor]);

  const eyebrow = obLabel(theme);

  const ToolBtn = ({ onClick, active, title: t, children }: {
    onClick: () => void; active?: boolean; title: string; children: React.ReactNode;
  }) => (
    <button
      type="button"
      title={t}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 30, height: 30, flexShrink: 0,
        background: active ? 'var(--ob-accent-soft)' : 'var(--ob-rail-field)',
        border: 'none', borderRadius: 'var(--ob-radius-sm)', cursor: 'pointer',
        color: active ? 'var(--ob-accent)' : theme.ink2,
      }}
    >
      {children}
    </button>
  );

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
      {/* Header: collapse + titolo del pannello */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: theme.ink, fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.control, fontWeight: OB_WEIGHT.emphasis }}>
            <IconPhoto size={15} style={{ color: theme.accent }} />
            Immagine
          </div>
        )}
      </div>

      {open && (
        <div style={{ flex: 1, minHeight: 0, padding: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Anteprima: dice a quale immagine appartengono i campi qui sotto. */}
          <div
            style={{
              background: 'var(--ob-rail-field)', borderRadius: 'var(--ob-radius-sm)',
              padding: 6, display: 'flex', justifyContent: 'center', flexShrink: 0,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={previewRef}
              src={src}
              alt={title}
              style={{ maxWidth: '100%', maxHeight: 120, objectFit: 'contain', display: 'block' }}
            />
          </div>

          {/* Il ridimensionamento sul canvas non tocca mai il rapporto: questa
              è la via per rimetterlo a posto se il box è deformato. */}
          {onFitAspect && (
            <button
              onClick={() => {
                const el = previewRef.current;
                if (el && el.naturalWidth > 0 && el.naturalHeight > 0) {
                  onFitAspect(el.naturalWidth / el.naturalHeight);
                }
              }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                width: '100%', padding: '7px 12px', background: 'var(--ob-rail-field)',
                border: 'none', borderRadius: 'var(--ob-radius-sm)', color: theme.ink2,
                fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.control, cursor: 'pointer', flexShrink: 0,
              }}
            >
              <IconAspectRatio size={14} />
              Ripristina proporzioni
            </button>
          )}

          {/* Titolo */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
            <span style={eyebrow}>Titolo</span>
            <input
              value={title}
              onChange={(e) => { setTitle(e.target.value); onTitleChange(e.target.value); }}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
              placeholder="Titolo dell'immagine"
              style={{
                width: '100%', padding: '8px 10px',
                background: 'var(--ob-rail-field)', border: `1px solid ${theme.border}`, borderRadius: 'var(--ob-radius-sm)',
                color: theme.ink, fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.control, outline: 'none',
              }}
            />
            {/* Check: il titolo esiste comunque, questo riguarda solo il vederlo
                sul canvas (didascalia in fondo al box). */}
            <label
              style={{
                display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                color: theme.ink2, fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.card,
                padding: '2px 0',
              }}
            >
              <span
                style={{
                  width: 16, height: 16, flexShrink: 0,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: showTitle ? 'var(--ob-accent-soft)' : 'var(--ob-rail-field)',
                  border: `1px solid ${showTitle ? 'transparent' : theme.border}`,
                  borderRadius: 'var(--ob-radius-sm)',
                  color: 'var(--ob-accent)',
                }}
              >
                {showTitle && <IconCheck size={12} stroke={3} />}
              </span>
              <input
                type="checkbox"
                checked={showTitle}
                onChange={(e) => onShowTitleChange(e.target.checked)}
                style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
              />
              Mostra il titolo sul canvas
            </label>
          </div>

          {/* Note — stesso editor dei box di testo */}
          {editor && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 0 }}>
              <span style={eyebrow}>Note</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                <ToolBtn title="Grassetto" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><IconBold size={16} /></ToolBtn>
                <ToolBtn title="Corsivo" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><IconItalic size={16} /></ToolBtn>
                <ToolBtn title="Barrato" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><IconStrikethrough size={16} /></ToolBtn>
                <div style={{ width: 1, height: 22, background: theme.border, margin: '0 2px', alignSelf: 'center' }} />
                <ToolBtn title="Titolo" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><IconH2 size={16} /></ToolBtn>
                <ToolBtn title="Lista" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><IconList size={16} /></ToolBtn>
                <ToolBtn title="Lista numerata" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><IconListNumbers size={16} /></ToolBtn>
                <div style={{ width: 1, height: 22, background: theme.border, margin: '0 2px', alignSelf: 'center' }} />
                <ToolBtn title="Codice inline" active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()}><IconCode size={16} /></ToolBtn>
                <ToolBtn title="Citazione" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}><IconBlockquote size={16} /></ToolBtn>
              </div>
              <div
                onMouseDown={() => editor.chain().focus().run()}
                style={{
                  flex: 1, minHeight: 100, overflowY: 'auto',
                  background: 'var(--ob-rail-field)', border: 'none', borderRadius: 'var(--ob-radius-sm)',
                  padding: '10px 12px', color: theme.ink, cursor: 'text',
                }}
              >
                <EditorContent editor={editor} />
              </div>
            </div>
          )}

          {/* Azioni */}
          <button
            onClick={onDelete}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              width: '100%', padding: '9px 12px', background: 'var(--ob-rail-field)',
              border: 'none', borderRadius: 'var(--ob-radius-sm)', color: 'var(--ob-danger)',
              fontFamily: 'var(--ob-font-sans)', fontSize: OB_TEXT.control, cursor: 'pointer', flexShrink: 0,
            }}
          >
            <IconTrash size={14} />
            Elimina immagine
          </button>
        </div>
      )}
    </div>
  );
}
