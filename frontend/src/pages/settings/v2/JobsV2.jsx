import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, RotateCcw } from 'lucide-react';
import { getJobs, retryJob } from '../../../services/jobService';
import { sendMessage } from '../../../services/notifyService';
import { getFailedDeliveries, getDeliveryHistory, recordDeliveryAttempt } from '../../../services/deliveryHistoryService';
import { getLabProfile } from '../../../services/setupService';
import { PageHeader, Button, StatGroup } from '../../../components/common';
import ReportTable from '../../../components/business/ReportTable';
import { notify } from '../../../components/common/Toast/toast';
import { fetchAllPages } from '../../../utils/printReport';
import { dateTimeLabel } from '../../../utils/reportFormat';
import '../../../components/business/business.css';
import '../../manage/v2/manage.css';

const STATUS = {
  Failed: { label: 'Not sent', tone: 'is-bad' },
  Pending: { label: 'Waiting', tone: 'is-warn' },
  Running: { label: 'Sending now', tone: 'is-info' },
  Done: { label: 'Sent', tone: 'is-good' },
};
const CHANNEL = { sms: 'SMS', whatsapp: 'WhatsApp', email: 'Email' };
const channelOf = (c) => CHANNEL[String(c || '').toLowerCase()] || c || 'Message';
const SHOW = [['Failed', 'Not sent'], ['Pending', 'Waiting'], ['Done', 'Sent'], ['', 'All']];

// Unsent messages (new look): SMS / WhatsApp / email that did not go out,
// with "Send again". Two lists: the lab's outbox and this computer's tries.
export default function JobsV2() {
  const [status, setStatus] = useState('Failed');
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [offline, setOffline] = useState(false);
  const [retrying, setRetrying] = useState('');
  const [local, setLocal] = useState([]);
  const [labName, setLabName] = useState('Pathology Lab');
  const [failedCount, setFailedCount] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await fetchAllPages(async (page, limit) => {
        const res = await getJobs({ status: status || undefined, page, limit });
        const list = res?.data?.jobs || res?.data || [];
        return { items: Array.isArray(list) ? list : [], pages: res?.data?.pagination?.pages || 1 };
      }, { pageSize: 50, maxPages: 6 });
      setJobs(all); setOffline(false);
      if (status === 'Failed') setFailedCount(all.length);
    } catch { setOffline(true); setJobs([]); }
    finally { setLoading(false); }
  }, [status]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    setLocal(getFailedDeliveries());
    getLabProfile().then((r) => { const p = r?.data?.profile || r?.data || {}; if (p.labName) setLabName(p.labName); }).catch(() => {});
  }, []);

  const retry = async (job) => {
    const id = job._id || job.id;
    setRetrying(id);
    try {
      const res = await retryJob(id);
      const now = res?.data?.status;
      notify(now === 'Done' ? 'Sent' : `Tried again - now ${STATUS[now]?.label?.toLowerCase() || 'updated'}`);
      load();
    } catch (err) { notify(err.response?.data?.message || 'Could not send. Try again later.'); }
    finally { setRetrying(''); }
  };

  const retryLocal = async (job) => {
    setRetrying(job.id);
    try {
      const original = getDeliveryHistory(job.reportId).find((h) => h.id === job.id) || job;
      const res = await sendMessage({
        channel: original.channel,
        templateKey: original.channel === 'whatsapp' ? 'report-ready-wa' : 'report-ready',
        to: original.to,
        vars: { name: '', regNo: original.regNo || '', url: '', lab: labName },
      });
      const ok = res?.success !== false;
      recordDeliveryAttempt({ reportId: original.reportId, regNo: original.regNo, channel: original.channel, to: original.to, status: ok ? 'sent' : 'failed', error: ok ? '' : (res?.message || 'Not accepted'), response: res });
      notify(ok ? 'Sent' : 'Still could not send');
    } catch (err) {
      recordDeliveryAttempt({ reportId: job.reportId, regNo: job.regNo, channel: job.channel, to: job.to, status: 'failed', error: err.response?.data?.message || 'Retry failed' });
      notify('Still could not send');
    } finally { setRetrying(''); setLocal(getFailedDeliveries()); }
  };

  return (
    <div className="biz-page">
      <PageHeader
        title="Unsent messages"
        subtitle="Report and bill messages (SMS, WhatsApp, email) that did not go out. Check the number and send again."
        action={<Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={() => { load(); setLocal(getFailedDeliveries()); }}>Refresh</Button>}
      />

      <StatGroup loading={loading && failedCount === null} items={[
        { label: 'Not sent', value: String(failedCount ?? '-'), hint: 'Waiting for you to send again', tone: failedCount ? 'warning' : undefined },
        { label: 'Failed on this computer', value: String(local.length), hint: 'Tried from this browser' },
      ]} />

      {offline && <div className="biz-error" role="alert">The message list could not be loaded. Check the internet connection, then refresh.<Button variant="secondary" size="sm" onClick={load}>Try again</Button></div>}

      <section className="biz-section">
        <div className="biz-section-head">
          <h2>Messages</h2>
          <div className="mg-seg" role="group" aria-label="Show">
            {SHOW.map(([value, label]) => (
              <button key={label} type="button" className={status === value ? 'is-on' : ''} aria-pressed={status === value} onClick={() => setStatus(value)}>{label}</button>
            ))}
          </div>
        </div>
        <ReportTable loading={loading} rows={jobs} rowKey={(j) => j._id || j.id}
          empty={status === 'Failed' ? 'Nothing waiting - every message went out.' : 'No messages here.'}
          columns={[
            { key: 'what', label: 'Message', render: (j) => <><div className="mg-name">{channelOf(j.payload?.channel || j.type)}</div><div className="mg-sub">{j.payload?.to ? `To ${j.payload.to}` : (j.type || '')}</div></> },
            { key: 'status', label: 'Status', render: (j) => <span className={`mg-pill ${STATUS[j.status]?.tone || ''}`}>{STATUS[j.status]?.label || j.status}</span> },
            { key: 'tries', label: 'Tries', align: 'right', render: (j) => `${j.attempts ?? 0} of ${j.maxAttempts ?? 3}` },
            { key: 'why', label: 'Why it failed', render: (j) => (j.error ? <span className="mg-sub" title={j.error}>{String(j.error).slice(0, 80)}</span> : <span className="muted">-</span>) },
            { key: 'when', label: 'When', render: (j) => <span className="muted">{j.createdAt ? dateTimeLabel(j.createdAt) : ''}</span> },
            { key: 'act', label: '', align: 'right', render: (j) => ((j.status === 'Failed' || j.status === 'Pending') ? (
              <Button variant="secondary" size="sm" icon={<RotateCcw size={13} />} loading={retrying === (j._id || j.id)} onClick={() => retry(j)}>Send again</Button>
            ) : null) },
          ]} />
      </section>

      <section className="biz-section">
        <div className="biz-section-head">
          <h2>Failed on this computer</h2>
          <p>Messages this browser tried to send and could not.</p>
        </div>
        <ReportTable rows={local} rowKey={(j) => j.id} empty="Nothing failed on this computer."
          columns={[
            { key: 'reg', label: 'Patient reg no', render: (j) => <span className="mg-name">{j.regNo || '-'}</span> },
            { key: 'channel', label: 'Sent by', render: (j) => channelOf(j.channel) },
            { key: 'to', label: 'To', render: (j) => j.to },
            { key: 'why', label: 'Why it failed', render: (j) => <span className="mg-sub" title={j.error || ''}>{String(j.error || '-').slice(0, 80)}</span> },
            { key: 'when', label: 'When', render: (j) => <span className="muted">{j.at ? dateTimeLabel(j.at) : ''}</span> },
            { key: 'act', label: '', align: 'right', render: (j) => <Button variant="secondary" size="sm" icon={<RotateCcw size={13} />} loading={retrying === j.id} onClick={() => retryLocal(j)}>Send again</Button> },
          ]} />
      </section>
    </div>
  );
}
