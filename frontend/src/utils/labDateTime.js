// Lab times are entered and printed in India, regardless of browser timezone.
export function toLabDateTime(value) {
  if (!value || Number.isNaN(new Date(value).getTime())) return '';
  return new Date(new Date(value).getTime() + 330 * 60000).toISOString().slice(0, 16);
}

export function fromLabDateTime(value) {
  return value ? new Date(`${value}:00+05:30`).toISOString() : null;
}

// "Today" and every day bucket is the IST calendar day. Using
// toISOString().slice(0, 10) gives the UTC date, which is still yesterday
// between 00:00 and 05:30 IST.
const IST_OFFSET_MS = 330 * 60000;
const DAY_MS = 24 * 60 * 60000;

/** IST calendar day ('YYYY-MM-DD') of a date/instant. Defaults to now; '' if invalid. */
export function istDayOf(value = new Date()) {
  if (value === null || value === undefined || value === '') return '';
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return '';
  return new Date(time + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Today's IST day string. */
export function istToday() {
  return istDayOf(new Date());
}

/** Shift an IST day string ('YYYY-MM-DD') by n calendar days. */
export function addIstDays(day, n) {
  const base = new Date(`${day}T00:00:00.000Z`).getTime();
  if (Number.isNaN(base)) return '';
  return new Date(base + n * DAY_MS).toISOString().slice(0, 10);
}

/** Epoch ms of 00:00:00.000 IST on a 'YYYY-MM-DD' day. */
export function istDayStartMs(day) {
  return new Date(`${day}T00:00:00.000+05:30`).getTime();
}

/** Epoch ms of 23:59:59.999 IST on a 'YYYY-MM-DD' day. */
export function istDayEndMs(day) {
  return new Date(`${day}T23:59:59.999+05:30`).getTime();
}
