const mongoose = require('mongoose');

// Durable copy of a lab-profile image (letterhead, footer, signature row,
// logo). The live server keeps uploads in a temporary folder that is wiped on
// restart, so the bytes live here and the file is restored when it is missing.
const LabAssetSchema = new mongoose.Schema({
  // Stored path, as saved on the lab profile: 'uploads/letterheads/x.png'.
  path: { type: String, required: true, unique: true },
  contentType: { type: String, default: 'application/octet-stream' },
  data: { type: Buffer, required: true }
}, { timestamps: true });

module.exports = mongoose.models.LabAsset || mongoose.model('LabAsset', LabAssetSchema);
