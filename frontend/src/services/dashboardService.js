import apiClient from './apiClient';

export const getSummary = async () => {
  const response = await apiClient.get('/dashboard/summary');
  return response.data;
};

export const getDailyBusiness = async (startDate, endDate) => {
  const response = await apiClient.get('/dashboard/business', {
    params: { startDate, endDate }
  });
  return response.data;
};

export const getReferralReport = async (startDate, endDate) => {
  const response = await apiClient.get('/dashboard/referral', {
    params: { startDate, endDate }
  });
  return response.data;
};

export const getActivityLogs = async () => {
  const response = await apiClient.get('/dashboard/activities');
  return response.data;
};

export const getMonthlyTrends = async () => {
  const response = await apiClient.get('/dashboard/trends');
  return response.data;
};
