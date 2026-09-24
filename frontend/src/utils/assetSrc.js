// Resolve an API-provided asset path for <img src>.
// Stored paths are relative ('uploads/letterheads/x.png') and are served
// from the site root (dev proxy /api + /uploads -> backend). Absolute URLs,
// if the API ever returns one, are used as-is. No host is ever hardcoded.
const assetSrc = (value) => {
  if (!value || typeof value !== 'string') return '';
  if (/^https?:\/\//i.test(value) || value.startsWith('//')) return value;
  return `/${value.replace(/^\/+/, '')}`;
};

export default assetSrc;
