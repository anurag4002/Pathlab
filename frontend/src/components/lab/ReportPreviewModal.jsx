import React, { useEffect, useState } from 'react';
import { FileDown } from 'lucide-react';
import { Modal, Button } from '../common';
import PrintStationerySelect from './PrintStationerySelect';
import { stationeryOptions } from '../../utils/reportPrintOptions';
import ServerPdfPreview from './ServerPdfPreview';
import { downloadReportPdf, buildPdfQuery } from '../../services/publicService';
import ReportPrintActions from './ReportPrintActions';

// Preview, print and download all use the same saved document format.
const ReportPreviewModal = ({
  isOpen,
  onClose,
  report,
  loading = false,
  error = '',
  stationery: selectedStationery,
  onStationeryChange,
}) => {
  const [actionError, setActionError] = useState('');
  const [localStationery, setLocalStationery] = useState('default');
  const stationery = selectedStationery ?? localStationery;
  const options = stationeryOptions(stationery);
  useEffect(() => { setActionError(''); }, [report?._id, isOpen]);
  const runPdfAction = async action => {
    if (!report?._id) return;
    setActionError('');
    try { await action(report._id, options); }
    catch (error) { setActionError(error.response?.data?.message || error.message || 'Could not generate the PDF.'); }
  };
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
            onClick={() => runPdfAction(downloadReportPdf)}
          >
            <FileDown size={14} /> Download PDF
          </Button>
          <ReportPrintActions reportId={report?._id} variant="primary" disabled={loading}
            onStationeryChange={onStationeryChange || setLocalStationery} />
        </>
      }
    >
      <PrintStationerySelect value={stationery} onChange={onStationeryChange || setLocalStationery} />
      {loading && <p style={{ color: '#6b7280' }}>Loading preview…</p>}
      {error && <p style={{ color: 'var(--color-danger, #b91c1c)' }}>{error}</p>}
      {actionError && <p role="alert" style={{ color: 'var(--color-danger, #b91c1c)' }}>{actionError}</p>}
      {!loading && !error && (
        report?._id ? <ServerPdfPreview path={`/reports/${report._id}/pdf${buildPdfQuery(options)}`} /> : <p>No report selected.</p>
      )}
    </Modal>
  );
};

export default ReportPreviewModal;
