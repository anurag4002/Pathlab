import React, { useState } from 'react';
import { getBills } from '../../services/billService';
import { getPatients } from '../../services/patientService';
import { getExpenses } from '../../services/expenseService';
import { FileSpreadsheet, Download } from 'lucide-react';
import { PageHeader, Button } from '../../components/common';

const DataExport = () => {
  const [loadingType, setLoadingType] = useState('');

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
        const rows = res.data.bills.map(b => [
          b.billNumber,
          b.patient?.name || 'Walk-in',
          b.totalAmount,
          b.paidAmount,
          b.dueAmount,
          b.paymentStatus,
          b.date
        ]);
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
        const rows = res.data.patients.map(p => [
          p.registrationNumber,
          p.name,
          p.age,
          p.gender,
          p.phone,
          p.address || '',
          p.referringDoctor?.name || 'Self'
        ]);
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
        const rows = res.data.map(e => [
          e.date,
          e.category,
          e.description || '',
          e.paymentMethod,
          e.amount
        ]);
        triggerCSVDownload(headers, rows, 'expense_ledger');
      }
    } catch (err) {
      alert('Failed to export expense vouchers');
    } finally {
      setLoadingType('');
    }
  };

  return (
    <div>
      <PageHeader
        title="Clinical Data Export Center"
        subtitle="Export ledger sheets, patient directories, and financial logs to standard CSV spreadsheets"
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
        
        {/* Bills Ledger Export Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: 'var(--primary-color)', marginBottom: '8px' }}><FileSpreadsheet size={32} /></div>
            <h4 style={{ fontWeight: '700', fontSize: '1rem', marginBottom: '4px' }}>Invoices Billing Ledger</h4>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
              Export billing histories including patients tags, gross charges, discounts, and payments.
            </p>
          </div>
          <Button variant="primary" onClick={handleExportBills} loading={loadingType === 'bills'}>
            <Download size={16} /> Export Invoices (CSV)
          </Button>
        </div>

        {/* Patient Registry Export Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: 'var(--primary-color)', marginBottom: '8px' }}><FileSpreadsheet size={32} /></div>
            <h4 style={{ fontWeight: '700', fontSize: '1rem', marginBottom: '4px' }}>Patients Registry</h4>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
              Export patients directories with demographic files, contact lines, and reference markers.
            </p>
          </div>
          <Button variant="primary" onClick={handleExportPatients} loading={loadingType === 'patients'}>
            <Download size={16} /> Export Patients (CSV)
          </Button>
        </div>

        {/* Expenses Ledger Export Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: 'var(--primary-color)', marginBottom: '8px' }}><FileSpreadsheet size={32} /></div>
            <h4 style={{ fontWeight: '700', fontSize: '1rem', marginBottom: '4px' }}>Operating Expense Vouchers</h4>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
              Export facilities bills, collection agents commissions, office rents, and supply costs.
            </p>
          </div>
          <Button variant="primary" onClick={handleExportExpenses} loading={loadingType === 'expenses'}>
            <Download size={16} /> Export Expenses (CSV)
          </Button>
        </div>

      </div>
    </div>
  );
};

export default DataExport;
