import React, { useRef, useState } from 'react';
import { Download, FileSpreadsheet, Server } from 'lucide-react';
import { downloadServerCsv } from '../../services/exportService';
import useAuth from '../../hooks/useAuth';
import { isAdmin } from '../../utils/permissions';
import normalizePermissions from '../../components/common/PermissionMatrix/normalizePermissions';
import { PageHeader, Button, Select, DatePicker } from '../../components/common';

const DATASETS = [
  { value: 'bills', label: 'Bills' },
  { value: 'patients', label: 'Patients' },
  { value: 'expenses', label: 'Expenses' },
  { value: 'transactions', label: 'Transactions' }
];
const PRESETS = ['Today', 'Last 31d', 'Last 365d', 'Custom'];

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

  // The backend preserves its legacy allow behavior for an empty permission
  // map and enforces the existing finance key once a matrix is explicit.
  const permissions = normalizePermissions(user.permissions);
  if (Object.keys(permissions).length === 0) return true;
  return permissions.finance === true;
};

const DataExport = () => {
  const { user } = useAuth();
  const canExport = canUseFinanceExport(user);
  const [dataset, setDataset] = useState('bills');
  const [preset, setPreset] = useState('Last 31d');
  const [customStart, setCustomStart] = useState(() => getLocalDate());
  const [customEnd, setCustomEnd] = useState(() => getLocalDate());
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [exportNotice, setExportNotice] = useState('');
  const exportInFlightRef = useRef(false);

  const selectedRange = getPresetRange(preset, {
    startDate: customStart,
    endDate: customEnd
  });
  const rangeError = preset === 'Custom' ? validateRange(selectedRange) : '';

  const clearFeedback = () => {
    setExportError('');
    setExportNotice('');
  };

  const handleDatasetChange = (event) => {
    setDataset(event.target.value);
    clearFeedback();
  };

  const handlePresetChange = (event) => {
    setPreset(event.target.value);
    clearFeedback();
  };

  const handleCustomDateChange = (setter) => (event) => {
    setter(event.target.value);
    clearFeedback();
  };

  const handleExport = async (event) => {
    event.preventDefault();
    if (!canExport || exportInFlightRef.current) return;

    const validationError = validateRange(selectedRange);
    if (validationError) {
      setExportError(validationError);
      setExportNotice('');
      return;
    }

    exportInFlightRef.current = true;
    setExporting(true);
    setExportError('');
    setExportNotice('');

    try {
      const result = await downloadServerCsv(dataset, selectedRange);
      setExportNotice(`CSV download started: ${result.filename}`);
    } catch (error) {
      setExportError(getErrorMessage(error, 'The export could not be started.'));
    } finally {
      exportInFlightRef.current = false;
      setExporting(false);
    }
  };

  return (
    <div className="data-export-page">
      <PageHeader
        title="Data Export"
        subtitle="Download API-backed operational, patient, billing, and business data as CSV files."
      />

      {!canExport ? (
        <div className="card" role="note" style={{ color: 'var(--color-text-muted)' }}>
          Your current account does not have access to the finance export capability.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-5)' }}>
          <section className="card" aria-labelledby="server-export-heading">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
              <Server size={28} color="var(--color-primary)" aria-hidden="true" />
              <div>
                <h2 id="server-export-heading" style={{ margin: 0, fontSize: 'var(--font-size-lg)' }}>Server CSV export</h2>
                <p style={{ margin: '4px 0 0', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                  The existing export service applies the selected date window and returns the server-generated file.
                </p>
              </div>
            </div>

            <form onSubmit={handleExport} noValidate>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <Select
                  name="export-dataset"
                  label="Dataset"
                  value={dataset}
                  onChange={handleDatasetChange}
                  options={DATASETS}
                  placeholder=""
                  disabled={exporting}
                />
                <Select
                  name="export-window"
                  label="Date window"
                  value={preset}
                  onChange={handlePresetChange}
                  options={PRESETS.map((value) => ({ value, label: value }))}
                  placeholder=""
                  disabled={exporting}
                />

                {preset === 'Custom' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--space-3)' }}>
                    <DatePicker
                      name="export-start-date"
                      label="From"
                      value={customStart}
                      onChange={handleCustomDateChange(setCustomStart)}
                      error={rangeError || undefined}
                      required
                      disabled={exporting}
                    />
                    <DatePicker
                      name="export-end-date"
                      label="To"
                      value={customEnd}
                      onChange={handleCustomDateChange(setCustomEnd)}
                      error={rangeError || undefined}
                      required
                      disabled={exporting}
                    />
                  </div>
                )}

                <div style={{ padding: 'var(--space-3)', background: 'var(--color-background)', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                  Selected range: {selectedRange.startDate || '—'} to {selectedRange.endDate || '—'}
                </div>

                {exportError && (
                  <div role="alert" style={{ color: 'var(--color-danger)', fontSize: 'var(--font-size-sm)' }}>
                    {exportError}
                  </div>
                )}
                {exportNotice && (
                  <div role="status" style={{ color: 'var(--color-success)', fontSize: 'var(--font-size-sm)' }}>
                    {exportNotice}
                  </div>
                )}

                <Button type="submit" loading={exporting} disabled={exporting || Boolean(rangeError)}>
                  <Download size={16} /> Export CSV
                </Button>
              </div>
            </form>
          </section>

          <section className="card" aria-labelledby="export-capabilities-heading">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              <FileSpreadsheet size={28} color="var(--color-primary)" aria-hidden="true" />
              <h2 id="export-capabilities-heading" style={{ margin: 0, fontSize: 'var(--font-size-lg)' }}>Export capabilities</h2>
            </div>
            <ul style={{ margin: 0, paddingLeft: 'var(--space-5)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', lineHeight: 1.7 }}>
              <li>Format: CSV only, generated by the existing backend export service.</li>
              <li>Datasets: bills, patients, expenses, and transactions.</li>
              <li>Filters: date range only; search, status, payment method, type, department, and page filters are not accepted by this endpoint.</li>
              <li>The service returns up to 5,000 rows per request and does not provide a total-count or truncation flag.</li>
              <li>Values and CSV serialization remain server-owned; the frontend does not recalculate or rewrite exported fields.</li>
              <li>Date order is validated in the UI; the backend does not enforce a maximum date window.</li>
              <li>A header-only CSV may be returned when no records match; no client-side records are generated.</li>
              <li>Bulk users, activity/audit, test-analysis, report, and analytics exports are not exposed by the current export endpoint.</li>
            </ul>
          </section>
        </div>
      )}
    </div>
  );
};

export default DataExport;
