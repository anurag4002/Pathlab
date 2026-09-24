const normalizePermissions = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.entries(value).reduce((result, [key, enabled]) => {
    if (typeof key === 'string' && key.trim() && typeof enabled === 'boolean') {
      result[key] = enabled;
    }
    return result;
  }, {});
};

export default normalizePermissions;
