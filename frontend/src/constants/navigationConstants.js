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
      { title: 'Booking Inquiries', path: '/cases/inquiries' },
      { title: 'Transactions', path: '/cases/transactions' },
      { title: 'Referral Doctors', path: '/cases/doctors' },
      { title: 'Agents', path: '/cases/agents' },
      { title: 'Modality', path: '/cases/modality', roles: ['Admin', 'Employee'] }
    ]
  },
  {
    title: 'Lab',
    icon: 'Activity',
    roles: ['Admin', 'Employee', 'Doctor'],
    children: [
      { title: "Today's Reports", path: '/lab/reports' },
      { title: 'Result Entry', path: '/lab/result-entry' },
      { title: 'Result Verification', path: '/lab/verification', roles: ['Admin'] },
      { title: 'Search Reports', path: '/lab/search' }
    ]
  },
  {
    // Catalog and rate setup, kept out of the daily Lab menu.
    title: 'Test Setup',
    icon: 'FlaskConical',
    roles: ['Admin', 'Employee', 'Doctor'],
    children: [
      { title: 'Test Database', path: '/lab/tests', roles: ['Admin'] },
      { title: 'Normal Ranges', path: '/lab/normal-ranges', roles: ['Admin'] },
      { title: 'Test Packages', path: '/lab/packages', roles: ['Admin'] },
      { title: 'Rate Revision', path: '/settings/rate-revision', roles: ['Admin'] },
      { title: 'Test Panels', path: '/lab/panels', roles: ['Admin'] },
      { title: 'Test Categories', path: '/lab/categories', roles: ['Admin'] },
      { title: 'Interpretations', path: '/lab/interpretations', roles: ['Admin', 'Employee'] },
      { title: 'Test Counts', path: '/lab/counts' },
      { title: 'Test Analysis', path: '/lab/analysis', roles: ['Admin', 'Employee'] },
      { title: 'Rate List', path: '/lab/rates', roles: ['Admin'] }
    ]
  },
  {
    title: 'USG',
    icon: 'Radio',
    roles: ['Admin', 'Employee', 'Doctor'],
    children: [
      { title: 'Cases', path: '/usg/today' },
      { title: 'USG Reports', path: '/usg/reports' },
      { title: 'Report Templates', path: '/usg/templates', roles: ['Admin'] }
    ]
  },
  {
    title: 'Digital X-Ray',
    icon: 'Layers',
    roles: ['Admin', 'Employee', 'Doctor'],
    children: [
      { title: 'Cases', path: '/xray/today' },
      { title: 'X-Ray Reports', path: '/xray/reports' }
    ]
  },
  {
    title: 'Doctor',
    icon: 'Stethoscope',
    roles: ['Doctor'],
    children: [
      { title: 'My Cases', path: '/doctor' }
    ]
  },
  {
    title: 'Manage',
    icon: 'Settings',
    roles: ['Admin'],
    children: [
      { title: 'User Management', path: '/manage/employees' },
      { title: 'Branches', path: '/manage/branches' },
      { title: 'Audit Log', path: '/settings/audit-log' },
      { title: 'Doctor Access', path: '/manage/doctors' },
      { title: 'Browser Security', path: '/manage/security' },
      { title: 'Lab Profile', path: '/setup/profile' },
      { title: 'Job Queue', path: '/settings/jobs' },
      { title: 'Onboarding', path: '/setup/onboarding' },
      { title: 'Templates', path: '/delivery/templates' },
      { title: 'Tickets', path: '/support/tickets' }
    ]
  }
];
