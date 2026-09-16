// Code39 barcode — zero-dependency patterns + renderers.
// Used for bill numbers on print/PDF. Scanners read Code39 natively.
//
// Each char = 9 elements (bar/space alternating, starting with bar).
// 'n' = narrow (1 unit), 'w' = wide (3 units).

const PATTERNS = {
  '0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw', '3': 'wnwwnnnnn',
  '4': 'nnnwwnnnw', '5': 'wnnwwnnnn', '6': 'nnwwwnnnn', '7': 'nnnwnnwnw',
  '8': 'wnnwnnwnn', '9': 'nnwwnnwnn',
  'A': 'wnnnnwnnw', 'B': 'nnwnnwnnw', 'C': 'wnwnnwnnn', 'D': 'nnnnwwnnw',
  'E': 'wnnnwwnnn', 'F': 'nnwnwwnnn', 'G': 'nnnnnwwnw', 'H': 'wnnnnwwnn',
  'I': 'nnwnnwwnn', 'J': 'nnnnwwwnn', 'K': 'wnnnnnnww', 'L': 'nnwnnnnww',
  'M': 'wnwnnnnwn', 'N': 'nnnnwnnww', 'O': 'wnnnwnnwn', 'P': 'nnwnwnnwn',
  'Q': 'nnnnnnwww', 'R': 'wnnnnnwwn', 'S': 'nnwnnnwwn', 'T': 'nnnnwnwwn',
  'U': 'wwnnnnnnw', 'V': 'nwwnnnnnw', 'W': 'wwwnnnnnn', 'X': 'nwnnwnnnw',
  'Y': 'wwnnwnnnn', 'Z': 'nwwnwnnnn',
  '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn',
  '*': 'nwnnwnwnn', '$': 'nwnwnwnnn', '/': 'nwnwnnnwn',
  '+': 'nwnnnwnwn', '%': 'nnnwnwnwn'
};

function sanitize(text) {
  return String(text || '').toUpperCase().replace(/[^0-9A-Z \-\.\$\/\+\%]/g, '');
}

// Returns bars: [{ x, w }] in narrow-units + total width. Includes * start/stop.
function encode(text) {
  const clean = sanitize(text);
  const chars = `*${clean}*`;
  const bars = [];
  let x = 0;
  const push = (isBar, units) => {
    if (isBar) bars.push({ x, w: units });
    x += units;
  };
  chars.split('').forEach((ch, ci) => {
    const pat = PATTERNS[ch];
    if (!pat) return;
    for (let i = 0; i < 9; i++) {
      const units = pat[i] === 'w' ? 3 : 1;
      push(i % 2 === 0, units);
    }
    if (ci < chars.length - 1) x += 1; // inter-char narrow gap
  });
  return { bars, width: x, text: clean };
}

// Standalone SVG string for <img>/print use (no client lib needed).
function toSVG(text, { barHeight = 48, scale = 2 } = {}) {
  const { bars, width } = encode(text);
  const W = width * scale;
  const rects = bars.map((b) => `<rect x="${b.x * scale}" y="0" width="${b.w * scale}" height="${barHeight}" fill="#000"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${barHeight + 18}" viewBox="0 0 ${W} ${barHeight + 18}"><rect width="${W}" height="${barHeight + 18}" fill="#fff"/>${rects}<text x="${W / 2}" y="${barHeight + 14}" font-family="monospace" font-size="12" text-anchor="middle" fill="#000">${encode(text).text}</text></svg>`;
}

module.exports = { PATTERNS, sanitize, encode, toSVG };
