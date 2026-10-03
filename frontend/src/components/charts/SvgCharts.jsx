import React, { useId } from 'react';
import './SvgCharts.css';

const AXIS = 'var(--color-border, #e2e8f0)';
const MUTED = 'var(--color-text-muted, #64748b)';
const BAR = 'var(--color-primary, #2563eb)';
const LINE = 'var(--color-success, #16a34a)';

const formatTick = (n) => {
  const v = Number(n) || 0;
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  if (abs >= 100) return String(Math.round(v));
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(1);
};

const sizeBox = (n, h, leftPad = 40) => ({
  w: Math.max(160, leftPad + 12 + Math.max(1, n) * 48),
  h: h || 200,
  left: leftPad
});

const niceMax = (raw) => {
  const m = Math.max(1, Number(raw) || 0);
  const pow = 10 ** Math.floor(Math.log10(m));
  const n = m / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
};

/** Horizontal bar / category ranking chart */
export const SvgBars = ({
  data = [],
  height = 200,
  color = BAR,
  showValues = true,
  formatValue = formatTick
}) => {
  const gid = useId().replace(/:/g, '');
  const left = 42;
  const { w, h } = sizeBox(data.length, height, left);
  const max = niceMax(Math.max(...data.map((d) => Number(d.value) || 0), 0));
  const chartH = h - 36;
  const chartTop = 12;
  const iw = w - left - 8;
  const slot = data.length ? iw / data.length : iw;
  const bw = Math.min(36, Math.max(10, slot * 0.58));

  const ticks = [0, 0.25, 0.5, 0.75, 1];

  if (!data.length) {
    return (
      <div className="svg-chart svg-chart--empty" style={{ height }} role="img" aria-label="No chart data">
        No data
      </div>
    );
  }

  return (
    <div className="svg-chart">
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img" aria-label="Bar chart">
        <defs>
          <linearGradient id={`barGrad-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.95" />
            <stop offset="100%" stopColor={color} stopOpacity="0.55" />
          </linearGradient>
        </defs>
        {ticks.map((f) => {
          const y = chartTop + chartH * (1 - f);
          return (
            <g key={f}>
              <line x1={left} x2={w - 4} y1={y} y2={y} stroke={AXIS} strokeWidth="1" strokeDasharray={f === 0 ? undefined : '3 3'} />
              <text x={left - 6} y={y + 3} fontSize="9" fill={MUTED} textAnchor="end">{formatTick(max * f)}</text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const v = Number(d.value) || 0;
          const bh = Math.max(v > 0 ? 3 : 0, (chartH * v) / max);
          const x = left + slot * i + (slot - bw) / 2;
          const y = chartTop + chartH - bh;
          return (
            <g key={i} className="svg-chart-bar">
              <title>{`${d.label}: ${v}`}</title>
              <rect
                x={x}
                y={y}
                width={bw}
                height={bh}
                rx="4"
                fill={`url(#barGrad-${gid})`}
                opacity={v > 0 ? 1 : 0.2}
              />
              {showValues && v > 0 && bh > 18 ? (
                <text x={x + bw / 2} y={y - 4} fontSize="9" fontWeight="600" fill={MUTED} textAnchor="middle">
                  {formatValue(v)}
                </text>
              ) : null}
              <text x={x + bw / 2} y={h - 8} fontSize="9" fill={MUTED} textAnchor="middle">
                {String(d.label || '').slice(0, 8)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

/** Area + line trend chart */
export const SvgLine = ({
  data = [],
  height = 200,
  color = LINE,
  formatValue = formatTick
}) => {
  const gid = useId().replace(/:/g, '');
  const left = 42;
  const { w, h } = sizeBox(Math.max(data.length, 2), height, left);
  const values = data.map((d) => Number(d.value) || 0);
  const max = niceMax(Math.max(...values, 0));
  const min = Math.min(0, ...values);
  const chartH = h - 36;
  const chartTop = 12;
  const right = 8;

  if (!data.length) {
    return (
      <div className="svg-chart svg-chart--empty" style={{ height }} role="img" aria-label="No chart data">
        No data
      </div>
    );
  }

  const px = (i) => {
    if (data.length < 2) return left + (w - left - right) / 2;
    return left + ((w - left - right) * i) / (data.length - 1);
  };
  const py = (v) => chartTop + chartH * (1 - (v - min) / (max - min || 1));
  const points = data.map((d, i) => ({
    x: px(i),
    y: py(Number(d.value) || 0),
    label: d.label,
    value: Number(d.value) || 0
  }));
  const linePts = points.map((p) => `${p.x},${p.y}`).join(' ');
  const areaPts = points.length
    ? `${points[0].x},${chartTop + chartH} ${linePts} ${points[points.length - 1].x},${chartTop + chartH}`
    : '';

  return (
    <div className="svg-chart">
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img" aria-label="Line chart">
        <defs>
          <linearGradient id={`areaGrad-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const y = chartTop + chartH * (1 - f);
          return (
            <g key={f}>
              <line x1={left} x2={w - right} y1={y} y2={y} stroke={AXIS} strokeWidth="1" strokeDasharray={f === 0 ? undefined : '3 3'} />
              <text x={left - 6} y={y + 3} fontSize="9" fill={MUTED} textAnchor="end">
                {formatValue(min + (max - min) * f)}
              </text>
            </g>
          );
        })}
        {areaPts ? <polygon points={areaPts} fill={`url(#areaGrad-${gid})`} className="svg-chart-area" /> : null}
        {linePts ? (
          <polyline
            points={linePts}
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            className="svg-chart-line"
          />
        ) : null}
        {points.map((p, i) => (
          <g key={i} className="svg-chart-point">
            <title>{`${p.label}: ${p.value}`}</title>
            <circle cx={p.x} cy={p.y} r="4.5" fill="var(--color-surface, #fff)" stroke={color} strokeWidth="2" />
            <text x={p.x} y={h - 8} fontSize="9" fill={MUTED} textAnchor="middle">
              {String(p.label || '').slice(0, 8)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};

/**
 * Grouped bars — e.g. Income vs Net per day.
 * series: [{ key, label, color }]
 * data: [{ label, [key]: number, ... }]
 */
export const SvgGroupedBars = ({
  data = [],
  series = [],
  height = 200,
  formatValue = formatTick
}) => {
  const left = 42;
  const { w, h } = sizeBox(data.length, height, left);
  const keys = series.map((s) => s.key);
  const max = niceMax(
    Math.max(
      0,
      ...data.flatMap((d) => keys.map((k) => Number(d[k]) || 0))
    )
  );
  const chartH = h - 36;
  const chartTop = 12;
  const iw = w - left - 8;
  const slot = data.length ? iw / data.length : iw;
  const groupW = Math.min(40, slot * 0.7);
  const barW = Math.max(6, (groupW / Math.max(1, series.length)) - 2);

  if (!data.length || !series.length) {
    return (
      <div className="svg-chart svg-chart--empty" style={{ height }} role="img" aria-label="No chart data">
        No data
      </div>
    );
  }

  return (
    <div className="svg-chart">
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img" aria-label="Grouped bar chart">
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const y = chartTop + chartH * (1 - f);
          return (
            <g key={f}>
              <line x1={left} x2={w - 4} y1={y} y2={y} stroke={AXIS} strokeWidth="1" strokeDasharray={f === 0 ? undefined : '3 3'} />
              <text x={left - 6} y={y + 3} fontSize="9" fill={MUTED} textAnchor="end">{formatTick(max * f)}</text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const gx = left + slot * i + (slot - groupW) / 2;
          return (
            <g key={i}>
              {series.map((s, si) => {
                const v = Number(d[s.key]) || 0;
                const bh = Math.max(v > 0 ? 3 : 0, (chartH * v) / max);
                const x = gx + si * (barW + 2);
                const y = chartTop + chartH - bh;
                return (
                  <g key={s.key} className="svg-chart-bar">
                    <title>{`${d.label} ${s.label}: ${v}`}</title>
                    <rect x={x} y={y} width={barW} height={bh} rx="3" fill={s.color || BAR} opacity={v > 0 ? 0.9 : 0.2} />
                  </g>
                );
              })}
              <text x={gx + groupW / 2} y={h - 8} fontSize="9" fill={MUTED} textAnchor="middle">
                {String(d.label || '').slice(0, 8)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="svg-chart-legend">
        {series.map((s) => (
          <span key={s.key} className="svg-chart-legend-item">
            <span className="svg-chart-legend-swatch" style={{ background: s.color || BAR }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
};

/** Horizontal ranking bars (good for category / payment-mode splits) */
export const SvgHBars = ({
  data = [],
  height,
  color = BAR,
  formatValue = formatTick
}) => {
  const rows = data.slice(0, 12);
  const max = Math.max(1, ...rows.map((d) => Number(d.value) || 0));
  const rowH = 28;
  const h = height || Math.max(120, rows.length * rowH + 8);

  if (!rows.length) {
    return (
      <div className="svg-chart svg-chart--empty" style={{ height: h }} role="img" aria-label="No chart data">
        No data
      </div>
    );
  }

  return (
    <div className="svg-chart svg-chart--hbars" style={{ minHeight: h }}>
      {rows.map((d, i) => {
        const v = Number(d.value) || 0;
        const pct = Math.round((v / max) * 100);
        return (
          <div key={i} className="svg-hbar-row">
            <div className="svg-hbar-meta">
              <span className="svg-hbar-label" title={d.label}>{d.label}</span>
              <span className="svg-hbar-value">{formatValue(v)}</span>
            </div>
            <div className="svg-hbar-track" aria-hidden="true">
              <div
                className="svg-hbar-fill"
                style={{ width: `${pct}%`, background: color, animationDelay: `${i * 40}ms` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SvgBars;
