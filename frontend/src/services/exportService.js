import apiClient from './apiClient';

// Server-side CSV export (bills|patients|expenses|transactions) with date windows.
export const downloadServerCsv = async (dataset, { startDate, endDate } = {}) => {
  const response = await apiClient.get(`/export/${dataset}`, {
    params: { startDate, endDate },
    responseType: 'blob'
  });
  const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${dataset}_${startDate || 'all'}_${endDate || 'all'}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};
