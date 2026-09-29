const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { UPLOAD_DIR } = require('../config/environment');

// ---------------------------------------------------------------------------
// Vercel-safe upload layer (multer ^2.x).
//
// Why memoryStorage?
//  - Vercel serverless functions have a read-only filesystem except /tmp
//    (ephemeral, per-invocation, small). diskStorage orphans partial files
//    on aborted uploads (CVE-2026-5038 class) and never persists across
//    instances. With memoryStorage nothing touches disk until we explicitly
//    save the validated buffer below.
//  - Local dev keeps the old behaviour: buffers are written under
//    backend/<UPLOAD_DIR>/<subfolder>/ so static serving + downloads work.
//  - On Vercel the same helper writes under /tmp/uploads/<subfolder>/ so
//    the request can finish (PDF render, response). Files are ephemeral —
//    use Vercel Blob / S3 for durable storage (see note in vercel.json).
// ---------------------------------------------------------------------------

const getBaseDir = () => (
  process.env.VERCEL
    ? '/tmp/uploads'
    : path.resolve(__dirname, '../../', UPLOAD_DIR)
);

const resolveSubfolder = (req) => {
  const url = req.originalUrl || req.url || '';
  if (url.includes('/api/usg')) return 'usg';
  if (url.includes('/api/xray')) return 'xray';
  if (url.includes('/api/signatures') || url.includes('/signatures')) return 'signatures';
  if (url.includes('/api/lab-profile') || url.includes('/api/setup') || url.includes('/letterhead')) {
    return 'letterheads';
  }
  return 'reports';
};

// Hardened limits (multer 2.x passes these to busboy). They mitigate the
// 1.x DoS advisories (malformed multipart crash, empty field names) and the
// nested-field-name recursion advisory (fieldNestingDepth, added in 2.2.0).
const SECURE_LIMITS = {
  fileSize: 10 * 1024 * 1024, // 10MB per file
  files: 5,                   // max file fields per request
  fields: 20,                 // max non-file fields per request
  parts: 30,                  // fields + files ceiling
  headerPairs: 2000,
  fieldNameSize: 200,
  fieldSize: 1024 * 1024,     // 1MB text field cap
  fieldNestingDepth: 10       // multer >= 2.2.0; ignored by older minors
};

const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    const err = new Error('Invalid file type. Only PDF, JPG, JPEG, and PNG are allowed.');
    err.statusCode = 400;
    return cb(err, false);
  }
  // Extension allow-list is primary (client mimetypes are attacker-controlled);
  // reject obvious mismatches without being stricter than the old behaviour.
  const mime = String(file.mimetype || '').toLowerCase();
  const looksLikeImage = ['.jpg', '.jpeg', '.png'].includes(ext);
  if (looksLikeImage && mime && !mime.startsWith('image/')) {
    const err = new Error('File content does not match its image extension.');
    err.statusCode = 400;
    return cb(err, false);
  }
  if (ext === '.pdf' && mime && mime !== 'application/pdf' && mime !== 'application/octet-stream') {
    const err = new Error('File content does not match its PDF extension.');
    err.statusCode = 400;
    return cb(err, false);
  }
  cb(null, true);
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: SECURE_LIMITS
});

// Logo-only variant: images only, 2MB cap.
const logoFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const mime = String(file.mimetype || '').toLowerCase();
  if (['.jpg', '.jpeg', '.png'].includes(ext) && mime.startsWith('image/')) {
    return cb(null, true);
  }
  const err = new Error('Invalid file type. Only JPG, JPEG, and PNG images are allowed for the logo.');
  err.statusCode = 400;
  return cb(err, false);
};

const logoUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: logoFileFilter,
  limits: { ...SECURE_LIMITS, fileSize: 2 * 1024 * 1024, files: 2 }
});

const sanitiseBase = (originalname) => {
  const base = path.basename(String(originalname || 'file')).replace(/[^a-zA-Z0-9._-]+/g, '_');
  return base.slice(0, 80) || 'file';
};

/**
 * Persist a validated multer memory-file to disk.
 * Attaches `filename` + `path` so existing controllers that read
 * `req.file.filename` keep working unchanged.
 */
const saveUploadedFile = (file, subfolder) => {
  if (!file || !file.buffer) return null;
  const dir = path.join(getBaseDir(), subfolder);
  fs.mkdirSync(dir, { recursive: true });
  const ext = path.extname(file.originalname || '').toLowerCase();
  const unique = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
  const filename = `${file.fieldname || 'file'}-${unique}${ext}`;
  const fullPath = path.join(dir, filename);
  fs.writeFileSync(fullPath, file.buffer);
  // Backward-compat shape (mirrors what diskStorage provided).
  file.filename = filename;
  file.path = fullPath;
  file.destination = dir;
  return { filename, fullPath, fileUrl: `uploads/${subfolder}/${filename}` };
};

/**
 * Persist req.file / req.files (memoryStorage) to disk using the
 * URL-derived subfolder. Call at the top of controllers that accept uploads.
 * Returns the primary file (or null) for convenience.
 */
const persistRequestFiles = (req, forcedSubfolder) => {
  const subfolder = forcedSubfolder || resolveSubfolder(req);
  let primary = null;
  if (req.file && req.file.buffer && !req.file.filename) {
    saveUploadedFile(req.file, subfolder);
    primary = req.file;
  } else if (req.file) {
    primary = req.file;
  }
  if (req.files) {
    const all = Array.isArray(req.files)
      ? req.files
      : Object.values(req.files).flat();
    all.forEach((f) => {
      if (f && f.buffer && !f.filename) saveUploadedFile(f, subfolder);
    });
    if (!primary && all.length) primary = all[0];
  }
  return primary;
};

module.exports = upload;
module.exports.upload = upload;
module.exports.logoUpload = logoUpload;
module.exports.SECURE_LIMITS = SECURE_LIMITS;
module.exports.getBaseDir = getBaseDir;
module.exports.resolveSubfolder = resolveSubfolder;
module.exports.saveUploadedFile = saveUploadedFile;
module.exports.persistRequestFiles = persistRequestFiles;
module.exports.sanitiseBase = sanitiseBase;
