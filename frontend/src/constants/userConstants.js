export const USER_ROLES = [
  { value: 'Admin', label: 'Admin (Clinical Director)' },
  { value: 'Employee', label: 'Employee (Laboratory Staff)' },
  { value: 'Doctor', label: 'Doctor (Consultant Pathologist)' }
];

export const USER_STATUSES = [
  { value: 'Active', label: 'Active' },
  { value: 'Inactive', label: 'Inactive' }
];

// Display names for every role, including the referring-doctor login
// ('Referrer'), which is not created here: it is given from Referral doctors.
export const ROLE_LABELS = {
  Admin: 'Admin',
  Employee: 'Employee',
  Doctor: 'Doctor (Consultant Pathologist)',
  Referrer: 'Referring doctor'
};
