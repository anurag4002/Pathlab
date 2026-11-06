import React, { useState, useEffect } from 'react';
import { getAgents, createAgent, updateAgent, deleteAgent } from '../../services/agentService';
import useClientPagination from '../../hooks/useClientPagination';
import { DataTable, PageHeader, Button, Modal, Input, Select, ConfirmDialog, StatusBadge, AdvancedFilterBar, RowMenu } from '../../components/common';
import './v2/casesV2.css';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { notify } from '../../components/common/Toast/toast';
import IdentityCell from '../../components/common/IdentityCell/IdentityCell';
import { useUiVersion } from '../../utils/uiVersion';
import useStickyState from '../../utils/useStickyState';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'Active', label: 'Active' },
  { value: 'Inactive', label: 'Inactive' }
];

const EMPTY_CONTACT = { name: '', phone: '', commissionPercentage: '5', status: 'Active' };

const Agents = () => {
  const isV2 = useUiVersion() === 'v2';
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(false);

  // New look: the open panel, what was typed in it, search and tab come back after a reload.
  const [formOpen, setFormOpen] = useStickyState('open', false);
  const [editingAgent, setEditingAgentRaw] = useState(null);
  const [editingId, setEditingId] = useStickyState('editing', null);
  const setEditingAgent = (item) => { setEditingAgentRaw(item); setEditingId(item ? item._id : null); };
  const [formData, setFormData] = useStickyState('form', { name: '', phone: '', commissionPercentage: '', status: 'Active' });
  const [errors, setErrors] = useState({});
  const [formSubmitLoading, setFormSubmitLoading] = useState(false);

  const [search, setSearch] = useStickyState('search', '');
  const [statusFilter, setStatusFilter] = useStickyState('status', '');

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Client-side filter + pagination (avoid refetching the API on every keystroke).
  const filtered = agents.filter((a) => {
    if (statusFilter && a.status !== statusFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return String(a.name || '').toLowerCase().includes(q)
      || String(a.phone || '').toLowerCase().includes(q);
  });
  const pg = useClientPagination(filtered, 10);

  const fetchAgents = async () => {
    setLoading(true);
    try {
      const res = await getAgents();
      if (res.success) setAgents(res.data);
    } catch (err) {
      console.error('Failed to load agents list', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const closeForm = () => {
    setFormOpen(false);
    if (editingAgent) { setEditingAgent(null); setFormData(EMPTY_CONTACT); }
  };
  // After a reload: the edited record comes back once the list has loaded.
  useEffect(() => {
    if (!isV2 || !formOpen || !editingId || editingAgent || !agents.length) return;
    const found = agents.find((x) => String(x._id) === String(editingId));
    if (found) setEditingAgentRaw(found); else { setEditingId(null); setFormOpen(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isV2, formOpen, editingId, agents]);

  const handleOpenCreate = () => {
    // New look: a half-typed new agent survives closing the panel.
    const keepDraft = isV2 && !editingAgent && (formData.name || formData.phone);
    setEditingAgent(null);
    if (!keepDraft) setFormData({ name: '', phone: '', commissionPercentage: '5', status: 'Active' });
    setErrors({});
    setFormOpen(true);
  };

  const handleOpenEdit = (agent) => {
    setEditingAgent(agent);
    setFormData({
      name: agent.name,
      phone: agent.phone,
      commissionPercentage: String(agent.commissionPercentage || 0),
      status: agent.status
    });
    setErrors({});
    setFormOpen(true);
  };

  const validate = () => {
    const errs = {};
    if (!formData.name.trim()) errs.name = 'Agent name is required';
    if (!formData.phone.trim()) errs.phone = 'Phone number is required';
    const pct = Number(formData.commissionPercentage);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      errs.commissionPercentage = 'Commission must be between 0% and 100%';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleFormSubmit = async (e) => {
    e?.preventDefault();
    if (!validate()) return;

    setFormSubmitLoading(true);
    try {
      const payload = { ...formData, commissionPercentage: Number(formData.commissionPercentage) };
      const res = editingAgent
        ? await updateAgent(editingAgent._id, payload)
        : await createAgent(payload);

      if (res.success) {
        setFormOpen(false);
        if (!editingAgent) setFormData({ name: '', phone: '', commissionPercentage: '5', status: 'Active' });
        fetchAgents();
      }
    } catch (err) {
      setErrors({ api: err.response?.data?.message || 'Failed to save agent details' });
    } finally {
      setFormSubmitLoading(false);
    }
  };

  const toggleActive = async (agent) => {
    try {
      const res = await updateAgent(agent._id, { name: agent.name, phone: agent.phone, commissionPercentage: Number(agent.commissionPercentage || 0), status: agent.status === 'Active' ? 'Inactive' : 'Active' });
      if (res.success) fetchAgents();
    } catch (err) {
      notify(err.response?.data?.message || 'Could not change the status.');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await deleteAgent(deleteTarget._id);
      if (res.success) {
        setDeleteTarget(null);
        fetchAgents();
      }
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to remove agent profile');
    } finally {
      setDeleteLoading(false);
    }
  };

  const footer = (
    <>
      {isV2 && !editingAgent && <span className="cases-drawer-note">Closing keeps what you typed.</span>}
      <Button variant="secondary" onClick={closeForm} disabled={formSubmitLoading}>
        Cancel
      </Button>
      <Button variant="primary" onClick={handleFormSubmit} loading={formSubmitLoading}>
        {isV2 ? (editingAgent ? 'Save changes' : 'Add agent') : 'Save Profile'}
      </Button>
    </>
  );

  return (
    <div>
      <PageHeader
        title="Collection Agents Directory"
        subtitle={isV2 ? 'People who bring in samples or patients, and the commission each one gets.' : 'Manage laboratory collection representatives and commission structures'}
        action={
          <Button variant="primary" onClick={handleOpenCreate} icon={<Plus size={16} />}>
            {isV2 ? 'Add agent' : 'Add Agent'}
          </Button>
        }
      />

      <AdvancedFilterBar
        showSearchButton={false}
        showClearButton={!!(search || statusFilter)}
        onClear={() => { setSearch(''); setStatusFilter(''); pg.reset(); }}
        values={{ search, status: statusFilter }}
        onChange={(key, value) => {
          pg.reset();
          if (key === 'search') setSearch(value);
          else if (key === 'status') setStatusFilter(value);
        }}
        fields={isV2 ? [
          { key: 'status', type: 'segmented', options: [{ value: '', label: 'All' }, ...STATUS_OPTIONS.filter((o) => o.value)] },
          { key: 'search', label: 'Search', type: 'text', size: 'lg', placeholder: 'Agent name or phone' }
        ] : [
          { key: 'search', label: 'Search', type: 'text', size: 'lg', placeholder: 'Search by agent name...' },
          { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS, placeholder: 'All statuses' }
        ]}
      />

      <DataTable
        headers={isV2 ? ['Agent', <span key="c" className="th-num">Commission</span>, 'Status', ''] : ['Name', 'Phone', 'Commission %', 'Status', 'Actions']}
        data={pg.paged}
        loading={loading}
        emptyMessage={isV2 ? (search || statusFilter ? "No agent matches these filters." : "No agents yet. Add the people who bring in samples or patients.") : "No collection agent profiles matching your query."}
        pagination={{
          total: pg.total,
          page: pg.page,
          limit: pg.limit,
          pages: pg.pages,
          onPageChange: pg.goToPage,
          onLimitChange: pg.setLimit,
        }}
        renderRow={(agent) => (
          <tr key={agent._id}>
            {isV2 ? (
              <>
                <td><IdentityCell name={agent.name} copy={agent.phone ? { value: agent.phone, label: 'phone' } : undefined} /></td>
                <td className="num">{agent.commissionPercentage}%</td>
              </>
            ) : (
              <>
                <td style={{ fontWeight: 'var(--font-weight-semibold)' }}>{agent.name}</td>
                <td>{agent.phone}</td>
                <td style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-primary)' }}>
                  {agent.commissionPercentage}%
                </td>
              </>
            )}
            <td>
              <StatusBadge status={agent.status} />
            </td>
            <td>
              {isV2 ? (
                <div className="row-actions-v2">
                  <Button variant="secondary" size="sm" icon={<Edit2 size={14} />} onClick={() => handleOpenEdit(agent)} aria-label={`Edit ${agent.name}`}>Edit</Button>
                  <RowMenu label={`More actions for ${agent.name}`} items={[
                    { label: agent.status === 'Active' ? 'Make inactive' : 'Make active', onClick: () => toggleActive(agent) },
                    { label: 'Delete agent', onClick: () => setDeleteTarget(agent), danger: true },
                  ]} />
                </div>
              ) : (
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <Button variant="secondary" size="sm" onClick={() => handleOpenEdit(agent)} icon={<Edit2 size={14} />} />
                <Button variant="danger" size="sm" onClick={() => setDeleteTarget(agent)} icon={<Trash2 size={14} />} />
              </div>
              )}
            </td>
          </tr>
        )}
      />

      <Modal
        isOpen={formOpen}
        onClose={closeForm}
        title={isV2 ? (editingAgent ? 'Edit agent' : 'New agent') : editingAgent ? 'Edit Agent Profile' : 'Add Collection Agent'}
        variant="drawer"
        footer={footer}
      >
        <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {errors.api && (
            <div style={{ padding: 'var(--space-2) var(--space-3)', backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-sm)' }}>
              {errors.api}
            </div>
          )}
          <Input label={isV2 ? 'Name' : 'Agent Name'} name="name" value={formData.name} onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} error={errors.name} placeholder="e.g. Ravi Kumar" required />
          <Input label={isV2 ? 'Phone number' : 'Phone Number'} name="phone" value={formData.phone} onChange={(e) => setFormData(p => ({ ...p, phone: e.target.value }))} error={errors.phone} required />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <Input label="Commission %" name="commissionPercentage" type="number" value={formData.commissionPercentage} onChange={(e) => setFormData(p => ({ ...p, commissionPercentage: e.target.value }))} error={errors.commissionPercentage} required />
            <Select label="Status" name="status" value={formData.status} onChange={(e) => setFormData(p => ({ ...p, status: e.target.value }))} options={[{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }]} required />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        loading={deleteLoading}
        title={isV2 ? 'Delete this agent?' : 'Remove Agent Profile?'}
        message={isV2 ? `${deleteTarget?.name} will be removed from the list. Old bills keep their name. Tip: "Make inactive" hides them without deleting.` : `Are you sure you want to permanently delete the agent profile for ${deleteTarget?.name}?`}
      />
    </div>
  );
};

export default Agents;
