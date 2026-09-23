import apiClient from './apiClient';

// Append-only audit trail  ->  GET /api/audit-log (Admin only).
// Params: actor, action, entity/module (substrings), from, to (ISO dates),
// page, limit. Returns { logs, pagination }.
export const getAuditLogs = async (params = {}) =>
  (await apiClient.get('/audit-log', { params })).data;
