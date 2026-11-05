import React, { useState } from 'react';
import { MessageCircle, Star } from 'lucide-react';
import Button from '../Button/Button';
import { fetchBillQr, fetchReportQr } from '../../../services/publicService';
import { getLabProfile } from '../../../services/setupService';
import './WhatsAppShare.css';

// Lab name and Google review link are needed by every share; load once.
let profileRequest = null;
const loadProfile = () => {
  profileRequest ||= getLabProfile()
    .then((response) => response?.data || response || {})
    .catch(() => { profileRequest = null; return {}; });
  return profileRequest;
};

// Indian 10-digit mobiles get the 91 country code; anything else is used as typed.
const whatsappLink = (phone, text) => {
  const digits = String(phone || '').replace(/\D/g, '').replace(/^0+/, '');
  const number = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
};

const absolute = (url) => (url && url.startsWith('/') ? `${window.location.origin}${url}` : url);

const LABELS = { report: 'WhatsApp', bill: 'WhatsApp', review: 'Google review' };

/**
 * Opens WhatsApp (the installed app on phones/desktop, or WhatsApp Web) with
 * a ready message for the patient: their report or bill link, or the lab's
 * Google review link. Staff just press Send.
 *
 * kind: 'report' | 'bill' | 'review'; id: report or bill id (not for review).
 */
export default function WhatsAppShare({ kind, id, phone, name, billNumber, label, size = 'sm', variant = 'secondary', iconOnly = false, onShared }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const share = async () => {
    setError('');
    // Open the window inside the click so pop-up blockers allow it, then
    // point it at WhatsApp once the link is ready.
    const target = window.open('about:blank', '_blank');
    setBusy(true);
    try {
      const profile = await loadProfile();
      const lab = profile.labName || 'our lab';
      const greeting = name ? `Dear ${name},` : 'Hello,';
      let text;
      if (kind === 'review') {
        if (!profile.googleReviewLink) throw new Error('Add your Google review link in Manage → Lab Profile first.');
        text = `${greeting} thank you for choosing ${lab}. We would be grateful if you could share your experience: ${profile.googleReviewLink}`;
      } else {
        const response = kind === 'bill' ? await fetchBillQr(id) : await fetchReportQr(id);
        const link = absolute(response?.data?.verifyUrl || response?.verifyUrl);
        if (!link) throw new Error('Could not create the share link. Please try again.');
        text = kind === 'bill'
          ? `${greeting} here is your bill${billNumber ? ` ${billNumber}` : ''} from ${lab}: ${link}`
          : `${greeting} your lab report from ${lab} is ready. View or download it here: ${link}`;
      }
      const url = whatsappLink(phone, text);
      if (target) target.location.href = url; else window.location.href = url;
      onShared?.();
    } catch (err) {
      target?.close();
      setError(err.response?.data?.message || err.message || 'Could not open WhatsApp.');
    } finally {
      setBusy(false);
    }
  };

  const text = label || LABELS[kind];
  const Icon = kind === 'review' ? Star : MessageCircle;
  return (
    <span className="wa-share">
      <Button variant={variant} size={size} onClick={share} loading={busy} disabled={busy || (kind !== 'review' && !id)}
        className={kind === 'review' ? 'wa-share-review' : 'wa-share-btn'}
        title={kind === 'review' ? 'Ask for a Google review on WhatsApp' : `Send the ${kind} on WhatsApp`}
        aria-label={kind === 'review' ? `Ask ${name || 'patient'} for a Google review on WhatsApp` : `Send ${kind} to ${name || 'patient'} on WhatsApp`}>
        <Icon size={14} />{iconOnly ? null : <span>{text}</span>}
      </Button>
      {error && <span className="wa-share-error" role="alert">{error}</span>}
    </span>
  );
}
