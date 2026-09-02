import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPatientById } from '../../services/patientService';
import formatCurrency from '../../utils/formatCurrency';
import formatDate from '../../utils/formatDate';
import downloadFile from '../../utils/downloadFile';
import { ArrowLeft, User, FileText, ClipboardList, Wallet } from 'lucide-react';
import { PageHeader, DataTable, StatusBadge } from '../../components/common';

const PatientDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const res = await getPatientById(id);
      if (res.success) {
        setDetails(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load patient file');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [id]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  if (error || !details) {
    return (
      <div>
        <button className="btn btn-secondary" onClick={() => navigate('/cases/patients')} style={{ marginBottom: '1.5rem' }}>
          <ArrowLeft size={16} /> Back to Patients
        </button>
        <div style={{ padding: '1rem', backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', borderRadius: 'var(--border-radius-sm)' }}>
          {error || 'Patient files not found.'}
        </div>
      </div>
    );
  }

  const { patient, bills = [], reports = [], transactions = [] } = details;

  return (
    <div>
      <button className="btn btn-secondary" onClick={() => navigate('/cases/patients')} style={{ marginBottom: '1.5rem' }}>
        <ArrowLeft size={16} /> Back to Patients
      </button>

      <PageHeader
        title={patient.name}
        subtitle={`Patient Registration File: ${patient.registrationNumber}`}
      />

      {/* Demographics Card */}
      <div className="card" style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: '220px' }}>
          <div style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary-color)', padding: '16px', borderRadius: '50%' }}>
            <User size={32} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: '700' }}>{patient.name}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{patient.registrationNumber}</p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1.5rem', flex: 3, width: '100%' }}>
          <div>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', fontWeight: '600' }}>Age / Gender</span>
            <span style={{ fontSize: '0.95rem', fontWeight: '500' }}>{patient.age} Years / {patient.gender}</span>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', fontWeight: '600' }}>Phone</span>
            <span style={{ fontSize: '0.95rem', fontWeight: '500' }}>{patient.phone}</span>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', fontWeight: '600' }}>Doctor Referral</span>
            <span style={{ fontSize: '0.95rem', fontWeight: '500' }}>{patient.referringDoctor?.name || 'Self / Walk-in'}</span>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', fontWeight: '600' }}>Address</span>
            <span style={{ fontSize: '0.95rem', fontWeight: '500' }}>{patient.address || 'N/A'}</span>
          </div>
        </div>
      </div>

      {/* Grid of Sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Billing Invoice history */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
            <ClipboardList size={20} style={{ color: 'var(--primary-color)' }} />
            <h3 style={{ fontSize: '1.125rem', fontWeight: '700', margin: 0 }}>Invoice History</h3>
          </div>
          <DataTable
            headers={['Bill No', 'Date', 'Gross Total', 'Paid', 'Due Balance', 'Status', 'Actions']}
            data={bills}
            emptyMessage="No billing records generated for this patient."
            renderRow={(bill) => (
              <tr key={bill._id}>
                <td style={{ fontWeight: '600' }}>{bill.billNumber}</td>
                <td>{formatDate(bill.date)}</td>
                <td>{formatCurrency(bill.totalAmount)}</td>
                <td>{formatCurrency(bill.paidAmount)}</td>
                <td style={{ fontWeight: '600', color: bill.dueAmount > 0 ? 'var(--color-danger)' : 'inherit' }}>
                  {formatCurrency(bill.dueAmount)}
                </td>
                <td>
                  <StatusBadge status={bill.paymentStatus} />
                </td>
                <td>
                  <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => navigate(`/cases/bills?search=${bill.billNumber}`)}>
                    View Invoice
                  </button>
                </td>
              </tr>
            )}
          />
        </div>

        {/* Diagnostic Reports */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
            <FileText size={20} style={{ color: 'var(--primary-color)' }} />
            <h3 style={{ fontSize: '1.125rem', fontWeight: '700', margin: 0 }}>Laboratory Reports</h3>
          </div>
          <DataTable
            headers={['Test / Panel', 'Uploaded on', 'Uploaded By', 'Download']}
            data={reports}
            emptyMessage="No diagnostic lab reports uploaded for this patient."
            renderRow={(report) => (
              <tr key={report._id}>
                <td style={{ fontWeight: '600' }}>
                  {report.test ? `${report.test.name} (${report.test.code})` : 'General Report'}
                </td>
                <td>{formatDate(report.reportDate)}</td>
                <td>{report.uploadedBy?.name || 'N/A'}</td>
                <td>
                  <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => downloadFile(`/${report.fileUrl}`, `report_${report.registrationNumber}.pdf`)}>
                    Download
                  </button>
                </td>
              </tr>
            )}
          />
        </div>

        {/* Transactions ledger */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
            <Wallet size={20} style={{ color: 'var(--primary-color)' }} />
            <h3 style={{ fontSize: '1.125rem', fontWeight: '700', margin: 0 }}>Payments & Transactions History</h3>
          </div>
          <DataTable
            headers={['Transaction Date', 'Related Invoice', 'Amount', 'Payment Method', 'Clerk']}
            data={transactions}
            emptyMessage="No payment transaction entries registered."
            renderRow={(tx) => (
              <tr key={tx._id}>
                <td>{formatDate(tx.date)}</td>
                <td>{tx.bill?.billNumber || 'N/A'}</td>
                <td style={{ fontWeight: '600', color: tx.type === 'Refund' ? 'var(--color-danger)' : 'var(--color-success)' }}>
                  {tx.type === 'Refund' ? '-' : ''}{formatCurrency(tx.amount)}
                </td>
                <td>
                  <StatusBadge status={tx.paymentMethod} />
                </td>
                <td>{tx.receivedBy?.name || 'N/A'}</td>
              </tr>
            )}
          />
        </div>

      </div>
    </div>
  );
};

export default PatientDetails;
