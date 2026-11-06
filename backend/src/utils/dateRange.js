// Report windows are whole lab days in India time. A date-only value
// ("2026-11-06") used to parse as midnight UTC, so an end date dropped the
// whole last day (Business analysis "7 days" showed ₹0 for today) and a
// one-day window collapsed to an instant (Cashbook false mismatch warning).
const LAB_OFFSET = '+05:30';
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/;

/** Start of the window: a date-only value means 00:00 that day (IST). */
function rangeStart(value, fallback) {
  if (value == null || value === '') return fallback;
  const text = String(value);
  if (DATE_ONLY.test(text)) return new Date(`${text}T00:00:00.000${LAB_OFFSET}`);
  if (LOCAL_DATETIME.test(text)) return new Date(`${text}${LAB_OFFSET}`);
  return new Date(text);
}

/** End of the window: a date-only value means the whole day, to 23:59:59.999 IST. */
function rangeEnd(value, fallback) {
  if (value == null || value === '') return fallback;
  const text = String(value);
  if (DATE_ONLY.test(text)) return new Date(`${text}T23:59:59.999${LAB_OFFSET}`);
  if (LOCAL_DATETIME.test(text)) return new Date(`${text}${LAB_OFFSET}`);
  return new Date(text);
}

module.exports = { rangeStart, rangeEnd };
