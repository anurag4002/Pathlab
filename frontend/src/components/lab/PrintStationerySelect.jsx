import React, { useId } from 'react';
import { Select } from '../common';
export default function PrintStationerySelect({ value, onChange }) {
  const id = useId();
  return <Select id={`stationery-${id}`} label="Preview and download format" placeholder="" value={value} onChange={e => onChange(e.target.value)} options={[
    { value: 'default', label: 'Lab default' }, { value: 'with', label: 'With letterhead' }, { value: 'without', label: 'Without letterhead (preprinted paper)' }
  ]} />;
}
