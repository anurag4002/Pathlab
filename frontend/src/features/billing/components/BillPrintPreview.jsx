import React from 'react';
import { Modal, Button } from '../../../components/common';
import formatCurrency from '../../../utils/formatCurrency';
import formatDate from '../../../utils/formatDate';
import '../Billing.css';

const BillPrintPreview = ({ isOpen, onClose, bill }) => {
  const footer = (
    <>
      <Button variant="secondary" onClick={onClose}>
        Close
      </Button>
      <Button variant="primary" onClick={() => window.print()}>
        Print Document
      </Button>
    </>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Invoice Print Preview" footer={footer} size="lg">
      {bill && (
        <div className="print-invoice-area printable-area">
          {/* Lab Header */}
          <div className="print-invoice-header">
            <img
              src="/logo.jpg"
              alt="Pure Path Lab Logo"
              style={{ width: '3rem', height: '3rem', borderRadius: '50%', marginBottom: 'var(--space-2)', objectFit: 'cover' }}
            />
            <h2 style={{ margin: 0, fontWeight: 700, fontSize: '1.25rem' }}>PURE PATH LAB</h2>
            <p style={{ margin: '2px 0', fontSize: 'var(--font-size-sm)' }}>Pathology &amp; Diagnostic Center</p>
            <p style={{ margin: '2px 0', fontSize: 'var(--font-size-xs)' }}>Ph: +91 98765 43210 | Sector 15, Dwarka, New Delhi</p>
          </div>
          <hr className="print-invoice-divider" />

          {/* Patient & Bill Grid */}
          <div className="print-invoice-grid">
            <div>
              <strong>Patient Name:</strong> {bill.patient?.name}<br />
              <strong>Age / Gender:</strong> {bill.patient?.age} Yrs / {bill.patient?.gender}<br />
              <strong>Reg Number:</strong> {bill.patient?.registrationNumber}
            </div>
            <div style={{ textAlign: 'right' }}>
              <strong>Bill Number:</strong> {bill.billNumber}<br />
              <strong>Date:</strong> {formatDate(bill.date)}<br />
              <strong>Doc Referral:</strong> {bill.referringDoctor?.name || 'Self'}
            </div>
          </div>
          <hr className="print-invoice-divider" />

          {/* Items Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 'var(--space-4)' }}>
            <thead>
              <tr style={{ borderBottom: '1px dashed #000' }}>
                <th style={{ padding: '4px 0', textAlign: 'left' }}>Test Description</th>
                <th style={{ padding: '4px 0', textAlign: 'right' }}>Price</th>
              </tr>
            </thead>
            <tbody>
              {bill.items?.map((item, idx) => (
                <tr key={idx}>
                  <td style={{ padding: '4px 0' }}>{item.name}</td>
                  <td style={{ padding: '4px 0', textAlign: 'right' }}>{formatCurrency(item.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <hr className="print-invoice-divider" />

          {/* Totals */}
          <div className="print-invoice-summary">
            <div>Gross Subtotal: {formatCurrency(bill.totalAmount + bill.discount)}</div>
            {bill.discount > 0 && <div>Discount Applied: -{formatCurrency(bill.discount)}</div>}
            <div style={{ fontWeight: 700 }}>Net Total Amount: {formatCurrency(bill.totalAmount)}</div>
            <div style={{ color: 'green' }}>Paid Amount: {formatCurrency(bill.paidAmount)}</div>
            {bill.dueAmount > 0 && (
              <div style={{ color: 'red', fontWeight: 700 }}>Due Balance: {formatCurrency(bill.dueAmount)}</div>
            )}
            <div>Payment Mode: {bill.paymentMethod}</div>
          </div>

          <hr className="print-invoice-divider" style={{ marginTop: 'var(--space-4)' }} />
          <p style={{ textAlign: 'center', fontSize: 'var(--font-size-xs)', margin: 0 }}>
            *** Thank You for Choosing Pure Path Lab ***
          </p>
        </div>
      )}
    </Modal>
  );
};

export default BillPrintPreview;
