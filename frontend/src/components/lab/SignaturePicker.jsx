import React, { useEffect, useMemo } from 'react';
import { Select } from '../common';
import { signatureDepartments, isSignatureActive, signatureImageSrc, autoSelectSignatureId } from '../../utils/signatureUtils';

// Phase 15 — SignaturePicker. Sources from /api/setup/signatures (never from
// lab-profile pathologist fields — LabProfile has no pathologist fields).
// Auto-selects the first active signature assigned to `department`.
const SignaturePicker = ({
  signatures = [],
  value,
  onChange,
  department = '',
  disabled = false,
  label = 'Signature',
}) => {
  const dept = String(department || '').trim();

  const options = useMemo(
    () =>
      (signatures || []).map((s) => {
        const depts = signatureDepartments(s);
        const tag = depts.length ? ` — ${depts.join(', ')}` : '';
        const inactive = isSignatureActive(s) ? '' : ' (inactive)';
        return {
          value: String(s._id || s.id),
          label: `${s.name || 'Unnamed'}${s.title ? ` (${s.title})` : ''}${tag}${inactive}`,
        };
      }),
    [signatures]
  );

  // Auto-select by department when nothing is chosen yet.
  useEffect(() => {
    if (value || !dept || !signatures?.length) return;
    const auto = autoSelectSignatureId(signatures, dept);
    if (auto) onChange?.({ target: { value: auto } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dept, signatures]);

  const selected = (signatures || []).find((s) => String(s._id || s.id) === String(value));
  const preview = selected ? signatureImageSrc(selected) : '';

  return (
    <div style={{ flex: 1 }}>
      <Select
        label={dept ? `${label} (auto: ${dept})` : label}
        value={value}
        onChange={onChange}
        options={options}
        placeholder={signatures.length ? 'Select signature' : 'No signatures configured'}
        disabled={disabled || !signatures.length}
        style={{ flex: 1 }}
      />
      {selected && preview ? (
        <img
          src={preview}
          alt={`Signature of ${selected.name || ''}`}
          style={{ height: 40, marginTop: 4, border: '1px solid #e5e7eb', background: '#fff' }}
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      ) : null}
      {!signatures.length && (
        <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 4 }}>
          No signatures yet — an Admin can add them at Settings → Signatures.
        </p>
      )}
    </div>
  );
};

export default SignaturePicker;
