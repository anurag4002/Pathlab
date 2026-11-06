import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, RotateCcw, Star } from 'lucide-react';
import { PageHeader, DataTable, Button, Input, WhatsAppShare, IdentityCell, RowMenu } from '../../components/common';
import { useUiVersion } from '../../utils/uiVersion';
import { getBills, updateReviewRequest } from '../../services/billService';
import { getLabProfile } from '../../services/setupService';
import formatDate from '../../utils/formatDate';
import useDebounce from '../../hooks/useDebounce';
import './GoogleReviews.css';

const TABS = [
  { value: 'pending', label: 'Not asked' },
  { value: 'asked', label: 'Asked' },
  { value: '', label: 'All' }
];

// One row per bill (visit): ask the patient for a Google review on WhatsApp
// and keep track of who has already been asked.
const GoogleReviews = () => {
  const isV2 = useUiVersion() === 'v2';
  const [status, setStatus] = useState('pending');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 350);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviewLink, setReviewLink] = useState(null);
  const [saving, setSaving] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    getLabProfile().then((response) => setReviewLink((response?.data || response || {}).googleReviewLink || '')).catch(() => setReviewLink(''));
  }, []);

  useEffect(() => {
    let active = true;
    getBills({ reviewStatus: status || undefined, search: debouncedSearch || undefined, page, limit: 20 })
      .then((response) => {
        if (!active) return;
        const data = response?.data || {};
        setRows(Array.isArray(data) ? data : data.bills || []);
        setPagination(data.pagination || null);
        setError('');
      })
      .catch((err) => { if (active) setError(err.response?.data?.message || 'Could not load patients.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [status, debouncedSearch, page, reloadKey]);

  const mark = async (bill, asked, channel = 'manual') => {
    setSaving(bill._id);
    try {
      const response = await updateReviewRequest(bill._id, { asked, channel });
      const reviewRequest = response?.data?.reviewRequest;
      // Rows that no longer match the tab drop out on the next refresh; update in place now.
      setRows((prev) => prev.map((row) => (row._id === bill._id ? { ...row, reviewRequest } : row)));
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update the review status.');
    } finally { setSaving(''); }
  };

  const changeTab = (value) => { setStatus(value); setPage(1); setLoading(true); };

  const renderRow = (bill) => {
    const asked = !!bill.reviewRequest?.askedAt;
    const patient = bill.patient || {};
    if (isV2) {
      const name = [patient.title, patient.name].filter(Boolean).join(' ');
      return (
        <tr key={bill._id}>
          <td>
            <IdentityCell name={name || 'Walk-in patient'} meta={[`Bill ${bill.billNumber}`, formatDate(bill.date || bill.createdAt).split(',')[0]]}
              copy={patient.phone ? { value: patient.phone, label: 'phone' } : undefined} />
          </td>
          <td>
            {asked ? (
              <span className="gr-status gr-status-asked">
                <CheckCircle2 size={14} /> Asked {formatDate(bill.reviewRequest.askedAt).split(',')[0]}
                {bill.reviewRequest.askedBy?.name ? ` · ${bill.reviewRequest.askedBy.name}` : ''}
              </span>
            ) : patient.phone ? <span className="gr-status gr-status-pending">Not asked</span> : <span className="cell-empty">No phone</span>}
          </td>
          <td>
            <div className="row-actions-v2">
              <WhatsAppShare kind="review" phone={patient.phone} name={name}
                label={asked ? 'Ask again' : 'Ask on WhatsApp'} onShared={() => mark(bill, true, 'whatsapp')} />
              <RowMenu label={`More actions for ${name || 'patient'}`} items={[
                asked
                  ? { label: 'Undo "asked"', onClick: () => mark(bill, false), ariaLabel: `Undo ${name}` }
                  : { label: 'Mark as asked', onClick: () => mark(bill, true), ariaLabel: `Mark asked ${name}` },
              ]} />
            </div>
          </td>
        </tr>
      );
    }
    return (
      <tr key={bill._id}>
        <td>{formatDate(bill.date || bill.createdAt)}</td>
        <td>{bill.billNumber}</td>
        <td className="gr-patient">{[patient.title, patient.name].filter(Boolean).join(' ') || '—'}</td>
        <td>{patient.phone || <span className="gr-muted">No phone</span>}</td>
        <td>
          {asked ? (
            <span className="gr-status gr-status-asked">
              <CheckCircle2 size={14} /> Asked {formatDate(bill.reviewRequest.askedAt)}
              {bill.reviewRequest.askedBy?.name ? ` · ${bill.reviewRequest.askedBy.name}` : ''}
              {bill.reviewRequest.channel === 'whatsapp' ? ' · WhatsApp' : ''}
            </span>
          ) : <span className="gr-status gr-status-pending">Not asked</span>}
        </td>
        <td>
          <div className="gr-actions">
            <WhatsAppShare kind="review" phone={patient.phone} name={[patient.title, patient.name].filter(Boolean).join(' ')}
              label={asked ? 'Ask again' : 'Ask on WhatsApp'} onShared={() => mark(bill, true, 'whatsapp')} />
            {asked ? (
              <Button variant="secondary" size="sm" icon={<RotateCcw size={14} />} onClick={() => mark(bill, false)} loading={saving === bill._id} disabled={!!saving}>
                Undo
              </Button>
            ) : (
              <Button variant="secondary" size="sm" icon={<CheckCircle2 size={14} />} onClick={() => mark(bill, true)} loading={saving === bill._id} disabled={!!saving}>
                Mark asked
              </Button>
            )}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="google-reviews-page">
      <PageHeader title="Google Reviews" subtitle="Ask patients for a Google review on WhatsApp and keep track of who has been asked." />
      {reviewLink === '' && (
        <div className="gr-banner" role="alert">
          <Star size={16} /> Add your Google review link in <Link to="/setup/profile">Lab Profile</Link> before asking patients.
        </div>
      )}
      <div className="gr-toolbar">
        <div className="gr-tabs" role="tablist" aria-label="Review status">
          {TABS.map((tab) => (
            <button key={tab.value || 'all'} type="button" role="tab" aria-selected={status === tab.value}
              className={`gr-tab${status === tab.value ? ' is-active' : ''}`} onClick={() => changeTab(tab.value)}>
              {tab.label}
            </button>
          ))}
        </div>
        <Input id="gr-search" name="gr-search" data-page-search="" aria-label="Search patients" placeholder="Search name, phone or bill no." value={search}
          onChange={(event) => { setSearch(event.target.value); setPage(1); setLoading(true); }} />
      </div>
      {error && <div className="gr-banner gr-banner-error" role="alert">{error} <Button variant="secondary" size="sm" onClick={() => { setLoading(true); setReloadKey((k) => k + 1); }}>Retry</Button></div>}
      <DataTable
        headers={isV2 ? ['Patient', 'Review', ''] : ['Date', 'Bill', 'Patient', 'Phone', 'Review', 'Action']}
        data={rows}
        loading={loading}
        emptyTitle={status === 'pending' ? 'Everyone has been asked' : 'No patients found'}
        emptyMessage={status === 'pending' ? 'There are no patients left to ask for a review.' : 'Try another search or tab.'}
        pagination={pagination ? { ...pagination, onPageChange: (next) => { setPage(next); setLoading(true); } } : undefined}
        renderRow={renderRow}
      />
    </div>
  );
};

export default GoogleReviews;
