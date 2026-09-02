export const QUICK_ACTIONS = [
  {
    label: 'New Bill',
    path: '/cases/bills/new',
    icon: 'FilePlus',
    description: 'Compile diagnostic billing orders',
    roles: ['Admin', 'Employee']
  },
  {
    label: 'Add Patient',
    path: '/cases/patients?add=true',
    icon: 'UserPlus',
    description: 'Register new patient profiles',
    roles: ['Admin', 'Employee']
  },
  {
    label: 'Add Test',
    path: '/lab/tests?add=true',
    icon: 'PlusCircle',
    description: 'Add individual pathology test logs',
    roles: ['Admin']
  },
  {
    label: 'Create USG Case',
    path: '/usg/today?new=true',
    icon: 'Radio',
    description: 'Draft findings for ultrasound scans',
    roles: ['Admin', 'Employee', 'Doctor']
  },
  {
    label: 'Upload Report',
    path: '/lab/reports/today?upload=true',
    icon: 'Upload',
    description: 'Attach clinical report findings files',
    roles: ['Admin', 'Employee']
  }
];

export const RECENT_TRANSACTIONS_HEADERS = [
  'Patient',
  'Reg Number',
  'Amount',
  'Method',
  'Date',
  'Actions'
];
