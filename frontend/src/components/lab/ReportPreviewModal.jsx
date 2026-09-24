import React from 'react';
import { FileDown, Printer } from 'lucide-react';
import { Modal, Button } from '../common';
import ReportPrintView from './ReportPrintView';
import { printReportPdf, downloadReportPdf } from '../../services/publicService';

// Phase 4 — ReportPreviewModal. Reuses ReportPrintView (the shared print
// template) so preview layout == print layout. Print/download go through the
// single consistent path: printReportPdf(id) / downloadReportPdf(id), which
// hit GET /api/reports/:id/pdf (server-rendered PDF, letterhead toggle).
const ReportPreviewModal = ({
  isOpen,
  onClose,
  report,
  qrDataUrl,
  verifyUrl,
  signatures = [],
  loading = false,
  error = '',
}) => {
  if (!isOpen) return null;
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Report Preview — ${report?.registrationNumber || ''}`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button
            variant="secondary"
            disabled={!report?._id || loading}
            title={report?._id ? 'Download the server-rendered PDF' : 'No report selected'}
            onClick={() => report?._id && downloadReportPdf(report._id, true)}
          >
            <FileDown size={14} /> Download PDF
          </Button>
          <Button
            variant="primary"
            disabled={!report?._id || loading}
            title={report?._id ? 'Print the server-rendered PDF' : 'No report selected'}
            onClick={() => report?._id && printReportPdf(report._id, true)}
          >
            <Printer size={14} /> Print PDF
          </Button>
        </>
      }
    >
      {loading && <p style={{ color: '#6b7280' }}>Loading preview…</p>}
      {error && <p style={{ color: 'var(--color-danger, #b91c1c)' }}>{error}</p>}
      {!loading && !error && (
        <ReportPrintView report={report} qrDataUrl={qrDataUrl} verifyUrl={verifyUrl} signatures={signatures} />
      )}
    </Modal>
  );
};

export default ReportPreviewModal;
