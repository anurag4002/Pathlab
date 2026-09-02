const validateBill = (data) => {
  const errors = {};

  if (!data.patient) {
    errors.patient = 'Patient ID is required';
  }

  if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
    errors.items = 'Invoice must contain at least one item (test, package or panel)';
  } else {
    data.items.forEach((item, index) => {
      if (!item.itemId) {
        errors[`items.${index}.itemId`] = 'Item ID is required';
      }
      if (!item.itemType || !['Test', 'TestPackage', 'TestPanel'].includes(item.itemType)) {
        errors[`items.${index}.itemType`] = 'Valid item type (Test/TestPackage/TestPanel) is required';
      }
      if (!item.name || item.name.trim() === '') {
        errors[`items.${index}.name`] = 'Item name is required';
      }
      if (item.price === undefined || item.price === null || isNaN(item.price) || item.price < 0) {
        errors[`items.${index}.price`] = 'Item price must be a positive number';
      }
    });
  }

  if (data.discount !== undefined && data.discount !== null && data.discount !== '') {
    const disc = Number(data.discount);
    if (isNaN(disc) || disc < 0) {
      errors.discount = 'Discount must be a positive number';
    }
  }

  if (data.paidAmount !== undefined && data.paidAmount !== null && data.paidAmount !== '') {
    const paid = Number(data.paidAmount);
    if (isNaN(paid) || paid < 0) {
      errors.paidAmount = 'Paid amount must be a positive number';
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
