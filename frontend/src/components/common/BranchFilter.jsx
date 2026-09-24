import React, { useEffect, useState } from 'react';
import { getBranches, branchIdOf } from '../../services/branchService';
import useAuth from '../../hooks/useAuth';
import { Select } from './index';

/**
 * Admin-only branch picker. Staff see their own branch as read-only text
 * (their lists are already server-scoped), Admin gets All + per-branch.
 */
const BranchFilter = ({ value, onChange, label = 'Branch' }) => {
  const { user } = useAuth();
  const [branches, setBranches] = useState([]);
  const isAdmin = user?.role === 'Admin';

  useEffect(() => {
    let active = true;
    getBranches({ status: 'Active' })
      .then((res) => {
        if (!active) return;
        const list = Array.isArray(res?.data) ? res.data : [];
        setBranches(list);
      })
      .catch(() => { if (active) setBranches([]); });
    return () => { active = false; };
  }, []);

  if (!isAdmin) {
    const name = user?.branch?.name || user?.branch?.code || 'Your branch';
    return (
      <div className="branch-filter-static" title="Your data is scoped to your branch">
        <span className="form-label">{label}</span>
        <span className="branch-badge">{name}</span>
      </div>
    );
  }

  return (
    <Select
      label={label}
      name="branch-filter"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      options={[
        { value: '', label: 'All branches' },
        ...branches.map((b) => ({ value: branchIdOf(b), label: `${b.name} (${b.code})` }))
      ]}
    />
  );
};

export default BranchFilter;
