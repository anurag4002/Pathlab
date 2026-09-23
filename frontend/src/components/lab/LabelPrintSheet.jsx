import React, { useState } from 'react';
import { Printer, Tag } from 'lucide-react';
import { Modal, Button } from '../common';
import BarcodeSvg from './BarcodeSvg';
import { truncateName } from './LabelTemplate';
import formatDate from '../../utils/formatDate';

/**
 * LabelPrintSheet — barcode label printing for the (thermal) label printer,
 * separate from A4 report printing.
 *
 * Tabs: Bill / Case / Sample labels. Bill barcodes use the auth endpoint by
 * id or the public endpoint by bill number; case/sample barcodes use the
 * public Code39 SVG endpoints. Stock size drives an exact @page rule so a
 * thermal printer feeds one label per page.
 */
const STOCKS = [
  { value: '50x25', label: '50 × 25 mm', w: '50mm', h: '25mm' },
  { value: '38x25', label: '38 × 25 mm', w: '38mm', h: '25mm' },
  { value: '102x51', label: '102 × 51 mm', w: '102mm', h: '51mm' },
];

const caseBarcodeUrl = (v) => `/api/public/case/${encodeURIComponent(v)}/barcode`;
const sampleBarcodeUrl = (v) => `/api/public/sample/${encodeURIComponent(v)}/barcode`;

const ThermalLabel = ({ lines, stock, children }) => (
  <div
    className="thermal-label"
    style={{
      width: stock.w, height: stock.h, background: '#fff', color: '#000',
      fontFamily: 'sans-serif', overflow: 'hidden', boxSizing: 'border-box',
      padding: stock.value === '102x51' ? '3mm' : '1.5mm',
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
      border: '1px dashed #94a3b8',
    }}
  >
    {lines.map((ln, i) => (
      <div
        key={i}
        style={{
          fontSize: i === 0 ? (stock.value === '102x51' ? '4mm' : '3mm') : '2.6mm',
          fontWeight: i === 0 ? 700 : 400,
          lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}
        title={ln}
      >
        {ln}
      </div>
    ))}
    {children}
  </div>
);

const ThermalBarcodeImg = ({ src, label, tall }) => (
  // No separate caption: the Code39 SVG already carries human-readable text.
  src ? (
    <img
      src={src}
      alt={label || 'barcode'}
      style={{ height: tall ? '16mm' : '9mm', maxWidth: '100%', objectFit: 'contain', marginTop: '1mm' }}
      onError={(e) => { e.currentTarget.style.display = 'none'; }}
    />
  ) : null
);

const LabelPrintSheet = ({
  isOpen, onClose, patient, bill, testName,
  caseId = '', caseLabel = '', sampleId = '',
}) => {
  const [tab, setTab] = useState('bill'); // 'bill' | 'case' | 'sample'
  const [copies, setCopies] = useState(2);
  const [stock, setStock] = useState(STOCKS[0]);
  const [caseValue, setCaseValue] = useState('');
  const [sampleValue, setSampleValue] = useState('');

  const resolvedCase = caseValue.trim() || caseLabel || caseId;
  const resolvedSample = sampleValue.trim() || sampleId || caseLabel || caseId;

  const patientName = truncateName(patient?.name || 'Walk-in Patient');
  const ageSex = [patient?.age ? `${patient.age}Y` : '', patient?.gender || patient?.sex || ''].filter(Boolean).join(' / ');
  const regNo = patient?.registrationNumber || '';
  const dateStr = bill?.date ? formatDate(bill.date).split(',')[0] : formatDate(new Date()).split(',')[0];
  const shortTests = truncateName(testName || (bill?.items || []).map((i) => i?.name || i?.test?.name).filter(Boolean).join(', '), 40);

  const billLines = [
    patientName + (ageSex ? `  ${ageSex}` : ''),
    [`Reg: ${regNo || '—'}`, dateStr].filter(Boolean).join('   '),
    shortTests ? `T: ${shortTests}` : '',
  ].filter(Boolean);

  const copiesList = Array.from({ length: Math.max(1, Math.min(12, Number(copies) || 1)) });

  const printCss = `
    @page { size: ${stock.w} ${stock.h}; margin: 0; }
    @media print {
      html, body { background: #fff !important; }
      body * { visibility: hidden !important; }
      .thermal-print-area, .thermal-print-area * { visibility: visible !important; }
      /* One label per page: vertical stack, exact stock footprint, no chrome. */
      .thermal-print-area {
        position: absolute !important; left: 0 !important; top: 0 !important;
        display: block !important; width: auto !important;
        background: #fff !important;
      }
      .thermal-print-page {
        display: block !important;
        width: ${stock.w} !important; height: ${stock.h} !important;
        margin: 0 !important; padding: 0 !important; overflow: hidden !important;
        page-break-after: always; page-break-inside: avoid;
      }
      .thermal-print-page:last-child { page-break-after: auto; }
      .thermal-label {
        width: 100% !important; height: 100% !important;
        border: none !important; border-radius: 0 !important;
        box-shadow: none !important; margin: 0 !important;
      }
      .modal-overlay { position: static !important; background: #fff !important; padding: 0 !important; }
      .modal-content { box-shadow: none !important; border: none !important; }
      .modal-header, .modal-footer, .no-thermal-print { display: none !important; }
    }
  `;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Print Labels — label printer"
      size="lg"
      footer={
        <>
          <label style={{ fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            Stock
            <select value={stock.value} onChange={(e) => setStock(STOCKS.find((s) => s.value === e.target.value) || STOCKS[0])} className="select-control" style={{ maxWidth: 140 }}>
              {STOCKS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
          <label style={{ fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            Copies
            <select value={copies} onChange={(e) => setCopies(Number(e.target.value))} className="select-control" style={{ maxWidth: 90 }}>
              {[1, 2, 3, 4, 6, 8].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button variant="primary" onClick={() => window.print()}><Printer size={16} /> Print Labels</Button>
        </>
      }
    >
      <style>{printCss}</style>

      <div className="no-thermal-print" style={{ display: 'flex', gap: 8, marginBottom: 12 }} role="tablist" aria-label="Label type">
        {[
          { value: 'bill', label: 'Bill label' },
          { value: 'case', label: 'Case label' },
          { value: 'sample', label: 'Sample label' },
        ].map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={tab === t.value}
            onClick={() => setTab(t.value)}
            className={`btn ${tab === t.value ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
          >
            <Tag size={13} /> {t.label}
          </button>
        ))}
      </div>

      {tab !== 'bill' && (
        <div className="no-thermal-print" style={{ marginBottom: 12 }}>
          <label style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 320 }}>
            {tab === 'case' ? 'Case value (reg no / case id)' : 'Sample id'}
            <input
              className="form-control"
              value={tab === 'case' ? caseValue : sampleValue}
              onChange={(e) => (tab === 'case' ? setCaseValue(e.target.value) : setSampleValue(e.target.value))}
              placeholder={tab === 'case' ? (resolvedCase || 'e.g. PPL-20260101-00001') : (resolvedSample || 'e.g. tube id')}
            />
          </label>
        </div>
      )}

      <div className="thermal-print-area" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {copiesList.map((_, i) => (
          <div key={i} className="thermal-print-page">
            {tab === 'bill' ? (
              <ThermalLabel lines={billLines} stock={stock}>
                {(bill?._id || bill?.billNumber) ? (
                  <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', marginTop: '1mm' }}>
                    <BarcodeSvg
                      billId={bill?._id || ''}
                      billNumber={bill?._id ? undefined : bill?.billNumber}
                      height={stock.value === '102x51' ? 60 : 40}
                    />
                  </span>
                ) : (
                  <span style={{ fontSize: '2.6mm', color: '#666' }}>No bill linked — barcode unavailable</span>
                )}
              </ThermalLabel>
            ) : tab === 'case' ? (
              <ThermalLabel lines={[patientName, `Case: ${resolvedCase || '—'}`, dateStr]} stock={stock}>
                <ThermalBarcodeImg src={resolvedCase ? caseBarcodeUrl(resolvedCase) : ''} label={resolvedCase} tall={stock.value === '102x51'} />
              </ThermalLabel>
            ) : (
              <ThermalLabel lines={[patientName, `Sample: ${resolvedSample || '—'}`, dateStr]} stock={stock}>
                <ThermalBarcodeImg src={resolvedSample ? sampleBarcodeUrl(resolvedSample) : ''} label={resolvedSample} tall={stock.value === '102x51'} />
              </ThermalLabel>
            )}
          </div>
        ))}
      </div>

      <p className="no-thermal-print" style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 10 }}>
        Prints one {stock.label} label per page on the label printer. A4 report printing is separate (Preview / Print on the report row).
      </p>
    </Modal>
  );
};

export default LabelPrintSheet;
