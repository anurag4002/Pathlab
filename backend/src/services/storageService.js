const fs = require('fs');
const path = require('path');
const { UPLOAD_DIR } = require('../config/environment');

// Ensure upload directory exists
const absoluteUploadDir = path.resolve(process.cwd(), UPLOAD_DIR);
if (!fs.existsSync(absoluteUploadDir)) {
  fs.mkdirSync(absoluteUploadDir, { recursive: true });
}

/**
 * Storage Service Abstraction
 * Currently uses local file system, designed to be swapped with S3/Cloud storage easily.
 */
const storageService = {
  /**
   * Save a file to storage
   * @param {Object} file - Express multer file object
   * @returns {Promise<string>} - Returns the stored file path or identifier
   */
  upload: async (file) => {
    // With multer, the file is already saved to UPLOAD_DIR via the middleware.
    // In a cloud implementation, this method would read the buffer and upload to S3.
    // For now, just return the relative path.
    return `/uploads/${file.filename}`;
  },

  /**
   * Get the absolute path to a stored file (for downloading/sending)
   * @param {string} fileIdentifier - The path/identifier stored in DB
   * @returns {string} - Absolute path on disk (or signed URL for cloud)
   */
  get: (fileIdentifier) => {
    const filename = path.basename(fileIdentifier);
    return path.join(absoluteUploadDir, filename);
  },

  /**
   * Delete a file from storage
   * @param {string} fileIdentifier 
   */
  delete: async (fileIdentifier) => {
    try {
      const filePath = storageService.get(fileIdentifier);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.error(`Failed to delete file ${fileIdentifier}:`, err);
    }
  }
};

module.exports = storageService;
