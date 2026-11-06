import React, { useEffect, useState } from 'react';
import useStickyState from '../../../utils/useStickyState';
import { RefreshCw } from 'lucide-react';
import { getUSGTemplates } from '../../../services/usgService';
import { PageHeader, Button, Modal, CopyButton } from '../../../components/common';
import ReportTable from '../../../components/business/ReportTable';
import '../../../components/business/business.css';
import './usgTemplatesV2.css';

// USG templates (new look): the ready-made findings text used when writing
// a USG report. Click one to read it in full and copy it.
export default function UsgTemplatesV2() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useStickyState('search', '');
  const [open, setOpen] = useStickyState('open', null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    getUSGTemplates()
      .then((res) => { if (!cancelled) setTemplates(res?.success && Array.isArray(res.data) ? res.data : []); if (!cancelled && !res?.success) setError(res?.message || 'Could not load the templates.'); })
      .catch(() => { if (!cancelled) { setTemplates([]); setError('Could not load the templates. Try again.'); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reload]);

  const q = search.trim().toLowerCase();
  const rows = templates.filter((t) => !q || `${t.name} ${t.findings || ''}`.toLowerCase().includes(q));

  return (
    <div className="biz-page">
      <PageHeader
        title="USG templates"
        subtitle="Ready-made findings you can start from when writing a USG report. Click one to read it in full."
        action={<Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={() => setReload((n) => n + 1)}>Refresh</Button>}
      />
      <div className="form-group" style={{ margin: 0 }} hidden>
        <input type="search" data-page-search="" aria-label="Search templates" placeholder="Template name or text" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {error && <div className="biz-error" role="alert">{error}<Button variant="secondary" size="sm" onClick={() => setReload((n) => n + 1)}>Try again</Button></div>}
      <ReportTable loading={loading} rows={rows} rowKey={(t, i) => t._id || i} onRowClick={setOpen}
        empty={q ? 'No template matches your search.' : 'No templates yet.'}
        columns={[
          { key: 'name', label: 'Template', className: 'usgt-name', render: (t) => <span className="strong">{t.name}</span> },
          { key: 'findings', label: 'Starts with', render: (t) => <span className="usgt-preview">{String(t.findings || '').trim() || '-'}</span> },
          { key: 'open', label: '', align: 'right', render: () => <span className="usgt-open">Read</span> },
        ]} />
      <Modal isOpen={!!open} onClose={() => setOpen(null)} variant="drawer" size="lg" title={open?.name || 'Template'}
        footer={open ? <><CopyButton value={open.findings || ''} label="template text" /><Button variant="secondary" onClick={() => setOpen(null)}>Close</Button></> : null}>
        {open && <pre className="usgt-full">{open.findings}</pre>}
      </Modal>
    </div>
  );
}
