// Builds the `cors` options object from environment configuration.
// Pure function (no express/cors import) so it can be unit-tested.
//
// CORS_ORIGIN: comma-separated allowlist, e.g.
//   "https://app.example.com, https://admin.example.com"
//   Use "*" only for local development — never in production.
// CORS_CREDENTIALS: boolean, defaults to true.

// Normalize a configured value to a comparable origin.
// Browsers send `Origin` as scheme + host + port with NO path
// (e.g. `https://app.vercel.app`), but operators often configure
// `https://app.vercel.app/`, `https://app.vercel.app/api` or similar.
// `new URL(x).origin` strips any path / trailing slash / default port so
// `/` vs `/api` vs `/path` misconfigurations still match.
function normalizeOrigin(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (s === '*') return '*';
  // Preserve wildcards such as https://*.vercel.app (match case-insensitively).
  if (s.includes('*')) return s.toLowerCase().replace(/\/+$/, '');
  try {
    return new URL(s).origin;
  } catch {
    return s.toLowerCase().replace(/\/+$/, '');
  }
}

function wildcardMatch(origin, pattern) {
  // Escape regex chars except *, then turn * into .*
  const re = new RegExp(
    `^${pattern
      .split('*')
      .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
      .join('.*')}$`,
    'i'
  );
  return re.test(origin);
}

function parseOrigins(raw) {
  if (!raw) return [];
  const out = String(raw)
    .split(',')
    .map((s) => normalizeOrigin(s))
    .filter(Boolean);
  // De-duplicate while preserving order.
  return [...new Set(out)];
}

function buildCorsOptions({ CORS_ORIGIN, CORS_CREDENTIALS } = {}) {
  const origins = parseOrigins(CORS_ORIGIN);
  const allowAll = origins.includes('*');
  const credentials = CORS_CREDENTIALS !== false && CORS_CREDENTIALS !== 'false';

  return {
    credentials,
    origin: (origin, callback) => {
      // Non-browser clients (curl, mobile apps, server-to-server) send no
      // Origin header — always allow them; auth is enforced by JWT, not CORS.
      if (!origin) return callback(null, true);
      if (allowAll) return callback(null, true);
      const incoming = normalizeOrigin(origin);
      if (origins.includes(incoming)) return callback(null, true);
      if (origins.some((p) => p.includes('*') && wildcardMatch(incoming, p))) {
        return callback(null, true);
      }
      const err = new Error(`Not allowed by CORS: ${origin}`);
      // Tag it so errorMiddleware can return 403 (not 500 "Unhandled").
      err.statusCode = 403;
      return callback(err);
    }
  };
}

module.exports = { parseOrigins, buildCorsOptions, normalizeOrigin, wildcardMatch };
