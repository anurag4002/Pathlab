import React, { useMemo } from 'react';

// Phase 6/16 — Auto TAT / Due Logic + TAT Configuration.
// Single timezone convention: lab local time (Asia/Kolkata) for all
// TAT computations and display. Thresholds come from TAT settings
// (localStorage, edited at /settings/tat) — never hardcoded here.

export const TAT_CONFIG_KEY = 'ppl.tatConfig';

export const DEFAULT_TAT_SETTINGS = {
  defaultTatHours: 24,
  emergencyTatHours: 4,
  dueSoonHours: 2,
  urgentHours: 4,
};

const toPositiveNumber = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export const loadTatSettings = () => {
  try {
    const raw = localStorage.getItem(TAT_CONFIG_KEY);
    if (!raw) return { ...DEFAULT_TAT_SETTINGS };
    const parsed = JSON.parse(raw);
    return {
      defaultTatHours: toPositiveNumber(parsed.defaultTatHours, DEFAULT_TAT_SETTINGS.defaultTatHours),
      emergencyTatHours: toPositiveNumber(parsed.emergencyTatHours, DEFAULT_TAT_SETTINGS.emergencyTatHours),
      dueSoonHours: toPositiveNumber(parsed.dueSoonHours, DEFAULT_TAT_SETTINGS.dueSoonHours),
      urgentHours: toPositiveNumber(parsed.urgentHours, DEFAULT_TAT_SETTINGS.urgentHours),
    };
  } catch {
    return { ...DEFAULT_TAT_SETTINGS };
  }
};

// Effective TAT hours for a report: per-report override first, then the
// linked test's configured TAT, then the lab default from settings.
// (Report/Test `tatHours` may be absent on older records — degrade to default.)
export const getReportTatHours = (report, settings = DEFAULT_TAT_SETTINGS) => {
  const s = settings || DEFAULT_TAT_SETTINGS;
  const candidates = [report?.tatHours, report?.test?.tatHours];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return toPositiveNumber(s.defaultTatHours, DEFAULT_TAT_SETTINGS.defaultTatHours);
};

// TAT clock starts at registration; fall back to createdAt/reportDate.
export const getTatStart = (report) => {
  const raw = report?.tat?.registered || report?.createdAt || report?.reportDate || null;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
};

const DONE_STATUSES = ['Signed', 'Completed'];

export const isDoneStatus = (status) => DONE_STATUSES.includes(status);

export const getTatInfo = (report, settings = DEFAULT_TAT_SETTINGS) => {
  const s = settings || DEFAULT_TAT_SETTINGS;
  const tatHours = getReportTatHours(report, s);
  const start = getTatStart(report);
  const due = start ? new Date(start.getTime() + tatHours * 3600 * 1000) : null;
  const remainingMs = due ? due.getTime() - Date.now() : null;
  let state = 'on-time';
  if (isDoneStatus(report?.status)) {
    state = 'done';
  } else if (remainingMs === null) {
    state = 'on-time';
  } else if (remainingMs <= 0) {
    state = 'overdue';
  } else if (remainingMs <= toPositiveNumber(s.dueSoonHours, DEFAULT_TAT_SETTINGS.dueSoonHours) * 3600 * 1000) {
    state = 'due-soon';
  }
  return { tatHours, start, due, remainingMs, state };
};

const formatDuration = (ms) => {
  const abs = Math.abs(ms);
  const totalMin = Math.floor(abs / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
};

const formatDueLabTime = (due) => {
  if (!due) return '';
  try {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(due);
  } catch {
    return due.toLocaleString();
  }
};

const STATE_STYLE = {
  'on-time': { background: '#e6f4ea', color: '#137333', label: 'On time' },
  'due-soon': { background: '#fef7e0', color: '#b06000', label: 'Due soon' },
  overdue: { background: '#fce8e6', color: '#a50e0e', label: 'Overdue' },
  done: { background: '#f1f3f4', color: '#5f6368', label: 'Done' },
};

export const DueBadge = ({ state }) => {
  const style = STATE_STYLE[state] || STATE_STYLE['on-time'];
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '999px',
        fontSize: '0.7rem',
        fontWeight: 700,
        background: style.background,
        color: style.color,
        whiteSpace: 'nowrap',
      }}
    >
      {style.label}
    </span>
  );
};

const TatCountdown = ({ report, settings }) => {
  const resolvedSettings = useMemo(() => settings || loadTatSettings(), [settings]);
  const info = useMemo(() => getTatInfo(report, resolvedSettings), [report, resolvedSettings]);

  if (!info.due) {
    return <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>No TAT data</span>;
  }

  const text =
    info.state === 'done'
      ? `Done • due was ${formatDueLabTime(info.due)}`
      : info.state === 'overdue'
        ? `Overdue by ${formatDuration(info.remainingMs)}`
        : `${formatDuration(info.remainingMs)} left`;

  return (
    <span
      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
      title={`Due ${formatDueLabTime(info.due)} (lab local time) • TAT ${info.tatHours}h`}
    >
      <DueBadge state={info.state} />
      <span style={{ fontSize: '0.78rem' }}>{text}</span>
    </span>
  );
};

export default TatCountdown;
