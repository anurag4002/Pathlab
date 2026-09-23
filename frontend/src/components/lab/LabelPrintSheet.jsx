import React, { useState } from 'react';
import { Printer, Info } from 'lucide-react';
import { Modal, Button } from '../common';
import StickerPreview from './StickerPreview';
import formatDate from '../../utils/formatDate';

/**
 * LabelPrintSheet (Phase 8 + 11) — label preview/print modal opened from
 * billing and report screens.
 *
 * - Patient / bill labels: WORKING (bill barcode endpoint exists).
 * - Case / sample labels: GATED with a "backend pending" note. Their
 *   barcode endpoints do not exist, so this component never calls them.
 */
const LabelPrintSheet = ({ isOpen, onClose, patient, bill, testName }) => {
  const [copies, setCopies] = useState(2);

  const labelProps = {
    patientName: patient?.name || 'Walk-in Patient',
    age: patient?.age ?? '',
    sex: patient?.gender || patient?.sex || '',
    regNo: patient?.registrationNumber || '',
    testName: testName || (bill?.items || []).map((i) => i?.name || i?.test?.name).filter(Boolean).join(', '),
    dateStr: bill?.date ? formatDate(bill.date).split(',')[0] : formatDate(new Date()).split(',')[0],
    billId: bill?._id || '',
    billNumber: bill?.billNumber || ''
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Print Labels / Stickers"
      size="lg"
      footer={
        <>
          <label style={{ fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            Copies
            <select value={copies} onChange={(e) => setCopies(Number(e.target.value))} className="select-control" style={{ maxWidth: 90 }}>
              {[1, 2, 3, 4, 6, 8].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button variant="primary" onClick={() => window.print()}><Printer size={16} /> Print</Button>
        </>
      }
    >
      <style>{`@media print {
        body * { visibility: hidden !important; }
        .label-print-area, .label-print-area * { visibility: visible !important; }
        .label-print-area { position: absolute !important; left: 0; top: 0; width: 100%; }
        .modal-overlay { position: static !important; }
        .modal-header, .modal-footer { display: none !important; }
      }`}</style>

      <div className="label-print-area">
        <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 8 }}>Patient / Bill labels</h4>
        <StickerPreview copies={copies} labelProps={labelProps} />

        <div
          style={{
            marginTop: 14, padding: '10px 12px', borderRadius: 8,
            background: '#fffbeb', border: '1px solid #fcd34d',
            display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: '0.78rem'
          }}
        >
          <Info size={15} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>
            <strong>Case / sample labels — backend pending.</strong>{' '}
            Case-wise and sample-wise barcode endpoints do not exist yet, so those
            labels are intentionally disabled. Bill labels above work today.
          </span>
        </div>
      </div>
    </Modal>
  );
};

export default LabelPrintSheet;
