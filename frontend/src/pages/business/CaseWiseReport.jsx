import React, { useState, useEffect } from 'react';
import { getBills } from '../../services/billService';
import formatCurrency from '../../utils/formatCurrency';
import formatDate from '../../utils/formatDate';
import usePagination from '../../hooks/usePagination';
import useDebounce from '../../hooks/useDebounce';
import { PageHeader, DataTable, DatePicker, StatusBadge, Button } from '../../components/common';
import { Printer, Mail, FileDown } from 'lucide-react';

export const CASE_TYPES_13 = ['LabCase','UsgCase','DigitalXrayCase','XrayCase','OutsourceLabCase','EcgCase','CtScanCase','MriCase','EpsCase','OpgCase','CardiologyCase','EegCase','MammographyCase'];

const CaseWiseReport = () => {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [centre, setCentre] = useState('');
  const [excludeCancelled, setExcludeCancelled] = useState(true);
  const { page, limit, goToPage, setLimit } = usePagination(1, 10);
  const [paginationInfo, setPaginationInfo] = useState({ total: 0, pages: 0 });

  const toggleType = (t) => setSelectedTypes((p) => p.includes(t) ? p.filter((x) => x !== t) : [...p, t]);

  const fetchCasesReport = async () => {
    setLoading(true);
    try {
      const res = await getBills({
        search: debouncedSearch || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        caseType: selectedTypes.length ? selectedTypes.join(',') : undefined,
        collectionCentre: centre || undefined,
        excludeCancelled: excludeCancelled ? 'true' : undefined,
        page, limit
      });
      if (res.success) {
        setBills(res.data.bills);
        setPaginationInfo(res.data.pagination);
      }
    } catch (err) {
      console.error('Failed to load case wise reports', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCasesReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, startDate, endDate, page, limit, selectedTypes.join(','), centre, excludeCancelled]);

  const exportCsv = () => {
    const rows = [['Invoice','RegCode','Patient','Type','Centre','ReferredBy','Date','Gross','Status']];
    bills.forEach((b) => rows.push([b.billNumber, b.patient?.registrationNumber || '', b.patient?.name || '', b.caseType || '', b.collectionCentre || '', b.referringDoctor?.name || 'Self', b.date || '', b.totalAmount, b.paymentStatus]));
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `case-wise-${Date.now()}.csv`;
    a.click();
  };

  return (
    <div>
      <PageHeader
        title="Case Wise Business Report"
        subtitle="Filter by 13 case types, collection centre, exclude cancelled — Labsmart parity"
        action={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="secondary" size="sm" onClick={() => window.print()} icon={<Printer size={14} />}>Print</Button>
            <Button variant="secondary" size="sm" onClick={() => { window.location.href = `mailto:?subject=Case-wise report&body=${encodeURIComponent(`Case-wise ${startDate} to ${endDate}: ${paginationInfo.total} cases`)}`; }} icon={<Mail size={14} />}>Email</Button>
            <Button variant="secondary" size="sm" onClick={exportCsv} icon={<FileDown size={14} />}>Export</Button>
          </div>
        }
      />

      <div className="card" style={{ display: 'flex', gap: '16px', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <DatePicker label="From Date" value={startDate} onChange={(e) => { setStartDate(e.target.value); goToPage(1); }} style={{ marginBottom: 0, minWidth: '180px' }} />
        <DatePicker label="To Date" value={endDate} onChange={(e) => { setEndDate(e.target.value); goToPage(1); }} style={{ marginBottom: 0, minWidth: '180px' }} />
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label"><span>Collection centre</span></label>
          <select className="select-control" value={centre} onChange={(e) => { setCentre(e.target.value); goToPage(1); }}>
            <option value="">All centres</option>
            <option value="Main">Main</option>
          </select>
        </div>
        <label style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '0.85rem', fontWeight: 600 }}>
          <input type="checkbox" checked={excludeCancelled} onChange={(e) => setExcludeCancelled(e.target.checked)} />
          Exclude cancelled cases
        </label>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '8px' }}>Case types ({selectedTypes.length}/13 selected)</div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {CASE_TYPES_13.map((t) => (
            <label key={t} style={{ fontSize: '0.78rem', display: 'flex', gap: '4px', alignItems: 'center', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '4px 8px', background: selectedTypes.includes(t) ? 'var(--primary-light)' : 'transparent' }}>
              <input type="checkbox" checked={selectedTypes.includes(t)} onChange={() => { toggleType(t); goToPage(1); }} />
              {t}
            </label>
          ))}
          {selectedTypes.length > 0 && <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => { setSelectedTypes([]); goToPage(1); }}>Clear types</button>}
        </div>
      </div>

      <DataTable
        headers={['Invoice Ref', 'Patient Reg Code', 'Patient Name', 'Type', 'Centre', 'Referred By', 'Registered Date', 'Gross Price', 'Status']}
        data={bills}
        loading={loading}
        emptyMessage="No diagnostic cases found for the selected filters."
        searchValue={search}
        onSearchChange={(e) => { setSearch(e.target.value); goToPage(1); }}
        searchPlaceholder="Search by invoice number..."
        pagination={{ total: paginationInfo.total, page, limit, pages: paginationInfo.pages, onPageChange: goToPage, onLimitChange: setLimit }}
        renderRow={(bill) => (
          <tr key={bill._id}>
            <td style={{ fontWeight: '600' }}>{bill.billNumber}</td>
            <td style={{ fontWeight: '600', color: 'var(--primary-color)' }}>{bill.patient?.registrationNumber}</td>
            <td>{bill.patient?.name || 'Walk-in Patient'}</td>
            <td><span style={{ fontSize: '0.75rem', background: 'var(--bg-main)', padding: '2px 6px', borderRadius: '4px' }}>{bill.caseType || 'LabCase'}</span></td>
            <td>{bill.collectionCentre || 'Main'}</td>
            <td>{bill.referringDoctor?.name || 'Self'}</td>
            <td>{formatDate(bill.date).split(',')[0]}</td>
            <td style={{ fontWeight: '600' }}>{formatCurrency(bill.totalAmount)}</td>
            <td><StatusBadge status={bill.isVoided || bill.cancelled ? 'Cancelled' : bill.paymentStatus} /></td>
          </tr>
        )}
      />
    </div>
  );
};

export default CaseWiseReport;
