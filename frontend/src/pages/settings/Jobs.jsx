import React, { useState, useEffect, useCallback } from 'react';
import { sendMessage } from '../../services/notifyService';
import {
  getFailedDeliveries,
  getDeliveryHistory,
  recordDeliveryAttempt,
} from '../../services/deliveryHistoryService';
import { getLabProfile } from '../../services/setupService';
import { PageHeader, Button, DataTable } from '../../components/common';
import { StatusBadge } from '../../components/common';
import { RotateCcw, AlertTriangle } from 'lucide-react';

// Phase 27 — Failed Job / Retry Dashboard.
// GET /api/jobs + retry do NOT exist on the backend, so this screen renders
// the real failed sends recorded by the Phase-7 local delivery history as its
// data source (no fabricated server data). Retries re-issue POST /api/notify/send.

const JobStatusBadge = ({ status }) => (
  <StatusBadge status={status === 'failed' ? 'Failed' : status} variant={status === 'failed' ? 'danger' : 'warning'} />
);

const RetryButton = ({ onRetry, loading, disabled }) => (
  <Button variant="secondary" size="sm" onClick={onRetry} loading={loading} disabled={disabled}>
    <RotateCcw size={14} /> Retry
  </Button>
);

const Jobs = () => {
  const [failed, setFailed] = useState([]);
  const [retryingId, setRetryingId] = useState('');
  const [labName, setLabName] = useState('Pathology Lab');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(() => {
    setFailed(getFailedDeliveries());
  }, []);

  useEffect(() => {
    refresh();
    getLabProfile()
      .then((r) => {
        const profile = r?.data?.profile || r?.data || {};
        if (profile.labName) setLabName(profile.labName);
      })
      .catch(() => { /* keep fallback */ });
  }, [refresh]);

  const handleRetry = async (job) => {
    setRetryingId(job.id);
    setNotice('');
    try {
      const history = getDeliveryHistory(job.reportId);
      const original = history.find((h) => h.id === job.id) || job;
      const res = await sendMessage({
        channel: original.channel,
        templateKey: original.channel === 'whatsapp' ? 'report-ready-wa' : 'report-ready',
        to: original.to,
        vars: { name: '', regNo: original.regNo || '', url: '', lab: labName },
      });
      const ok = res?.success !== false;
      recordDeliveryAttempt({
        reportId: original.reportId,
        regNo: original.regNo,
        channel: original.channel,
        to: original.to,
        status: ok ? 'sent' : 'failed',
        error: ok ? '' : (res?.message || 'Retry rejected by server'),
        response: res,
      });
      setNotice(ok ? `Retry for ${original.regNo || original.to} sent.` : `Retry for ${original.regNo || original.to} failed.`);
    } catch (err) {
      const message = err.response?.data?.message || 'Retry failed';
      recordDeliveryAttempt({
        reportId: job.reportId,
        regNo: job.regNo,
        channel: job.channel,
        to: job.to,
        status: 'failed',
        error: message,
      });
      setNotice(`Retry for ${job.regNo || job.to} failed: ${message}`);
    } finally {
      setRetryingId('');
      refresh();
    }
  };

  return (
    <div>
      <PageHeader
        title="Failed Jobs / Retry Queue"
        subtitle="Notification sends that did not go through — retry them from here"
      />

      <div className="card" style={{ borderLeft: '4px solid var(--color-warning, #d97706)', marginBottom: '1rem', fontSize: '0.85rem' }}>
        <AlertTriangle size={14} /> Server job queue is pending: GET /api/jobs and POST /api/jobs/:id/retry do not
        exist on the backend yet. This table shows real failed sends recorded on this device (Phase-7 delivery
        history). Retries call POST /api/notify/send directly.
      </div>

      {notice && (
        <div className="card" style={{ marginBottom: '1rem', fontSize: '0.85rem' }} role="status">{notice}</div>
      )}

      <div className="card">
        <DataTable
          headers={['Reg No', 'Channel', 'Recipient', 'Error', 'Failed At', 'Status', 'Action']}
          data={failed}
          loading={false}
          emptyMessage="No failed deliveries — the queue is clear."
          emptyTitle="No failed jobs"
          renderRow={(job) => (
            <tr key={job.id}>
              <td style={{ fontWeight: '600' }}>{job.regNo || '—'}</td>
              <td style={{ textAlign: 'center' }}>{job.channel}</td>
              <td style={{ textAlign: 'center' }}>{job.to}</td>
              <td style={{ maxWidth: '280px' }}>{job.error || '—'}</td>
              <td style={{ textAlign: 'center' }}>{job.at ? new Date(job.at).toLocaleString() : '—'}</td>
              <td style={{ textAlign: 'center' }}><JobStatusBadge status="failed" /></td>
              <td>
                <RetryButton onRetry={() => handleRetry(job)} loading={retryingId === job.id} />
              </td>
            </tr>
          )}
        />
      </div>
    </div>
  );
};

export default Jobs;
