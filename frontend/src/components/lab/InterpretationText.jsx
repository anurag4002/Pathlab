import React from 'react';
import { hasInterpretation, toInterpretationHtml } from '../../utils/interpretationContent';
import '../../styles/InterpretationRichText.css';

export default function InterpretationText({ text, title = 'Interpretation' }) {
  if (!hasInterpretation(text)) return null;
  return <details className="re-interpretation">
    <summary>{title}</summary>
    <div className="interpretation-document interpretation-display" dangerouslySetInnerHTML={{ __html: toInterpretationHtml(text) }} />
  </details>;
}
