const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { resolveReportOptions, resolveUploadAbsolute } = require('./pdfService');

function createPdfCache({ maxBytes = 32 * 1024 * 1024, maxEntries = 40, ttlMs = 10 * 60 * 1000 } = {}) {
  const entries = new Map(), pending = new Map();
  let bytes = 0, generation = 0;
  const remove = key => { const entry = entries.get(key); if (entry) bytes -= entry.buffer.length; entries.delete(key); };
  return {
    async getOrCreate(key, render) {
      const entry = entries.get(key);
      if (entry && entry.expires > Date.now()) {
        entries.delete(key); entries.set(key, entry);
        return { buffer: entry.buffer, status: 'HIT' };
      }
      remove(key);
      if (pending.has(key)) return { buffer: await pending.get(key), status: 'SHARED' };
      const started = generation;
      const promise = Promise.resolve().then(render).then(buffer => {
        if (started === generation && buffer.length <= maxBytes) {
          while (entries.size && (entries.size >= maxEntries || bytes + buffer.length > maxBytes)) remove(entries.keys().next().value);
          entries.set(key, { buffer, expires: Date.now() + ttlMs }); bytes += buffer.length;
        }
        return buffer;
      });
      pending.set(key, promise);
      try { return { buffer: await promise, status: 'MISS' }; }
      finally { if (pending.get(key) === promise) pending.delete(key); }
    },
    clear() { entries.clear(); pending.clear(); bytes = 0; generation += 1; }
  };
}

let rendererVersion;
function version() {
  if (!rendererVersion) {
    const hash = crypto.createHash('sha256');
    for (const file of ['formattedPdfService.js', 'pdfService.js', 'interpretationLayout.js', 'richInterpretation.js', 'documentTemplateService.js', 'referenceRangeService.js', 'testDefinitions.js', 'code39Service.js',
      '../assets/document-formats/fonts/NotoSans-Regular.ttf', '../assets/document-formats/fonts/NotoSans-Bold.ttf', '../assets/document-formats/fonts/NotoSansMath-Regular.ttf',
      '../assets/document-formats/pure-path-reference.json', '../assets/document-formats/reference-header.jpg', '../assets/document-formats/reference-footer.jpg', '../assets/document-formats/reference-watermark.jpg', '../assets/document-formats/reference-corner.jpg']) {
      hash.update(fs.readFileSync(path.resolve(__dirname, file)));
    }
    rendererVersion = hash.digest('hex');
  }
  return rendererVersion;
}
function reportPdfKey(context, options) {
  const profile = context.profile || {};
  const assets = [profile.letterheadUrl, profile.footerUrl, profile.logoUrl].map(value => {
    const absolute = value && resolveUploadAbsolute(value);
    try { const info = fs.statSync(absolute); return [value, info.size, info.mtimeMs]; }
    catch { return [value || '', null]; }
  });
  const plain = value => value?.toObject ? value.toObject() : value;
  return crypto.createHash('sha256').update(JSON.stringify({
    renderer: version(), report: plain(context.report), patient: plain(context.patient), bill: plain(context.bill),
    profile: plain(profile), tests: context.testMap, options: resolveReportOptions(options, profile), assets,
    qr: context.qrPng ? crypto.createHash('sha256').update(context.qrPng).digest('hex') : null,
    signatures: (context.signaturePngs || []).map(({ png, name, title }) => ({ name, title, image: crypto.createHash('sha256').update(png).digest('hex') }))
  })).digest('hex');
}

module.exports = { createPdfCache, reportPdfKey, reportPdfCache: createPdfCache() };
