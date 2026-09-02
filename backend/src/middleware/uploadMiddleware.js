const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { UPLOAD_DIR } = require('../config/environment');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let subfolder = 'reports';
    // Dynamically choose folder based on endpoint path or field
    if (req.originalUrl.includes('/api/usg')) {
      subfolder = 'usg';
    } else if (req.originalUrl.includes('/api/xray')) {
      subfolder = 'xray';
    }
    
    const uploadPath = path.resolve(__dirname, '../../', UPLOAD_DIR, subfolder);
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
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
