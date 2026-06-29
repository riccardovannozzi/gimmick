'use client';

import { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import Highlight from '@tiptap/extension-highlight';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Markdown } from 'tiptap-markdown';
import {
  IconBold, IconItalic, IconStrikethrough, IconCode, IconH1, IconH2, IconH3,
  IconList, IconListNumbers, IconListCheck, IconQuote, IconLink, IconHighlight,
  IconTable, IconArrowBackUp, IconArrowForwardUp, IconSeparator,
  IconMicrophone, IconMicrophoneOff,
} from '@tabler/icons-react';
import { usePixelTheme } from '@/components/pixel';
import { isObsidianShellEnabled } from '@/lib/feature-flags';
import { cn } from '@/lib/utils';

// Soft pastel highlight palette — the Light2 row of GIMMICK_PALETTE.
// "Remove" (null) clears the mark.
const HIGHLIGHT_COLORS: Array<{ color: string | null; label: string }> = [
  { color: '#FFEAB6', label: 'Giallo' },
  { color: '#FEE2D5', label: 'Arancio' },
  { color: '#FFDCE5', label: 'Rosso' },
  { color: '#FFDAF6', label: 'Rosa' },
  { color: '#EDE2FE', label: 'Viola' },
  { color: '#CFDFFF', label: 'Blu' },
  { color: '#D0F0FD', label: 'Ciano' },
  { color: '#C2F5E9', label: 'Verde acqua' },
  { color: '#D1F7C4', label: 'Verde' },
  { color: '#EEEEEE', label: 'Grigio' },
  { color: null, label: 'Rimuovi' },
];

interface MarkdownEditorProps {
  /** Initial markdown content. */
  value: string;
  /** Called on every keystroke with the new markdown content. */
  onChange: (markdown: string) => void;
  autoFocus?: boolean;
  className?: string;
}

/**
 * Pixel-styled rich-text editor that round-trips Markdown.
 * tiptap-markdown parses `value` as markdown when set as content and lets us
 * read it back via `editor.storage.markdown.getMarkdown()` in onUpdate, so
 * callers stay in markdown-land — no HTML leakage.
 */
export function MarkdownEditor({ value, onChange, autoFocus, className }: MarkdownEditorProps) {
  const theme = usePixelTheme();
  const inShell = isObsidianShellEnabled();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Link.configure({ openOnClick: false, autolink: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Highlight.configure({ multicolor: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Markdown.configure({ html: false, transformPastedText: true, transformCopiedText: true }),
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class: 'tiptap-md focus:outline-none w-full min-h-full',
      },
    },
    onUpdate: ({ editor: ed }) => {
      const md = (ed.storage as { markdown?: { getMarkdown: () => string } }).markdown?.getMarkdown() ?? '';
      onChange(md);
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (!autoFocus || !editor) return;
    // Defer past the Radix Dialog mount/animation, otherwise the dialog steals
    // focus right after our focus() call and the editor cursor never appears.
    const t = setTimeout(() => {
      // If the document ends with a block node (heading / list / blockquote /
      // codeBlock / table), append an empty paragraph so the cursor lands on a
      // fresh line ready for typing instead of being trapped inside the block.
      const { doc, schema } = editor.state;
      const last = doc.lastChild;
      const trailingBlocks = new Set(['heading', 'bulletList', 'orderedList', 'taskList', 'blockquote', 'codeBlock', 'table', 'horizontalRule']);
      if (last && trailingBlocks.has(last.type.name) && schema.nodes.paragraph) {
        editor.chain().insertContentAt(doc.content.size, { type: 'paragraph' }).run();
      }
      editor.commands.focus('end');
    }, 80);
    return () => clearTimeout(t);
  }, [autoFocus, editor]);

  if (!editor) return null;

  return (
    <div className={cn('flex flex-col h-full', className)}>
      <Toolbar editor={editor} theme={theme} />
      <div
        className="flex-1 overflow-auto"
        style={{
          background: theme.surface,
          padding: 16,
          fontFamily: inShell ? 'var(--ob-font-sans)' : 'var(--font-pixel-body), ui-monospace, monospace',
          color: theme.ink,
          fontSize: inShell ? 14 : 13,
          lineHeight: 1.6,
        }}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

interface ToolbarProps { editor: Editor; theme: ReturnType<typeof usePixelTheme>; }

function Toolbar({ editor, theme }: ToolbarProps) {
  const inShell = isObsidianShellEnabled();
  const btnStyle = (active: boolean): React.CSSProperties => ({
    width: inShell ? 30 : 28,
    height: inShell ? 30 : 28,
    background: active ? (inShell ? `${theme.accent}22` : theme.accent) : 'transparent',
    color: active ? theme.accent : theme.ink2,
    border: inShell ? `1px solid ${active ? theme.accent : 'transparent'}` : `2px solid ${theme.border}`,
    borderRadius: inShell ? 8 : 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  });
  const sep = <span style={{ width: 1, height: 18, background: theme.border, margin: '0 4px', alignSelf: 'center' }} />;

  const promptLink = () => {
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('URL del link', prev ?? 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
  };

  return (
    <div
      // preventDefault on mousedown keeps the editor's text selection alive
      // while clicking any toolbar button — otherwise focus moves to the
      // <button> on mousedown, the selection collapses, and toggle commands
      // run against an empty range (the symptom: "the selection leaves no trace").
      onMouseDown={(e) => e.preventDefault()}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 4,
        padding: 8,
        background: theme.bg2,
        borderBottom: `${inShell ? 1 : 2}px solid ${theme.border}`,
      }}
    >
      <button type="button" title="Annulla" style={btnStyle(false)} onClick={() => editor.chain().focus().undo().run()}><IconArrowBackUp size={14} /></button>
      <button type="button" title="Ripeti" style={btnStyle(false)} onClick={() => editor.chain().focus().redo().run()}><IconArrowForwardUp size={14} /></button>
      {sep}
      <button type="button" title="Grassetto" style={btnStyle(editor.isActive('bold'))} onClick={() => editor.chain().focus().toggleBold().run()}><IconBold size={14} /></button>
      <button type="button" title="Corsivo" style={btnStyle(editor.isActive('italic'))} onClick={() => editor.chain().focus().toggleItalic().run()}><IconItalic size={14} /></button>
      <button type="button" title="Barrato" style={btnStyle(editor.isActive('strike'))} onClick={() => editor.chain().focus().toggleStrike().run()}><IconStrikethrough size={14} /></button>
      <button type="button" title="Codice inline" style={btnStyle(editor.isActive('code'))} onClick={() => editor.chain().focus().toggleCode().run()}><IconCode size={14} /></button>
      <HighlightPicker editor={editor} btnStyle={btnStyle} theme={theme} />
      {sep}
      <button type="button" title="Titolo 1" style={btnStyle(editor.isActive('heading', { level: 1 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><IconH1 size={14} /></button>
      <button type="button" title="Titolo 2" style={btnStyle(editor.isActive('heading', { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><IconH2 size={14} /></button>
      <button type="button" title="Titolo 3" style={btnStyle(editor.isActive('heading', { level: 3 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><IconH3 size={14} /></button>
      {sep}
      <button type="button" title="Lista puntata" style={btnStyle(editor.isActive('bulletList'))} onClick={() => editor.chain().focus().toggleBulletList().run()}><IconList size={14} /></button>
      <button type="button" title="Lista numerata" style={btnStyle(editor.isActive('orderedList'))} onClick={() => editor.chain().focus().toggleOrderedList().run()}><IconListNumbers size={14} /></button>
      <button type="button" title="Task list" style={btnStyle(editor.isActive('taskList'))} onClick={() => editor.chain().focus().toggleTaskList().run()}><IconListCheck size={14} /></button>
      {sep}
      <button type="button" title="Citazione" style={btnStyle(editor.isActive('blockquote'))} onClick={() => editor.chain().focus().toggleBlockquote().run()}><IconQuote size={14} /></button>
      <button type="button" title="Blocco codice" style={btnStyle(editor.isActive('codeBlock'))} onClick={() => editor.chain().focus().toggleCodeBlock().run()}><IconSeparator size={14} /></button>
      <button type="button" title="Link" style={btnStyle(editor.isActive('link'))} onClick={promptLink}><IconLink size={14} /></button>
      <button type="button" title="Tabella" style={btnStyle(false)} onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><IconTable size={14} /></button>
      {sep}
      <DictationButton editor={editor} btnStyle={btnStyle} />
    </div>
  );
}

// Web Speech API types — not in the standard lib.dom.d.ts. Minimal shapes
// covering what we actually use.
interface SpeechRecognitionAlternative { transcript: string }
interface SpeechRecognitionResult { isFinal: boolean; 0: SpeechRecognitionAlternative; length: number }
interface SpeechRecognitionEvent { resultIndex: number; results: ArrayLike<SpeechRecognitionResult> }
interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

interface DictationButtonProps {
  editor: Editor;
  btnStyle: (active: boolean) => React.CSSProperties;
}

function DictationButton({ editor, btnStyle }: DictationButtonProps) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognitionInstance | null>(null);

  const getCtor = (): SpeechRecognitionCtor | null => {
    if (typeof window === 'undefined') return null;
    const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
    return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
  };

  // Tear-down on unmount so a still-active recognition doesn't keep the mic
  // open when the modal closes.
  useEffect(() => () => { try { recRef.current?.stop(); } catch { /* */ } }, []);

  const supported = !!getCtor();

  const toggle = () => {
    if (listening) {
      try { recRef.current?.stop(); } catch { /* */ }
      return;
    }
    const Ctor = getCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = 'it-IT';
    rec.continuous = true;
    rec.interimResults = false; // only commit final results so we don't insert+overwrite
    rec.onresult = (e) => {
      let chunk = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) chunk += r[0].transcript;
      }
      if (chunk) editor.chain().focus().insertContent(chunk + ' ').run();
    };
    rec.onerror = () => { setListening(false); };
    rec.onend = () => { setListening(false); recRef.current = null; };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  if (!supported) {
    return (
      <button
        type="button"
        title="Dettatura non supportata in questo browser"
        disabled
        style={{ ...btnStyle(false), opacity: 0.4, cursor: 'not-allowed' }}
      >
        <IconMicrophoneOff size={14} />
      </button>
    );
  }

  return (
    <button
      type="button"
      title={listening ? 'Ferma dettatura' : 'Avvia dettatura (italiano)'}
      style={{
        ...btnStyle(listening),
        // Pulse the button while listening so the user knows the mic is hot.
        animation: listening ? 'pulse 1.4s ease-in-out infinite' : undefined,
      }}
      onClick={toggle}
    >
      {listening ? <IconMicrophone size={14} /> : <IconMicrophone size={14} />}
    </button>
  );
}

interface HighlightPickerProps {
  editor: Editor;
  btnStyle: (active: boolean) => React.CSSProperties;
  theme: ReturnType<typeof usePixelTheme>;
}

function HighlightPicker({ editor, btnStyle, theme }: HighlightPickerProps) {
  const inShell = isObsidianShellEnabled();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const apply = (color: string | null) => {
    if (color === null) editor.chain().focus().unsetHighlight().run();
    else editor.chain().focus().toggleHighlight({ color }).run();
    setOpen(false);
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        title="Evidenzia"
        style={btnStyle(editor.isActive('highlight'))}
        onClick={() => setOpen((v) => !v)}
      >
        <IconHighlight size={14} />
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 4,
            zIndex: 100,
            background: theme.surface,
            border: `${inShell ? 1 : 2}px solid ${theme.border}`,
            borderRadius: inShell ? 12 : 0,
            padding: 6,
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 22px)',
            gap: 4,
            boxShadow: inShell ? 'var(--ob-shadow-card)' : `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
          }}
        >
          {HIGHLIGHT_COLORS.map((opt) => {
            const isRemove = opt.color === null;
            return (
              <button
                key={opt.label}
                type="button"
                title={opt.label}
                onClick={() => apply(opt.color)}
                style={{
                  width: 22,
                  height: 22,
                  background: isRemove ? theme.surfaceVariant : (opt.color as string),
                  border: `${inShell ? 1 : 2}px solid ${theme.border}`,
                  borderRadius: inShell ? 6 : 0,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: theme.ink2,
                  fontSize: 12,
                  lineHeight: 1,
                  padding: 0,
                }}
              >
                {isRemove ? '×' : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
