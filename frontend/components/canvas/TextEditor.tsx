'use client';

import { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { StarterKit } from '@tiptap/starter-kit';
import { cn } from '@/lib/utils';
import { OB_TILE_TITLE } from '@/lib/theme/ob-typography';
import { TILE_SCALE } from '@/lib/tile-visual';

/**
 * Corpo di default del testo di un box, appaiato al TITOLO DEL TILE.
 *
 * Non è `OB_TILE_TITLE.size`: quello è un valore nominale, che sul tile viene
 * ridotto da `zoom: var(--ob-tile-zoom)`. Il box di testo vive nelle stesse
 * coordinate della lavagna ma NON è zoomato, quindi per apparire della stessa
 * misura deve prendersi il valore già ridotto. 15 × 0.8 = 12.
 */
export const BOX_FONT_SIZE = OB_TILE_TITLE.size * TILE_SCALE;

interface TextEditorProps {
  initialHtml: string;
  onChange: (html: string) => void;
  /** true = inserimento testo attivo (editable + focus); false = sola lettura
   *  (la casella è in modalità "sposta", gestita dal gruppo D3 sottostante). */
  editing?: boolean;
  /** Dimensione del font in px (scelta dalla TextSidebar). Default: il corpo
   *  del titolo del tile, già ridotto (vedi `BOX_FONT_SIZE`). */
  fontSize?: number;
  /**
   * Riporta a chi ospita il box se il testo ECCEDE l'altezza disponibile, e
   * quanto sarebbe alto per starci tutto. Serve al badge di espansione, che
   * non può misurare da sé: l'elemento che scorre è il DOM di ProseMirror,
   * che nasce dentro questo componente.
   */
  onMeasure?: (m: { overflowing: boolean; contentHeight: number }) => void;
  /**
   * Colore del testo. Di norma il token del tema, come il titolo del tile; ma
   * un box con un fondo scelto dalla palette ha bisogno dell'inchiostro che si
   * legge SU QUEL FONDO, non su quello della pagina.
   */
  textColor?: string;
}

/**
 * TipTap-based rich-text editor for canvas text boxes.
 * Mounted via ReactDOM.createRoot() inside a foreignObject by CanvasBoard.
 * BubbleMenu appears above selection with B/I/H/list/code/quote.
 */
export function TextEditor({ initialHtml, onChange, editing = false, fontSize = BOX_FONT_SIZE, onMeasure, textColor = 'var(--ob-text)' }: TextEditorProps) {
  // Il callback cambia identità a ogni render del genitore: tenerlo in un ref
  // evita di smontare e rimontare l'osservatore a ogni giro.
  const onMeasureRef = useRef(onMeasure);
  onMeasureRef.current = onMeasure;
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
    ],
    content: initialHtml || '',
    editable: editing,
    editorProps: {
      attributes: {
        class: 'tiptap-canvas focus:outline-none w-full h-full overflow-auto',
        // Solo i valori che non cambiano mai: `editorProps.attributes` è
        // valutato UNA VOLTA alla creazione dell'editor, quindi corpo e colore
        // — che cambiano da fuori — vivono nell'effetto qui sotto. Questi due
        // restano qui perché nessuno li tocca.
        style: 'line-height: var(--ob-leading-text);padding:0;',
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
    immediatelyRender: false,
  });

  // Corpo e COLORE possono cambiare dopo il mount — il primo dalla TextSidebar,
  // il secondo quando si sceglie un fondo dalla palette. `editorProps.attributes`
  // è statico, quindi si scrivono direttamente sul DOM di ProseMirror a ogni
  // variazione. Il colore stava là dentro e quindi non si aggiornava mai: si
  // vedeva cambiare solo ricaricando la pagina.
  useEffect(() => {
    if (!editor) return;
    editor.view.dom.style.fontSize = `${fontSize}px`;
    editor.view.dom.style.color = textColor;
  }, [fontSize, textColor, editor]);

  /**
   * MISURA DELL'ECCEDENZA — quanto testo non ci sta.
   *
   * L'elemento che scorre è il DOM di ProseMirror (`overflow-auto`), quindi la
   * domanda "il testo entra?" si riduce a `scrollHeight > clientHeight`. Il
   * margine di 1px assorbe gli arrotondamenti sub-pixel: senza, un box che
   * combacia esatto sfarfalla fra eccedente e no a ogni ridisegno.
   *
   * Tre sorgenti di variazione, tre agganci: il RIQUADRO cambia (resize del box)
   * → ResizeObserver; il TESTO cambia da dentro (si digita) → evento `update`;
   * il testo cambia da FUORI (TextSidebar) o cambia il corpo → dipendenze
   * dell'effetto. L'evento `update` non copre il caso esterno, perché quel
   * `setContent` è emesso con `emitUpdate: false`.
   */
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom as HTMLElement;
    const report = () => {
      onMeasureRef.current?.({
        overflowing: dom.scrollHeight > dom.clientHeight + 1,
        contentHeight: dom.scrollHeight,
      });
    };
    report();
    const ro = new ResizeObserver(report);
    ro.observe(dom);
    editor.on('update', report);
    return () => { ro.disconnect(); editor.off('update', report); };
  }, [editor, fontSize, initialHtml]);

  // Sincronizza editable con lo stato di editing e, quando si entra, porta il
  // focus in coda al testo.
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editing);
    if (editing) editor.commands.focus('end');
  }, [editing, editor]);

  // Sync esterno: quando il contenuto cambia da FUORI (es. la TextSidebar
  // modifica lo stesso box) e questo editor NON è in inserimento, riallinea il
  // testo mostrato sul canvas. Durante l'editing lo si lascia stare per non
  // sovrascrivere i tasti in arrivo.
  useEffect(() => {
    if (!editor || editing) return;
    const current = editor.getHTML();
    if (initialHtml && initialHtml !== current) {
      editor.commands.setContent(initialHtml, { emitUpdate: false });
    }
  }, [initialHtml, editing, editor]);

  if (!editor) return null;

  const btnBase = 'h-8 min-w-8 px-2 flex items-center justify-center rounded text-xs leading-none font-medium transition-colors';
  const btnInactive = 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 hover:text-white';
  const btnActive = 'bg-blue-600/30 text-blue-200';

  return (
    <>
      <BubbleMenu
        editor={editor}
        className="tiptap-bubble flex items-center gap-1 p-1 rounded-lg bg-zinc-900 border border-white/10 shadow-xl"
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
