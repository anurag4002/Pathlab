import React, { useState, useEffect, useCallback } from 'react';
import { getJobs, retryJob } from '../../services/jobService';
import { sendMessage } from '../../services/notifyService';
import {
  getFailedDeliveries,
  getDeliveryHistory,
  recordDeliveryAttempt,
} from '../../services/deliveryHistoryService';
import { getLabProfile } from '../../services/setupService';
import { PageHeader, Button, DataTable, Select } from '../../components/common';
import { StatusBadge } from '../../components/common';
import { RotateCcw, AlertTriangle, CheckCircle2, RefreshCw, Server, Smartphone } from 'lucide-react';
import usePagination from '../../hooks/usePagination';
import useClientPagination from '../../hooks/useClientPagination';
import './Jobs.css';

// Job Queue — server-backed (GET /api/jobs, POST /api/jobs/:id/retry) with
// the on-device Phase-7 delivery history as a secondary section. Server
// retries are idempotent (Done jobs return as-is); local retries re-issue
// POST /api/notify/send directly.

const JOB_STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Running', label: 'Running' },
  { value: 'Failed', label: 'Failed' },
  { value: 'Done', label: 'Done' },
];

const jobPayloadSummary = (job) => {
  const p = job?.payload || {};
  return [p.channel, p.templateKey, p.to].filter(Boolean).join(' · ') || '—';
};

const Jobs = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [serverUp, setServerUp] = useState(true);
  const [statusFilter, setStatusFilter] = useState('Failed');
  const { page, limit, goToPage, setLimit } = usePagination(1, 10);
  const [paginationInfo, setPaginationInfo] = useState({ total: 0, pages: 0 });
  const [retryingId, setRetryingId] = useState('');
  const [labName, setLabName] = useState('Pathology Lab');
  const [notice, setNotice] = useState('');
  const [noticeType, setNoticeType] = useState('info');
  const [failed, setFailed] = useState([]);
  const [retryingLocalId, setRetryingLocalId] = useState('');
  const pgLocal = useClientPagination(failed, 10);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getJobs({ status: statusFilter || undefined, page, limit });
      if (res?.success) {
        const list = res.data?.jobs || res.data || [];
        setJobs(Array.isArray(list) ? list : []);
        setPaginationInfo(res.data?.pagination || { total: list.length, pages: 1 });
        setServerUp(true);
      }
    } catch (err) {
      console.error('Failed to load jobs', err);
      setServerUp(false);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page, limit]);

  const refreshLocal = useCallback(() => {
    setFailed(getFailedDeliveries());
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    refreshLocal();
    getLabProfile()
      .then((r) => {
        const profile = r?.data?.profile || r?.data || {};
        if (profile.labName) setLabName(profile.labName);
      })
      .catch(() => { /* keep fallback */ });
  }, [refreshLocal]);

  const flash = (text, type = 'info') => { setNotice(text); setNoticeType(type); };

  const handleRetry = async (job) => {
    const id = job._id || job.id;
    setRetryingId(id);
    flash('');
    try {
      const res = await retryJob(id);
      if (res?.success) {
        const updated = res.data || {};
        flash(
          updated.status === 'Done'
            ? `Job retried successfully — marked Done.`
            : `Retry processed — status is now ${updated.status || 'updated'}.`,
          updated.status === 'Done' ? 'success' : 'info'
        );
        fetchJobs();
      }
    } catch (err) {
      flash(err.response?.data?.message || 'Server retry failed', 'error');
    } finally {
      setRetryingId('');
    }
  };

  const handleLocalRetry = async (job) => {
    setRetryingLocalId(job.id);
    flash('');
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
      flash(ok ? `Retry for ${original.regNo || original.to} sent.` : `Retry for ${original.regNo || original.to} failed.`, ok ? 'success' : 'error');
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
      flash(`Retry for ${job.regNo || job.to} failed: ${message}`, 'error');
    } finally {
      setRetryingLocalId('');
      refreshLocal();
    }
  };

  return (
    <div className="jobs-page">
      <PageHeader
        title="Job Queue"
        subtitle="Background jobs — failed notification sends, retries and device history"
        action={
          <Button variant="secondary" onClick={() => { fetchJobs(); refreshLocal(); }} icon={<RefreshCw size={15} />}>
            Refresh
          </Button>
        }
      />

      {!serverUp && (
        <div className="jobs-alert warning" role="status">
          <AlertTriangle size={16} />
          <span>Server queue unreachable — showing on-device history below. Pull to retry once the API is back.</span>
        </div>
      )}

      {notice && (
        <div className={`jobs-alert ${noticeType}`} role="status">
          {noticeType === 'success' ? <CheckCircle2 size={16} /> : noticeType === 'error' ? <AlertTriangle size={16} /> : null}
          <span>{notice}</span>
        </div>
      )}

      <section className="jobs-card" aria-label="Server job queue">
        <div className="jobs-card-header">
          <span className="jobs-icon-box"><Server size={17} /></span>
          <div>
            <h2 className="jobs-card-title">Server Queue</h2>
            <p className="jobs-card-desc">Live server queue — failed and pending jobs with one-click retry.</p>
          </div>
        </div>
        <div className="jobs-filter-row">
          <div style={{ minWidth: '11rem', maxWidth: '14rem', flex: '0 1 auto' }}>
            <Select
              placeholder="All statuses"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); goToPage(1); }}
              options={JOB_STATUS_OPTIONS}
            />
          </div>
          <span className="jobs-count">{paginationInfo.total} job{paginationInfo.total === 1 ? '' : 's'}</span>
        </div>
        <DataTable
          headers={['Type', 'Detail', 'Status', 'Attempts', 'Error', 'Created', 'Action']}
          data={jobs}
          loading={loading}
          emptyMessage={statusFilter ? `No ${statusFilter.toLowerCase()} jobs.` : 'Queue is clear — no jobs.'}
          emptyTitle="No jobs"
          pagination={{
            total: paginationInfo.total,
            page,
            limit,
            pages: paginationInfo.pages,
            onPageChange: goToPage,
            onLimitChange: setLimit,
          }}
          renderRow={(job) => {
            const id = job._id || job.id;
            const retryable = job.status === 'Failed' || job.status === 'Pending';
            return (
              <tr key={id}>
                <td style={{ fontWeight: 600, textTransform: 'capitalize' }}>{job.type || '—'}</td>
                <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={jobPayloadSummary(job)}>
                  {jobPayloadSummary(job)}
                </td>
                <td><StatusBadge status={job.status} /></td>
                <td style={{ textAlign: 'center' }}>{job.attempts ?? 0}/{job.maxAttempts ?? 3}</td>
                <td style={{ maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={job.error || ''}>{job.error || '—'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{job.createdAt ? new Date(job.createdAt).toLocaleString() : '—'}</td>
                <td>
                  {retryable ? (
                    <Button variant="secondary" size="sm" onClick={() => handleRetry(job)} loading={retryingId === id} icon={<RotateCcw size={14} />}>
                      Retry
                    </Button>
                  ) : (
                    <span className="jobs-muted">—</span>
                  )}
                </td>
              </tr>
            );
          }}
        />
      </section>

      <section className="jobs-card" aria-label="On-device delivery history">
        <div className="jobs-card-header">
          <span className="jobs-icon-box"><Smartphone size={17} /></span>
          <div>
            <h2 className="jobs-card-title">This Device — Failed Sends</h2>
            <p className="jobs-card-desc">Failed sends recorded in this browser — retry them here.</p>
          </div>
        </div>
        <DataTable
          headers={['Reg No', 'Channel', 'Recipient', 'Error', 'Failed At', 'Action']}
          data={pgLocal.paged}
          loading={false}
          emptyMessage="No failed deliveries on this device."
          emptyTitle="All clear"
          pagination={{
            total: pgLocal.total,
            page: pgLocal.page,
            limit: pgLocal.limit,
            pages: pgLocal.pages,
            onPageChange: pgLocal.goToPage,
            onLimitChange: pgLocal.setLimit,
          }}
          renderRow={(job) => (
            <tr key={job.id}>
              <td style={{ fontWeight: '600' }}>{job.regNo || '—'}</td>
              <td style={{ textTransform: 'capitalize' }}>{job.channel}</td>
              <td>{job.to}</td>
              <td style={{ maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={job.error || ''}>{job.error || '—'}</td>
              <td style={{ whiteSpace: 'nowrap' }}>{job.at ? new Date(job.at).toLocaleString() : '—'}</td>
              <td>
                <Button variant="secondary" size="sm" onClick={() => handleLocalRetry(job)} loading={retryingLocalId === job.id} icon={<RotateCcw size={14} />}>
                  Retry
                </Button>
              </td>
            </tr>
          )}
        />
      </section>
    </div>
  );
};

export default Jobs;
