export const SIDEBAR_NAV_ITEMS = [
  {
    title: 'New Bill',
    path: '/cases/bills/new',
    icon: 'FilePlus',
    roles: ['Admin', 'Employee']
  },
  {
    title: 'Dashboard',
    path: '/dashboard',
    icon: 'LayoutDashboard',
    roles: ['Admin', 'Employee', 'Doctor']
  },
  {
    title: 'Google Reviews',
    path: '/reviews',
    icon: 'Star',
    roles: ['Admin', 'Employee']
  },
  {
    title: 'Business',
    icon: 'TrendingUp',
    roles: ['Admin'],
    children: [
      { title: 'Daily Business', v2Title: 'Daily summary', path: '/business/daily' },
      { title: 'Monthly Business', v2Title: 'Monthly summary', path: '/business/monthly' },
      { title: 'Cashbook', v2Title: 'Payments received', path: '/business/cashbook' },
      { title: 'Expenses', v2Title: 'Expenses', path: '/business/expenses' },
      { title: 'Due Reports', v2Title: 'Dues to collect', path: '/business/dues' },
      { title: 'Referral Business', v2Title: 'Doctor commission', path: '/business/referrals' },
      { title: 'Case Wise Report', v2Title: 'All bills report', path: '/business/cases' },
      { title: 'Business Analysis', v2Title: 'Trends', path: '/business/analysis' },
      { title: 'Test Usage', v2Title: 'Test usage', path: '/analytics/test-usage' },
      { title: 'Data Export', v2Title: 'Download data', path: '/business/export' },
      { title: 'Activities', v2Title: 'Activity log', path: '/business/activities' }
    ]
  },
  {
    title: 'Cases',
    icon: 'FolderOpen',
    roles: ['Admin', 'Employee'],
    children: [
      { title: 'Bills', path: '/cases/bills' },
      { title: 'Patients', path: '/cases/patients' },
      { title: 'Booking Inquiries', v2Title: 'Bookings', path: '/cases/inquiries' },
      { title: 'Transactions', path: '/cases/transactions' },
      { title: 'Referral Doctors', v2Title: 'Referral doctors', path: '/cases/doctors' },
      { title: 'Agents', path: '/cases/agents' },
      { title: 'Modality', v2Title: 'Other scans', path: '/cases/modality', roles: ['Admin', 'Employee'] }
    ]
  },
  {
    title: 'Lab',
    icon: 'Activity',
    roles: ['Admin', 'Employee', 'Doctor'],
    children: [
      { title: "Today's Reports", v2Title: "Today's reports", path: '/lab/reports' },
      { title: 'Result Entry', v2Title: 'Result entry', path: '/lab/result-entry' },
      { title: 'Result Verification', v2Title: 'Verification', path: '/lab/verification', roles: ['Admin'] },
      { title: 'Search Reports', v2Title: 'Search reports', path: '/lab/search' }
    ]
  },
  {
    // Catalog and rate setup, kept out of the daily Lab menu.
    title: 'Test Setup',
    icon: 'FlaskConical',
    roles: ['Admin', 'Employee', 'Doctor'],
    children: [
      { title: 'Test Database', v2Title: 'Tests', path: '/lab/tests', roles: ['Admin'] },
      { title: 'Normal Ranges', v2Title: 'Normal ranges', path: '/lab/normal-ranges', roles: ['Admin'] },
      { title: 'Test Packages', v2Title: 'Packages', path: '/lab/packages', roles: ['Admin'] },
      { title: 'Rate Revision', v2Title: 'Change prices', path: '/settings/rate-revision', roles: ['Admin'] },
      { title: 'Test Panels', v2Title: 'Panels', path: '/lab/panels', roles: ['Admin'] },
      { title: 'Test Categories', v2Title: 'Categories', path: '/lab/categories', roles: ['Admin'] },
      { title: 'Interpretations', path: '/lab/interpretations', roles: ['Admin', 'Employee'] },
      { title: 'Test Counts', v2Title: 'Test counts', path: '/lab/counts' },
      { title: 'Test Analysis', v2Title: 'Test analysis', path: '/lab/analysis', roles: ['Admin', 'Employee'] },
      { title: 'Rate List', v2Title: 'Rate list', path: '/lab/rates', roles: ['Admin'] }
    ]
  },
  {
    title: 'USG',
    icon: 'Radio',
    roles: ['Admin', 'Employee', 'Doctor'],
    children: [
      { title: 'Cases', v2Title: 'USG cases', path: '/usg/today' },
      { title: 'USG Reports', v2Title: 'USG reports', path: '/usg/reports' },
      { title: 'Report Templates', v2Title: 'Report templates', path: '/usg/templates', roles: ['Admin'] }
    ]
  },
  {
    title: 'Digital X-Ray',
    icon: 'Layers',
    roles: ['Admin', 'Employee', 'Doctor'],
    children: [
      { title: 'Cases', v2Title: 'X-ray cases', path: '/xray/today' },
      { title: 'X-Ray Reports', v2Title: 'X-ray reports', path: '/xray/reports' }
    ]
  },
  {
    title: 'Doctor',
    icon: 'Stethoscope',
    roles: ['Doctor'],
    children: [
      { title: 'My Cases', v2Title: 'My patients', path: '/doctor' }
    ]
  },
  {
    title: 'Manage',
    icon: 'Settings',
    roles: ['Admin'],
    children: [
      { title: 'User Management', v2Title: 'Staff', path: '/manage/employees' },
      { title: 'Branches', path: '/manage/branches' },
      { title: 'Audit Log', v2Title: 'Audit log', path: '/settings/audit-log' },
      { title: 'Doctor Access', v2Title: 'Doctor access', path: '/manage/doctors' },
      { title: 'Browser Security', v2Title: 'Approved computers', path: '/manage/security' },
      { title: 'Lab Profile', v2Title: 'Lab profile', path: '/setup/profile' },
      { title: 'Job Queue', v2Title: 'Unsent messages', path: '/settings/jobs' },
      { title: 'Onboarding', v2Title: 'Getting started', path: '/setup/onboarding' },
      { title: 'Templates', v2Title: 'Message wording', path: '/delivery/templates' },
      { title: 'Tickets', v2Title: 'Help requests', path: '/support/tickets' }
    ]
  }
];
