import useAuth from './useAuth';

// Phase 25 — granular permission hook.
// Reads user.permissions which the backend stores as a Map (serialized
// as an object over the wire, or as a Map-like on the server). Admin
// implies all permissions. UI gating is cosmetic only — the server
// still enforces via permissionMiddleware / authorize.
export const PERMISSION_KEYS = ['billing', 'reports', 'rates', 'finance', 'settings', 'patients', 'delivery'];

const readPerm = (permissions, key) => {
  if (!permissions) return false;
  if (typeof permissions.get === 'function') {
    try {
      return !!permissions.get(key);
    } catch (e) {
      return false;
    }
  }
  return !!permissions[key];
};

const usePermission = (key) => {
  const { user } = useAuth();
  if (!user) return false;
  if (user.role === 'Admin' || user.role === 'superadmin') return true;
  const perms = user.permissions;
  const keys = perms
    ? (typeof perms.keys === 'function' ? Array.from(perms.keys()) : Object.keys(perms))
    : [];
  // Legacy behaviour: no matrix configured yet -> allow (server does the same).
  if (keys.length === 0) return true;
  if (!key) return false;
  return readPerm(perms, key);
};

export const usePermissions = () => {
  const { user } = useAuth();
  const can = (key) => {
    if (!user) return false;
    if (user.role === 'Admin' || user.role === 'superadmin') return true;
    const perms = user.permissions;
    const keys = perms
      ? (typeof perms.keys === 'function' ? Array.from(perms.keys()) : Object.keys(perms))
      : [];
    if (keys.length === 0) return true;
    return readPerm(perms, key);
  };
  return { can, permissions: user?.permissions || {}, role: user?.role };
};

export default usePermission;
