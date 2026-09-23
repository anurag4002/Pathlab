/**
 * Client-side image downscale (Phase 14: keep report PDFs light).
 * Large captures are resized so the longest edge <= maxDim and
 * re-encoded as JPEG. Returns the original file when no work is needed.
 */
export const compressImage = (file, { maxDim = 1600, quality = 0.82 } = {}) =>
  new Promise((resolve) => {
    try {
      if (!file || !file.type || !file.type.startsWith('image/')) return resolve(file);
      // Small files: skip the canvas round-trip entirely.
      if (file.size < 1024 * 1024) return resolve(file);

      const url = window.URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const longest = Math.max(img.naturalWidth, img.naturalHeight);
          if (longest <= maxDim) {
            window.URL.revokeObjectURL(url);
            return resolve(file);
          }
          const scale = maxDim / longest;
          const w = Math.round(img.naturalWidth * scale);
          const h = Math.round(img.naturalHeight * scale);
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          window.URL.revokeObjectURL(url);
          canvas.toBlob(
            (blob) => {
              if (!blob) return resolve(file);
              const name = (file.name || 'scan.jpg').replace(/\.[a-z0-9]+$/i, '') + '.jpg';
              resolve(new File([blob], name, { type: 'image/jpeg' }));
            },
            'image/jpeg',
            quality
          );
        } catch (e) {
          window.URL.revokeObjectURL(url);
          resolve(file);
        }
      };
      img.onerror = () => {
        window.URL.revokeObjectURL(url);
        resolve(file);
      };
      img.src = url;
    } catch (e) {
      resolve(file);
    }
  });

export default compressImage;
