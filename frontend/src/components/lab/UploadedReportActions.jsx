import React, { useState } from 'react';
import { Download, Printer, Upload } from 'lucide-react';
import { Button } from '../common';
import apiClient from '../../services/apiClient';
import { downloadBlob } from '../../utils/downloadFile';
import { notify } from '../common/Toast/toast';

// An uploaded (outsourced) report is one or more finished files from the
// other lab (one PDF for several tests, or one per test), so it gets exactly
// three actions: Download them, Print them, or Replace a file. Download and
// Print go through every uploaded file.
// No letterhead choice and no generated-PDF options - those only apply to
// reports whose values were typed in here.

const fetchUploadedFile = async (reportId, fileId) => {
  const params = fileId && fileId !== 'legacy' ? { file: fileId } : undefined;
  const response = await apiClient.get(`/reports/${reportId}/download`, { responseType: 'blob', params });
  const type = response.headers?.['content-type'] || response.data?.type || 'application/pdf';
  if (/application\/json|text\/html/i.test(type)) throw new Error('The uploaded file could not be found. Upload it again.');
  const blob = response.data instanceof Blob ? response.data : new Blob([response.data], { type });
  const name = /filename="?([^";]+)"?/i.exec(response.headers?.['content-disposition'] || '')?.[1];
  return { blob, name };
};

const extensionFor = (blob) => (/png/i.test(blob.type) ? '.png' : /jpe?g/i.test(blob.type) ? '.jpg' : '.pdf');

// Print the file through a hidden frame; phones that cannot print from a
// frame get the file opened in a new tab, where they can print or share it.
const printBlob = (blob) => new Promise((resolve) => {
  const url = URL.createObjectURL(blob);
  const done = () => { setTimeout(() => { URL.revokeObjectURL(url); frame.remove(); }, 60000); resolve(); };
  const frame = document.createElement('iframe');
  frame.title = 'Uploaded report print document';
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:816px;height:1056px;border:0';
  frame.onload = () => setTimeout(() => {
    try {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } catch {
      window.open(url, '_blank', 'noopener');
    }
    done();
  }, 700);
  if (/^image\//.test(blob.type)) {
    frame.srcdoc = `<html><body style="margin:0"><img src="${url}" style="width:100%"></body></html>`;
  } else {
    frame.src = url;
  }
  document.body.appendChild(frame);
});

export default function UploadedReportActions({ report, onReplace, size = 'sm', showReplace = true }) {
  const [busy, setBusy] = useState('');
  const fileName = `Report_${report?.registrationNumber || report?._id}`;
  const count = Array.isArray(report?.files) ? report.files.length : 0;
  const many = count > 1 ? ` (${count} files)` : '';
  // Some outsourced tests still have no file: the next upload adds one.
  const waiting = Array.isArray(report?.fileCoverage) && report.fileCoverage.some((row) => !row.covered);

  const run = async (kind) => {
    if (busy || !report?._id) return;
    setBusy(kind);
    try {
      const files = Array.isArray(report.files) && report.files.length ? report.files : [{ _id: null }];
      for (let i = 0; i < files.length; i += 1) {
        const { blob, name } = await fetchUploadedFile(report._id, files[i]?._id ? String(files[i]._id) : null);
        const suffix = files.length > 1 ? `_${i + 1}` : '';
        if (kind === 'download') downloadBlob(blob, files.length > 1 ? `${fileName}${suffix}${extensionFor(blob)}` : (name || `${fileName}${extensionFor(blob)}`));
        else await printBlob(blob);
      }
    } catch (error) {
      notify(error?.response?.status === 404
        ? 'The uploaded file could not be found. Upload it again.'
        : (error?.message || 'Could not open the uploaded report.'));
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="uploaded-report-actions" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      <Button size={size} variant="secondary" icon={<Download size={14} />} onClick={() => run('download')} loading={busy === 'download'} disabled={!!busy}>
        Download{many}
      </Button>
      <Button size={size} variant="secondary" icon={<Printer size={14} />} onClick={() => run('print')} loading={busy === 'print'} disabled={!!busy}>
        Print{many}
      </Button>
      {showReplace && onReplace && (
        <Button size={size} variant="secondary" icon={<Upload size={14} />} onClick={onReplace} disabled={!!busy}>
          {waiting ? 'Upload next file' : 'Replace file'}
        </Button>
      )}
    </div>
  );
}
