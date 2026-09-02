import apiClient from './apiClient';

export const login = async (email, password) => {
  // Bypass backend for testing frontend UI
  const mockData = {
    success: true,
    data: {
      token: 'mock-jwt-token-12345',
      user: {
        _id: 'mock-admin-id',
        name: 'Test Admin',
        email: email || 'admin@purepathlab.com',
        role: 'Admin',
        status: 'Active'
      }
    }
  };
  localStorage.setItem('ppl_token', mockData.data.token);
  localStorage.setItem('ppl_user', JSON.stringify(mockData.data.user));
  return mockData;
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

