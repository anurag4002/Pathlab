import React, { useEffect, useState } from 'react';
import apiClient from '../../services/apiClient';

export default function ServerPdfPreview({ path }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true, objectUrl;
    setUrl(''); setError('');
    apiClient.get(path, { responseType: 'blob' }).then(response => {
      if (!active) return;
      objectUrl = URL.createObjectURL(response.data); setUrl(objectUrl);
    }).catch(error => { if (active) setError(error.response?.data?.message || 'Could not load the PDF preview. Close and reopen to retry.'); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [path]);
  if (error) return <p role="alert">{error}</p>;
  if (!url) return <p role="status">Loading PDF preview…</p>;
  return <><a href={url} target="_blank" rel="noreferrer">Open full PDF preview</a><iframe title="Generated report PDF preview" src={url} style={{ width: '100%', height: '75vh', border: '1px solid #d1d5db' }} /></>;
}
