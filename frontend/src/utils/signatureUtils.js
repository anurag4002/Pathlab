// Signature helpers (Phase 15).
//
// Backend reality (verified): signatures live at /api/setup/*
// (GET list, POST create, DELETE remove). There is NO PUT endpoint and the
// model field is `modalities[]` (+ `status` Active/Inactive) — NOT
// `assignedDepartments`. This module normalises both shapes so the UI works
// today via `modalities` and is forward-compatible if the backend ever adds
// `assignedDepartments` / PUT.

export const signatureDepartments = (sig = {}) => {
  const raw = sig.assignedDepartments ?? sig.modalities ?? [];
  return (Array.isArray(raw) ? raw : [raw]).filter(Boolean).map(String);
};

export const isSignatureActive = (sig = {}) =>
  String(sig.status || 'Active').toLowerCase() !== 'inactive';

export const signatureLabel = (sig = {}) =>
  `${sig.name || 'Unnamed'}${sig.title ? ` (${sig.title})` : ''}`;

// imageUrl is stored as 'uploads/signatures/<file>' and served statically at
// /uploads/* (and /api/uploads/*). Resolve to an absolute path the browser
// can load in dev (vite proxy) and prod (same-origin backend).
export const signatureImageSrc = (sig = {}) => {
  const url = sig.imageUrl || sig.url || '';
  if (!url) return '';
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  const clean = String(url).replace(/^\.\//, '').replace(/^src\//, '');
  if (clean.startsWith('/')) return clean;
  return `/${clean}`;
};

// Auto-select: first active signature whose departments include the report
// department (case-insensitive). Returns the signature _id or ''.
export const autoSelectSignatureId = (signatures = [], department = '') => {
  const dept = String(department || '').trim().toUpperCase();
  if (!dept) return '';
  const match = (signatures || []).find(
    (s) => isSignatureActive(s) && signatureDepartments(s).some((d) => String(d).toUpperCase() === dept)
  );
  return match ? String(match._id || match.id || '') : '';
};
