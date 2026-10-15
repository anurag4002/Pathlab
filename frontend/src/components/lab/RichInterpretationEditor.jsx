import React, { useEffect } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TableKit } from '@tiptap/extension-table';
import TextAlign from '@tiptap/extension-text-align';
import { Bold, Italic, Underline, List, ListOrdered, AlignLeft, AlignCenter, AlignRight, Undo2, Redo2, Table2 } from 'lucide-react';
import { toInterpretationHtml } from '../../utils/interpretationContent';
import '../../styles/InterpretationRichText.css';

export default function RichInterpretationEditor({ value, onChange, label = 'Interpretation', disabled = false }) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [2, 3, 4] }, link: false, codeBlock: false, code: false }),
      TableKit.configure({ table: { resizable: true, cellMinWidth: 60 } }),
      TextAlign.configure({ types: ['heading', 'paragraph'] })],
    content: toInterpretationHtml(value),
    editable: !disabled,
    editorProps: { attributes: { role: 'textbox', 'aria-label': label, 'aria-multiline': 'true', class: 'interpretation-document', spellcheck: 'true' } },
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? '' : editor.getHTML()),
  });
  const state = useEditorState({ editor, selector: ({ editor }) => editor ? {
    bold: editor.isActive('bold'), italic: editor.isActive('italic'), underline: editor.isActive('underline'),
    bullet: editor.isActive('bulletList'), ordered: editor.isActive('orderedList'), inTable: editor.isActive('table'),
    align: editor.isActive({ textAlign: 'center' }) ? 'center' : editor.isActive({ textAlign: 'right' }) ? 'right' : 'left',
    heading: editor.isActive('heading', { level: 2 }) ? '2' : editor.isActive('heading', { level: 3 }) ? '3' : editor.isActive('heading', { level: 4 }) ? '4' : 'p',
  } : null });
  useEffect(() => {
    if (!editor) return;
    const html = toInterpretationHtml(value);
    // External library replacements update the document without resetting
    // the selection on every keystroke.
    if (editor.getHTML() !== html && !(editor.isEmpty && !value)) editor.commands.setContent(html, { emitUpdate: false });
  }, [editor, value]);
  useEffect(() => { editor?.setEditable(!disabled); }, [editor, disabled]);
  if (!editor || !state) return <p>Loading rich text editor…</p>;
  const tool = (name, icon, command, active = false, unavailable = false) => <button key={name} type="button" className={`interpretation-tool${active ? ' is-active' : ''}`}
    aria-label={name} title={name} aria-pressed={active} disabled={disabled || unavailable} onMouseDown={event => event.preventDefault()} onClick={command}>{icon}</button>;
  return <div className={`interpretation-editor${disabled ? ' is-disabled' : ''}`}>
    <div className="interpretation-rich-toolbar" role="toolbar" aria-label="Interpretation formatting">
      <select aria-label="Paragraph style" value={state.heading} disabled={disabled} onChange={event => {
        if (event.target.value === 'p') editor.chain().focus().setParagraph().run();
        else editor.chain().focus().toggleHeading({ level: Number(event.target.value) }).run();
      }}><option value="p">Paragraph</option><option value="2">Heading 1</option><option value="3">Heading 2</option><option value="4">Heading 3</option></select>
      {tool('Bold', <Bold size={16} />, () => editor.chain().focus().toggleBold().run(), state.bold)}
      {tool('Italic', <Italic size={16} />, () => editor.chain().focus().toggleItalic().run(), state.italic)}
      {tool('Underline', <Underline size={16} />, () => editor.chain().focus().toggleUnderline().run(), state.underline)}
      <span className="interpretation-toolbar-divider" />
      {tool('Bullet list', <List size={16} />, () => editor.chain().focus().toggleBulletList().run(), state.bullet)}
      {tool('Numbered list', <ListOrdered size={16} />, () => editor.chain().focus().toggleOrderedList().run(), state.ordered)}
      {tool('Align left', <AlignLeft size={16} />, () => editor.chain().focus().setTextAlign('left').run(), state.align === 'left')}
      {tool('Align center', <AlignCenter size={16} />, () => editor.chain().focus().setTextAlign('center').run(), state.align === 'center')}
      {tool('Align right', <AlignRight size={16} />, () => editor.chain().focus().setTextAlign('right').run(), state.align === 'right')}
      <span className="interpretation-toolbar-divider" />
      <button type="button" className="interpretation-tool interpretation-tool-label" disabled={disabled} onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Table2 size={16} /> Insert table</button>
      {tool('Undo', <Undo2 size={16} />, () => editor.chain().focus().undo().run(), false, !editor.can().undo())}
      {tool('Redo', <Redo2 size={16} />, () => editor.chain().focus().redo().run(), false, !editor.can().redo())}
    </div>
    {state.inTable && <div className="interpretation-table-toolbar" role="toolbar" aria-label="Table editing">
      <span>Table</span>
      {[
        ['Row above', 'addRowBefore'], ['Row below', 'addRowAfter'], ['Delete row', 'deleteRow'],
        ['Column left', 'addColumnBefore'], ['Column right', 'addColumnAfter'], ['Delete column', 'deleteColumn'],
        ['Merge cells', 'mergeCells'], ['Split cell', 'splitCell'], ['Header row', 'toggleHeaderRow'], ['Delete table', 'deleteTable'],
      ].map(([name, command]) => <button key={command} type="button" disabled={disabled || !editor.can()[command]()} onMouseDown={event => event.preventDefault()}
        onClick={() => editor.chain().focus()[command]().run()}>{name}</button>)}
    </div>}
    <EditorContent editor={editor} />
    <div className="interpretation-editor-hint">Click a table cell to edit it. Use Tab for the next cell; drag a column border to resize.</div>
  </div>;
}
