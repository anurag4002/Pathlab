// Builds the `cors` options object from environment configuration.
// Pure function (no express/cors import) so it can be unit-tested.
//
// CORS_ORIGIN: comma-separated allowlist, e.g.
//   "https://app.example.com, https://admin.example.com"
//   Use "*" only for local development — never in production.
// CORS_CREDENTIALS: boolean, defaults to true.

function parseOrigins(raw) {
  if (!raw) return [];
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildCorsOptions({ CORS_ORIGIN, CORS_CREDENTIALS } = {}) {
  const origins = parseOrigins(CORS_ORIGIN);
  const allowAll = origins.includes('*');
  const credentials = CORS_CREDENTIALS !== false;

  return {
    credentials,
    origin: (origin, callback) => {
      // Non-browser clients (curl, mobile apps, server-to-server) send no
      // Origin header — always allow them; auth is enforced by JWT, not CORS.
      if (!origin) return callback(null, true);
      if (allowAll) return callback(null, true);
      if (origins.includes(origin)) return callback(null, true);
      return callback(new Error(`Not allowed by CORS: ${origin}`));
    }
  };
}

module.exports = { parseOrigins, buildCorsOptions };
