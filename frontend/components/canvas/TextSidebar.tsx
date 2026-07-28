'use client';

/**
 * Gimmick · Canvas — TextSidebar.
 *
 * Pannello destro (analogo a GroupSidebar) per modificare un box di TESTO
 * selezionato sul canvas: contenuto (editor TipTap con toolbar fissa), colore
 * di sfondo (stessa palette/picker dei gruppi) e dimensione del font.
 *
 * Tutto è controllato dal parent: `onChange(html)` per il testo e
 * `onStyleChange(patch)` per sfondo/dimensione, così la nota resta sincronizzata
 * tra sidebar e lavagna.
 */
import { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import {
  IconLayoutSidebarRightCollapse, IconLayoutSidebarRightExpand, IconTrash, IconNote,
  IconBold, IconItalic, IconStrikethrough, IconH2, IconList, IconListNumbers, IconCode, IconBlockquote,
  IconMinus, IconPlus,
} from '@tabler/icons-react';
import { usePixelTheme } from '@/components/pixel';
import { ColorField, GROUP_BG_PALETTE } from '@/components/canvas/GroupSidebar';

// Dimensione font: scatti di 1 px alla volta, entro questi limiti.
const FONT_MIN = 8;
const FONT_MAX = 48;
const FONT_STEP = 1;
const clampFont = (n: number) => Math.max(FONT_MIN, Math.min(FONT_MAX, n));

interface TextSidebarProps {
  /** Box di testo selezionato (già ristretto a type 'text' dal parent). */
  boxId: string;
  initialHtml: string;
  bgColor?: string | null;
  fontSize?: number;
  open: boolean;
  onToggle: () => void;
  onChange: (html: string) => void;
  onStyleChange: (patch: { bgColor?: string | null; fontSize?: number }) => void;
  onDelete: () => void;
}

export function TextSidebar({ boxId, initialHtml, bgColor, fontSize = 11, open, onToggle, onChange, onStyleChange, onDelete }: TextSidebarProps) {
  const theme = usePixelTheme();

  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3] } })],
    content: initialHtml || '',
    editable: true,
    editorProps: {
      attributes: { class: 'tiptap-md focus:outline-none' },
    },
    onUpdate: ({ editor: ed }) => onChange(ed.getHTML()),
    immediatelyRender: false,
  });

  // Cambio box selezionato → ricarica il contenuto nell'editor (il componente
  // NON viene rimontato tra un box e l'altro se il parent non lo re-key-a).
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if ((initialHtml || '') !== current) {
      editor.commands.setContent(initialHtml || '', { emitUpdate: false });
    }
    editor.commands.focus('end');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boxId, editor]);

  // Applica la dimensione del font all'editor (WYSIWYG con il canvas).
  useEffect(() => {
    if (!editor) return;
    editor.view.dom.style.fontSize = `${fontSize}px`;
  }, [fontSize, editor]);

  const eyebrow: React.CSSProperties = {
    fontFamily: 'var(--ob-font-mono)', fontSize: 8, fontWeight: 700,
    letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.ink3,
  };

  const ToolBtn = ({ onClick, active, title, children }: {
    onClick: () => void; active?: boolean; title: string; children: React.ReactNode;
  }) => (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 30, height: 30, flexShrink: 0,
        // Stato attivo: viola scuro (accent-soft) + testo accent, come i tab.
        background: active ? 'var(--ob-accent-soft)' : theme.bg1,
        border: `1px solid ${active ? 'transparent' : theme.border}`,
        borderRadius: 7, cursor: 'pointer',
        color: active ? 'var(--ob-accent)' : theme.ink2,
      }}
    >
      {children}
    </button>
  );

  const StepBtn = ({ onClick, disabled, title, children }: {
    onClick: () => void; disabled?: boolean; title: string; children: React.ReactNode;
  }) => (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 30, height: 30, flexShrink: 0,
        background: theme.bg1, border: `1px solid ${theme.border}`, borderRadius: 7,
        cursor: disabled ? 'not-allowed' : 'pointer',
        color: disabled ? theme.ink3 : theme.ink2, opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  );

  return (
    <div
      style={{
        borderLeft: `1px solid ${theme.border}`,
        background: theme.bg2,
        transition: 'width 200ms',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        width: open ? 280 : 32,
      }}
    >
      {/* Header: collapse + titolo */}
      <div
        style={{
          height: 48,
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: theme.ink, fontFamily: 'var(--ob-font-sans)', fontSize: 13, fontWeight: 600 }}>
            <IconNote size={15} style={{ color: theme.accent }} />
            Testo
          </div>
        )}
      </div>

      {open && editor && (
        <div style={{ flex: 1, minHeight: 0, padding: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Toolbar formattazione */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={eyebrow}>Formattazione</span>
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
          </div>

          {/* Sfondo (picker dei gruppi) + dimensione font (scatti da 2px) sulla
              stessa riga */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <ColorField
                label="Colore sfondo"
                value={bgColor}
                allowNone
                palette={GROUP_BG_PALETTE}
                onChange={(hex) => onStyleChange({ bgColor: hex })}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 120, flexShrink: 0 }}>
              <span style={eyebrow}>Dimensione</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <StepBtn title={`-${FONT_STEP}px`} disabled={fontSize <= FONT_MIN} onClick={() => onStyleChange({ fontSize: clampFont(fontSize - FONT_STEP) })}>
                  <IconMinus size={14} />
                </StepBtn>
                <div style={{
                  flex: 1, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: theme.bg1, border: `1px solid ${theme.border}`, borderRadius: 7,
                  color: theme.ink2, fontFamily: 'var(--ob-font-mono)', fontSize: 11,
                }}>
                  {fontSize} px
                </div>
                <StepBtn title={`+${FONT_STEP}px`} disabled={fontSize >= FONT_MAX} onClick={() => onStyleChange({ fontSize: clampFont(fontSize + FONT_STEP) })}>
                  <IconPlus size={14} />
                </StepBtn>
              </div>
            </div>
          </div>

          {/* Area di scrittura */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 0 }}>
            <span style={eyebrow}>Contenuto</span>
            <div
              onMouseDown={() => editor.chain().focus().run()}
              style={{
                flex: 1, minHeight: 120, overflowY: 'auto',
                background: bgColor || theme.bg1, border: `1px solid ${theme.border}`, borderRadius: 8,
                padding: '10px 12px', color: theme.ink, cursor: 'text',
              }}
            >
              <EditorContent editor={editor} />
            </div>
          </div>

          {/* Azioni */}
          <button
            onClick={onDelete}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              width: '100%', padding: '9px 12px', background: 'transparent',
              border: `1px solid ${theme.border}`, borderRadius: 8, color: '#E24B4A',
              fontFamily: 'var(--ob-font-sans)', fontSize: 12.5, cursor: 'pointer', flexShrink: 0,
            }}
          >
            <IconTrash size={14} />
            Elimina nota
          </button>
        </div>
      )}
    </div>
  );
}
