const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { UPLOAD_DIR } = require('../config/environment');

const getUploadPath = (req) => {
  let subfolder = 'reports';
  if (req.originalUrl && req.originalUrl.includes('/api/usg')) {
    subfolder = 'usg';
  } else if (req.originalUrl && req.originalUrl.includes('/api/xray')) {
    subfolder = 'xray';
  }

  const baseDir = process.env.VERCEL
    ? '/tmp/uploads'
    : path.resolve(__dirname, '../../', UPLOAD_DIR);

  const fullPath = path.join(baseDir, subfolder);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
  return fullPath;
};

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    try {
      const uploadPath = getUploadPath(req);
      cb(null, uploadPath);
    } catch (err) {
      cb(err);
    }
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, JPG, JPEG, and PNG are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

module.exports = upload;
