import React, { useState } from 'react';
import { Upload } from 'lucide-react';
import { Button, FileUploader, Modal } from '../common';
import { uploadXrayReport } from '../../services/xrayService';

export default function XrayReportUpload({ record, onUploaded }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async () => {
    if (!file || !/\.pdf$/i.test(file.name)) { setError('Choose a PDF report.'); return; }
    if (file.size > 10 * 1024 * 1024) { setError('PDF report must be 10 MB or smaller.'); return; }
    setBusy(true); setError('');
    try {
      const response = await uploadXrayReport(record._id, file);
      if (!response.success) throw new Error(response.message || 'Could not upload the PDF.');
      setOpen(false); setFile(null); onUploaded?.(response.data);
    } catch (error) { setError(error.response?.data?.message || error.message || 'Could not upload the PDF.'); }
    finally { setBusy(false); }
  };
  return <>
    <Button variant="secondary" size="sm" icon={<Upload size={14} />} onClick={() => { setFile(null); setError(''); setOpen(true); }}>
      {record.reportFile?.size ? 'Replace PDF' : 'Upload PDF'}
    </Button>
    <Modal isOpen={open} onClose={() => !busy && setOpen(false)} title={`Upload X-Ray PDF — ${record.patient?.name || ''}`}
      footer={<><Button variant="secondary" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button><Button loading={busy} disabled={busy} onClick={submit}>Upload PDF</Button></>}>
      <FileUploader label="X-Ray PDF report" subtitle="PDF report, up to 10 MB. Written findings are optional when uploading a report."
        accept=".pdf" value={file} onChange={setFile} error={error} disabled={busy} />
    </Modal>
  </>;
}
