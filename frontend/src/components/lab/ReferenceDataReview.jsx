import React, { useState } from 'react';
import { Button, Modal, Select } from '../common';
import { downloadBlob } from '../../utils/downloadFile';
import review from '../../data/referenceRangeReview.json';
import { formatAgeRanges } from '../../utils/ageReferenceRanges';

const referenceText = test => {
  const own = test.referenceRanges?.length ? formatAgeRanges(test.referenceRanges) : test.referenceRange ||
    [test.maleReferenceRange && `Male: ${test.maleReferenceRange}`, test.femaleReferenceRange && `Female: ${test.femaleReferenceRange}`].filter(Boolean).join('\n');
  return [own, ...(test.parameters || []).map(parameter => `${parameter.name || parameter.code}: ${referenceText(parameter) || 'Reference text missing'}`)].filter(Boolean).join('\n');
};

export default function ReferenceDataReview({ open, onClose, tests = [] }) {
  const [code, setCode] = useState(review.tests.find(t => t.proposal)?.code || '');
  const entry = review.tests.find(t => t.code === code);
  const live = tests.find(t => t.code === code);
  const current = live || entry?.existing || {};
  const exportCsv = () => {
    const quote = value => {
      const text = String(value ?? '');
      return `"${(/^[=+@\-\t\r]/.test(text) ? "'" + text : text).replace(/"/g, '""')}"`;
    };
    const rows = [['Code', 'Test', 'Current unit', 'Existing reference', 'Review status', 'Proposed unit', 'Proposed sex / age / context / range', 'Source', 'Lab review notes'],
      ...review.tests.map(t => {
        const actual = tests.find(item => item.code === t.code);
        return [t.code, t.name, actual?.unit ?? t.currentUnit, referenceText(actual || t.existing),
          t.reviewStatus, t.proposal?.unit, t.proposal?.rows.map(r => `${r.sex}; ${r.age}; ${r.context}; ${r.range}`).join('\n'),
          t.proposal?.sourceUrl || 'Existing test database', [t.proposal?.notes, t.reviewNotes].filter(Boolean).join('\n')];
      })];
    downloadBlob(new Blob(['\uFEFF' + rows.map(row => row.map(quote).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }), 'reference-data-review.csv');
  };
  return <Modal isOpen={open} onClose={onClose} title="Reference data review" size="lg" footer={<>
    <Button variant="secondary" onClick={exportCsv}>Download all {review.tests.length} tests</Button>
    <Button variant="secondary" onClick={onClose}>Close review</Button>
  </>}>
    <div className="nr-review">
      <p>These sourced proposals are pending lab review. Existing database ranges remain active. Check the assay, unit, specimen and clinical context before entering approved values in the range editor.</p>
      <Select label="Test to review" name="review-test" value={code} placeholder="" onChange={e => setCode(e.target.value)}
        options={review.tests.map(t => ({ value: t.code, label: `${t.name}${t.proposal ? ' — review proposed data' : ''}` }))} />
      {entry && <>
        <section className="nr-review-section"><h3>Existing database</h3><p>Source: {entry.existing.source}</p><p>Unit: {current.unit || entry.currentUnit || 'Not configured'}</p>
          <div className="nr-review-text">{referenceText(current) || 'Reference text missing'}</div>
          <p className="form-helper">{entry.reviewNotes}</p>
        </section>
        {entry.proposal ? <section className="nr-review-section"><h3>{entry.proposal.kind} — pending review</h3>
          <p>{entry.proposal.notes}</p><p>Proposed unit: {entry.proposal.unit || 'Qualitative / to be specified'}</p>
          {entry.proposal.sourceUrl && <a href={entry.proposal.sourceUrl} target="_blank" rel="noreferrer">Open reference source</a>}
          {entry.proposal.rows.length > 0 && <div className="nr-proposal-scroll"><table className="nr-proposal-table"><thead><tr><th>Sex</th><th>Age / scope</th><th>Context</th><th>Candidate</th></tr></thead><tbody>
            {entry.proposal.rows.map((row, i) => <tr key={i}><td>{row.sex}</td><td>{row.age}</td><td>{row.context || '—'}</td><td>{row.range}</td></tr>)}
          </tbody></table></div>}
        </section> : <p>The existing reference is retained. No external replacement is proposed.</p>}
      </>}
    </div>
  </Modal>;
}
