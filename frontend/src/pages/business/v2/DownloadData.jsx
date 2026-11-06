import React, { useEffect, useState } from 'react';
import { Download, FileText, Receipt, Users, Wallet } from 'lucide-react';
import { downloadServerCsv, fetchExportPreviewCount, EXPORT_DATASETS } from '../../../services/exportService';
import { PageHeader, Button } from '../../../components/common';
import PeriodBar, { presetRange } from '../../../components/business/PeriodBar';
import useAuth from '../../../hooks/useAuth';
import { isAdmin } from '../../../utils/permissions';
import normalizePermissions from '../../../components/common/PermissionMatrix/normalizePermissions';
import { periodLabel } from '../../../utils/reportFormat';
import { notify } from '../../../components/common/Toast/toast';
import '../../../components/business/business.css';
import './businessV2Pages.css';

const DATASETS = {
  bills: { label: 'Bills', icon: Receipt, text: 'One row per bill: bill number, patient, tests, amount, received, still to collect and status.' },
  transactions: { label: 'Payments received', icon: Wallet, text: 'Every payment and refund: time, bill, patient, payment mode and who received it.' },
  expenses: { label: 'Expenses', icon: FileText, text: 'Every expense: date, category, details, how it was paid and the amount.' },
  patients: { label: 'Patients', icon: Users, text: 'Patients registered in the period: name, age, sex, phone and registration number.' },
};

// Same rule as the classic export page: admins, or staff with the finance
// permission (an empty legacy permission map keeps the old "allowed").
const canExportFor = (user) => {
  if (isAdmin(user)) return true;
  if (!user) return false;
  const permissions = normalizePermissions(user.permissions);
  if (Object.keys(permissions).length === 0) return true;
  return permissions.finance === true;
};

// Download data (new look): pick the dates, then download the file you need.
export default function DownloadData() {
  const { user } = useAuth();
  const canExport = canExportFor(user);
  const [[from, to], setRange] = useState(() => presetRange('month'));
  const [counts, setCounts] = useState({});
  const [counting, setCounting] = useState(false);
  const [busy, setBusy] = useState('');
  const [done, setDone] = useState('');

  useEffect(() => {
    if (!canExport || !from || !to) return undefined;
    let cancelled = false;
    setCounting(true);
    Promise.all(EXPORT_DATASETS.map(async (d) => {
      try { return [d, await fetchExportPreviewCount(d, { startDate: from, endDate: to })]; } catch { return [d, null]; }
    })).then((entries) => { if (!cancelled) setCounts(Object.fromEntries(entries)); })
      .finally(() => { if (!cancelled) setCounting(false); });
    return () => { cancelled = true; };
  }, [canExport, from, to]);

  const download = async (dataset) => {
    setBusy(dataset); setDone('');
    try {
      const result = await downloadServerCsv(dataset, { startDate: from, endDate: to });
      setDone(`${DATASETS[dataset]?.label || dataset} downloaded${result?.rows != null ? ` - ${result.rows} rows` : ''}.`);
    } catch (err) {
      notify(err?.response?.status === 403 ? 'You do not have permission to download this.' : 'The download did not work. Try again.');
    } finally { setBusy(''); }
  };

  if (!canExport) {
    return (
      <div className="biz-page">
        <PageHeader title="Download data" subtitle="Spreadsheet files of bills, payments, expenses and patients." />
        <div className="biz-error" role="note">Your account cannot download business data. Ask an admin to give you the finance permission.</div>
      </div>
    );
  }

  return (
    <div className="biz-page">
      <PageHeader title="Download data" subtitle="Spreadsheet (CSV) files you can open in Excel - pick the dates, then the file." />
      <PeriodBar from={from} to={to} onChange={({ from: a, to: b }) => setRange([a, b])} />

      <div className="biz-datasets">
        {EXPORT_DATASETS.map((d) => {
          const meta = DATASETS[d] || { label: d, icon: FileText, text: '' };
          const Icon = meta.icon;
          const count = counts[d];
          return (
            <div key={d} className="biz-dataset">
              <span className="biz-dataset-icon" aria-hidden="true"><Icon size={18} /></span>
              <div className="biz-dataset-text">
                <h3>{meta.label}</h3>
                <p>{meta.text}</p>
                <span className="biz-dataset-count">{counting ? 'Counting rows…' : count == null ? 'Row count not available' : `${count} row${count === 1 ? '' : 's'} for ${periodLabel(from, to)}`}</span>
              </div>
              <Button variant="secondary" size="sm" icon={<Download size={14} />} onClick={() => download(d)} loading={busy === d} disabled={!!busy || count === 0}>
                Download
              </Button>
            </div>
          );
        })}
      </div>
      {done && <p className="biz-note" role="status">{done}</p>}
      <p className="biz-note">Files cover the dates above, up to 5,000 rows each. Very old or very large ranges may be cut off - pick a shorter period if so.</p>
    </div>
  );
}
