import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPatientById } from '../../../services/patientService';
import { PageHeader, DataTable, StatusBadge, Button, LoadingSpinner } from '../../../components/common';
import PatientDemographicsCard from '../components/PatientDemographicsCard';
import formatCurrency from '../../../utils/formatCurrency';
import formatDate from '../../../utils/formatDate';
import downloadFile from '../../../utils/downloadFile';
import useClientPagination from '../../../hooks/useClientPagination';
import { buildBillsSearchUrl } from '../../../utils/billNavigation';
import { ArrowLeft, ClipboardList, FileText, Wallet } from 'lucide-react';
import '../Patients.css';

const PatientDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Per-section client pagination (single-patient history lists).
  // Hooks stay above the early returns; empty lists paginate trivially.
  const pgBills = useClientPagination(details?.bills || [], 5);
  const pgReports = useClientPagination(details?.reports || [], 5);
  const pgTx = useClientPagination(details?.transactions || [], 5);
  const pgProps = (pg) => ({
    total: pg.total,
    page: pg.page,
    limit: pg.limit,
    pages: pg.pages,
    onPageChange: pg.goToPage,
    onLimitChange: pg.setLimit,
  });

  useEffect(() => {
    const fetchDetails = async () => {
      setLoading(true);
      try {
        const res = await getPatientById(id);
        if (res.success) setDetails(res.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load patient file');
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [id]);

  const backButton = (
    <Button
      variant="secondary"
      onClick={() => navigate('/cases/patients')}
      icon={<ArrowLeft size={16} />}
      style={{ marginBottom: 'var(--space-5)' }}
    >
      Back to Patients
    </Button>
  );

  if (loading) return <LoadingSpinner label="Loading patient file..." size={2.5} />;

  if (error || !details) {
    return (
      <div>
        {backButton}
        <div
          style={{
            padding: 'var(--space-3)',
            backgroundColor: 'var(--color-danger-bg)',
            color: 'var(--color-danger)',
            borderRadius: 'var(--radius-sm)'
          }}
        >
          {error || 'Patient files not found.'}
        </div>
      </div>
    );
  }

  const { patient, bills = [], reports = [], transactions = [] } = details;

  return (
    <div>
      {backButton}

      <PageHeader
        title={patient.name}
        subtitle={`Patient Registration File: ${patient.registrationNumber}`}
      />

      <PatientDemographicsCard patient={patient} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

        {/* Invoice History */}
        <div className="patient-history-section">
          <div className="patient-history-header">
            <ClipboardList size={20} style={{ color: 'var(--color-primary)' }} aria-hidden="true" />
            <span>Invoice History</span>
          </div>
          <DataTable
            headers={['Bill No', 'Date', 'Gross Total', 'Paid', 'Due Balance', 'Status', 'Actions']}
            data={pgBills.paged}
            emptyMessage="No billing records generated for this patient."
            pagination={pgProps(pgBills)}
            renderRow={(bill) => (
              <tr key={bill._id}>
                <td style={{ fontWeight: 'var(--font-weight-semibold)' }}>{bill.billNumber}</td>
                <td>{formatDate(bill.date)}</td>
                <td>{formatCurrency(bill.totalAmount)}</td>
                <td>{formatCurrency(bill.paidAmount)}</td>
                <td style={{ fontWeight: 'var(--font-weight-semibold)', color: bill.dueAmount > 0 ? 'var(--color-danger)' : 'inherit' }}>
                  {formatCurrency(bill.dueAmount)}
                </td>
                <td><StatusBadge status={bill.paymentStatus} /></td>
                <td>
                  {bill?.billNumber ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => navigate(buildBillsSearchUrl(bill))}
                    >
                      View Invoice
                    </Button>
                  ) : (
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                      No bill no.
                    </span>
                  )}
                </td>
              </tr>
            )}
          />
        </div>

        {/* Laboratory Reports */}
        <div className="patient-history-section">
          <div className="patient-history-header">
            <FileText size={20} style={{ color: 'var(--color-primary)' }} aria-hidden="true" />
            <span>Laboratory Reports</span>
          </div>
          <DataTable
            headers={['Test / Panel', 'Uploaded On', 'Uploaded By', 'Download']}
            data={pgReports.paged}
            emptyMessage="No diagnostic lab reports uploaded for this patient."
            pagination={pgProps(pgReports)}
            renderRow={(report) => (
              <tr key={report._id}>
                <td style={{ fontWeight: 'var(--font-weight-semibold)' }}>
                  {report.test ? `${report.test.name} (${report.test.code})` : 'General Report'}
                </td>
                <td>{formatDate(report.reportDate)}</td>
                <td>{report.uploadedBy?.name || 'N/A'}</td>
                <td>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => downloadFile(`/${report.fileUrl}`, `report_${report.registrationNumber}.pdf`)}
                  >
                    Download
                  </Button>
                </td>
              </tr>
            )}
          />
        </div>

        {/* Payments & Transactions */}
        <div className="patient-history-section">
          <div className="patient-history-header">
            <Wallet size={20} style={{ color: 'var(--color-primary)' }} aria-hidden="true" />
            <span>Payments &amp; Transactions</span>
          </div>
          <DataTable
            headers={['Date', 'Related Invoice', 'Amount', 'Method', 'Clerk']}
            data={pgTx.paged}
            emptyMessage="No payment transactions registered."
            pagination={pgProps(pgTx)}
            renderRow={(tx) => (
              <tr key={tx._id}>
                <td>{formatDate(tx.date)}</td>
                <td>{tx.bill?.billNumber || 'N/A'}</td>
                <td
                  style={{
                    fontWeight: 'var(--font-weight-semibold)',
                    color: tx.type === 'Refund' ? 'var(--color-danger)' : 'var(--color-success)'
                  }}
                >
                  {tx.type === 'Refund' ? '-' : ''}{formatCurrency(tx.amount)}
                </td>
                <td><StatusBadge status={tx.paymentMethod} /></td>
                <td>{tx.receivedBy?.name || 'N/A'}</td>
              </tr>
            )}
          />
        </div>
      </div>
    </div>
  );
};

export default PatientDetailsPage;
