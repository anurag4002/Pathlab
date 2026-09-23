import React, { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { Button, EmptyState } from '../common';
import { addReportComment } from '../../services/reportService';

// Phase 3 — CommentThread. Backend LIVE: POST /api/reports/:id/comments.
const CommentThread = ({ comments = [], reportId, onPosted }) => {
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePost = async () => {
    const body = draft.trim();
    if (!body || loading || !reportId) return;
    setLoading(true);
    setError('');
    try {
      const res = await addReportComment(reportId, body);
      setDraft('');
      onPosted?.(res.data || res);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to post comment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: 16 }}>
      <h4 style={{ fontSize: '0.85rem', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
        <MessageSquare size={14} /> Comments
      </h4>
      {(!comments || comments.length === 0) ? (
        <EmptyState title="No comments yet" message="Start the discussion between technician and pathologist." />
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
          {comments.map((c, i) => (
            <li key={c._id || i} style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 12px' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{c.authorName || c.author?.name || c.author || '—'}</div>
              <div style={{ fontSize: '0.85rem' }}>{c.text || c.body}</div>
            </li>
          ))}
        </ul>
      )}
      {error && <p style={{ fontSize: '0.8rem', color: '#b91c1c' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handlePost(); }}
          placeholder="Write a comment…"
          style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db' }}
        />
        <Button variant="secondary" size="sm" onClick={handlePost} loading={loading} disabled={!draft.trim()}>Post</Button>
      </div>
    </div>
  );
};

export default CommentThread;
