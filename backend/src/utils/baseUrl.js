// A configured base address works with or without a trailing "/" (and with
// or without "https://"). "https://lab.com", "https://lab.com/" and
// "lab.com//" all become "https://lab.com"; a sub-path is kept
// ("https://lab.com/app/" -> "https://lab.com/app").
function normalizeBaseUrl(raw) {
  let s = String(raw || '').trim();
  if (!s) return '';
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) {
    const local = /^(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(s);
    s = `${local ? 'http' : 'https'}://${s.replace(/^\/+/, '')}`;
  }
  return s.replace(/\/+$/, '');
}

/** Join a base and a path with exactly one "/" between them. */
function joinUrl(base, path = '') {
  const b = normalizeBaseUrl(base);
  const p = String(path || '').replace(/^\/+/, '');
  if (!b) return p ? `/${p}` : '';
  return p ? `${b}/${p}` : b;
}

module.exports = { normalizeBaseUrl, joinUrl };
