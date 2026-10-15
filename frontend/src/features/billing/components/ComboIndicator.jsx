import React from 'react';

// One pricing explanation for the selected panels/packages.
const ComboIndicator = ({ items = [] }) => {
  const combos = items.filter((i) => i.comboName || i.itemType === 'TestPackage' || i.itemType === 'TestPanel');
  if (combos.length === 0) return null;
  return <p className="bill-bundle-note">Panel and package prices include their listed tests.</p>;
};

export default ComboIndicator;
