'use client';

import { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { StarterKit } from '@tiptap/starter-kit';
import { cn } from '@/lib/utils';

interface TextEditorProps {
  initialHtml: string;
  onChange: (html: string) => void;
  autoFocus?: boolean;
}

/**
 * TipTap-based rich-text editor for canvas text boxes.
 * Mounted via ReactDOM.createRoot() inside a foreignObject by CanvasBoard.
 * BubbleMenu appears above selection with B/I/H/list/code/quote.
 */
export function TextEditor({ initialHtml, onChange, autoFocus = false }: TextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
    ],
    content: initialHtml || '',
    editorProps: {
      attributes: {
        class: 'tiptap-canvas focus:outline-none w-full h-full overflow-auto',
        style: 'color:#D4D4D8;font-size:11px;line-height:16px;padding:0;',
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (autoFocus && editor) {
      editor.commands.focus('end');
    }
  }, [autoFocus, editor]);

  if (!editor) return null;

  const btnBase = 'h-8 min-w-8 px-2 flex items-center justify-center rounded text-xs leading-none font-medium transition-colors';
  const btnInactive = 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 hover:text-white';
  const btnActive = 'bg-blue-600/30 text-blue-200';

  return (
    <>
      <BubbleMenu
        editor={editor}
        className="flex items-center gap-1 p-1 rounded-lg bg-zinc-900 border border-white/10 shadow-xl"
      >
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={cn(btnBase, editor.isActive('bold') ? btnActive : btnInactive, 'font-bold')}
          title="Grassetto"
        >B</button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={cn(btnBase, editor.isActive('italic') ? btnActive : btnInactive, 'italic')}
          title="Corsivo"
        >I</button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={cn(btnBase, editor.isActive('strike') ? btnActive : btnInactive, 'line-through')}
          title="Barrato"
        >S</button>
        <div className="w-px h-5 bg-zinc-700 mx-0.5" />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={cn(btnBase, editor.isActive('heading', { level: 2 }) ? btnActive : btnInactive)}
          title="Titolo"
        >H</button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={cn(btnBase, editor.isActive('bulletList') ? btnActive : btnInactive)}
          title="Lista"
        >•</button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={cn(btnBase, editor.isActive('orderedList') ? btnActive : btnInactive)}
          title="Lista numerata"
        >1.</button>
        <div className="w-px h-5 bg-zinc-700 mx-0.5" />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={cn(btnBase, editor.isActive('code') ? btnActive : btnInactive, 'font-mono')}
          title="Codice inline"
        >&lt;/&gt;</button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={cn(btnBase, editor.isActive('blockquote') ? btnActive : btnInactive)}
          title="Citazione"
        >&ldquo;</button>
      </BubbleMenu>
      <EditorContent editor={editor} className="w-full h-full" />
    </>
  );
}
