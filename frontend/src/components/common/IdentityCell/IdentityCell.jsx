import React from 'react';
import CopyButton from '../CopyButton/CopyButton';
import './IdentityCell.css';

const initialsOf = (name) => String(name || '?').replace(/^(mr|mrs|ms|miss|dr|master|baby)\.?\s+/i, '')
  .split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?';

const sexLabel = (gender) => ({ male: 'M', female: 'F', other: 'O' }[String(gender || '').toLowerCase()] || (gender ? String(gender)[0].toUpperCase() : ''));

/**
 * First column of a list (new look): initials, bold name, muted sub-line.
 * - meta: strings/numbers joined with " · " (reg no, bill no, date...)
 * - copy: { value, label } adds a copy button (phone, bill no)
 * - clinical: { age, ageUnit, gender } - on result entry / verification /
 *   reports age and sex are shown prominently next to the name, never
 *   folded away (pathlab-ui skill).
 */
export default function IdentityCell({ name, meta = [], copy, clinical, onClick, title }) {
  const parts = meta.filter((part) => part !== undefined && part !== null && part !== '' && part !== false);
  const ageText = clinical && clinical.age !== undefined && clinical.age !== null && clinical.age !== ''
    ? `${clinical.age} ${String(clinical.ageUnit || 'Y').charAt(0).toUpperCase()}` : '';
  const sex = clinical ? sexLabel(clinical.gender) : '';
  const NameTag = onClick ? 'button' : 'span';
  return (
    <div className="identity-cell">
      <span className="identity-avatar" aria-hidden="true">{initialsOf(name)}</span>
      <span className="identity-text">
        <span className="identity-line">
          <NameTag className={`identity-name${onClick ? ' is-link' : ''}`} {...(onClick ? { type: 'button', onClick, title } : {})}>{name || 'Walk-in patient'}</NameTag>
          {clinical && (ageText || sex) && <span className="identity-clinical" title="Age · Sex">{[ageText, sex].filter(Boolean).join(' · ')}</span>}
        </span>
        {(parts.length > 0 || copy?.value) && (
          <span className="identity-meta">
            {parts.join(' · ')}
            {copy?.value && <>{parts.length ? ' · ' : ''}{copy.value}<CopyButton value={copy.value} label={copy.label || 'value'} /></>}
          </span>
        )}
      </span>
    </div>
  );
}
