import apiClient from './apiClient';

export const getBranches = async (params = {}) => {
  const res = await apiClient.get('/branches', { params });
  return res.data;
};

export const createBranch = async (payload) => {
  const res = await apiClient.post('/branches', payload);
  return res.data;
};

export const updateBranch = async (id, payload) => {
  const res = await apiClient.put(`/branches/${id}`, payload);
  return res.data;
};

export const deleteBranch = async (id) => {
  const res = await apiClient.delete(`/branches/${id}`);
  return res.data;
};

export const branchLabel = (branch) => {
  if (!branch) return '—';
  if (typeof branch === 'string') return branch;
  return branch.name || branch.code || '—';
};

export const branchIdOf = (branch) => {
  if (!branch) return '';
  if (typeof branch === 'string') return branch;
  return branch._id || branch.id || '';
};
