import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getReports } from '../../services/reportService';
import { getTests } from '../../services/testService';
import { getDoctors } from '../../services/doctorService';
import { downloadReportPdf, fetchReportQr } from '../../services/publicService';
import downloadFile from '../../utils/downloadFile';
import formatDate from '../../utils/formatDate';
import useDebounce from '../../hooks/useDebounce';
import { Download, FileDown, QrCode, Printer } from 'lucide-react';
import { DataTable, PageHeader, AdvancedFilterBar, DURATION_OPTIONS } from '../../components/common';

const STATUS_OPTIONS = [
  { value: 'Registered', label: 'New / Registered' },
  { value: 'Collected', label: 'Collected' },
  { value: 'Received', label: 'In progress / Received' },
  { value: 'Reported', label: 'Final / Reported' },
  { value: 'Signed', label: 'Signed off' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Pending', label: 'Pending' },
];

const SearchReports = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const debouncedSearch = useDebounce(search, 500);
  const [tests, setTests] = useState([]);
  const [doctors, setDoctors] = useState([]);

  const [adv, setAdv] = useState({
    duration: searchParams.get('duration') || 'Past 7 days',
    firstName: searchParams.get('firstName') || '',
    status: searchParams.get('status') || '',
    referredBy: searchParams.get('referredBy') || '',
    regNo: searchParams.get('regNo') || '',
    dailyCaseNo: searchParams.get('dailyCaseNo') || '',
    uhid: searchParams.get('uhid') || '',
    cc: searchParams.get('cc') || '',
    test: searchParams.get('test') || '',
    from: searchParams.get('from') || '',
    to: searchParams.get('to') || '',
  });
  const setAdvKey = (k, v) => setAdv((p) => ({ ...p, [k]: v }));

  const fetchReports = async () => {
    setLoading(true);
    try {
      const params = {
        search: debouncedSearch || undefined,
        registrationNumber: adv.regNo || undefined,
        status: adv.status || undefined,
        uhid: adv.uhid || undefined,
        dailyCaseNo: adv.dailyCaseNo || undefined,
        cc: adv.cc || undefined,
        test: adv.test || undefined,
        firstName: adv.firstName || undefined,
        referredBy: adv.referredBy || undefined,
        duration: adv.from || adv.to ? undefined : (adv.duration || undefined),
        from: adv.from || undefined,
        to: adv.to || undefined,
        limit: 50,
      };
      const res = await getReports(params);
      if (res.success) setReports(res.data.reports);
    } catch (err) {
      console.error('Failed to query report records', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getTests({ limit: 200 }).then((r) => { if (r.success) setTests(r.data || r.data?.tests || []); }).catch(() => {});
    getDoctors({ status: 'Active' }).then((r) => { if (r.success) setDoctors(Array.isArray(r.data) ? r.data : []); }).catch(() => {});
  }, []);

  useEffect(() => {
    fetchReports();
    // sync shareable URLs (?status&regNo&uhid&test&from&to)
    const qp = {};
    Object.entries({ ...adv, search: debouncedSearch }).forEach(([k, v]) => { if (v) qp[k] = v; });
    setSearchParams(qp, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, adv.status, adv.test, adv.duration, adv.from, adv.to, adv.referredBy, adv.cc]);

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
        title="Search Lab Reports"
        subtitle="Advanced URL-based filtering: duration, patient, status, referrer, reg.no, daily case no, UHID, test"
        action={
          <button className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.825rem' }} onClick={() => window.print()}>
            <Printer size={16} /> Print
          </button>
        }
      />

      <AdvancedFilterBar
        values={adv}
        onChange={setAdvKey}
        onSearch={fetchReports}
        onClear={() => { setAdv({ duration: '', firstName: '', status: '', referredBy: '', regNo: '', dailyCaseNo: '', uhid: '', cc: '', test: '', from: '', to: '' }); setSearch(''); }}
        fields={[
          { key: 'duration', label: 'Duration', type: 'select', options: DURATION_OPTIONS },
          { key: 'firstName', label: 'Patient first name', type: 'text', placeholder: 'First name' },
          { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS },
          { key: 'referredBy', label: 'Referred by', type: 'select', options: doctors.map((d) => ({ value: d._id, label: d.name })) },
          { key: 'regNo', label: 'Reg.no.', type: 'text', placeholder: 'Reg.no.' },
          { key: 'dailyCaseNo', label: 'Daily case no.', type: 'text', placeholder: 'DCN' },
          { key: 'uhid', label: 'UHID', type: 'text', placeholder: 'UHID' },
          { key: 'cc', label: 'Collection centre', type: 'select', options: [{ value: 'Main', label: 'Main' }] },
          { key: 'test', label: 'Select test', type: 'select', options: (Array.isArray(tests) ? tests : tests?.tests || []).map((t) => ({ value: t._id, label: `${t.name} (${t.code})` })) },
          { key: 'from', label: 'From', type: 'date' },
          { key: 'to', label: 'To', type: 'date' },
        ]}
      />

      <DataTable
        headers={['Reg.no.', 'Date/Time', 'Patient', 'Referred By', 'Tests', 'CC', 'Status', 'Actions']}
        data={reports}
        loading={loading}
        emptyMessage="No laboratory reports matched your search filters."
        searchValue={search}
        onSearchChange={(e) => setSearch(e.target.value)}
        searchPlaceholder="Type registration no / name / phone (e.g. PPL-2026)..."
        renderRow={(report) => (
          <tr key={report._id}>
            <td style={{ fontWeight: '600', color: 'var(--primary-color)' }}>{report.registrationNumber}</td>
            <td>{formatDate(report.reportDate || report.createdAt)}</td>
            <td style={{ fontWeight: '600' }}>{report.patient?.name || 'Walk-in Patient'}</td>
            <td>{report.bill?.referringDoctor?.name || report.referredBy || 'Self'}</td>
            <td>{report.test ? `${report.test.name} (${report.test.code})` : (report.results?.length ? `${report.results.length} params` : 'General Findings')}</td>
            <td>{report.cc || 'Main'}</td>
            <td>{report.status}</td>
            <td>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => downloadReportPdf(report._id, true)}>
                  <FileDown size={14} /> PDF
                </button>
                <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => handleQr(report)}>
                  <QrCode size={14} /> QR
                </button>
                {report.fileUrl && (
                  <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => downloadFile(`/${report.fileUrl}`, `report_${report.registrationNumber}.pdf`)}>
                    <Download size={14} /> Download
                  </button>
                )}
              </div>
            </td>
          </tr>
        )}
      />
    </div>
  );
};

export default SearchReports;
