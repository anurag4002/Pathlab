import apiClient from './apiClient';

// Doctor portal + invites  ->  /api/doctor/*
export const getMyCases = async () => (await apiClient.get('/doctor/cases')).data;
export const getInvites = async () => (await apiClient.get('/doctor/invites')).data;
export const createInvite = async (data) => (await apiClient.post('/doctor/invites', data)).data;
export const acceptInvite = async (token, password) => (await apiClient.post('/doctor/invites/accept', { token, password })).data;
