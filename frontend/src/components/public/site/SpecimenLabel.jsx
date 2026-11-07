import React from 'react';
import Code39 from './Code39';

// The card is drawn like the label on a sample tube: lab name and "patient
// copy" on top, the fields in the middle, and a Code 39 barcode that is drawn
// live from the mobile number as it is typed - the same kind of barcode the
// lab prints on every sample. The coloured edge is a row of tube caps.
export default function SpecimenLabel({ code = '', lab = 'Pure Path Lab', kind = 'Patient copy', children, footer, className = '' }) {
  const digits = String(code).replace(/\D/g, '');
  return (
    <div className={`pps-label ${className}`.trim()}>
      <div className="pps-label-caps" aria-hidden="true"><i /><i /><i /><i /><i /></div>
      <div className="pps-label-body">
        <div className="pps-label-head">
          <span className="pps-label-lab">{lab}</span>
          <span className="pps-label-kind">{kind}</span>
        </div>
        {children}
        <div className={`pps-label-code${digits ? ' has-code' : ''}`} aria-hidden="true">
          <Code39 value={digits || '0000000000'} className="pps-barcode" />
          <span className="pps-label-digits">{digits ? `+91 ${digits.padEnd(10, '·')}` : '+91 ··········'}</span>
        </div>
        {footer}
      </div>
    </div>
  );
}
