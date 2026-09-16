const fs = require('fs');
const path = require('path');
const { UPLOAD_DIR } = require('../config/environment');

const getBaseStorageDir = () => {
  if (process.env.VERCEL) {
    return '/tmp/uploads';
  }
  return path.resolve(__dirname, '../../', UPLOAD_DIR);
};

const baseStorageDir = getBaseStorageDir();

try {
  if (!fs.existsSync(baseStorageDir)) {
    fs.mkdirSync(baseStorageDir, { recursive: true });
  }
} catch (err) {
  console.warn('Storage directory initialization warning:', err.message);
}

/**
 * Storage Service Abstraction
 * Handles local private filesystem storage with clean hooks for S3 / Cloud storage integration.
 */
class StorageService {
  /**
   * Save a buffer or file to private storage
   * @param {string} subFolder - Subdirectory name (e.g., 'reports', 'xray', 'usg')
   * @param {string} fileName - Destination filename
   * @param {Buffer} buffer - File buffer
   * @returns {Promise<{ relativePath: string, fullPath: string }>}
   */
  async uploadFile(subFolder, fileName, buffer) {
    const targetDir = path.join(baseStorageDir, subFolder);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const fullPath = path.join(targetDir, fileName);
    await fs.promises.writeFile(fullPath, buffer);
    const relativePath = path.join(UPLOAD_DIR, subFolder, fileName).replace(/\\/g, '/');

    return {
      relativePath,
      fullPath
    };
  }

  /**
   * Normalize a stored fileUrl to a path relative to the storage root.
   * Accepts 'uploads/reports/f', 'src/uploads/reports/f' or 'reports/f'.
   */
  stripStoragePrefix(relativePath) {
    if (!relativePath) return '';
    return String(relativePath)
      .replace(/\\/g, '/')
      .replace(/^(src\/)?uploads\//, '');
  }

  /**
   * Check if a file exists in private storage
   * @param {string} relativePath
   * @returns {boolean}
   */
  fileExists(relativePath) {
    if (!relativePath) return false;
    const fullPath = path.join(baseStorageDir, this.stripStoragePrefix(relativePath));
    return fs.existsSync(fullPath);
  }

  /**
   * Get absolute path for an authorized download/view
   * @param {string} relativePath
   * @returns {string|null}
   */
  getFilePath(relativePath) {
    if (!relativePath) return null;
    const fullPath = path.join(baseStorageDir, this.stripStoragePrefix(relativePath));
    return fs.existsSync(fullPath) ? fullPath : null;
  }

  /**
   * Get readable stream for file
   * @param {string} relativePath
   * @returns {fs.ReadStream|null}
   */
  getFileStream(relativePath) {
    const fullPath = this.getFilePath(relativePath);
    if (!fullPath) return null;
    return fs.createReadStream(fullPath);
  }

  /**
   * Delete a file from private storage
   * @param {string} relativePath
   * @returns {Promise<boolean>}
   */
  async deleteFile(relativePath) {
    try {
      const fullPath = this.getFilePath(relativePath);
      if (fullPath) {
        await fs.promises.unlink(fullPath);
        return true;
      }
      return false;
    } catch (err) {
      console.error('[STORAGE SERVICE] Delete Error:', err.message);
      return false;
    }
  }
}

module.exports = new StorageService();
