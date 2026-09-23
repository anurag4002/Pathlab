import React, { useState } from 'react';
import { PenLine } from 'lucide-react';
import { signUSGCase } from '../../services/usgService';
import { signXrayCase } from '../../services/xrayService';

/**
 * InlineSignButton (Phase 13) — sign-off directly from the case list.
 * USG: POST /api/usg/cases/:id/sign. X-ray: POST /api/xray/cases/:id/sign
 * (pass modality="xray"). Idempotent: disables while signing and hides
 * itself once the case reports a signed/completed state.
 */
const InlineSignButton = ({ caseId, modality = 'usg', signed = false, onSigned, size = 'sm' }) => {
  const [signing, setSigning] = useState(false);

  if (signed) return null;

  const handleSign = async () => {
    if (signing || !caseId) return;
    setSigning(true);
    try {
      const res = modality === 'xray' ? await signXrayCase(caseId) : await signUSGCase(caseId);
      if (res?.success !== false && onSigned) onSigned(res.data);
    } catch (err) {
      alert(err?.response?.data?.message || 'Sign-off failed');
    } finally {
      setSigning(false);
    }
  };

  return (
    <button
      className="btn btn-primary"
      style={{ padding: size === 'sm' ? '4px 8px' : undefined, fontSize: size === 'sm' ? '0.75rem' : undefined }}
      onClick={handleSign}
      disabled={signing}
      title="Sign off this case"
    >
      <PenLine size={14} /> {signing ? 'Signing…' : 'Sign'}
    </button>
  );
};

export default InlineSignButton;
