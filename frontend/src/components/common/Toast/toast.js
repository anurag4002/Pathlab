// Small, non-blocking notifications. Replaces window.alert(), which froze
// the whole screen until the user clicked OK — dozens of times a day.
//
//   notify('Bill voided.')                 -> type inferred (success here)
//   notify('Could not print the report')   -> error (inferred)
//   toast.success(text) / toast.error(text) / toast.info(text)
const listeners = new Set();
let nextId = 1;

const ERROR_WORDS = /^(?:select|enter|choose)\b|\b(could not|couldn't|cannot|can't|failed|failure|error|unable|invalid|not allowed|denied|missing|required|please|must|no .* (?:selected|found))\b/i;
const SUCCESS_WORDS = /\b(saved|created|updated|deleted|removed|voided|sent|copied|added|done|uploaded|signed|refunded|completed|started|success|recorded|emailed)/i;

function emit(type, message, { duration } = {}) {
  const text = String(message ?? '').trim();
  if (!text) return null;
  const id = nextId++;
  // Errors stay until dismissed (or 8s); confirmations get out of the way.
  const item = { id, type, text, duration: duration ?? (type === 'error' ? 8000 : 3200) };
  listeners.forEach((listener) => listener(item));
  return id;
}

export const toast = {
  success: (message, options) => emit('success', message, options),
  error: (message, options) => emit('error', message, options),
  info: (message, options) => emit('info', message, options),
  subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
};

export function notify(message, options) {
  const text = String(message ?? '');
  const type = ERROR_WORDS.test(text) ? 'error' : SUCCESS_WORDS.test(text) ? 'success' : 'info';
  return emit(type, text, options);
}

export default toast;
