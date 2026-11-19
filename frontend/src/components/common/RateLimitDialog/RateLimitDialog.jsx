import React, { useEffect, useState } from 'react';
import { Clock3 } from 'lucide-react';
import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import { RATE_LIMIT_EVENT } from '../../../services/apiClient';
import './RateLimitDialog.css';

const remaining = (retryAt) => Math.max(0, Math.ceil((retryAt - Date.now()) / 1000));
const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

// Shown when the server answers "Too many requests" (HTTP 429): explains
// what happened, counts down until the device may try again, and reloads
// the page on "Try again" so empty lists fill in.
export default function RateLimitDialog() {
  const [notice, setNotice] = useState(null); // { message, retryAt }
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    const onLimit = (event) => {
      setNotice((current) => current || event.detail);
      setSecondsLeft(remaining(event.detail.retryAt));
    };
    window.addEventListener(RATE_LIMIT_EVENT, onLimit);
    return () => window.removeEventListener(RATE_LIMIT_EVENT, onLimit);
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setInterval(() => setSecondsLeft(remaining(notice.retryAt)), 1000);
    return () => clearInterval(timer);
  }, [notice]);

  if (!notice) return null;
  const close = () => setNotice(null);
  const ready = secondsLeft === 0;

  return (
    <Modal
      isOpen
      onClose={close}
      title="Please wait a moment"
      footer={(
        <>
          <Button variant="secondary" onClick={close}>Close</Button>
          <Button onClick={() => window.location.reload()} disabled={!ready}>
            {ready ? 'Try again' : `Try again in ${clock(secondsLeft)}`}
          </Button>
        </>
      )}
    >
      <div className="rate-limit-dialog">
        <Clock3 size={28} aria-hidden="true" className="rate-limit-dialog-icon" />
        <div>
          <p className="rate-limit-dialog-lead">{notice.message}</p>
          <p className="rate-limit-dialog-help">
            Too many requests reached the server from this device in a short time, so it is pausing them for a while.
            Your data is safe: nothing was deleted or lost. Pages may look empty until you try again.
          </p>
        </div>
      </div>
    </Modal>
  );
}
