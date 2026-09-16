import apiClient from './apiClient';

export const login = async (email, password, { remember = false, browserCode = '' } = {}) => {
  const response = await apiClient.post('/auth/login', { email, password, remember, browserCode });
  if (response.data.success) {
    localStorage.setItem('ppl_token', response.data.data.token);
    localStorage.setItem('ppl_user', JSON.stringify(response.data.data.user));
  }
  return response.data;
};

export const requestEmailOtp = async (email) => {
  const response = await apiClient.post('/auth/email-otp/request', { email });
  return response.data;
};

export const verifyEmailOtp = async (email, otp, { remember = false, browserCode = '' } = {}) => {
  const response = await apiClient.post('/auth/email-otp/verify', { email, otp, remember, browserCode });
  if (response.data.success) {
    localStorage.setItem('ppl_token', response.data.data.token);
    localStorage.setItem('ppl_user', JSON.stringify(response.data.data.user));
  }
  return response.data;
};

export const requestPasswordReset = async (email) => {
  const response = await apiClient.post('/auth/forgot-password', { email });
  return response.data;
};

export const resetPassword = async (email, otp, newPassword) => {
  const response = await apiClient.post('/auth/reset-password', { email, otp, newPassword });
  return response.data;
};

export const getCurrentUser = async () => {
  const response = await apiClient.get('/auth/me');
  return response.data;
};

export const logout = async () => {
  try {
    await apiClient.post('/auth/logout');
  } catch (error) {
    console.error('Logout error on backend', error);
  } finally {
    localStorage.removeItem('ppl_token');
    localStorage.removeItem('ppl_user');
  }
};

export const getUsers = async (params = {}) => {
  const response = await apiClient.get('/users', { params });
  return response.data;
};

export const createUser = async (data) => {
  const response = await apiClient.post('/users', data);
  return response.data;
};

export const updateUser = async (id, data) => {
  const response = await apiClient.put(`/users/${id}`, data);
  return response.data;
};

export const deleteUser = async (id) => {
  const response = await apiClient.delete(`/users/${id}`);
  return response.data;
};
