import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getInquiries, setInquiryStatus, updateInquiry } from '../../services/inquiryService';
import { DataTable, PageHeader, StatusBadge, Select, Modal, Input, Button, AdvancedFilterBar, IdentityCell, RowMenu } from '../../components/common';
import { useUiVersion } from '../../utils/uiVersion';
import './v2/casesV2.css';
import useStickyState from '../../utils/useStickyState';
import useDebounce from '../../hooks/useDebounce';
import formatCurrency from '../../utils/formatCurrency';
import formatDate from '../../utils/formatDate';
import { notify } from '../../components/common/Toast/toast';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'New', label: 'New' },
  { value: 'Contacted', label: 'Contacted' },
  { value: 'Confirmed', label: 'Confirmed' },
  { value: 'Cancelled', label: 'Cancelled' }
];

const NEXT_STATUS = ['New', 'Contacted', 'Confirmed', 'Cancelled'];

// Staff queue for patient-portal booking inquiries. Inquiries carry no bill
// and no payment — staff confirm by phone and bill at the counter.
// Confirming moves the person's details + items into the billing form
// (/cases/bills/new) automatically; the Edit option allows corrections first.
const STATUS_TONE = { New: 'is-new', Contacted: 'is-warn', Confirmed: 'is-done', Cancelled: 'is-off' };

const Inquiries = () => {
  const navigate = useNavigate();
  const isV2 = useUiVersion() === 'v2';
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useStickyState('search', '');
  const debouncedSearch = useDebounce(search, 500);
  const [statusFilter, setStatusFilter] = useStickyState('status', '');
  const [page, goToPage] = useStickyState('page', 1);
  const [limit, setLimitRaw] = useStickyState('limit', 10);
  const setLimit = (n) => { setLimitRaw(Math.max(1, Number(n) || 10)); goToPage(1); };
  const [paginationInfo, setPaginationInfo] = useState({ total: 0, pages: 0 });
  const [updatingId, setUpdatingId] = useState('');

  // Edit-booking modal state (modification requests).
  const [editTarget, setEditTargetRaw] = useState(null);
  // New look: the booking being edited, and what was typed, come back after a reload.
  const [editId, setEditId] = useStickyState('editing', null);
  const setEditTarget = (inq) => { setEditTargetRaw(inq); setEditId(inq ? inq._id : null); };
  const [editName, setEditName] = useStickyState('editName', '');
  const [editPhone, setEditPhone] = useStickyState('editPhone', '');
  const [editPreferred, setEditPreferred] = useStickyState('editPreferred', '');
  const [editNote, setEditNote] = useStickyState('editNote', '');
  const [editItems, setEditItems] = useStickyState('editItems', []);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await getInquiries({
        status: statusFilter || undefined,
        search: debouncedSearch.trim() || undefined,
        page,
        limit
      });
      if (res?.success) {
        setItems(res.data?.inquiries || []);
        setPaginationInfo(res.data?.pagination || { total: 0, pages: 0 });
      }
    } catch (err) {
      console.error('Failed to load inquiries', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, statusFilter, page, limit]);

  const changeStatus = async (inq, status) => {
    if (!status || status === inq.status) return;
    setUpdatingId(inq._id);
    try {
      const res = await setInquiryStatus(inq._id, status);
      if (res?.success) fetchList();
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to update inquiry');
    } finally {
      setUpdatingId('');
    }
  };

  // Confirm a booking and move the person's details into billing automatically.
  // Handoff uses sessionStorage (not router state) so it survives the ledger's
  // URL-mirroring replaces and page refreshes. BillCreateForm consumes + clears it.
  const confirmAndBill = async (inq) => {
    setUpdatingId(inq._id);
    // Keep list-row fields — status API may return a slim doc.
    const source = inq;
    try {
      if (inq.status !== 'Confirmed') {
        const res = await setInquiryStatus(inq._id, 'Confirmed');
        if (!res?.success) return;
        inq = { ...source, ...(res.data || {}), status: 'Confirmed' };
      }
      const linked = inq.patient && typeof inq.patient === 'object' ? inq.patient : null;
      // Only treat as registered when we have a populated patient (or a real id).
      const patientId = linked?._id || (typeof inq.patient === 'string' ? inq.patient : null) || null;
      const booking = {
        inquiryId: inq._id || source._id,
        name: source.name || inq.name || '',
        phone: source.phone || inq.phone || '',
        patientId,
        email: linked?.email || '',
        address: linked?.address || '',
        aadhaar: linked?.aadhaar || '',
        history: linked?.history || source.note || inq.note || '',
        age: linked?.age,
        gender: linked?.gender,
        title: linked?.title || '',
        items: source.items || inq.items || [],
        note: source.note || inq.note || '',
        preferredDate: source.preferredDate || inq.preferredDate || null
      };
      try {
        sessionStorage.setItem('billBookingPrefill', JSON.stringify(booking));
      } catch {
        /* storage unavailable — pass via router state instead */
      }
      navigate('/cases/bills/new', { state: { booking } });
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to confirm booking');
    } finally {
      setUpdatingId('');
    }
  };

  // Open the edit modal prefilled with the booking's current details.
  useEffect(() => {
    if (!isV2 || !editId || editTarget || !items.length) return;
    const found = items.find((it) => String(it._id) === String(editId));
    if (found) setEditTargetRaw(found); else setEditId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isV2, editId, items]);

  const openEdit = (inq) => {
    setEditTarget(inq);
    setEditName(inq.name || '');
    setEditPhone(inq.phone || '');
    setEditPreferred(inq.preferredDate ? String(inq.preferredDate).slice(0, 10) : '');
    setEditNote(inq.note || '');
    setEditItems((inq.items || []).map((it) => ({
      kind: it.kind || 'Other',
      refId: it.refId || null,
      name: it.name || '',
      price: Number(it.price) || 0
    })));
    setEditError('');
  };

  const closeEdit = () => {
    if (editSaving) return;
    setEditTarget(null);
    setEditError('');
  };

  const updateEditItem = (idx, patch) => {
    setEditItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const removeEditItem = (idx) => {
    setEditItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    if (!editName.trim()) {
      setEditError('Patient name is required.');
      return;
    }
    if (!editPhone.trim()) {
      setEditError('Phone is required.');
      return;
    }
    if (!editItems.length) {
      setEditError('At least one item is required.');
      return;
    }
    if (editItems.some((it) => !String(it.name || '').trim())) {
      setEditError('Every item needs a name.');
      return;
    }
    setEditSaving(true);
    setEditError('');
    try {
      const res = await updateInquiry(editTarget._id, {
        name: editName.trim(),
        phone: editPhone.trim(),
        items: editItems.map((it) => ({
          kind: ['Test', 'Package'].includes(it.kind) ? it.kind : 'Other',
          refId: it.refId || null,
          name: String(it.name).trim(),
          price: Math.max(0, Number(it.price) || 0)
        })),
        preferredDate: editPreferred || null,
        note: editNote
      });
      if (res?.success) {
        setEditTarget(null);
        fetchList();
      }
    } catch (err) {
      setEditError(err.response?.data?.message || 'Failed to save booking changes.');
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Booking Inquiries"
        subtitle={isV2 ? 'Tests booked from the patient website. Call to confirm, then bill at the counter.' : 'Self-service test bookings from the patient portal — confirm by phone, bill at the counter'}
      />

      <AdvancedFilterBar
        showSearchButton={false}
        showClearButton={!!statusFilter}
        onClear={() => { setStatusFilter(''); goToPage(1); }}
        values={{ status: statusFilter }}
        onChange={(key, value) => {
          if (key === 'status') { setStatusFilter(value); goToPage(1); }
        }}
        fields={isV2 ? [
          { key: 'status', type: 'segmented', options: [{ value: '', label: 'All' }, ...STATUS_OPTIONS.filter((o) => o.value)] }
        ] : [
          { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS.filter((o) => o.value), placeholder: 'All statuses', size: 'sm' }
        ]}
      />

      <DataTable
        headers={isV2 ? ['Patient', 'Tests booked', <span key="t" className="th-num">Total</span>, 'Wants on', 'Status', ''] : ['Raised On', 'Patient', 'Phone', 'Items', 'Est. Total', 'Preferred', 'Status', 'Actions']}
        data={items}
        loading={loading}
        emptyMessage={isV2 ? (statusFilter || search ? 'No booking matches these filters.' : 'No bookings yet. When a patient books tests on the website, they show up here.') : 'No booking inquiries.'}
        searchValue={search}
        onSearchChange={(e) => { setSearch(e.target.value); goToPage(1); }}
        searchPlaceholder="Search name or phone…"
        pagination={{
          total: paginationInfo.total,
          page,
          limit,
          pages: paginationInfo.pages,
          onPageChange: goToPage,
          onLimitChange: setLimit
        }}
        renderRow={(inq) => isV2 ? (
          <tr key={inq._id}>
            <td>
              <IdentityCell
                name={inq.name}
                clinical={inq.patient ? { age: inq.patient.age, ageUnit: inq.patient.ageUnit, gender: inq.patient.gender } : undefined}
                meta={[inq.phone, `Booked ${formatDate(inq.createdAt)}`].filter(Boolean)}
                onClick={inq.patient?._id ? () => navigate(`/cases/patients/${inq.patient._id}`) : undefined}
                title={inq.patient?._id ? 'Open patient' : undefined}
              />
            </td>
            <td style={{ maxWidth: '280px' }}>
              {(inq.items || []).map((it) => it.name).filter(Boolean).join(', ') || <span className="cell-empty">Not set</span>}
            </td>
            <td className="num" style={{ fontWeight: 600 }}>{formatCurrency((inq.items || []).reduce((sum, it) => sum + (Number(it.price) || 0), 0))}</td>
            <td style={{ whiteSpace: 'nowrap' }}>{inq.preferredDate ? formatDate(inq.preferredDate).split(',')[0] : <span className="cell-empty">Any day</span>}</td>
            <td><span className={`cases-status ${STATUS_TONE[inq.status] || ''}`}>{inq.status}</span></td>
            <td>
              <div className="row-actions-v2">
                {inq.status !== 'Cancelled' && (
                  <Button variant={inq.status === 'Confirmed' ? 'secondary' : 'primary'} size="sm" disabled={updatingId === inq._id}
                    onClick={() => confirmAndBill(inq)} aria-label={`${inq.status === 'Confirmed' ? 'Bill' : 'Confirm and bill'} ${inq.name}`}>
                    {inq.status === 'Confirmed' ? 'Bill' : 'Confirm & bill'}
                  </Button>
                )}
                <RowMenu label={`More actions for ${inq.name}`} items={[
                  { label: 'Edit booking', onClick: () => openEdit(inq) },
                  inq.status === 'New' && { label: 'Mark as called', onClick: () => changeStatus(inq, 'Contacted') },
                  inq.patient?._id
                    ? { label: 'Open patient', onClick: () => navigate(`/cases/patients/${inq.patient._id}`) }
                    : { label: 'Find patient by phone', onClick: () => navigate(`/cases/patients?search=${encodeURIComponent(inq.phone || inq.name || '')}`) },
                  inq.status === 'Cancelled'
                    ? { label: 'Reopen booking', onClick: () => changeStatus(inq, 'New') }
                    : { label: 'Cancel booking', onClick: () => changeStatus(inq, 'Cancelled'), danger: true },
                ]} />
              </div>
            </td>
          </tr>
        ) : (
          <tr key={inq._id}>
            <td style={{ whiteSpace: 'nowrap' }}>{formatDate(inq.createdAt)}</td>
            <td style={{ fontWeight: '600' }}>
              {inq.name}
              {inq.patient?.registrationNumber && (
                <span style={{ display: 'block', fontWeight: 400, fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                  {inq.patient.registrationNumber}
                  {inq.patient.age != null ? ` · ${inq.patient.age}y` : ''}
                  {inq.patient.gender ? ` / ${inq.patient.gender}` : ''}
                  {inq.patient.aadhaar ? ` · Aadhaar ${inq.patient.aadhaar}` : ''}
                  {inq.patient.address ? ` · ${inq.patient.address}` : ''}
                </span>
              )}
            </td>
            <td style={{ whiteSpace: 'nowrap' }}>{inq.phone}</td>
            <td style={{ maxWidth: '260px' }}>
              {(inq.items || []).map((it, i) => (
                <span key={i} style={{ display: 'block', fontSize: '0.8rem' }}>
                  {it.name} <span style={{ color: 'var(--color-text-muted)' }}>({formatCurrency(it.price)})</span>
                </span>
              ))}
            </td>
            <td style={{ fontWeight: '700', whiteSpace: 'nowrap' }}>
              {formatCurrency((inq.items || []).reduce((s, it) => s + (Number(it.price) || 0), 0))}
            </td>
            <td style={{ whiteSpace: 'nowrap' }}>{inq.preferredDate ? formatDate(inq.preferredDate).split(',')[0] : '—'}</td>
            <td><StatusBadge status={inq.status} /></td>
            <td>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                <select
                  value={inq.status}
                  disabled={updatingId === inq._id}
                  onChange={(e) => changeStatus(inq, e.target.value)}
                  className="select-control"
                  style={{ maxWidth: '130px', padding: '4px 8px', fontSize: '0.75rem' }}
                  aria-label="Change inquiry status"
                >
                  {NEXT_STATUS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  disabled={updatingId === inq._id}
                  onClick={() => openEdit(inq)}
                  title="Edit name, phone, items or note when a modification is requested"
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  disabled={updatingId === inq._id || inq.status === 'Cancelled'}
                  onClick={() => confirmAndBill(inq)}
                  title={inq.status === 'Confirmed' ? 'Open this booking in billing' : 'Confirm and move details to billing'}
                >
                  {inq.status === 'Confirmed' ? 'Bill →' : 'Confirm & Bill'}
                </button>
                {inq.patient?._id ? (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                    onClick={() => navigate(`/cases/patients/${inq.patient._id}`)}
                  >
                    Patient
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                    title="Find the confirmed profile by phone"
                    onClick={() => navigate(`/cases/patients?search=${encodeURIComponent(inq.phone || inq.name || '')}`)}
                  >
                    Find patient
                  </button>
                )}
              </div>
            </td>
          </tr>
        )}
      />

      {/* Edit booking — used when any modification is requested before billing. */}
      <Modal
        isOpen={!!editTarget}
        onClose={closeEdit}
        title={isV2 ? 'Edit booking' : `Edit booking — ${editTarget?.name || ''}`}
        variant="drawer"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={closeEdit} disabled={editSaving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={saveEdit} loading={editSaving} disabled={editSaving}>
              Save changes
            </Button>
          </>
        }
      >
        {editError && (
          <p className="form-error" style={{ marginBottom: '12px' }}>{editError}</p>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Input label="Patient name" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Full name" />
          <Input label="Phone" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="Phone" />
          <Input label="Preferred date" type="date" value={editPreferred} onChange={(e) => setEditPreferred(e.target.value)} />
          <Input label="Note" value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder="Optional note" />
        </div>
        <div style={{ fontWeight: 700, margin: '16px 0 8px' }}>Booked items</div>
        {editItems.map((it, idx) => (
          <div key={idx} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 110px auto', gap: '8px', marginBottom: '8px', alignItems: 'end' }}>
            <Select
              label={idx === 0 ? 'Type' : undefined}
              value={it.kind}
              onChange={(e) => updateEditItem(idx, { kind: e.target.value })}
              options={[
                { value: 'Test', label: 'Test' },
                { value: 'Package', label: 'Package' },
                { value: 'Other', label: 'Other' }
              ]}
            />
            <Input
              label={idx === 0 ? 'Item name' : undefined}
              value={it.name}
              onChange={(e) => updateEditItem(idx, { name: e.target.value })}
              placeholder="Test / package name"
            />
            <Input
              label={idx === 0 ? 'Price (₹)' : undefined}
              type="number"
              value={it.price}
              onChange={(e) => updateEditItem(idx, { price: Math.max(0, Number(e.target.value)) })}
              placeholder="0"
            />
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '6px 10px', fontSize: '0.75rem' }}
              onClick={() => removeEditItem(idx)}
              disabled={editItems.length <= 1}
              title="Remove item"
            >
              ✕
            </button>
          </div>
        ))}
        <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
          Est. total: {formatCurrency(editItems.reduce((s, it) => s + (Number(it.price) || 0), 0))}
        </p>
      </Modal>
    </div>
  );
};

export default Inquiries;
