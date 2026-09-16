import React from 'react';

const PAD = 28;
const AXIS = '#e2e8f0';
const BAR = '#2563eb';
const LINE = '#16a34a';

const sizeBox = (n, h) => ({ w: Math.max(120, n * 44), h: h || 180 });

export const SvgBars = ({ data = [], height = 180, color = BAR }) => {
  const { w, h } = sizeBox(data.length, height);
  const max = Math.max(1, ...data.map((d) => Number(d.value) || 0));
  const iw = w - PAD;
  const bw = data.length ? Math.min(34, (iw / data.length) * 0.55) : 0;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line key={f} x1={PAD} x2={w} y1={h - 22 - (h - 40) * f} y2={h - 22 - (h - 40) * f} stroke={AXIS} strokeWidth="1" />
      ))}
      {data.map((d, i) => {
        const v = Number(d.value) || 0;
        const bh = Math.max(2, ((h - 40) * v) / max);
        const x = PAD + (iw / data.length) * i + (iw / data.length - bw) / 2;
        return (
          <g key={i}>
            <title>{`${d.label}: ${v}`}</title>
            <rect x={x} y={h - 22 - bh} width={bw} height={bh} rx="3" fill={color} opacity={v > 0 ? 1 : 0.25} />
            <text x={x + bw / 2} y={h - 8} fontSize="9" fill="#64748b" textAnchor="middle">{String(d.label).slice(0, 8)}</text>
          </g>
        );
      })}
    </svg>
  );
};

export const SvgLine = ({ data = [], height = 180, color = LINE }) => {
  const { w, h } = sizeBox(data.length, height);
  const max = Math.max(1, ...data.map((d) => Number(d.value) || 0));
  const min = Math.min(0, ...data.map((d) => Number(d.value) || 0));
  const px = (i) => (data.length < 2 ? w / 2 : PAD + ((w - PAD - 12) * i) / (data.length - 1));
  const py = (v) => 10 + (h - 40) * (1 - (v - min) / (max - min || 1));
  const pts = data.map((d, i) => `${px(i)},${py(Number(d.value) || 0)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line key={f} x1={PAD} x2={w} y1={10 + (h - 40) * (1 - f)} y2={10 + (h - 40) * (1 - f)} stroke={AXIS} strokeWidth="1" />
      ))}
      {pts && <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
      {data.map((d, i) => (
        <g key={i}>
          <title>{`${d.label}: ${d.value}`}</title>
          <circle cx={px(i)} cy={py(Number(d.value) || 0)} r="3.5" fill={color} />
          <text x={px(i)} y={h - 8} fontSize="9" fill="#64748b" textAnchor="middle">{String(d.label).slice(0, 8)}</text>
        </g>
      ))}
    </svg>
  );
};

export default SvgBars;
