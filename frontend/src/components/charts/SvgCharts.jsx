import React, { useEffect, useMemo, useRef, useState } from 'react';
import './SvgCharts.css';

// Charts drawn at the card's real width (not a small fixed-size drawing
// stretched to fit), with thin marks, hairline grid, hover tooltips and a
// screen-reader table. Same exports and props as before.

// Reference categorical order (validated: CVD-safe, >= 3:1 on the surface).
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
const GRID = '#e8ebef';
const BASE = '#c9ced6';
const INK_MUTED = '#5b6472';
const FONT = 11;

const groupDigits = (v) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Number(v) || 0);
// Axis ticks: in full when the axis stays under 10,000; otherwise compact
// (K / L / Cr) for every tick of that axis - one style per axis.
const axisFormatter = (ticks) => {
  const top = Math.max(...ticks.map((t) => Math.abs(t)));
  if (top >= 1e7) return (v) => `${+(v / 1e7).toFixed(2)}Cr`;
  if (top >= 1e5) return (v) => `${+(v / 1e5).toFixed(1)}L`;
  if (top >= 1e4) return (v) => `${+(v / 1e3).toFixed(1)}K`;
  return groupDigits;
};

// Clean axis: 0 included, 4-5 round steps.
function niceScale(min, max) {
  const lo = Math.min(0, min), hi = Math.max(0, max);
  const span = hi - lo || Math.max(1, Math.abs(hi));
  const raw = span / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) || 10 * pow;
  const start = Math.floor(lo / step) * step;
  const end = Math.max(Math.ceil(hi / step) * step, start + step);
  const ticks = [];
  for (let t = start; t <= end + step / 2; t += step) ticks.push(Math.round(t * 1e6) / 1e6);
  return { min: start, max: end, ticks };
}

// Width of the card the chart sits in, kept current on resize.
function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const measure = () => setWidth(Math.floor(node.getBoundingClientRect().width));
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

const Empty = ({ height }) => (
  <div className="svg-chart svg-chart--empty" style={{ height }} role="img" aria-label="No chart data">No data for this period</div>
);

// Column with a 4px rounded data end and a square baseline end.
function columnPath(x, y0, y1, w) {
  const top = Math.min(y0, y1), bottom = Math.max(y0, y1), h = bottom - top;
  if (h <= 0) return '';
  const r = Math.min(4, w / 2, h);
  if (y1 <= y0) return `M${x},${bottom}V${top + r}Q${x},${top} ${x + r},${top}H${x + w - r}Q${x + w},${top} ${x + w},${top + r}V${bottom}Z`;
  return `M${x},${top}V${bottom - r}Q${x},${bottom} ${x + r},${bottom}H${x + w - r}Q${x + w},${bottom} ${x + w},${bottom - r}V${top}Z`;
}

/**
 * Shared frame: axes, grid, x labels (thinned so they never overlap), hover
 * band / crosshair, keyboard (← →) and the tooltip. `draw` renders the marks.
 */
function Frame({ labels, series, rows, height, formatValue, kind, draw, ariaLabel }) {
  const [ref, measured] = useWidth();
  const [active, setActive] = useState(null);
  const width = Math.max(240, measured || 600);
  const values = rows.flatMap((row) => series.map((s) => Number(row[s.key]) || 0));
  const scale = niceScale(Math.min(0, ...values), Math.max(0, ...values));
  const tickText = scale.ticks.map(axisFormatter(scale.ticks));
  const left = Math.max(28, 8 + Math.max(...tickText.map((t) => t.length)) * 6.6);
  const right = 12, top = 10, bottom = 24;
  const plotW = width - left - right, plotH = height - top - bottom;
  const n = labels.length;
  const slot = plotW / Math.max(1, n);
  const y = (v) => top + plotH * (1 - (v - scale.min) / (scale.max - scale.min || 1));
  const xCenter = (i) => (kind === 'line' ? (n < 2 ? left + plotW / 2 : left + (plotW * i) / (n - 1)) : left + slot * i + slot / 2);
  const longest = Math.max(...labels.map((l) => Math.min(14, String(l).length)));
  const every = Math.max(1, Math.ceil((longest * 6.2 + 10) / (kind === 'line' && n > 1 ? plotW / (n - 1) : slot)));
  // Every k-th label so they never overlap; the last one too when it has room.
  const showLabel = (i) => i % every === 0 || (i === n - 1 && (n - 1) % every >= Math.ceil(every / 2));
  const short = (l) => (String(l).length > 14 ? `${String(l).slice(0, 13)}…` : String(l));

  const pick = (clientX) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    const px = clientX - box.left;
    const i = kind === 'line' && n > 1 ? Math.round(((px - left) / plotW) * (n - 1)) : Math.floor((px - left) / slot);
    setActive(i >= 0 && i < n ? i : null);
  };
  const onKeyDown = (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    setActive((current) => {
      if (event.key === 'Home') return 0;
      if (event.key === 'End') return n - 1;
      const start = current ?? (event.key === 'ArrowRight' ? -1 : n);
      return Math.min(n - 1, Math.max(0, start + (event.key === 'ArrowRight' ? 1 : -1)));
    });
  };

  const tip = active != null ? (() => {
    const x = xCenter(active);
    const flip = x > width - 170;
    return (
      <div className="svg-chart-tip" style={{ left: flip ? undefined : x + 12, right: flip ? width - x + 12 : undefined, top: top }} role="status">
        <div className="svg-chart-tip-title">{labels[active]}</div>
        {series.map((s) => (
          <div key={s.key} className="svg-chart-tip-row">
            {series.length > 1 && <span className="svg-chart-swatch" style={{ background: s.color }} />}
            {series.length > 1 && <span className="svg-chart-tip-name">{s.label}</span>}
            <span className="svg-chart-tip-value">{formatValue(Number(rows[active][s.key]) || 0)}</span>
          </div>
        ))}
      </div>
    );
  })() : null;

  return (
    <div className="svg-chart" ref={ref}>
      {series.length > 1 && (
        <div className="svg-chart-legend">
          {series.map((s) => (
            <span key={s.key} className="svg-chart-legend-item"><span className="svg-chart-swatch" style={{ background: s.color }} />{s.label}</span>
          ))}
        </div>
      )}
      <div className="svg-chart-plot" tabIndex={0} aria-label={`${ariaLabel}. Use left and right arrow keys to read values.`}
        onMouseMove={(event) => pick(event.clientX)} onMouseLeave={() => setActive(null)} onKeyDown={onKeyDown} onBlur={() => setActive(null)}
        onTouchStart={(event) => pick(event.touches[0].clientX)}>
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
          {scale.ticks.map((t, i) => (
            <g key={t}>
              <line x1={left} x2={width - right} y1={y(t)} y2={y(t)} stroke={t === 0 ? BASE : GRID} strokeWidth="1" shapeRendering="crispEdges" />
              <text x={left - 8} y={y(t) + 4} fontSize={FONT} fill={INK_MUTED} textAnchor="end" className="svg-chart-num">{tickText[i]}</text>
            </g>
          ))}
          {kind !== 'line' && active != null && <rect x={left + slot * active} y={top} width={slot} height={plotH} fill="#0f172a" opacity="0.04" />}
          {kind === 'line' && active != null && <line x1={xCenter(active)} x2={xCenter(active)} y1={top} y2={top + plotH} stroke={BASE} strokeWidth="1" />}
          {draw({ y, xCenter, slot, left, plotW, active, zero: y(0) })}
          {labels.map((label, i) => (showLabel(i) ? (
            <text key={i} x={xCenter(i)} y={height - 7} fontSize={FONT} fill={active === i ? '#0f172a' : INK_MUTED} textAnchor={kind === 'line' && i === 0 && n > 1 ? 'start' : kind === 'line' && i === n - 1 && n > 1 ? 'end' : 'middle'}>{short(label)}</text>
          ) : null))}
        </svg>
        {tip}
      </div>
      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <thead><tr><th scope="col">Label</th>{series.map((s) => <th key={s.key} scope="col">{s.label}</th>)}</tr></thead>
        <tbody>{rows.map((row, i) => <tr key={i}><th scope="row">{labels[i]}</th>{series.map((s) => <td key={s.key}>{formatValue(Number(row[s.key]) || 0)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

/** Columns (one series): daily income, tests per category ... */
export const SvgBars = ({ data = [], height = 200, color = SERIES[0], formatValue = groupDigits, label = 'Bar chart' }) => {
  const rows = useMemo(() => data.map((d) => ({ v: Number(d.value) || 0 })), [data]);
  if (!data.length) return <Empty height={height} />;
  const series = [{ key: 'v', label, color }];
  const peak = rows.reduce((best, row, i) => (row.v > rows[best].v ? i : best), 0);
  return (
    <Frame kind="bars" labels={data.map((d) => d.label)} series={series} rows={rows} height={height} formatValue={formatValue} ariaLabel={label}
      draw={({ y, xCenter, slot, active, zero }) => {
        const w = Math.max(3, Math.min(24, slot * 0.62));
        return rows.map((row, i) => (
          <g key={i}>
            <path d={columnPath(xCenter(i) - w / 2, zero, y(row.v), w)} fill={color} opacity={active == null || active === i ? 1 : 0.55} />
            {/* Only the highest value is labelled; the rest are on hover. */}
            {i === peak && row.v > 0 && active == null && (
              <text x={xCenter(i)} y={y(row.v) - 5} fontSize={FONT} fontWeight="600" fill="#1f2937" textAnchor="middle" className="svg-chart-num">{formatValue(row.v)}</text>
            )}
          </g>
        ));
      }} />
  );
};

/** Trend line with a light area wash. */
export const SvgLine = ({ data = [], height = 200, color = SERIES[0], formatValue = groupDigits, label = 'Trend' }) => {
  const rows = useMemo(() => data.map((d) => ({ v: Number(d.value) || 0 })), [data]);
  if (!data.length) return <Empty height={height} />;
  const series = [{ key: 'v', label, color }];
  return (
    <Frame kind="line" labels={data.map((d) => d.label)} series={series} rows={rows} height={height} formatValue={formatValue} ariaLabel={label}
      draw={({ y, xCenter, active, zero }) => {
        const pts = rows.map((row, i) => [xCenter(i), y(row.v)]);
        const line = pts.map(([x, py], i) => `${i ? 'L' : 'M'}${x},${py}`).join('');
        const area = pts.length > 1 ? `${line}L${pts.at(-1)[0]},${zero}L${pts[0][0]},${zero}Z` : '';
        const last = pts.length - 1;
        const shown = active ?? last;
        return (
          <g>
            {area && <path d={area} fill={color} opacity="0.1" />}
            {pts.length > 1 && <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
            <circle cx={pts[shown][0]} cy={pts[shown][1]} r="4.5" fill={color} stroke="#fff" strokeWidth="2" />
            {active == null && (
              <text x={pts[last][0] - (pts.length > 1 ? 6 : 0)} y={pts[last][1] - 9} fontSize={FONT} fontWeight="600" fill="#1f2937" textAnchor={pts.length > 1 ? 'end' : 'middle'} className="svg-chart-num">{formatValue(rows[last].v)}</text>
            )}
          </g>
        );
      }} />
  );
};

/**
 * Grouped columns - e.g. Income vs Net per day.
 * series: [{ key, label, color }]; data: [{ label, [key]: number }]
 */
export const SvgGroupedBars = ({ data = [], series = [], height = 200, formatValue = groupDigits, label = 'Grouped bar chart' }) => {
  if (!data.length || !series.length) return <Empty height={height} />;
  const coloured = series.map((s, i) => ({ ...s, color: s.color && !/var\(--color-(success|danger|warning)/.test(s.color) ? s.color : SERIES[i % SERIES.length] }));
  return (
    <Frame kind="bars" labels={data.map((d) => d.label)} series={coloured} rows={data} height={height} formatValue={formatValue} ariaLabel={label}
      draw={({ y, xCenter, slot, active, zero }) => {
        const gap = 2;
        const w = Math.max(3, Math.min(20, (slot * 0.7 - gap * (coloured.length - 1)) / coloured.length));
        const groupW = w * coloured.length + gap * (coloured.length - 1);
        return data.map((row, i) => coloured.map((s, si) => {
          const x = xCenter(i) - groupW / 2 + si * (w + gap);
          return <path key={`${i}-${s.key}`} d={columnPath(x, zero, y(Number(row[s.key]) || 0), w)} fill={s.color} opacity={active == null || active === i ? 1 : 0.55} />;
        }));
      }} />
  );
};

/** Horizontal ranking bars (payment modes, categories): label, value, thin bar. */
export const SvgHBars = ({ data = [], height, color = SERIES[0], formatValue = groupDigits }) => {
  const rows = data.slice(0, 12);
  const max = Math.max(1, ...rows.map((d) => Number(d.value) || 0));
  const total = rows.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
  if (!rows.length) return <Empty height={height || 120} />;
  return (
    <div className="svg-chart svg-chart--hbars" style={height ? { minHeight: height } : undefined}>
      {rows.map((d, i) => {
        const v = Number(d.value) || 0;
        return (
          <div key={i} className="svg-hbar-row" title={`${d.label}: ${formatValue(v)}${total ? ` (${Math.round((v / total) * 100)}%)` : ''}`}>
            <div className="svg-hbar-meta">
              <span className="svg-hbar-label">{d.label}</span>
              <span className="svg-hbar-value">
                {formatValue(v)}
                {rows.length > 1 && total > 0 && <span className="svg-hbar-share">{Math.round((v / total) * 100)}%</span>}
              </span>
            </div>
            <div className="svg-hbar-track" aria-hidden="true">
              <div className="svg-hbar-fill" style={{ width: `${(v / max) * 100}%`, background: color, animationDelay: `${i * 30}ms` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SvgBars;
