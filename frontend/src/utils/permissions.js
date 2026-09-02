export const canAccess = (userRole, allowedRoles) => {
  if (!allowedRoles || allowedRoles.length === 0) return true;
  return allowedRoles.includes(userRole);
};

export const isAdmin = (user) => {
  return user && user.role === 'Admin';
};
export const isEmployee = (user) => {
  return user && (user.role === 'Employee' || user.role === 'Admin');
};
