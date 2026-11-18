const path = require('path');

// The letterhead pad's built-in artwork, shown on the Report template page
// next to each image the lab can replace. Read-only, whitelisted names only.
const ART = {
  header: 'reference-header.png',
  footer: 'reference-footer.png',
  signatures: 'reference-signatures.png',
  watermark: 'reference-watermark.png'
};
const folder = path.join(__dirname, '../assets/document-formats');

exports.referenceArt = (req, res) => {
  const file = Object.prototype.hasOwnProperty.call(ART, req.params.name) ? ART[req.params.name] : null;
  if (!file) return res.status(404).json({ success: false, message: 'No such letterhead image.' });
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.type('image/png');
  return res.sendFile(path.join(folder, file));
};
