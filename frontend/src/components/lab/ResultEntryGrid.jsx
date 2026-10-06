import React, { forwardRef, useImperativeHandle, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button, DataTable, Input, Select } from '../common';
import { FLAG_STYLES, getRangeFlag } from './RangeFlagBadge';
import InterpretationText from './InterpretationText';
import DifferentialTotalRow from './DifferentialTotalRow';
import { differentialTotalsByRow } from '../../utils/differentialCount';
import {
  saveReportResults,
  saveReportResultsDraft,
  submitReportResults
} from '../../services/reportService';
import { buildCalculatedResults } from '../../utils/reportResults';
import { compileReportFormulas, calculateLocalResults } from '../../utils/localReportCalculations';
import '../../styles/ResultEntry.css';

/* Standalone result-entry grid with the SAME experience as lab/result-entry:
   auto-calculated (fx) tests update live as values are typed, range flags,
   reference ranges, interpretations, result options and draft/submit/save
   through the same report APIs.
   NOTE: ResultEntry.jsx keeps its own inline copy of this grid (do not
   refactor that page) — this component exists so the lab/reports popup
   offers the identical entry UI. */

const isReportFinal = (status) =>
  ['Reported', 'Signed', 'Verified', 'Completed'].includes(status);

/* Reference range display — backend-provided strings/numbers only, never computed here. */
const formatReferenceRange = (testEntry) => {
  if (testEntry.referenceRange) return testEntry.referenceRange;
  const parts = [];
  if (testEntry.maleReferenceRange) parts.push(`Male: ${testEntry.maleReferenceRange}`);
  if (testEntry.femaleReferenceRange) parts.push(`Female: ${testEntry.femaleReferenceRange}`);
  if (parts.length) return parts.join(' / ');
  // Fall back to the numeric normal bounds the API also provides (Phase 2).
  const { normalLow, normalHigh } = testEntry;
  if (normalLow != null && normalHigh != null) return `${normalLow} - ${normalHigh}`;
  if (normalLow != null) return `>= ${normalLow}`;
  if (normalHigh != null) return `<= ${normalHigh}`;
  return '—';
};

/* The same test can arrive twice (billed directly + inside a package). */
const dedupeTestEntries = (list) => {
  const seen = new Set();
  const out = [];
  (list || []).forEach((testEntry) => {
    const key = testEntry.resultKey || testEntry.testId || `name:${testEntry.testName}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(testEntry);
  });
  return out;
};

/* Payload mirrors the backend row builder: non-derived tests only,
   trimmed non-empty values, unit carried from the test master. */
const entryKey = (testEntry) =>
  testEntry?.resultKey || testEntry?.testId || `name:${testEntry?.testName || ''}`;

const buildResultsPayload = (testEntries, values) =>
  (testEntries || [])
    .filter((testEntry) => !testEntry.isDerived)
    .map((testEntry) => {
      const key = entryKey(testEntry);
      return {
        ...(testEntry.testId ? { test: testEntry.testId } : {}),
        ...(testEntry.parameterCode ? { parameterCode: testEntry.parameterCode } : {}),
        testName: testEntry.testName,
        value: String(values[key] ?? '').trim(),
        unit: testEntry.testId ? testEntry.unit || '' : testEntry.unit || testEntry.existingUnit || ''
      };
    })
    .filter((row) => row.value !== '');

/* Local API error mapper: surfaces only the backend's user-facing `message`
   field (never `errors.stack`), with sensible fallbacks per failure type. */
const getApiErrorMessage = (err, fallback) => {
  if (err?.response) {
    const data = err.response.data;
    if (data && typeof data.message === 'string' && data.message.trim()) {
      return data.message;
    }
    const status = err.response.status;
    if (status === 401) return 'Your session has expired. Please log in again.';
    if (status === 403) return 'You do not have permission to perform this action.';
    if (status === 404) return 'The requested record was not found.';
    if (status === 409) return 'The record was changed elsewhere. Please refresh and try again.';
    if (status === 422) return 'The submitted data is invalid.';
    if (status >= 500) return 'Server error. Please try again.';
    return fallback;
  }
  if (err?.code === 'ECONNABORTED') return 'The request timed out. Please try again.';
  if (err?.request) return 'Network error. Please check your connection and try again.';
  return err?.message || fallback;
};

const ACTION_DEFS = {
  draft: {
    label: 'Save Draft',
    variant: 'secondary',
    api: saveReportResultsDraft,
    emptyText: 'Enter a value for at least one test before saving.',
    failText: 'Failed to save draft. Please try again.'
  },
  submit: {
    label: 'Submit Result',
    variant: 'primary',
    api: submitReportResults,
    emptyText: 'Enter a value for at least one test before submitting.',
    failText: 'Failed to submit results. Please try again.'
  },
  save: {
    label: 'Save Results',
    variant: 'primary',
    api: saveReportResults,
    emptyText: 'Enter a value for at least one test before saving.',
    failText: 'Failed to save results. Please try again.'
  }
};

/**
 * @param entry getReportForEntry payload ({ testEntries, results, report, patient, bill })
 * @param reportId report _id the payload belongs to (parents pass key={reportId} to reset)
 * @param actions which save buttons to show — default ['save'] for the reports popup
 * @param readOnly terminal states render read-only with no actions
 * @param hideActions hide the in-grid buttons (parent triggers save via ref instead)
 * @param onBusyChange(busy:boolean) mirror loading state to a parent footer button
 * @param onSaved(updatedReport, mode) parent refreshes its copies/lists
 * Ref API: ref.current?.save(mode?) runs the save (defaults to actions[0]).
 */
const ResultEntryGrid = forwardRef(({
  entry,
  reportId,
  actions = ['save'],
  readOnly = false,
  hideActions = false,
  onBusyChange = null,
  onSaved = null
}, ref) => {
  const testEntries = useMemo(() => dedupeTestEntries(entry?.testEntries), [entry?.testEntries]);

  // Draft copy of values; the server stays the source of truth.
  const [values, setValues] = useState(() => {
    const initial = {};
    testEntries.forEach((testEntry) => {
      const key = entryKey(testEntry);
      initial[key] = testEntry.existingValue != null ? String(testEntry.existingValue) : '';
    });
    return initial;
  });
  const [customResultKeys, setCustomResultKeys] = useState({});
  const [busy, setBusy] = useState(null); // null | action mode
  const [feedback, setFeedback] = useState(null); // { type: 'error' | 'success', text }

  const compiledFormulas = useMemo(() => compileReportFormulas(testEntries), [testEntries]);
  const localResults = useMemo(() => calculateLocalResults(
    testEntries, compiledFormulas, values, entry?.patient
  ), [testEntries, compiledFormulas, values, entry?.patient]);
  // Submitted reports keep the saved results; editable reports calculate locally.
  const calculated = isReportFinal(entry?.report?.status)
    ? buildCalculatedResults(testEntries, entry?.results)
    : localResults.calculated;
  const calculationErrors = localResults.errors;
  const differentialTotals = differentialTotalsByRow(testEntries, values, calculated);

  const enterableCount = testEntries.filter((testEntry) => !testEntry.isDerived).length;
  const enteredCount = testEntries.filter(
    (testEntry) => !testEntry.isDerived && String(values[entryKey(testEntry)] ?? '').trim() !== ''
  ).length;

  const handleValueChange = (key, next) => {
    setValues((prev) => ({ ...prev, [key]: next }));
  };

  const handleAction = async (mode) => {
    const def = ACTION_DEFS[mode];
    if (!def || busy || !reportId || readOnly) return;
    const payload = buildResultsPayload(testEntries, values);
    if (payload.length === 0) {
      setFeedback({ type: 'error', text: def.emptyText });
      return;
    }
    setBusy(mode);
    onBusyChange?.(true);
    setFeedback(null);
    try {
      const res = await def.api(reportId, payload);
      setFeedback({ type: 'success', text: res?.message || `${def.label} successful.` });
      onSaved?.(res?.data, mode);
    } catch (err) {
      // Entered values are untouched — the user can correct and retry.
      setFeedback({ type: 'error', text: getApiErrorMessage(err, def.failText) });
    } finally {
      setBusy(null);
      onBusyChange?.(false);
    }
  };

  // Parent footer buttons trigger the single save through this handle.
  useImperativeHandle(ref, () => ({
    save: (mode) => handleAction(mode || actions[0])
  }));

  const renderTestRow = (testEntry, index) => {
    const isDerived = Boolean(testEntry.isDerived);
    const key = entryKey(testEntry);
    // Show the locally calculated value immediately (read-only).
    const calcRow = isDerived ? calculated[key] : null;
    const displayValue = isDerived ? calcRow?.value ?? '' : values[key] ?? '';
    const subLine = [testEntry.testCode, testEntry.packageName, testEntry.panelName, testEntry.formulaInput ? 'Formula input' : '']
      .filter(Boolean)
      .join(' · ');
    // Range flag lives INSIDE the single value control (one border total),
    // not as a separate pill above the input.
    const flag = getRangeFlag(displayValue, testEntry);
    const inputHelperText = isDerived
      ? calcRow
        ? 'Calculated automatically from entered results.'
        : calculationErrors[key] || 'Enter the required input results to calculate.'
      : testEntry.legacyScalar ? 'Previous entry retained. Use the separate parameter fields for new results.' : undefined;
    const showInput = isDerived || !testEntry.resultOptions?.length || customResultKeys[key] || (displayValue && !testEntry.resultOptions.includes(displayValue));
    // Interpretation gets its own full-width row (colSpan) so the text uses
    // the whole table width instead of squeezing into the TEST column.
    return (
      <React.Fragment key={key || index}>
      <tr>
        <td>
          <div className="re-test-name">{testEntry.testName || 'Test'}
            {isDerived && <span className="re-fx" title={testEntry.formula || 'Automatically calculated'} aria-label="Calculated test">fx</span>}
          </div>
          {subLine ? <div className="re-sub">{subLine}</div> : null}
        </td>
        <td className="re-result-cell">
          {!isDerived && testEntry.resultOptions?.length > 0 && <Select
            name={`result-option-${key}`} aria-label={`Result option for ${testEntry.testName || 'test'}`}
            value={customResultKeys[key] || (displayValue && !testEntry.resultOptions.includes(displayValue)) ? '__other__' : displayValue}
            options={[...testEntry.resultOptions.map((option) => ({ value: option, label: option })), { value: '__other__', label: 'Other / enter value' }]}
            placeholder="Select result (optional)"
            disabled={busy !== null || readOnly}
            onChange={(event) => {
              const next = event.target.value;
              setCustomResultKeys((prev) => ({ ...prev, [key]: next === '__other__' }));
              handleValueChange(key, next === '__other__' ? '' : next);
            }} />}
          {!isDerived && testEntry.sourceType === 'Document' ? (
            <>
              <textarea
                id={`result-${key}`} name={`result-${key}`} className="form-control re-document-result" rows={4}
                aria-label={`Result value for ${testEntry.testName || 'test'}`} placeholder="Enter report findings"
                value={displayValue} onChange={event => handleValueChange(key, event.target.value)}
                disabled={busy !== null || readOnly} />
              {flag ? <span className="re-flag-text" data-flag={flag}>{FLAG_STYLES[flag].label}</span> : null}
            </>
          ) : showInput ? (
            <>
              <div className="re-value-wrap">
                <Input
                  id={`result-${key}`}
                  name={`result-${key}`}
                  type="text"
                  aria-label={`Result value for ${testEntry.testName || 'test'}`}
                  placeholder={isDerived ? 'Calculated value' : 'Enter value'}
                  value={displayValue}
                  onChange={(event) => handleValueChange(key, event.target.value)}
                  disabled={isDerived || testEntry.legacyScalar || busy !== null || readOnly}
                  autoComplete="off"
                />
                {flag ? <span className="re-flag-inline" data-flag={flag}>{FLAG_STYLES[flag].label}</span> : null}
              </div>
              {inputHelperText ? <p className="form-helper">{inputHelperText}</p> : null}
            </>
          ) : null}
        </td>
        <td className="re-unit">{(testEntry.testId ? testEntry.unit : testEntry.unit || testEntry.existingUnit || calcRow?.unit) || '—'}</td>
        <td className="re-range">{formatReferenceRange(testEntry)}</td>
      </tr>
      <DifferentialTotalRow total={differentialTotals.get(key)} />
      {testEntry.interpretation ? (
        <tr className="re-interp-row">
          <td colSpan={4}>
            <InterpretationText text={testEntry.interpretation} />
          </td>
        </tr>
      ) : null}
      </React.Fragment>
    );
  };

  return (
    <section className="re-card re-grid-popup" aria-labelledby="re-results-heading">
      <div className="re-section-head">
        <h2 id="re-results-heading" className="re-card-title">
          Test Results
        </h2>
        <span className="re-count">
          {enterableCount > 0
            ? `${enteredCount} of ${enterableCount} entered`
            : `${testEntries.length} tests`}
        </span>
      </div>
      {feedback ? (
        <div
          className={`re-banner ${feedback.type === 'error' ? 're-banner-error' : 're-banner-success'}`}
          role={feedback.type === 'error' ? 'alert' : 'status'}
        >
          {feedback.type === 'error' ? <AlertTriangle size={16} aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}
          <span>{feedback.text}</span>
        </div>
      ) : null}
      {testEntries.length ? Object.entries(testEntries.reduce((groups, test) => {
        const group = test.panelName || test.packageName || test.parentName || test.categoryName || 'Tests';
        (groups[group] ||= []).push(test);
        return groups;
      }, Object.create(null))).map(([name, tests]) => <div key={name} className="re-test-group">
        <h3>{name}</h3>
        <DataTable headers={['Test', 'Value', 'Unit', 'Reference Range']} data={tests} renderRow={renderTestRow} />
      </div>) : <p className="re-sub">This case has no lab tests to report.</p>}
      {readOnly ? (
        <p className="re-sub" role="status">Results already submitted — no further action.</p>
      ) : !hideActions ? (
        <div className="re-actions">
          {actions.map((mode) => {
            const def = ACTION_DEFS[mode];
            if (!def) return null;
            return (
              <Button
                key={mode}
                variant={def.variant}
                onClick={() => handleAction(mode)}
                loading={busy === mode}
                disabled={busy !== null}
              >
                {def.label}
              </Button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
});

export default ResultEntryGrid;
