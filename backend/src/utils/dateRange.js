// Report windows are whole lab days in India time. A date-only value
// ("2026-11-06") used to parse as midnight UTC, so an end date dropped the
// whole last day (Business analysis "7 days" showed ₹0 for today) and a
// one-day window collapsed to an instant (Cashbook false mismatch warning).
const { istDayStart, istDayEnd, istDayOf, parseIstDayParam, IST_TIMEZONE } = require('./istDay');

const LOCAL_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/;

/** Start of the window: a date-only value means 00:00 that day (IST). */
function rangeStart(value, fallback) {
  if (value == null || value === '') return fallback;
  const text = String(value);
  const day = parseIstDayParam(text);
  if (day) return day.start;
  if (LOCAL_DATETIME.test(text)) return new Date(`${text}${IST_TIMEZONE}`);
  return new Date(text);
}

/** End of the window: a date-only value means the whole day, to 23:59:59.999 IST. */
function rangeEnd(value, fallback) {
  if (value == null || value === '') return fallback;
  const text = String(value);
  const day = parseIstDayParam(text);
  if (day) return day.end;
  if (LOCAL_DATETIME.test(text)) return new Date(`${text}${IST_TIMEZONE}`);
  return new Date(text);
}

/**
 * End of the IST day containing `value`. For list filters that always meant
 * "through the end of that day" (they used setHours(23,59,59,999), which is
 * server-local and so 05:29 IST next day on a UTC server).
 */
function rangeEndOfDay(value, fallback) {
  if (value == null || value === '') return fallback;
  const day = parseIstDayParam(value);
  if (day) return day.end;
  const instant = rangeStart(value);
  if (Number.isNaN(instant.getTime())) return instant;
  return istDayEnd(istDayOf(instant));
}

/** Default window: today in IST. */
function todayStart(now = new Date()) { return istDayStart(istDayOf(now)); }
function todayEnd(now = new Date()) { return istDayEnd(istDayOf(now)); }

module.exports = { rangeStart, rangeEnd, rangeEndOfDay, todayStart, todayEnd };
