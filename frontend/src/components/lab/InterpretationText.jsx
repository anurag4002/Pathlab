import React, { useMemo } from 'react';

/* Structured rendering for test interpretations.
   Lab interpretation strings carry section headings ("Physiological basis",
   "Interpretation", "Increased in:", "Decreased in:", ...) separated by
   newlines — or flattened into one blob. This splits them back into headed
   sections so they read as formatted guidance instead of a wall of text. */

// Standalone heading lines (optional trailing colon).
const HEADING_RE = /^(physiological basis|clinical significance|interpretation|increased in|decreased in|causes?|notes?|comments?|method|principle|reference(?: interval| range)?|clinical utility|limitations?|specimen|precautions?)\s*:?\s*$/i;
// "Increased in: <list...>" / "Decreased in: <list...>" on one line.
const INLINE_HEAD_RE = /^(increased in|decreased in)\s*:\s*(.+)$/i;

const titleCase = (s) => {
  const t = String(s || '').trim().replace(/:\s*$/, '');
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
};

function splitBlocks(text) {
  const normalized = String(text || '').replace(/\r\n?/g, '\n');
  let chunks = normalized.split('\n').map((s) => s.trim()).filter(Boolean);
  if (chunks.length <= 1 && chunks[0]) {
    // Flattened blob — force breaks before change-list headings.
    chunks = chunks[0].split(/(?=(?:Increased|Decreased) in\s*:)/).map((s) => s.trim()).filter(Boolean);
  }
  return chunks;
}

const InterpretationText = ({ text }) => {
  const blocks = useMemo(() => splitBlocks(text), [text]);
  if (!blocks.length) return null;
  return (
    <details className="re-interpretation">
      <summary>Interpretation</summary>
      <div className="interp-body">
        {blocks.map((block, i) => {
          const headOnly = block.match(HEADING_RE);
          if (headOnly) {
            return <div key={i} className="interp-head">{titleCase(headOnly[1])}</div>;
          }
          const inline = block.match(INLINE_HEAD_RE);
          if (inline) {
            return (
              <div key={i} className="interp-block">
                <div className="interp-head">{titleCase(inline[1])}:</div>
                <p className="interp-p">{inline[2].trim()}</p>
              </div>
            );
          }
          return <p key={i} className="interp-p">{block}</p>;
        })}
      </div>
    </details>
  );
};

export default InterpretationText;
