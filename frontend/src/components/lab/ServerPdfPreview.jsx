import React, { useEffect, useState } from 'react';
import { getReportPdfDocument } from '../../services/reportPdfDocumentService';

export default function ServerPdfPreview({ path, refreshKey = 0 }) {
  const requestKey = `${path}:${refreshKey}`;
  const [preview, setPreview] = useState({ key: '', url: '', error: '' });
  useEffect(() => {
    let active = true, objectUrl;
    getReportPdfDocument(path).then(blob => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob);
      setPreview({ key: requestKey, url: objectUrl, error: '' });
    }).catch(error => { if (active) setPreview({ key: requestKey, url: '', error: error.response?.data?.message || 'Could not load the PDF preview. Close and reopen to retry.' }); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [path, requestKey]);
  const { url, error } = preview.key === requestKey ? preview : { url: '', error: '' };
  if (error) return <p role="alert">{error}</p>;
  if (!url) return <p role="status">Loading PDF preview…</p>;
  return <><a href={url} target="_blank" rel="noreferrer">Open full PDF preview</a><iframe title="Generated report PDF preview" src={url} style={{ width: '100%', height: '75vh', border: '1px solid #d1d5db' }} /></>;
}
