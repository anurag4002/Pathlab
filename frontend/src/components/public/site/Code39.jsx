import React from 'react';

// A real Code 39 barcode (the symbology on the lab's sample labels), drawn
// as SVG. Each character is 9 elements - bar, space, bar... - 3 of them wide.
const PATTERNS = {
  0: 'nnnwwnwnn', 1: 'wnnwnnnnw', 2: 'nnwwnnnnw', 3: 'wnwwnnnnn', 4: 'nnnwwnnnw',
  5: 'wnnwwnnnn', 6: 'nnwwwnnnn', 7: 'nnnwnnwnw', 8: 'wnnwnnwnn', 9: 'nnwwnnwnn', '*': 'nwnnwnwnn',
};

export default function Code39({ value = '', height = 44, narrow = 2, wide = 5, className = '' }) {
  const text = `*${String(value).replace(/\D/g, '')}*`;
  const bars = [];
  let x = 0;
  for (const ch of text) {
    const pattern = PATTERNS[ch];
    if (!pattern) continue;
    [...pattern].forEach((p, i) => {
      const w = p === 'w' ? wide : narrow;
      if (i % 2 === 0) bars.push(<rect key={`${x}`} x={x} y={0} width={w} height={height} />);
      x += w;
    });
    x += narrow; // gap between characters
  }
  return (
    <svg className={className} viewBox={`0 0 ${Math.max(x, 1)} ${height}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
      {bars}
    </svg>
  );
}
