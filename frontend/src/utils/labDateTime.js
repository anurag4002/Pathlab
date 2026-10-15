// Lab times are entered and printed in India, regardless of browser timezone.
export function toLabDateTime(value) {
  if (!value || Number.isNaN(new Date(value).getTime())) return '';
  return new Date(new Date(value).getTime() + 330 * 60000).toISOString().slice(0, 16);
}

export function fromLabDateTime(value) {
  return value ? new Date(`${value}:00+05:30`).toISOString() : null;
}
