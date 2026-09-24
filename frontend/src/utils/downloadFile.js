const sanitizeFilename = (filename, fallback = 'download') => {
  const value = typeof filename === 'string' ? filename.trim() : '';
  if (!value) return fallback;
  const withoutPathCharacters = value.replace(/[\\/:*?"<>|]/g, '_');
  return Array.from(withoutPathCharacters)
    .map((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127 ? '_' : character;
    })
    .join('');
};

/**
 * Save an already-fetched Blob without exposing its source URL to an anchor.
 * The delayed revoke keeps the object URL alive long enough for browsers that
 * process the synthetic click asynchronously.
 */
export const downloadBlob = (blob, filename = 'download') => {
  if (!(blob instanceof Blob) || blob.size === 0) {
    throw new Error('The requested file is empty or unavailable.');
  }

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeFilename = sanitizeFilename(filename);
  link.href = url;
  link.download = safeFilename;
  link.rel = 'noreferrer';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
  return safeFilename;
};

const downloadFile = (fileUrl, filename) => {
  if (!fileUrl) return false;

  const link = document.createElement('a');
  link.href = fileUrl;
  link.setAttribute('download', sanitizeFilename(filename));
  link.target = '_blank';
  link.rel = 'noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  return true;
};

export default downloadFile;
