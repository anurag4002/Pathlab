import React, { useState, useEffect, useCallback } from 'react';
import {
  downloadServerCsv,
  fetchExportPreviewCount,
  EXPORT_DATASETS,
} from '../../services/exportService';
import { FileSpreadsheet, Download, RefreshCw, AlertTriangle } from 'lucide-react';
import { PageHeader, Button, Select, DatePicker, DataTable } from '../../components/common';

const PRESETS = ['Today', 'Last 31d', 'Last 365d', 'Custom'];

const DATASET_META = {
  bills: { label: 'Bills', hint: 'Billing ledger incl. patient, totals, payments and void flags.' },
  patients: { label: 'Patients', hint: 'Patient registry with demographics and contact lines.' },
  expenses: { label: 'Expenses', hint: 'Operating expense vouchers with category and method.' },
  transactions: { label: 'Transactions', hint: 'Cash-book transactions with type, method and receiver.' },
};

const toISODate = (d) => d.toISOString().split('T')[0];
const presetRange = (preset, custom) => {
  const today = new Date();
  if (preset === 'Today') { const t = toISODate(today); return { startDate: t, endDate: t }; }
  if (preset === 'Last 31d') { const s = new Date(today); s.setDate(s.getDate() - 30); return { startDate: toISODate(s), endDate: toISODate(today) }; }
  if (preset === 'Last 365d') { const s = new Date(today); s.setDate(s.getDate() - 364); return { startDate: toISODate(s), endDate: toISODate(today) }; }
  return custom;
};

// Phase 26 — Data Export Center wired to GET /api/export/:dataset
// (server returns text/csv; client-side JSON→CSV fallback lives in
// exportService for resilience). Route: /business/export (+ /lab/export alias).
const DataExport = () => {
  const [preset, setPreset] = useState('Last 31d');
  const [customStart, setCustomStart] = useState(toISODate(new Date()));
  const [customEnd, setCustomEnd] = useState(toISODate(new Date()));
  const [counts, setCounts] = useState({});
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [activeDataset, setActiveDataset] = useState('');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [lastResult, setLastResult] = useState(null);

  const range = presetRange(preset, { startDate: customStart, endDate: customEnd });

  const loadPreviewCounts = useCallback(async () => {
    setPreviewLoading(true);
    setPreviewError('');
    try {
      const entries = await Promise.all(
        EXPORT_DATASETS.map(async (ds) => {
          try {
            const n = await fetchExportPreviewCount(ds, range);
            return [ds, n];
          } catch {
            return [ds, null];
          }
        })
      );
      setCounts(Object.fromEntries(entries));
    } catch (err) {
      setPreviewError(err.response?.data?.message || 'Failed to preview export sizes');
    } finally {
      setPreviewLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, customStart, customEnd]);

  useEffect(() => {
    loadPreviewCounts();
  }, [loadPreviewCounts]);

  const handleDownload = async (dataset) => {
    setActiveDataset(dataset);
    setProgress(`Preparing ${dataset} CSV…`);
    setError('');
    setLastResult(null);
    try {
      const result = await downloadServerCsv(dataset, range);
      setLastResult({ dataset, ...result });
      setProgress('');
    } catch (err) {
      setError(err.response?.data?.message || `Export of ${dataset} failed`);
      setProgress('');
    } finally {
      setActiveDataset('');
    }
  };

  const invalidRange = range.startDate > range.endDate;

  return (
    <div>
      <PageHeader
        title="Clinical Data Export Center"
        subtitle="Pick a dataset and date window, check the preview count, then download the server CSV"
      />

      <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <Select
          name="preset"
          label="Date window"
          value={preset}
          onChange={(e) => setPreset(e.target.value)}
          options={PRESETS.map((p) => ({ value: p, label: p }))}
          placeholder=""
          style={{ minWidth: '160px' }}
        />
        {preset === 'Custom' && (
          <>
            <DatePicker label="From" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
            <DatePicker label="To" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
          </>
        )}
        <Button variant="secondary" size="sm" onClick={loadPreviewCounts} loading={previewLoading}>
          <RefreshCw size={14} /> Refresh preview
        </Button>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Window: {range.startDate} → {range.endDate}
        </span>
      </div>

      {invalidRange && (
        <div className="card" style={{ borderLeft: '4px solid var(--color-danger, #dc2626)', marginBottom: '1rem', fontSize: '0.85rem' }}>
          <AlertTriangle size={14} /> Start date is after end date — adjust the window before exporting.
        </div>
      )}
      {previewError && (
        <div className="card" style={{ borderLeft: '4px solid var(--color-danger, #dc2626)', marginBottom: '1rem', fontSize: '0.85rem' }}>
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
        {EXPORT_DATASETS.map((ds) => (
          <div key={ds} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', justifyContent: 'space-between' }}>
            <div>
              <div style={{ color: 'var(--primary-color)', marginBottom: '8px' }}><FileSpreadsheet size={32} /></div>
              <h4 style={{ fontWeight: '700', fontSize: '1rem', marginBottom: '4px' }}>{DATASET_META[ds].label}</h4>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>{DATASET_META[ds].hint}</p>
              <p style={{ fontSize: '0.8rem', marginTop: '8px' }}>
                Preview rows:{' '}
                <strong>{previewLoading ? '…' : counts[ds] === null || counts[ds] === undefined ? 'unavailable' : counts[ds]}</strong>
              </p>
            </div>
            <Button variant="primary" onClick={() => handleDownload(ds)} loading={activeDataset === ds} disabled={invalidRange}>
              <Download size={16} /> Export {DATASET_META[ds].label} (CSV)
            </Button>
          </div>
        ))}
      </div>

      <div className="card">
        <h4 style={{ fontWeight: '700', fontSize: '0.95rem', marginBottom: '0.5rem' }}>Export summary</h4>
        <DataTable
          headers={['Dataset', 'Preview rows', 'Action']}
          data={EXPORT_DATASETS.map((ds) => ({ ds }))}
          emptyMessage="No datasets configured."
          renderRow={({ ds }) => (
            <tr key={ds}>
              <td style={{ fontWeight: '600' }}>{DATASET_META[ds].label}</td>
              <td>{previewLoading ? '…' : counts[ds] ?? 'unavailable'}</td>
              <td>
                <Button variant="secondary" size="sm" onClick={() => handleDownload(ds)} loading={activeDataset === ds} disabled={invalidRange}>
                  <Download size={14} /> Download
                </Button>
              </td>
            </tr>
          )}
        />
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
          Large windows download as CSV (up to 5000 rows per dataset). Export history is not available.
        </p>
      </div>
    </div>
  );
};

export default DataExport;
