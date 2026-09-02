const formatCurrency = (amount) => {
  const value = Number(amount);
  if (isNaN(value)) return 'INR 0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR'
  }).format(value);
};

export default formatCurrency;
