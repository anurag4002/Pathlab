// Session-only memory. Never put patient PDF data in persistent browser storage.
const state = { scope: null, generation: 0, entries: new Map(), pending: new Map(), bytes: 0 };
export function invalidateReportPdfs() {
  state.entries.clear(); state.pending.clear(); state.bytes = 0; state.generation += 1;
}
export function reportPdfCacheFor(scope) {
  if (state.scope !== scope) { invalidateReportPdfs(); state.scope = scope; }
  return state;
}
export function rememberReportPdf(key, entry) {
  const old = state.entries.get(key);
  if (old) { state.bytes -= old.blob.size; state.entries.delete(key); }
  if (entry.blob.size > 24 * 1024 * 1024) return;
  while (state.entries.size && (state.entries.size >= 24 || state.bytes + entry.blob.size > 24 * 1024 * 1024)) {
    const first = state.entries.keys().next().value;
    state.bytes -= state.entries.get(first).blob.size; state.entries.delete(first);
  }
  state.entries.set(key, entry); state.bytes += entry.blob.size;
}
