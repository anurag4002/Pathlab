import React, { useState } from 'react';
import './DocumentResultEditor.css';

// Findings of a Document test (Widal, FNAC, PAP smear, Culture ...) are stored
// as text: one printed line per line, "| a | b |" lines form a table. The same
// rules drive the PDF (backend interpretationLayout.documentBlocks), so what
// staff see and edit here is laid out the way it prints.
const isTableLine = (line) => /^\|.*\|$/.test(line.trim());
const cellsOf = (line) => line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());

export function parseDocument(value) {
  const blocks = [];
  for (const line of String(value || '').replace(/\r\n?/g, '\n').split('\n')) {
    if (isTableLine(line)) {
      const last = blocks.at(-1);
      if (last?.type === 'table') last.rows.push(cellsOf(line));
      else blocks.push({ type: 'table', rows: [cellsOf(line)] });
    } else blocks.push({ type: 'line', text: line });
  }
  return blocks;
}

export function serializeDocument(blocks) {
  return blocks.flatMap((block) => (block.type === 'table'
    ? block.rows.map((row) => `| ${row.join(' | ')} |`)
    : [block.text])).join('\n');
}

export default function DocumentResultEditor({ id, value, onChange, disabled, label }) {
  const [asText, setAsText] = useState(false);
  const blocks = parseDocument(value);
  const update = (index, next) => onChange(serializeDocument(blocks.map((block, i) => (i === index ? next : block))));
  const setCell = (index, r, c, text) => {
    const rows = blocks[index].rows.map((row, ri) => (ri === r ? row.map((cell, ci) => (ci === c ? text : cell)) : row));
    update(index, { ...blocks[index], rows });
  };
  const addRow = (index) => {
    const width = Math.max(...blocks[index].rows.map((row) => row.length));
    update(index, { ...blocks[index], rows: [...blocks[index].rows, Array(width).fill('')] });
  };

  if (asText) {
    return (
      <div className="doc-editor">
        <textarea id={id} className="form-control doc-editor-text" aria-label={label} value={value} disabled={disabled}
          rows={Math.min(18, Math.max(5, String(value || '').split('\n').length + 1))}
          onChange={(event) => onChange(event.target.value)} />
        <div className="doc-editor-bar">
          <span>Each line prints as written. Lines like <code>| S TYPHI &quot;O&quot; | + | - |</code> print as a table row.</span>
          <button type="button" className="doc-editor-switch" onClick={() => setAsText(false)}>Show as report</button>
        </div>
      </div>
    );
  }

  return (
    <div className="doc-editor" role="group" aria-label={label}>
      <div className="doc-editor-sheet">
        {blocks.map((block, index) => {
          if (block.type === 'table') {
            return (
              <div className="doc-editor-table-wrap" key={index}>
                <table className="doc-editor-table">
                  <tbody>
                    {block.rows.map((row, r) => (
                      <tr key={r}>
                        {row.map((cell, c) => (
                          <td key={c} className={c === 0 ? 'doc-editor-label' : ''}>
                            <input value={cell} disabled={disabled} aria-label={`${label}: row ${r + 1}, column ${c + 1}`}
                              id={index === blocks.findIndex((b) => b.type === 'table') && !r && !c ? id : undefined}
                              onChange={(event) => setCell(index, r, c, event.target.value)} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!disabled && <button type="button" className="doc-editor-add" onClick={() => addRow(index)}>+ Add row</button>}
              </div>
            );
          }
          if (!block.text.trim()) return <div className="doc-editor-gap" key={index} />;
          return (
            <textarea key={index} className="doc-editor-line" value={block.text} disabled={disabled}
              aria-label={`${label}: line ${index + 1}`} rows={Math.max(1, Math.ceil(block.text.length / 95))}
              onChange={(event) => update(index, { type: 'line', text: event.target.value.replace(/\n/g, ' ') })} />
          );
        })}
        {!blocks.some((block) => block.type === 'table' || block.text.trim()) && (
          <textarea id={id} className="doc-editor-line" placeholder="Enter report findings" value="" disabled={disabled}
            aria-label={label} rows={3} onChange={(event) => onChange(event.target.value)} />
        )}
      </div>
      <div className="doc-editor-bar">
        <span>Laid out as it prints on the report.</span>
        <button type="button" className="doc-editor-switch" onClick={() => setAsText(true)} disabled={disabled}>Edit as text</button>
      </div>
    </div>
  );
}
