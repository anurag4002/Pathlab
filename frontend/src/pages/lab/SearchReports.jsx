import React, { useState, useEffect } from 'react';
import { getReports } from '../../services/reportService';
import { downloadReportPdf, fetchReportQr } from '../../services/publicService';
import downloadFile from '../../utils/downloadFile';
import formatDate from '../../utils/formatDate';
import useDebounce from '../../hooks/useDebounce';
import { Download, FileDown, QrCode } from 'lucide-react';
import { DataTable, PageHeader } from '../../components/common';

const SearchReports = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await getReports({
        registrationNumber: debouncedSearch
      });
      if (res.success) {
        setReports(res.data.reports);
      }
    } catch (err) {
      console.error('Failed to query report records', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [debouncedSearch]);

  const handleQr = async (report) => {
    try {
      const res = await fetchReportQr(report._id);
      if (res.success) window.open(res.data.verifyUrl, '_blank', 'noopener');
    } catch {
      alert('Failed to load report QR');
    }
  };

  return (
    <div>
      <PageHeader
        title="Search Completed Reports"
        subtitle="Look up patient reports by registration code, name, or phone number"
      />

      <DataTable
        headers={['Registration No', 'Patient Name', 'Invoice', 'Test', 'Completed Date', 'Actions']}
        data={reports}
        loading={loading}
        emptyMessage="No laboratory reports matched your search filters."
        searchValue={search}
        onSearchChange={(e) => setSearch(e.target.value)}
        searchPlaceholder="Type a patient registration number..."
        renderRow={(report) => (
          <tr key={report._id}>
            <td style={{ fontWeight: '600', color: 'var(--primary-color)' }}>{report.registrationNumber}</td>
            <td style={{ fontWeight: '600' }}>{report.patient?.name || 'Walk-in Patient'}</td>
            <td>{report.bill?.billNumber || 'N/A'}</td>
            <td>{report.test ? `${report.test.name} (${report.test.code})` : 'General Findings'}</td>
            <td>{formatDate(report.reportDate)}</td>
            <td>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  onClick={() => downloadReportPdf(report._id, true)}
                >
                  <FileDown size={14} /> PDF
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  onClick={() => handleQr(report)}
                >
                  <QrCode size={14} /> QR
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  onClick={() => downloadFile(`/${report.fileUrl}`, `report_${report.registrationNumber}.pdf`)}
                >
                  <Download size={14} /> Download
                </button>
              </div>
            </td>
          </tr>
        )}
      />
    </div>
  );
};

export default SearchReports;
