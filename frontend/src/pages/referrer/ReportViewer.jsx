import React, { useEffect, useState } from 'react';
import { Download, ExternalLink } from 'lucide-react';
import { Button, Modal } from '../../components/common';
import { fetchReferrerReport, downloadReferrerReport } from '../../services/referrerService';
import { patientName } from '../../utils/patientName';

// Shows a signed report on screen (no download needed). The PDF is loaded
// through the doctor's own API and kept only in this page's memory.
export default function ReportViewer({ target, onClose }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  // An outsourced report can have several outside-lab files: one tab each.
  const files = target?.report?.kind === 'lab' && Array.isArray(target?.report?.files) && target.report.files.length > 1 ? target.report.files : [];
  const [fileId, setFileId] = useState('');
  useEffect(() => { setFileId(''); }, [target]);
  const activeFile = files.length ? (files.some((file) => file._id === fileId) ? fileId : files[files.length - 1]._id) : '';
  useEffect(() => {
    if (!target) return undefined;
    let objectUrl = '';
    let cancelled = false;
    setUrl(''); setError('');
    fetchReferrerReport(target.report, activeFile)
      .then((blob) => { if (cancelled) return; objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); })
      .catch((err) => { if (!cancelled) setError(err.response?.data?.message || err.message || 'Could not open the report.'); });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [target, activeFile]);

  const patient = patientName(target?.row?.patient);
  return (
    <Modal isOpen={!!target} onClose={onClose} size="xl" className="rf-viewer-modal"
      title={`${target?.report?.label || 'Report'}${patient ? ` - ${patient}` : ''}`}
      footer={<>
        {url && <a className="btn btn-secondary" href={url} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Open full screen</a>}
        {url && <Button variant="secondary" icon={<Download size={14} />} onClick={() => downloadReferrerReport(target.row, target.report)}>Download</Button>}
        <Button variant="primary" onClick={onClose}>Close</Button>
      </>}>
      <div className="rf-viewer" data-testid="referrer-report-viewer">
        {files.length > 0 && (
          <div className="rf-file-tabs" role="tablist" aria-label="Report files">
            {files.map((file, index) => (
              <button key={file._id} type="button" role="tab" aria-selected={file._id === activeFile}
                className={`rf-file-tab${file._id === activeFile ? ' is-active' : ''}`} onClick={() => setFileId(file._id)}>
                File {index + 1}{file.tests?.length ? `: ${file.tests.join(', ')}` : ''}
              </button>
            ))}
          </div>
        )}
        {error && <div className="rf-error" role="alert">{error}</div>}
        {!error && !url && <p className="rf-meta">Opening the report…</p>}
        {url && <iframe title="Report" src={url} className="rf-viewer-frame" />}
        {url && <p className="rf-meta rf-viewer-hint">Report not showing on your phone? Use Open full screen.</p>}
      </div>
    </Modal>
  );
}
