export const QUICK_ACTIONS = [
  {
    label: 'New Bill',
    path: '/cases/bills/new',
    icon: 'FilePlus',
    description: 'Create a diagnostic billing order',
    roles: ['Admin', 'Employee']
  },
  {
    label: 'Add Patient',
    path: '/cases/patients?add=true',
    icon: 'UserPlus',
    description: 'Register a patient profile',
    roles: ['Admin', 'Employee']
  },
  {
    label: 'Test Database',
    path: '/lab/tests',
    icon: 'PlusCircle',
    description: 'Open test configuration',
    roles: ['Admin']
  },
  {
    label: 'Enter Results',
    path: '/lab/result-entry',
    icon: 'FileEdit',
    description: 'Work through pending lab cases',
    roles: ['Admin', 'Employee']
  },
  {
    label: 'Verify Results',
    path: '/lab/verification',
    icon: 'FileEdit',
    description: 'Review submitted lab results',
    roles: ['Admin']
  },
  {
    label: 'View Reports',
    path: '/lab/reports',
    icon: 'FileEdit',
    description: 'Open the laboratory report workspace',
    roles: ['Admin', 'Employee', 'Doctor']
  },
  {
    label: 'Open USG Cases',
    path: '/usg/today',
    icon: 'Radio',
    description: 'Work with ultrasound cases',
    roles: ['Admin', 'Employee', 'Doctor']
  },
  {
    label: 'Daily Business',
    path: '/business/daily',
    icon: 'TrendingUp',
    description: 'Review today’s business ledger',
    roles: ['Admin']
  },
  {
    label: 'Monthly Business',
    path: '/business/monthly',
    icon: 'TrendingUp',
    description: 'Review a selected month’s business',
    roles: ['Admin']
  },
  {
    label: 'Test Analysis',
    path: '/lab/analysis',
    icon: 'BarChart3',
    description: 'Review catalog and report activity',
    roles: ['Admin', 'Employee']
  },
  {
    label: 'Upload Report',
    path: '/lab/reports?upload=true',
    icon: 'Upload',
    description: 'Attach clinical report findings files',
    roles: ['Admin', 'Employee']
  }
];

export const RECENT_TRANSACTIONS_HEADERS = [
  'Patient',
  'Reg Number',
  'Type',
  'Amount',
  'Method',
  'Date',
  'Actions'
];
