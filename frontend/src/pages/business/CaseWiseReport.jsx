import React, { useState, useEffect } from 'react';
import { getBills } from '../../services/billService';
import formatCurrency from '../../utils/formatCurrency';
import formatDate from '../../utils/formatDate';
import usePagination from '../../hooks/usePagination';
import useDebounce from '../../hooks/useDebounce';
import { PageHeader, DataTable, StatusBadge, Button, AdvancedFilterBar } from '../../components/common';
import { Printer, Mail, FileDown } from 'lucide-react';
import { useUiVersion } from '../../utils/uiVersion';
import printReport, { fetchAllPages } from '../../utils/printReport';
import { caseTypeLabel, money, dayLabel, periodLabel, sum, downloadCsv } from '../../utils/reportFormat';
import { notify } from '../../components/common/Toast/toast';

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

  const isV2 = useUiVersion() === 'v2';
  // Print and download use every bill for the filters, not just this page.
  const fetchAllBills = () => fetchAllPages(async (p, size) => {
    const res = await getBills({
      search: debouncedSearch || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      caseType: selectedTypes.length ? selectedTypes.join(',') : undefined,
      collectionCentre: centre || undefined,
      excludeCancelled: excludeCancelled ? 'true' : undefined,
      page: p, limit: size
    });
    return { items: res?.data?.bills || [], pages: res?.data?.pagination?.pages || 1 };
  });
  const statusOf = (b) => (b.isVoided || b.cancelled ? 'Cancelled' : b.paymentStatus || '');
  const [busy, setBusy] = useState('');

  const exportCsv = async () => {
    setBusy('csv');
    try {
      const all = await fetchAllBills();
      downloadCsv(`case-wise-${startDate || 'all'}-${endDate || 'dates'}.csv`,
        ['Bill no', 'Reg no', 'Patient', 'Type', 'Centre', 'Referred by', 'Date', 'Amount', 'Received', 'Still to collect', 'Status'],
        all.map((b) => [b.billNumber, b.patient?.registrationNumber || '', b.patient?.name || '', caseTypeLabel(b.caseType), b.collectionCentre || 'Main', b.referringDoctor?.name || 'Self', dayLabel(b.date), b.totalAmount, b.paidAmount, b.dueAmount, statusOf(b)]));
    } catch { notify('Could not download the report. Try again.'); } finally { setBusy(''); }
  };

  const printCases = async () => {
    setBusy('print');
    try {
      const all = await fetchAllBills();
      const live = all.filter((b) => !(b.isVoided || b.cancelled));
      await printReport({
        title: 'Case-wise report',
        period: periodLabel(startDate, endDate),
        filters: [selectedTypes.length ? selectedTypes.map(caseTypeLabel).join(', ') : 'All case types', centre && `Centre: ${centre}`, excludeCancelled ? 'Cancelled bills left out' : 'Cancelled bills included', debouncedSearch && `Search: ${debouncedSearch}`],
        summary: [
          { label: 'Bills', value: String(live.length) },
          { label: 'Billed', value: money(sum(live, (b) => b.totalAmount)) },
          { label: 'Received', value: money(sum(live, (b) => b.paidAmount)) },
          { label: 'Still to collect', value: money(sum(live, (b) => b.dueAmount)) },
        ],
        sections: [{
          columns: [{ label: 'Bill no' }, { label: 'Patient' }, { label: 'Type' }, { label: 'Referred by' }, { label: 'Date' }, { label: 'Amount', align: 'right' }, { label: 'Received', align: 'right' }, { label: 'Status' }],
          rows: all.map((b) => [b.billNumber, [b.patient?.name || 'Walk-in', b.patient?.registrationNumber].filter(Boolean).join(' · '), caseTypeLabel(b.caseType), b.referringDoctor?.name || 'Self', dayLabel(b.date), money(b.totalAmount), money(b.paidAmount), statusOf(b)]),
          totals: ['Total', `${live.length} bills`, '', '', '', money(sum(live, (b) => b.totalAmount)), money(sum(live, (b) => b.paidAmount)), ''],
          empty: 'No bills for these filters.',
        }],
      });
    } catch { notify('Could not prepare the print. Try again.'); } finally { setBusy(''); }
  };

  return (
    <div>
      <PageHeader
        title="Case Wise Business Report"
        subtitle="Filter by 13 case types, collection centre, exclude cancelled — Labsmart parity"
        action={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="secondary" size="sm" onClick={printCases} loading={busy === 'print'} icon={<Printer size={14} />}>Print</Button>
            {!isV2 && <Button variant="secondary" size="sm" onClick={() => { window.location.href = `mailto:?subject=Case-wise report&body=${encodeURIComponent(`Case-wise ${startDate} to ${endDate}: ${paginationInfo.total} cases`)}`; }} icon={<Mail size={14} />}>Email</Button>}
            <Button variant="secondary" size="sm" onClick={exportCsv} loading={busy === 'csv'} icon={<FileDown size={14} />}>{isV2 ? 'Download (CSV)' : 'Export'}</Button>
          </div>
        }
      />

      <AdvancedFilterBar
        showSearchButton={false}
        showClearButton={!!(startDate || endDate || centre || selectedTypes.length || !excludeCancelled)}
        onClear={() => {
          setStartDate('');
          setEndDate('');
          setCentre('');
          setSelectedTypes([]);
          setExcludeCancelled(true);
          goToPage(1);
        }}
        values={{ from: startDate, to: endDate, centre, excludeCancelled }}
        onChange={(key, value) => {
          goToPage(1);
          if (key === 'from') setStartDate(value);
          else if (key === 'to') setEndDate(value);
          else if (key === 'centre') setCentre(value);
          else if (key === 'excludeCancelled') setExcludeCancelled(value);
        }}
        fields={[
          { key: 'from', label: 'From Date', type: 'date' },
          { key: 'to', label: 'To Date', type: 'date' },
          {
            key: 'centre',
            label: 'Collection centre',
            type: 'select',
            size: 'sm',
            placeholder: 'All centres',
            options: [{ value: 'Main', label: 'Main' }]
          },
          { key: 'excludeCancelled', label: 'Exclude cancelled cases', type: 'toggle' },
          {
            key: 'caseTypes',
            type: 'custom',
            size: 'auto',
            render: () => (
              <div>
                <div className="form-label"><span>Case types ({selectedTypes.length}/13)</span></div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', maxWidth: '48rem' }}>
                  {CASE_TYPES_13.map((t) => (
                    <label
                      key={t}
                      style={{
                        fontSize: '0.78rem',
                        display: 'flex',
                        gap: '4px',
                        alignItems: 'center',
                        border: '1px solid var(--color-border)',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        background: selectedTypes.includes(t) ? 'var(--color-primary-light)' : 'transparent',
                        cursor: 'pointer'
                      }}
                    >
                      <input type="checkbox" checked={selectedTypes.includes(t)} onChange={() => { toggleType(t); goToPage(1); }} />
                      {isV2 ? caseTypeLabel(t) : t}
                    </label>
                  ))}
                </div>
              </div>
            )
          }
        ]}
      />

      <DataTable
        headers={isV2 ? ['Bill no', 'Patient', 'Type', 'Referred by', 'Date', 'Amount', 'Status'] : ['Invoice Ref', 'Patient Reg Code', 'Patient Name', 'Type', 'Centre', 'Referred By', 'Registered Date', 'Gross Price', 'Status']}
        data={bills}
        loading={loading}
        emptyMessage="No diagnostic cases found for the selected filters."
        searchValue={search}
        onSearchChange={(e) => { setSearch(e.target.value); goToPage(1); }}
        searchPlaceholder="Search by invoice number..."
        pagination={{ total: paginationInfo.total, page, limit, pages: paginationInfo.pages, onPageChange: goToPage, onLimitChange: setLimit }}
        renderRow={(bill) => isV2 ? (
          <tr key={bill._id}>
            <td style={{ fontWeight: 600 }}>{bill.billNumber}</td>
            <td><div style={{ fontWeight: 500 }}>{bill.patient?.name || 'Walk-in'}</div><div style={{ color: '#71717a', fontSize: '0.8rem' }}>{bill.patient?.registrationNumber}</div></td>
            <td>{caseTypeLabel(bill.caseType)}</td>
            <td>{bill.referringDoctor?.name || 'Self'}</td>
            <td style={{ whiteSpace: 'nowrap' }}>{dayLabel(bill.date)}</td>
            <td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{money(bill.totalAmount)}</td>
            <td><StatusBadge status={statusOf(bill)} /></td>
          </tr>
        ) : (
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
