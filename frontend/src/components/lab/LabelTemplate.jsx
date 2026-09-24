import React from 'react';
import BarcodeSvg from './BarcodeSvg';

/** Truncate long names to label width (Phase 11 validation). */
export const truncateName = (name = '', max = 22) => {
  const s = String(name || '').trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};

const row = { display: 'flex', justifyContent: 'space-between', gap: 6, fontSize: '0.68rem', lineHeight: 1.35 };

/**
 * LabelTemplate (Phase 11) — patient label with name / age / sex /
 * reg no / test / date + bill barcode. Fixed small-label footprint so the
 * layout matches physical label stock.
 */
const LabelTemplate = ({
  patientName = '',
  age = '',
  sex = '',
  regNo = '',
  testName = '',
  dateStr = '',
  billId = '',
  billNumber = ''
}) => (
  <div
    className="label-template"
    style={{
      width: 300, minHeight: 118, border: '1px dashed #334155', borderRadius: 6,
      padding: '8px 10px', background: '#fff', color: '#000', fontFamily: 'sans-serif'
    }}
  >
    <div style={{ ...row, borderBottom: '1px solid #cbd5e1', paddingBottom: 4, marginBottom: 4 }}>
      <strong style={{ fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={patientName}>
        {truncateName(patientName) || '—'}
      </strong>
      <span style={{ whiteSpace: 'nowrap' }}>{age ? `${age}Y` : ''}{age && sex ? ' / ' : ''}{sex || ''}</span>
    </div>
    <div style={row}><span>Reg: <strong>{regNo || '—'}</strong></span><span>{dateStr || ''}</span></div>
    <div style={{ ...row, marginTop: 2 }}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280 }} title={testName}>
        Test: {truncateName(testName, 34) || '—'}
      </span>
    </div>
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
      <BarcodeSvg billId={billId} billNumber={billId ? undefined : billNumber} height={44} label={billNumber} />
    </div>
  </div>
);

export default LabelTemplate;
