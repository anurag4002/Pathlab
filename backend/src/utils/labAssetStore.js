const fs = require('fs');
const path = require('path');

// Lab-profile images are saved to the database as well as the upload folder,
// because the live server's upload folder is temporary. Before a PDF is drawn
// or an image is served, any missing file is written back from the database.
const PROFILE_ASSET_FIELDS = ['letterheadUrl', 'footerUrl', 'logoUrl', 'signatureStripUrl'];
const SAFE_PATH = /^uploads\/letterheads\/[\w-][\w.-]*$/;

// Where a stored 'uploads/...' path lives on this server (same rule as
// pdfService.resolveUploadAbsolute, without requiring the file to exist).
function uploadTarget(fileUrl) {
  const rel = String(fileUrl).replace(/^src\//, '');
  return process.env.VERCEL
    ? path.join('/tmp/uploads', rel.replace(/^uploads\//, ''))
    : path.join(__dirname, '..', rel);
}

async function saveLabAsset(fileUrl, contentType) {
  if (!SAFE_PATH.test(String(fileUrl || ''))) return;
  const LabAsset = require('../models/LabAsset');
  const data = await fs.promises.readFile(uploadTarget(fileUrl));
  await LabAsset.updateOne({ path: fileUrl }, { $set: { data, contentType: contentType || 'application/octet-stream' } }, { upsert: true });
}

async function restoreLabAsset(fileUrl) {
  if (!SAFE_PATH.test(String(fileUrl || ''))) return false;
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

async function restoreProfileAssets(profile) {
  if (!profile) return;
  await Promise.all(PROFILE_ASSET_FIELDS.map(field => profile[field] && restoreLabAsset(profile[field])));
}

// Express middleware for /uploads/letterheads/*: restore before static serving.
function restoreOnRequest(req, res, next) {
  const rel = `uploads${decodeURIComponent(req.path || '')}`;
  if (!/^uploads\/letterheads\//.test(rel)) return next();
  restoreLabAsset(rel).finally(() => next());
}

module.exports = { saveLabAsset, restoreLabAsset, restoreProfileAssets, restoreOnRequest, PROFILE_ASSET_FIELDS };
