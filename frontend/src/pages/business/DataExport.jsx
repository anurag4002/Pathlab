import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  downloadServerCsv,
  fetchExportPreviewCount,
  EXPORT_DATASETS
} from '../../services/exportService';
import useAuth from '../../hooks/useAuth';
import { isAdmin } from '../../utils/permissions';
import normalizePermissions from '../../components/common/PermissionMatrix/normalizePermissions';
import {
  AlertTriangle,
  Download,
  FileSpreadsheet,
  RefreshCw,
  Server
} from 'lucide-react';
import {
  PageHeader,
  Button,
  Select,
  DatePicker,
  DataTable
} from '../../components/common';

const PRESETS = ['Today', 'Last 31d', 'Last 365d', 'Custom'];

const DATASET_META = {
  bills: {
    label: 'Bills',
    hint: 'Billing ledger including patient, totals, payments and void flags.'
  },
  patients: {
    label: 'Patients',
    hint: 'Patient registry with demographics and contact lines.'
  },
  expenses: {
    label: 'Expenses',
    hint: 'Operating expense vouchers with category and method.'
  },
  transactions: {
    label: 'Transactions',
    hint: 'Cash-book transactions with type, method and receiver.'
  }
};

const toDateInputValue = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getLocalDate = (date = new Date()) => toDateInputValue(date);

const shiftDate = (date, days) => {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + days);
  return shifted;
};

const getPresetRange = (preset, customRange) => {
  const today = new Date();
  if (preset === 'Today') {
    const value = getLocalDate(today);
    return { startDate: value, endDate: value };
  }
  if (preset === 'Last 31d') {
    return {
      startDate: getLocalDate(shiftDate(today, -30)),
      endDate: getLocalDate(today)
    };
  }
  if (preset === 'Last 365d') {
    return {
      startDate: getLocalDate(shiftDate(today, -364)),
      endDate: getLocalDate(today)
    };
  }
  return {
    startDate: customRange.startDate,
    endDate: customRange.endDate
  };
};

const validateRange = ({ startDate, endDate }) => {
  if (!startDate || !endDate) return 'Choose both a start date and an end date.';
  if (startDate > endDate) return 'The end date must be on or after the start date.';
  return '';
};

const getErrorMessage = (error, fallback) => {
  if (typeof error?.message === 'string' && error.message.trim()) return error.message;
  const status = error?.status || error?.response?.status;
  if (status === 400) return 'The export request is invalid.';
  if (status === 401) return 'Your session has expired. Please log in again.';
  if (status === 403) return 'You do not have permission to export this data.';
  if (status === 404) return 'The requested export resource was not found.';
  if (status === 409) return 'The export data changed elsewhere. Please try again.';
  if (status === 413) return 'The export file is too large.';
  if (status === 422) return 'The selected export range is invalid.';
  if (status === 429) return 'The export request limit was reached. Please try again later.';
  if (status >= 500) return 'The server could not complete the export.';
  if (error?.code === 'ECONNABORTED') return 'The export request timed out. Please try again.';
  if (error?.request) return 'Network error. Please check your connection and try again.';
  return fallback;
};

const canUseFinanceExport = (user) => {
  if (isAdmin(user)) return true;
  if (!user) return false;

  // An empty legacy permission map retains the backend's allow behavior; an
  // explicit matrix must grant the finance capability.
  const permissions = normalizePermissions(user.permissions);
  if (Object.keys(permissions).length === 0) return true;
  return permissions.finance === true;
};

const DataExport = () => {
  const { user } = useAuth();
  const canExport = canUseFinanceExport(user);
  const [preset, setPreset] = useState('Last 31d');
  const [customStart, setCustomStart] = useState(() => getLocalDate());
  const [customEnd, setCustomEnd] = useState(() => getLocalDate());
  const [counts, setCounts] = useState({});
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [activeDataset, setActiveDataset] = useState('');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [lastResult, setLastResult] = useState(null);
  const exportInFlightRef = useRef(false);

  const range = getPresetRange(preset, { startDate: customStart, endDate: customEnd });
  const rangeStart = range.startDate;
  const rangeEnd = range.endDate;
  const rangeError = validateRange(range);

  const loadPreviewCounts = useCallback(async () => {
    if (!canExport) {
      setCounts({});
      return;
    }
    if (rangeError) {
      setCounts({});
      setPreviewError('');
      return;
    }

    setPreviewLoading(true);
    setPreviewError('');
    try {
      const entries = await Promise.all(
        EXPORT_DATASETS.map(async (dataset) => {
          try {
            return [dataset, await fetchExportPreviewCount(dataset, { startDate: rangeStart, endDate: rangeEnd })];
          } catch {
            return [dataset, null];
          }
        })
      );
      setCounts(Object.fromEntries(entries));
    } catch (requestError) {
      setPreviewError(getErrorMessage(requestError, 'Failed to preview export sizes.'));
    } finally {
      setPreviewLoading(false);
    }
  }, [canExport, rangeStart, rangeEnd, rangeError]);

  useEffect(() => {
    loadPreviewCounts();
  }, [loadPreviewCounts]);

  const handleDownload = async (dataset) => {
    if (!canExport || rangeError || exportInFlightRef.current) return;

    exportInFlightRef.current = true;
    setActiveDataset(dataset);
    setProgress(`Preparing ${DATASET_META[dataset].label} CSV…`);
    setError('');
    setLastResult(null);
    try {
      const result = await downloadServerCsv(dataset, range);
      setLastResult({ dataset, ...result });
      setProgress('');
    } catch (requestError) {
      setError(getErrorMessage(requestError, `Export of ${dataset} failed.`));
      setProgress('');
    } finally {
      exportInFlightRef.current = false;
      setActiveDataset('');
    }
  };

  if (!canExport) {
    return (
      <div className="data-export-page">
        <PageHeader
          title="Data Export"
          subtitle="Download API-backed operational, patient, billing, and business data as CSV files."
        />
        <div className="card" role="note" style={{ color: 'var(--color-text-muted)' }}>
          Your current account does not have access to the finance export capability.
        </div>
      </div>
    );
  }

  return (
    <div className="data-export-page">
      <PageHeader
        title="Clinical Data Export Center"
        subtitle="Pick a dataset and date window, check the preview count, then download the server CSV"
      />

      <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <Select
          name="preset"
          label="Date window"
          value={preset}
          onChange={(event) => {
            setPreset(event.target.value);
            setError('');
            setLastResult(null);
          }}
          options={PRESETS.map((value) => ({ value, label: value }))}
          placeholder=""
          style={{ minWidth: '160px' }}
        />
        {preset === 'Custom' && (
          <>
            <DatePicker
              name="export-start-date"
              label="From"
              value={customStart}
              onChange={(event) => setCustomStart(event.target.value)}
              error={rangeError || undefined}
              required
            />
            <DatePicker
              name="export-end-date"
              label="To"
              value={customEnd}
              onChange={(event) => setCustomEnd(event.target.value)}
              error={rangeError || undefined}
              required
            />
          </>
        )}
        <Button
          variant="secondary"
          size="sm"
          onClick={loadPreviewCounts}
          loading={previewLoading}
          disabled={Boolean(rangeError)}
        >
          <RefreshCw size={14} /> Refresh preview
        </Button>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Window: {range.startDate || '—'} → {range.endDate || '—'}
        </span>
      </div>

      {rangeError && (
        <div className="card" style={{ borderLeft: '4px solid var(--color-danger, #dc2626)', marginBottom: '1rem', fontSize: '0.85rem' }}>
          <AlertTriangle size={14} /> {rangeError}
        </div>
      )}
      {previewError && (
        <div className="card" style={{ borderLeft: '4px solid var(--color-danger, #dc2626)', marginBottom: '1rem', fontSize: '0.85rem' }} role="alert">
          {previewError}
        </div>
      )}
      {(progress || error || lastResult) && (
        <div className="card" style={{ marginBottom: '1rem', fontSize: '0.85rem' }} role="status">
          {progress && <div>Generating… {progress}</div>}
          {error && <div style={{ color: 'var(--color-danger, #dc2626)' }}>Error: {error}</div>}
          {lastResult && (
            <div style={{ color: 'var(--color-success, #16a34a)' }}>
              Downloaded {lastResult.filename} ({lastResult.source === 'client-fallback' ? 'built client-side from JSON fallback' : 'server CSV'}
              {typeof lastResult.rows === 'number' ? `, ${lastResult.rows} rows` : ''}).
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {EXPORT_DATASETS.map((dataset) => (
          <div key={dataset} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', justifyContent: 'space-between' }}>
            <div>
              <div style={{ color: 'var(--primary-color)', marginBottom: '8px' }}><FileSpreadsheet size={32} /></div>
              <h4 style={{ fontWeight: '700', fontSize: '1rem', marginBottom: '4px' }}>{DATASET_META[dataset].label}</h4>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>{DATASET_META[dataset].hint}</p>
              <p style={{ fontSize: '0.8rem', marginTop: '8px' }}>
                Preview rows:{' '}
                <strong>{previewLoading ? '…' : counts[dataset] == null ? 'unavailable' : counts[dataset]}</strong>
              </p>
            </div>
            <Button
              variant="primary"
              onClick={() => handleDownload(dataset)}
              loading={activeDataset === dataset}
              disabled={Boolean(rangeError) || Boolean(activeDataset)}
            >
              <Download size={16} /> Export {DATASET_META[dataset].label} (CSV)
            </Button>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
          <Server size={24} color="var(--color-primary)" aria-hidden="true" />
          <div>
            <h4 style={{ fontWeight: '700', fontSize: '0.95rem', margin: 0 }}>Server export notes</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              CSV values and row selection remain server-owned. The endpoint is capped at 5,000 rows per request; search and page filters are intentionally not sent to it.
            </p>
          </div>
        </div>
      </div>

      <div className="card">
        <h4 style={{ fontWeight: '700', fontSize: '0.95rem', marginBottom: '0.5rem' }}>Export summary</h4>
        <DataTable
          headers={['Dataset', 'Preview rows', 'Action']}
          data={EXPORT_DATASETS.map((dataset) => ({ dataset }))}
          emptyMessage="No datasets configured."
          renderRow={({ dataset }) => (
            <tr key={dataset}>
              <td style={{ fontWeight: '600' }}>{DATASET_META[dataset].label}</td>
              <td>{previewLoading ? '…' : counts[dataset] ?? 'unavailable'}</td>
              <td>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleDownload(dataset)}
                  loading={activeDataset === dataset}
                  disabled={Boolean(rangeError) || Boolean(activeDataset)}
                >
                  <Download size={14} /> Download
                </Button>
              </td>
            </tr>
          )}
        />
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
          Large windows download as CSV (up to 5,000 rows per dataset). Export history is not available.
        </p>
      </div>
    </div>
  );
};

export default DataExport;
