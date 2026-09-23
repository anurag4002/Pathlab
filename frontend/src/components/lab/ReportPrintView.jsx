import React from 'react';
import formatDate from '../../utils/formatDate';
import { getReportStatusLabel, isSignedStatus } from '../../utils/reportStatus';
import { signatureImageSrc } from '../../utils/signatureUtils';
import QrBlock from './QrBlock';

// Phase 4 + 10 — shared print layout. ReportPreviewModal renders THIS
// component so preview markup and print output cannot diverge. Keep the
// structure mirrored with backend pdfService.reportPdf (header → meta →
// results table → TAT → signatures → QR → footer).
const ReportPrintView = ({ report, qrDataUrl, verifyUrl, signatures = [] }) => {
  if (!report) return null;
  const signed = isSignedStatus(report.status) && (report.signatures || []).length > 0;
  const patient = report.patient || {};
  const results = report.results || [];

  return (
    <div style={{ position: 'relative', fontSize: '0.85rem', color: '#111827' }}>
      {!signed && (
        <div
          style={{
            background: '#fef3c7', border: '1px solid #f59e0b', color: '#92400e',
            padding: '8px 12px', borderRadius: 6, marginBottom: 12, fontWeight: 600,
          }}
          role="note"
        >
          UNSIGNED — PREVIEW ONLY. This report has not been signed and must not be issued.
        </div>
      )}

      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>PURE PATH LAB</div>
        <div style={{ color: '#4b5563' }}>Pathology &amp; Diagnostic Center</div>
      </div>

      <div style={{ display: 'grid', gap: 4, marginBottom: 12 }}>
        <div><strong>Patient:</strong> {patient.name || 'Walk-in Patient'}</div>
        <div><strong>Reg No:</strong> {report.registrationNumber || '—'}</div>
        {report.bill?.billNumber && <div><strong>Bill No:</strong> {report.bill.billNumber}</div>}
        <div><strong>Report Date:</strong> {formatDate(report.reportDate)}</div>
        <div><strong>Status:</strong> {getReportStatusLabel(report.status)}</div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
        <thead>
          <tr style={{ background: '#1f2937', color: '#fff' }}>
            {['Test', 'Result', 'Unit', 'Flag'].map((h) => (
              <th key={h} style={{ textAlign: 'left', padding: '6px 8px', fontSize: '0.8rem' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {results.length === 0 && (
            <tr><td colSpan={4} style={{ padding: 8, color: '#6b7280' }}>No results entered yet.</td></tr>
          )}
          {results.map((r, i) => {
            const abnormal = r.flag === 'H' || r.flag === 'L' || r.flag === 'C';
            return (
              <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '6px 8px', fontWeight: abnormal ? 700 : 400, color: abnormal ? '#b91c1c' : '#111827' }}>
                  {r.testName || r.test?.name || '—'}{r.derived ? ' *' : ''}
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: abnormal ? 700 : 400, color: abnormal ? '#b91c1c' : '#111827' }}>{r.value}</td>
                <td style={{ padding: '6px 8px', color: '#374151' }}>{r.unit || '—'}</td>
                <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 700, color: abnormal ? '#b91c1c' : '#16a34a' }}>
                  {r.flag && r.flag !== 'N' ? `[${r.flag}]` : ''}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {report.tat && (
        <div style={{ fontSize: '0.75rem', color: '#4b5563', marginBottom: 12 }}>
          Registered: {report.tat.registered ? formatDate(report.tat.registered) : '—'}
          {'  '}Collected: {report.tat.collected ? formatDate(report.tat.collected) : '—'}
          {'  '}Received: {report.tat.received ? formatDate(report.tat.received) : '—'}
          {'  '}Reported: {report.tat.reported ? formatDate(report.tat.reported) : '—'}
        </div>
      )}

      {(report.signatures || []).length > 0 && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
          {(report.signatures || []).map((s, i) => {
            const master = (signatures || []).find((m) => String(m._id || m.id) === String(s.signature));
            const src = master ? signatureImageSrc(master) : '';
            return (
              <div key={i} style={{ minWidth: 160 }}>
                {src && (
                  <img src={src} alt="Authorised signature" style={{ height: 48, objectFit: 'contain' }}
                    onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                )}
                <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                  {master?.name || ''}{master?.title ? ` (${master.title})` : ''}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#4b5563' }}>Authorised Signatory</div>
              </div>
            );
          })}
        </div>
      )}

      <QrBlock qrDataUrl={qrDataUrl} verifyUrl={verifyUrl} />

      <div style={{ marginTop: 12, fontSize: '0.72rem', color: '#6b7280', textAlign: 'center' }}>
        Report {report.registrationNumber} • H/L/C flags explained above • Verify via QR
      </div>
    </div>
  );
};

export default ReportPrintView;
