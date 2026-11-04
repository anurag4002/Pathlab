import React from 'react';

export default function DifferentialTotalRow({ total, withFlagColumn = false }) {
  if (!total) return null;
  return (
    <tr className={`re-differential-total re-differential-${total.status}`}>
      <td><strong>Differential count total</strong></td>
      {withFlagColumn && <td />}
      <td>
        <output aria-label="Differential leucocyte total" aria-live="polite">{total.value}</output>
        <p className="form-helper">{total.message}</p>
      </td>
      <td className="re-unit">%</td>
      <td className="re-range">100</td>
    </tr>
  );
}
