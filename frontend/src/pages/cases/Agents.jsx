import React, { useState, useEffect } from 'react';
import { getAgents, createAgent, updateAgent, deleteAgent } from '../../services/agentService';
import { DataTable, PageHeader, Button, Modal, Input, Select, ConfirmDialog, StatusBadge } from '../../components/common';
import { Plus, Edit2, Trash2 } from 'lucide-react';

const Agents = () => {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null);
  const [formData, setFormData] = useState({ name: '', phone: '', commissionPercentage: '', status: 'Active' });
  const [errors, setErrors] = useState({});
  const [formSubmitLoading, setFormSubmitLoading] = useState(false);

  const [search, setSearch] = useState('');

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchAgents = async () => {
    setLoading(true);
    try {
      const res = await getAgents({ search });
      if (res.success) setAgents(res.data);
    } catch (err) {
      console.error('Failed to load agents list', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, [search]);

  const handleOpenCreate = () => {
    setEditingAgent(null);
    setFormData({ name: '', phone: '', commissionPercentage: '5', status: 'Active' });
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
        fetchAgents();
      }
    } catch (err) {
      setErrors({ api: err.response?.data?.message || 'Failed to save agent details' });
    } finally {
      setFormSubmitLoading(false);
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
      alert(err.response?.data?.message || 'Failed to remove agent profile');
    } finally {
      setDeleteLoading(false);
    }
  };

  const footer = (
    <>
      <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={formSubmitLoading}>
        Cancel
      </Button>
      <Button variant="primary" onClick={handleFormSubmit} loading={formSubmitLoading}>
        Save Profile
      </Button>
    </>
  );

  return (
    <div>
      <PageHeader
        title="Collection Agents Directory"
        subtitle="Manage laboratory collection representatives and commission structures"
        action={
          <Button variant="primary" onClick={handleOpenCreate} icon={<Plus size={16} />}>
            Add Agent
          </Button>
        }
      />

      <DataTable
        headers={['Name', 'Phone', 'Commission %', 'Status', 'Actions']}
        data={agents}
        loading={loading}
        emptyMessage="No collection agent profiles matching your query."
        searchValue={search}
        onSearchChange={(e) => setSearch(e.target.value)}
        searchPlaceholder="Search by agent name..."
        renderRow={(agent) => (
          <tr key={agent._id}>
            <td style={{ fontWeight: 'var(--font-weight-semibold)' }}>{agent.name}</td>
            <td>{agent.phone}</td>
            <td style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-primary)' }}>
              {agent.commissionPercentage}%
            </td>
            <td>
              <StatusBadge status={agent.status} />
            </td>
            <td>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <Button variant="secondary" size="sm" onClick={() => handleOpenEdit(agent)} icon={<Edit2 size={14} />} />
                <Button variant="danger" size="sm" onClick={() => setDeleteTarget(agent)} icon={<Trash2 size={14} />} />
              </div>
            </td>
          </tr>
        )}
      />

      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingAgent ? 'Edit Agent Profile' : 'Add Collection Agent'}
        footer={footer}
      >
        <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {errors.api && (
            <div style={{ padding: 'var(--space-2) var(--space-3)', backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-sm)' }}>
              {errors.api}
            </div>
          )}
          <Input label="Agent Name" name="name" value={formData.name} onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} error={errors.name} placeholder="e.g. Ravi Kumar" required />
          <Input label="Phone Number" name="phone" value={formData.phone} onChange={(e) => setFormData(p => ({ ...p, phone: e.target.value }))} error={errors.phone} required />
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
        title="Remove Agent Profile?"
        message={`Are you sure you want to permanently delete the agent profile for ${deleteTarget?.name}?`}
      />
    </div>
  );
};

export default Agents;
