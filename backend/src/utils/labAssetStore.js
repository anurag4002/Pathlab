const fs = require('fs');
const path = require('path');

// Every uploaded file (lab-profile images, report PDFs, X-ray files,
// signature images) is saved to the database as well as the upload folder,
// because the live server's upload folder is temporary and is emptied on each
// deploy or restart. Before a file is read or served, a missing one is written
// back from the database.
const PROFILE_ASSET_FIELDS = ['letterheadUrl', 'footerUrl', 'logoUrl', 'signatureStripUrl'];
const SAFE_PATH = /^uploads\/[\w-]+\/[\w-][\w.-]*$/;

// 'src/uploads/x/f', 'uploads/x/f' or 'x/f' -> 'uploads/x/f'.
const normalise = (fileUrl) => `uploads/${String(fileUrl || '').replace(/\\/g, '/').replace(/^(src\/)?uploads\//, '')}`;

// Where a stored 'uploads/...' path lives on this server (same rule as
// pdfService.resolveUploadAbsolute, without requiring the file to exist).
function uploadTarget(fileUrl) {
  const rel = String(fileUrl).replace(/^src\//, '');
  return process.env.VERCEL
    ? path.join('/tmp/uploads', rel.replace(/^uploads\//, ''))
    : path.join(__dirname, '..', rel);
}

async function saveLabAsset(fileUrl, contentType) {
  fileUrl = normalise(fileUrl);
  if (!SAFE_PATH.test(fileUrl)) return;
  const LabAsset = require('../models/LabAsset');
  const data = await fs.promises.readFile(uploadTarget(fileUrl));
  await LabAsset.updateOne({ path: fileUrl }, { $set: { data, contentType: contentType || 'application/octet-stream' } }, { upsert: true });
}

// Save an upload's bytes straight from memory (no disk read).
async function saveUploadBuffer(fileUrl, buffer, contentType) {
  fileUrl = normalise(fileUrl);
  if (!SAFE_PATH.test(fileUrl) || !buffer) return;
  const LabAsset = require('../models/LabAsset');
  await LabAsset.updateOne({ path: fileUrl }, { $set: { data: buffer, contentType: contentType || 'application/octet-stream' } }, { upsert: true });
}

async function restoreLabAsset(fileUrl) {
  if (!fileUrl) return false;
  fileUrl = normalise(fileUrl);
  if (!SAFE_PATH.test(fileUrl)) return false;
  const target = uploadTarget(fileUrl);
  if (fs.existsSync(target)) return true;
  // No database connection (e.g. a standalone render): nothing to restore from.
  if (require('mongoose').connection.readyState !== 1) return false;
  try {
    const LabAsset = require('../models/LabAsset');
    const saved = await LabAsset.findOne({ path: fileUrl }).lean();
    if (!saved?.data) return false;
    await fs.promises.mkdir(path.dirname(target), { recursive: true });
    await fs.promises.writeFile(target, saved.data.buffer ? Buffer.from(saved.data.buffer) : saved.data);
    return true;
  } catch (error) {
    console.warn('Lab image restore skipped:', error.message);
    return false;
  }
}

// Restore several stored paths (missing or empty entries are ignored).
async function restoreUploads(urls) {
  await Promise.all([...new Set((urls || []).filter(Boolean))].map(restoreLabAsset));
}

async function restoreProfileAssets(profile) {
  if (!profile) return;
  await Promise.all(PROFILE_ASSET_FIELDS.map(field => profile[field] && restoreLabAsset(profile[field])));
}

// Express middleware for /uploads/*: restore before static serving.
function restoreOnRequest(req, res, next) {
  const rel = `uploads${decodeURIComponent(req.path || '')}`;
  if (!SAFE_PATH.test(rel)) return next();
  restoreLabAsset(rel).finally(() => next());
}

module.exports = { saveLabAsset, saveUploadBuffer, restoreLabAsset, restoreUploads, restoreProfileAssets, restoreOnRequest, PROFILE_ASSET_FIELDS };
