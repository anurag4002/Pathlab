import apiClient from './apiClient';

// Tickets + subscription  ->  /api/support/*
export const getTickets = async () => (await apiClient.get('/support/tickets')).data;
export const createTicket = async (data) => (await apiClient.post('/support/tickets', data)).data;
export const setTicketStatus = async (id, patch) => (await apiClient.put(`/support/tickets/${id}`, patch)).data;
export const getSubscription = async () => (await apiClient.get('/support/subscription')).data;
export const changePlan = async (planId, gst) => (await apiClient.post('/support/subscription/plan', { planId, ...gst })).data;
export const requestRefund = async () => (await apiClient.post('/support/subscription/refund')).data;
