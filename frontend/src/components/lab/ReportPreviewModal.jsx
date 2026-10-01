import React from 'react';
import { FileDown, Printer } from 'lucide-react';
import { Modal, Button } from '../common';
import ServerPdfPreview from './ServerPdfPreview';
import { printReportPdf, downloadReportPdf } from '../../services/publicService';

// Preview, print and download all use the same saved document format.
const ReportPreviewModal = ({
  isOpen,
  onClose,
  report,
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
            onClick={() => report?._id && downloadReportPdf(report._id)}
          >
            <FileDown size={14} /> Download PDF
          </Button>
          <Button
            variant="primary"
            disabled={!report?._id || loading}
            title={report?._id ? 'Print the server-rendered PDF' : 'No report selected'}
            onClick={() => report?._id && printReportPdf(report._id)}
          >
            <Printer size={14} /> Print PDF
          </Button>
        </>
      }
    >
      {loading && <p style={{ color: '#6b7280' }}>Loading preview…</p>}
      {error && <p style={{ color: 'var(--color-danger, #b91c1c)' }}>{error}</p>}
      {!loading && !error && (
        report?._id ? <ServerPdfPreview path={`/reports/${report._id}/pdf`} /> : <p>No report selected.</p>
      )}
    </Modal>
  );
};

export default ReportPreviewModal;
