import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '../common';
import { notify } from '../common/Toast/toast';
import { publishReportFile } from '../../services/reportService';

// Each outside-lab file on a report, with the tests it holds and whether the
// patient can see it. A file can be published on its own, so a test that is
// back is shared while the others are still with the outside lab.
// `onChanged(updatedReport)` gets the report as the server returns it.
export default function ReportFilesPublish({ report, onChanged }) {
  const [busy, setBusy] = useState('');
  const files = Array.isArray(report?.files) ? report.files : [];
  if (!report?._id || !files.length) return null;

  const toggle = async (file) => {
    const id = String(file._id);
    const next = file.published === false;
    setBusy(id);
    try {
      const res = await publishReportFile(report._id, id, next);
      if (res?.success) {
        notify(next ? 'Published to the patient.' : 'Hidden from the patient.');
        onChanged?.(res.data);
      }
    } catch (error) {
      notify(error?.response?.data?.message || 'Could not change what the patient sees.');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="report-files-publish">
      <p style={{ margin: '0 0 4px', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>Uploaded files</p>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
        {files.map((file, i) => {
          const published = file.published !== false;
          const name = file.name || file.originalName || `File ${i + 1}`;
          return (
            <li key={String(file._id)} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 'var(--font-size-sm)' }}>
              <span style={{ fontWeight: 500 }}>{file.tests?.length ? file.tests.join(', ') : 'All tests'}</span>
              <span className="cell-sub" style={{ display: 'inline' }}>{name}</span>
              <span className="cell-sub" style={{ display: 'inline', color: published ? 'var(--color-success, #166534)' : 'var(--color-warning, #92400e)' }}>
                {published ? 'Visible to patient' : 'Not published'}
              </span>
              <Button
                size="sm"
                variant="secondary"
                icon={published ? <EyeOff size={14} /> : <Eye size={14} />}
                loading={busy === String(file._id)}
                disabled={!!busy}
                onClick={() => toggle(file)}
                aria-label={`${published ? 'Unpublish' : 'Publish'} ${name}`}
              >
                {published ? 'Unpublish' : 'Publish'}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
