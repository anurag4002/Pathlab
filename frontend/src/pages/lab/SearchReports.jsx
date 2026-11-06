import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getReports } from '../../services/reportService';
import { getTests } from '../../services/testService';
import { getDoctors } from '../../services/doctorService';
import { downloadReportPdf } from '../../services/publicService';
import { WhatsAppShare, IdentityCell, RowMenu, StatusBadge } from '../../components/common';
import { useUiVersion } from '../../utils/uiVersion';
import './labV2.css';

import downloadFile from '../../utils/downloadFile';
import formatDate from '../../utils/formatDate';
import useDebounce from '../../hooks/useDebounce';
import usePagination from '../../hooks/usePagination';
import { Download, FileDown } from 'lucide-react';
import ReportPrintActions from '../../components/lab/ReportPrintActions';
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

const cleanParam = (v) => {
  if (v == null) return '';
  const s = String(v).trim();
  return s === 'undefined' || s === 'null' ? '' : s;
};

const SearchReports = () => {
  const isV2 = useUiVersion() === 'v2';
  const [searchParams, setSearchParams] = useSearchParams();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState(cleanParam(searchParams.get('search')));
  const debouncedSearch = useDebounce(search, 500);
  const { page, limit, goToPage, setLimit } = usePagination(1, 20);
  const [paginationInfo, setPaginationInfo] = useState({ total: 0, pages: 0 });
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
        page,
        limit,
      };
      const res = await getReports(params);
      if (res.success) {
        setReports(res.data.reports);
        setPaginationInfo(res.data.pagination || { total: 0, pages: 0 });
      }
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
  }, [debouncedSearch, adv.status, adv.test, adv.duration, adv.from, adv.to, adv.referredBy, adv.cc, page, limit]);

  return (
    <div>
      <PageHeader
        title="Search Lab Reports"
        subtitle={isV2 ? 'Find any report by patient, reg no, test, doctor or date - then print or send it.' : 'Advanced URL-based filtering: duration, patient, status, referrer, reg.no, daily case no, UHID, test'}
      />

      <AdvancedFilterBar
        values={adv}
        onChange={(k, v) => { setAdvKey(k, v); goToPage(1); }}
        onSearch={() => { goToPage(1); fetchReports(); }}
        onClear={() => { setAdv({ duration: '', firstName: '', status: '', referredBy: '', regNo: '', dailyCaseNo: '', uhid: '', cc: '', test: '', from: '', to: '' }); setSearch(''); goToPage(1); }}
        collapseAfter={6}
        fields={[
          { key: 'duration', label: 'Duration', type: 'select', options: DURATION_OPTIONS },
          { key: 'firstName', label: 'Patient first name', type: 'text', placeholder: 'First name' },
          { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS },
          { key: 'referredBy', label: 'Referred by', type: 'select', options: doctors.map((d) => ({ value: d._id, label: d.name })) },
          { key: 'regNo', label: isV2 ? 'Reg no' : 'Reg.no.', type: 'text', placeholder: isV2 ? 'Reg no' : 'Reg.no.' },
          { key: 'dailyCaseNo', label: isV2 ? 'Daily case no' : 'Daily case no.', type: 'text', placeholder: isV2 ? 'Daily case no' : 'DCN' },
          { key: 'uhid', label: 'UHID', type: 'text', placeholder: 'UHID' },
          { key: 'cc', label: 'Collection centre', type: 'select', options: [{ value: 'Main', label: 'Main' }] },
          { key: 'test', label: isV2 ? 'Test' : 'Select test', type: 'select', size: 'lg', options: (Array.isArray(tests) ? tests : tests?.tests || []).map((t) => ({ value: t._id, label: `${t.name} (${t.code})` })) },
          { key: 'from', label: 'From', type: 'date' },
          { key: 'to', label: 'To', type: 'date' },
        ]}
      />

      <DataTable
        headers={isV2 ? ['Patient', 'Tests', 'Referred by', 'Date', 'Status', ''] : ['Reg.no.', 'Date/Time', 'Patient', 'Referred By', 'Tests', 'CC', 'Status', 'Actions']}
        data={reports}
        loading={loading}
        emptyMessage="No laboratory reports matched your search filters."
        searchValue={search}
        onSearchChange={(e) => {
          setSearch(e.target.value);
          goToPage(1);
        }}
        searchPlaceholder={isV2 ? 'Patient name, phone or reg no' : 'Type registration no / name / phone (e.g. PPL-2026)...'}
        stickyActions
        pagination={{
          total: paginationInfo.total,
          page,
          limit,
          pages: paginationInfo.pages,
          onPageChange: goToPage,
          onLimitChange: setLimit,
        }}
        renderRow={(report) => isV2 ? (() => {
          // Report screen: age · sex stay next to the name.
          const p = report.patient || {};
          const reported = ['Reported', 'Signed', 'Verified', 'Completed'].includes(report.status);
          const billed = (report.bill?.items || []).filter((item) => item && !item.reportDepartment).map((item) => String(item.name || '').replace(/ \(bundle\)$/, ''));
          const names = report.test ? [report.test.name] : [...new Set(billed)];
          const menu = [
            { label: 'Download PDF', onClick: () => downloadReportPdf(report._id) },
            report.fileUrl && { label: 'Download uploaded file', onClick: () => downloadFile(`/${report.fileUrl}`, `report_${report.registrationNumber}.pdf`) },
          ].filter(Boolean);
          return (
            <tr key={report._id}>
              <td>
                <IdentityCell
                  name={[p.title, p.name].filter(Boolean).join(' ') || 'Walk-in patient'}
                  clinical={{ age: p.age, ageUnit: p.ageUnit, gender: p.gender }}
                  meta={[report.registrationNumber && `Reg ${report.registrationNumber}`, report.bill?.billNumber && `Bill ${report.bill.billNumber}`]}
                />
              </td>
              <td style={{ maxWidth: 260 }}>
                {names.length
                  ? <span title={names.join(', ')}>{names[0]}{names.length > 1 && <span className="cell-sub" style={{ display: 'inline', marginLeft: 6 }}>+{names.length - 1} more</span>}</span>
                  : report.results?.length ? `${report.results.length} values` : <span className="cell-empty">General findings</span>}
              </td>
              <td>{report.bill?.referringDoctor?.name || report.referredBy || 'Self'}</td>
              <td style={{ whiteSpace: 'nowrap' }} title={formatDate(report.reportDate || report.createdAt)}>{formatDate(report.reportDate || report.createdAt).split(',')[0]}</td>
              <td><StatusBadge status={report.status} /></td>
              <td>
                <div className="row-actions-v2">
                  <ReportPrintActions reportId={report._id} />
                  {reported && <WhatsAppShare kind="report" id={report._id} phone={p.phone} name={p.name} iconOnly />}
                  <RowMenu label={`More actions for report ${report.registrationNumber}`} items={menu} />
                </div>
              </td>
            </tr>
          );
        })() : (
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
                <ReportPrintActions reportId={report._id} />
                {['Reported', 'Signed', 'Verified', 'Completed'].includes(report.status) && (
                  <WhatsAppShare kind="report" id={report._id} phone={report.patient?.phone} name={report.patient?.name} iconOnly />
                )}
                <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => downloadReportPdf(report._id)}>
                  <FileDown size={14} /> PDF
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
