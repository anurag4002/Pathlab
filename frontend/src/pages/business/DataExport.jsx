import React, { useState } from 'react';
import { getBills } from '../../services/billService';
import { getPatients } from '../../services/patientService';
import { getExpenses } from '../../services/expenseService';
import { downloadServerCsv } from '../../services/exportService';
import { FileSpreadsheet, Download, Server } from 'lucide-react';
import { PageHeader, Button, Select, DatePicker } from '../../components/common';

const DATASETS = [
  { value: 'bills', label: 'Bills' },
  { value: 'patients', label: 'Patients' },
  { value: 'expenses', label: 'Expenses' },
  { value: 'transactions', label: 'Transactions' }
];
const PRESETS = ['Today', 'Last 31d', 'Last 365d', 'Custom'];

const toISODate = (d) => d.toISOString().split('T')[0];
const presetRange = (preset, custom) => {
  const today = new Date();
  if (preset === 'Today') { const t = toISODate(today); return { startDate: t, endDate: t }; }
  if (preset === 'Last 31d') { const s = new Date(today); s.setDate(s.getDate() - 30); return { startDate: toISODate(s), endDate: toISODate(today) }; }
  if (preset === 'Last 365d') { const s = new Date(today); s.setDate(s.getDate() - 364); return { startDate: toISODate(s), endDate: toISODate(today) }; }
  return custom;
};

const DataExport = () => {
  const [loadingType, setLoadingType] = useState('');
  const [dataset, setDataset] = useState('bills');
  const [preset, setPreset] = useState('Last 31d');
  const [customStart, setCustomStart] = useState(toISODate(new Date()));
  const [customEnd, setCustomEnd] = useState(toISODate(new Date()));
  const [serverLoading, setServerLoading] = useState(false);

  const triggerCSVDownload = (headers, rows, filename) => {
    const csvRows = [
      headers.join(','),
      ...rows.map(row => row.map(val => {
        const str = String(val === null || val === undefined ? '' : val);
        return `"${str.replace(/"/g, '""')}"`;
      }).join(','))
    ];
    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${filename}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportBills = async () => {
    setLoadingType('bills');
    try {
      const res = await getBills({ limit: 500 });
      if (res.success) {
        const headers = ['Invoice Number', 'Patient Name', 'Gross Total', 'Paid Amount', 'Due Balance', 'Payment Status', 'Date'];
        const rows = res.data.bills.map(b => [b.billNumber, b.patient?.name || 'Walk-in', b.totalAmount, b.paidAmount, b.dueAmount, b.paymentStatus, b.date]);
        triggerCSVDownload(headers, rows, 'billing_ledger');
      }
    } catch (err) {
      alert('Failed to export bills ledger');
    } finally {
      setLoadingType('');
    }
  };

  const handleExportPatients = async () => {
    setLoadingType('patients');
    try {
      const res = await getPatients({ limit: 500 });
      if (res.success) {
        const headers = ['Registration Code', 'Patient Name', 'Age', 'Gender', 'Phone', 'Address', 'Referral Doctor'];
        const rows = res.data.patients.map(p => [p.registrationNumber, p.name, p.age, p.gender, p.phone, p.address || '', p.referringDoctor?.name || 'Self']);
        triggerCSVDownload(headers, rows, 'patient_directory');
      }
    } catch (err) {
      alert('Failed to export patient registry');
    } finally {
      setLoadingType('');
    }
  };

  const handleExportExpenses = async () => {
    setLoadingType('expenses');
    try {
      const res = await getExpenses();
      if (res.success) {
        const headers = ['Voucher Date', 'Category', 'Description', 'Payment Method', 'Amount'];
        const rows = res.data.map(e => [e.date, e.category, e.description || '', e.paymentMethod, e.amount]);
        triggerCSVDownload(headers, rows, 'expense_ledger');
      }
    } catch (err) {
      alert('Failed to export expense vouchers');
    } finally {
      setLoadingType('');
    }
  };

  const handleServerExport = async () => {
    setServerLoading(true);
    try {
      const { startDate, endDate } = presetRange(preset, { startDate: customStart, endDate: customEnd });
      await downloadServerCsv(dataset, { startDate, endDate });
    } catch (err) {
      alert(err.response?.data?.message || 'Server export failed');
    } finally {
      setServerLoading(false);
    }
  };

  const cardStyle = { display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'space-between' };

  return (
    <div>
      <PageHeader
        title="Clinical Data Export Center"
        subtitle="Export ledger sheets, patient directories, and financial logs to standard CSV spreadsheets"
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
        <div className="card" style={cardStyle}>
          <div>
            <div style={{ color: 'var(--primary-color)', marginBottom: '8px' }}><FileSpreadsheet size={32} /></div>
            <h4 style={{ fontWeight: '700', fontSize: '1rem', marginBottom: '4px' }}>Invoices Billing Ledger</h4>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>Export billing histories including patients tags, gross charges, discounts, and payments.</p>
          </div>
          <Button variant="primary" onClick={handleExportBills} loading={loadingType === 'bills'}><Download size={16} /> Export Invoices (CSV)</Button>
        </div>

        <div className="card" style={cardStyle}>
          <div>
            <div style={{ color: 'var(--primary-color)', marginBottom: '8px' }}><FileSpreadsheet size={32} /></div>
            <h4 style={{ fontWeight: '700', fontSize: '1rem', marginBottom: '4px' }}>Patients Registry</h4>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>Export patients directories with demographic files, contact lines, and reference markers.</p>
          </div>
          <Button variant="primary" onClick={handleExportPatients} loading={loadingType === 'patients'}><Download size={16} /> Export Patients (CSV)</Button>
        </div>

        <div className="card" style={cardStyle}>
          <div>
            <div style={{ color: 'var(--primary-color)', marginBottom: '8px' }}><FileSpreadsheet size={32} /></div>
            <h4 style={{ fontWeight: '700', fontSize: '1rem', marginBottom: '4px' }}>Operating Expense Vouchers</h4>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>Export facilities bills, collection agents commissions, office rents, and supply costs.</p>
          </div>
          <Button variant="primary" onClick={handleExportExpenses} loading={loadingType === 'expenses'}><Download size={16} /> Export Expenses (CSV)</Button>
        </div>

        {/* Server-side export card */}
        <div className="card" style={cardStyle}>
          <div>
            <div style={{ color: 'var(--primary-color)', marginBottom: '8px' }}><Server size={32} /></div>
            <h4 style={{ fontWeight: '700', fontSize: '1rem', marginBottom: '4px' }}>Server Export (Date Window)</h4>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>Generate CSV on the server with a dataset and date window.</p>
          </div>
          <Select name="dataset" label="Dataset" value={dataset} onChange={(e) => setDataset(e.target.value)} options={DATASETS} placeholder="" />
          <Select name="preset" label="Window" value={preset} onChange={(e) => setPreset(e.target.value)}
            options={PRESETS.map((p) => ({ value: p, label: p }))} placeholder="" />
          {preset === 'Custom' && (
            <div style={{ display: 'flex', gap: '12px' }}>
              <DatePicker label="From" value={customStart} onChange={(e) => setCustomStart(e.target.value)} style={{ flex: 1 }} />
              <DatePicker label="To" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} style={{ flex: 1 }} />
            </div>
          )}
          <Button variant="primary" onClick={handleServerExport} loading={serverLoading}><Download size={16} /> Export {dataset} (Server CSV)</Button>
        </div>
      </div>
    </div>
  );
};

export default DataExport;
