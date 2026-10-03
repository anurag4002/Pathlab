const validateBill = (data) => {
  const errors = {};
  const ALLOWED_TYPES = ['Test', 'TestPackage', 'TestPanel', 'Custom'];

  if (!data.patient) {
    errors.patient = 'Patient ID is required';
  }

  if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
    errors.items = 'Invoice must contain at least one item (test, package, panel or outsource test)';
  } else {
    data.items.forEach((item, index) => {
      const type = item.itemType;
      if (!type || !ALLOWED_TYPES.includes(type)) {
        errors[`items.${index}.itemType`] = 'Valid item type (Test/TestPackage/TestPanel/Custom) is required';
      }
      // Catalog lines need an id; Custom (outsource) lines are name + rate only.
      if (type !== 'Custom' && !item.itemId) {
        errors[`items.${index}.itemId`] = 'Item ID is required';
      }
      if (!item.name || String(item.name).trim() === '') {
        errors[`items.${index}.name`] = 'Item name is required';
      }
      const priceNum = Number(item.price);
      if (item.price === undefined || item.price === null || item.price === '' || Number.isNaN(priceNum) || priceNum < 0) {
        errors[`items.${index}.price`] = 'Item price must be a non-negative number';
      }
    });
  }

  if (data.discount !== undefined && data.discount !== null && data.discount !== '') {
    const disc = Number(data.discount);
    if (Number.isNaN(disc) || disc < 0) {
      errors.discount = 'Discount must be a non-negative number';
    }
  }

  if (data.paidAmount !== undefined && data.paidAmount !== null && data.paidAmount !== '') {
    const paid = Number(data.paidAmount);
    if (Number.isNaN(paid) || paid < 0) {
      errors.paidAmount = 'Paid amount must be a non-negative number';
    }
  }

  if (data.paymentMethod && !['Cash', 'Card', 'UPI', 'Insurance'].includes(data.paymentMethod)) {
    errors.paymentMethod = 'Invalid payment method selected';
  }

  return {
    errors,
    isValid: Object.keys(errors).length === 0
  };
};

module.exports = {
  validateBill
};
