import React, { useState, useEffect } from 'react';
import { getXrayCases } from '../../services/xrayService';
import formatDate from '../../utils/formatDate';
import downloadFile from '../../utils/downloadFile';
import { Download } from 'lucide-react';
import { DataTable, PageHeader } from '../../components/common';

const XrayReports = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
      try {
        const res = await getXrayCases({ status: 'Completed' });
        if (res.success) {
          // filter cases that actually have files uploaded
          setReports(res.data.filter(c => c.fileUrl));
        }
      } catch (err) {
        console.error('Failed to load X-ray reports', err);
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, []);

  return (
    <div>
      <PageHeader
        title="Completed X-Ray Reports Archive"
        subtitle="Access and download scanned digital radiographs and signed clinical reports"
      />

      <DataTable
        headers={['Completed Date', 'Registration No', 'Patient Name', 'Referring Doctor', 'Download Scan File']}
        data={reports}
        loading={loading}
        emptyMessage="No completed X-Ray scans archived yet."
        renderRow={(c) => (
          <tr key={c._id}>
            <td>{formatDate(c.date).split(',')[0]}</td>
            <td style={{ fontWeight: '600' }}>{c.patient?.registrationNumber}</td>
            <td style={{ fontWeight: '600' }}>{c.patient?.name}</td>
            <td>{c.referringDoctor?.name || 'Self'}</td>
            <td>
              <button
                className="btn btn-primary"
                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                onClick={() => downloadFile(`/${c.fileUrl}`, `xray_scan_${c.patient?.registrationNumber}.jpg`)}
              >
                <Download size={14} /> Download Scan
              </button>
            </td>
          </tr>
        )}
      />
    </div>
  );
};

export default XrayReports;
