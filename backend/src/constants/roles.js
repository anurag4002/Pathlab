const ROLES = {
  ADMIN: 'Admin',
  EMPLOYEE: 'Employee',
  // The lab's own consultant pathologist (staff).
  DOCTOR: 'Doctor',
  // An outside doctor who refers patients ("Referred by" on bills). Sees only
  // their own referred cases through /api/referrer; every staff API refuses it.
  REFERRER: 'Referrer'
};

ROLES.STAFF = [ROLES.ADMIN, ROLES.EMPLOYEE, ROLES.DOCTOR];

module.exports = ROLES;
