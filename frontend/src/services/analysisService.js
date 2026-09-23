import apiClient from './apiClient';

// Server-side test-usage aggregation  ->  GET /api/analysis/test-usage
// Params: from, to (YYYY-MM-DD), search (name/code), sort (asc|desc by
// orders), page, limit. Returns { items, top, slowest, totals, pagination }.
export const getTestUsage = async (params = {}) =>
  (await apiClient.get('/analysis/test-usage', { params })).data;
