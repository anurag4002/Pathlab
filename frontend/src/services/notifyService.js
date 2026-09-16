import apiClient from './apiClient';

// Templates / credits / sends / review builder  ->  /api/notify/*
export const getTemplates = async () => (await apiClient.get('/notify/templates')).data;
export const saveTemplate = async (data) => (await apiClient.post('/notify/templates', data)).data;
export const sendMessage = async ({ channel, templateKey, to, vars }) =>
  (await apiClient.post('/notify/send', { channel, templateKey, to, vars })).data;
export const getCredits = async () => (await apiClient.get('/notify/credits')).data;
export const topupCredits = async (credits, note) => (await apiClient.post('/notify/credits/topup', { credits, note })).data;
export const getReviewRequests = async () => (await apiClient.get('/notify/reviews')).data;
export const sendReviewRequest = async ({ patient, phone }) => (await apiClient.post('/notify/reviews', { patient, phone })).data;
export const markReview = async (id, status) => (await apiClient.put(`/notify/reviews/${id}`, { status })).data;
