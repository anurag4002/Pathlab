// Console request logger — mounted once in app.js so EVERY route
// (auth, bills, reports, USG, X-ray, setup, notify, jobs, ...) is logged
// with method, path, status code and duration. Zero dependencies.
const startedAt = () => (typeof process.hrtime.bigint === 'function'
  ? process.hrtime.bigint()
  : BigInt(Date.now()) * 1000000n);

const elapsedMs = (t0) => {
  const t1 = typeof process.hrtime.bigint === 'function'
    ? process.hrtime.bigint()
    : BigInt(Date.now()) * 1000000n;
  return Number(t1 - t0) / 1e6;
};

const requestLogger = (req, res, next) => {
  const t0 = startedAt();
  res.on('finish', () => {
    const ms = elapsedMs(t0).toFixed(1);
    const user = req.user ? (req.user.email || req.user.name || req.user._id || req.user.role || '') : '-';
    console.log(
      `[api] ${new Date().toISOString()} ${req.method} ${req.originalUrl || req.url} -> ${res.statusCode} (${ms}ms) user=${user}`
    );
  });
  next();
};

module.exports = requestLogger;
