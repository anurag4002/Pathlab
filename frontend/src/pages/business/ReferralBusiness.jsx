import React, { useState, useEffect } from 'react';
import { getReferralReport } from '../../services/dashboardService';
import formatCurrency from '../../utils/formatCurrency';
import formatDate from '../../utils/formatDate';
import { Eye, FileSpreadsheet } from 'lucide-react';
import { PageHeader, DataTable, DatePicker, Modal } from '../../components/common';

const ReferralBusiness = () => {
  const todayStr = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);

  const [report, setReport] = useState([]);
  const [loading, setLoading] = useState(false);

  // View details modal
  const [detailsTarget, setDetailsTarget] = useState(null);

  const fetchReferralData = async () => {
    setLoading(true);
    try {
      const res = await getReferralReport(startDate, endDate);
      if (res.success) {
        setReport(res.data);
      }
    } catch (err) {
      console.error('Failed to load referral report', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReferralData();
  }, [startDate, endDate]);

  return (
    <div>
      <PageHeader
        title="Referral Doctor Business Share"
        subtitle="Track sales volumes, commission rates, and payables associated with referring physicians"
      />

      {/* Date Filters */}
      <div className="card" style={{ display: 'flex', gap: '16px', marginBottom: '2rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <DatePicker
          label="From Date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          style={{ marginBottom: 0, minWidth: '180px' }}
        />
        <DatePicker
          label="To Date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          style={{ marginBottom: 0, minWidth: '180px' }}
        />
      </div>

      <DataTable
        headers={['Referring Doctor', 'Hospital Clinic', 'Commission Percentage %', 'Gross Bills Generated', 'Calculated Share payable', 'Case Details']}
        data={report}
        loading={loading}
        emptyMessage="No referral doctor billing generated in selected range."
        renderRow={(item) => (
          <tr key={item.doctorId}>
            <td style={{ fontWeight: '600' }}>{item.doctorName}</td>
            <td>{item.clinicHospital || 'Walk-in'}</td>
            <td style={{ fontWeight: '600' }}>{item.commissionPercentage}%</td>
            <td>{formatCurrency(item.totalBillsAmount)}</td>
            <td style={{ fontWeight: '700', color: 'var(--primary-color)' }}>
              {formatCurrency(item.totalCommission)}
            </td>
            <td>
              <button
                className="btn btn-secondary"
                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                onClick={() => setDetailsTarget(item)}
              >
                <Eye size={14} /> View Cases ({item.billsCount})
              </button>
            </td>
          </tr>
        )}
      />

      {/* Details Modal */}
      <Modal
        isOpen={!!detailsTarget}
        onClose={() => setDetailsTarget(null)}
        title={`Billing Cases for ${detailsTarget?.doctorName}`}
      >
        {detailsTarget && (
          <div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Clinic: <strong>{detailsTarget.clinicHospital || 'Walk-in'}</strong> | Commission Rate: <strong>{detailsTarget.commissionPercentage}%</strong>
            </p>
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              <table style={{ width: '100%', fontSize: '0.825rem', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)' }}>
                    <th style={{ padding: '8px' }}>Date</th>
                    <th style={{ padding: '8px' }}>Patient</th>
                    <th style={{ padding: '8px' }}>Bill Number</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Total</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Commission</th>
                  </tr>
                </thead>
                <tbody>
                  {detailsTarget.billsList?.map((bill, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px' }}>{formatDate(bill.date).split(',')[0]}</td>
                      <td style={{ padding: '8px', fontWeight: '500' }}>{bill.patientName}</td>
                      <td style={{ padding: '8px' }}>{bill.billNumber}</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>{formatCurrency(bill.amount)}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: '600', color: 'var(--primary-color)' }}>
                        {formatCurrency(bill.commissionAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ReferralBusiness;
