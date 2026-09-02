import React, { useState, useEffect } from 'react';
import { getUSGTemplates } from '../../services/usgService';
import { PageHeader, DataTable } from '../../components/common';

const ReportTemplates = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchTemplates = async () => {
      setLoading(true);
      try {
        const res = await getUSGTemplates();
        if (res.success) {
          setTemplates(res.data);
        }
      } catch (err) {
        console.error('Failed to load templates list', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTemplates();
  }, []);

  return (
    <div>
      <PageHeader
        title="USG Clinical Report Templates"
        subtitle="Manage default findings templates for abdominal scan profiles and Obstetric checks"
      />

      <DataTable
        headers={['Template Name', 'Default Findings Text']}
        data={templates}
        loading={loading}
        emptyMessage="No clinical templates defined."
        renderRow={(t, idx) => (
          <tr key={idx}>
            <td style={{ fontWeight: '600', verticalAlign: 'top', width: '220px' }}>{t.name}</td>
            <td>
              <pre style={{ fontFamily: 'inherit', fontSize: '0.825rem', whiteSpace: 'pre-wrap', color: 'var(--text-muted)' }}>
                {t.findings}
              </pre>
            </td>
          </tr>
        )}
      />
    </div>
  );
};

export default ReportTemplates;
