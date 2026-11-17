// The lab works in India time (IST, UTC+05:30, no DST). Production runs with
// the server clock in UTC, so server-local midnight (setHours(0,0,0,0)) is
// 05:30 IST and anything created between 00:00 and 05:30 IST fell into
// "yesterday". Every "day" — today's lists, date-range filters, per-day
// buckets — is the IST calendar day, whatever the server timezone is.
const IST_OFFSET_MINUTES = 330;
const IST_OFFSET_MS = IST_OFFSET_MINUTES * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const IST_SUFFIX = '+05:30';
const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const valid = (d) => d instanceof Date && !Number.isNaN(d.getTime());

/** IST calendar day ('YYYY-MM-DD') of an instant. Defaults to now. '' if invalid. */
function istDayOf(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  if (!valid(d)) return '';
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Today's IST day string. `now` is injectable for tests. */
function istToday(now = new Date()) {
  return istDayOf(now);
}

/** True for a well-formed, real calendar day 'YYYY-MM-DD'. */
function isIstDayString(value) {
  const m = DAY_RE.exec(String(value ?? ''));
  if (!m) return false;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00.000Z`);
  return valid(d) && d.toISOString().slice(0, 10) === String(value);
}

const toDay = (day) => (day instanceof Date ? istDayOf(day) : String(day));

/** Instant of 00:00:00.000 IST on a day ('YYYY-MM-DD' or any instant in that IST day). */
function istDayStart(day = new Date()) {
  return new Date(`${toDay(day)}T00:00:00.000${IST_SUFFIX}`);
}

/** Instant of 23:59:59.999 IST on a day ('YYYY-MM-DD' or any instant in that IST day). */
function istDayEnd(day = new Date()) {
  return new Date(`${toDay(day)}T23:59:59.999${IST_SUFFIX}`);
}

/** { start, end } instants of an IST day. */
function istDayBounds(day = new Date()) {
  return { start: istDayStart(day), end: istDayEnd(day) };
}

/** Shift an IST day string by n calendar days. */
function addIstDays(day, n) {
  const base = new Date(`${toDay(day)}T00:00:00.000Z`);
  return new Date(base.getTime() + n * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Parse a 'YYYY-MM-DD' query param as IST day bounds. Returns null when the
 * value is empty or not a date-only string (callers fall back to their own
 * parsing for full timestamps).
 */
function parseIstDayParam(value) {
  if (value == null || value === '') return null;
  const text = String(value).trim();
  if (!isIstDayString(text)) return null;
  return istDayBounds(text);
}

/** { start, end } instants of an IST calendar month (month is 1-12). */
function istMonthBounds(year, month) {
  const y = Number(year);
  const m = Number(month);
  const first = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-01`;
  const nextFirst = m === 12 ? `${String(y + 1).padStart(4, '0')}-01-01` : `${String(y).padStart(4, '0')}-${String(m + 1).padStart(2, '0')}-01`;
  return { start: istDayStart(first), end: new Date(istDayStart(nextFirst).getTime() - 1) };
}

/** { year, month } (month 1-12) of an instant in IST. */
function istYearMonthOf(value = new Date()) {
  const day = istDayOf(value);
  return { year: Number(day.slice(0, 4)), month: Number(day.slice(5, 7)) };
}

module.exports = {
  IST_OFFSET_MINUTES,
  IST_OFFSET_MS,
  IST_TIMEZONE: IST_SUFFIX,
  istDayOf,
  istToday,
  isIstDayString,
  istDayStart,
  istDayEnd,
  istDayBounds,
  addIstDays,
  parseIstDayParam,
  istMonthBounds,
  istYearMonthOf
};
