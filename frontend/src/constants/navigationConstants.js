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
    title: 'Business',
    icon: 'TrendingUp',
    roles: ['Admin'],
    children: [
      { title: 'Daily Business', path: '/business/daily' },
      { title: 'Expenses', path: '/business/expenses' },
      { title: 'Due Reports', path: '/business/dues' },
      { title: 'Referral Business', path: '/business/referrals' },
      { title: 'Case Wise Report', path: '/business/cases' },
      { title: 'Business Analysis', path: '/business/analysis' },
      { title: 'Data Export', path: '/business/export' },
      { title: 'Activities', path: '/business/activities' }
    ]
  },
  {
    title: 'Cases',
    icon: 'FolderOpen',
    roles: ['Admin', 'Employee'],
    children: [
      { title: 'Bills', path: '/cases/bills' },
      { title: 'Patients', path: '/cases/patients' },
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
      { title: 'Search Reports', path: '/lab/search' },
      { title: 'Test Database', path: '/lab/tests', roles: ['Admin'] },
      { title: 'Test Packages', path: '/lab/packages', roles: ['Admin'] },
      { title: 'Test Panels', path: '/lab/panels', roles: ['Admin'] },
      { title: 'Test Categories', path: '/lab/categories', roles: ['Admin'] },
      { title: 'Interpretations', path: '/lab/interpretations', roles: ['Admin'] },
      { title: 'Test Counts', path: '/lab/counts' }
    ]
  },
  {
    title: 'USG',
    icon: 'Radio',
    roles: ['Admin', 'Employee', 'Doctor'],
    children: [
      { title: "Today's Cases", path: '/usg/today' },
      { title: 'Search Cases', path: '/usg/search' },
      { title: 'Report Templates', path: '/usg/templates', roles: ['Admin'] }
    ]
  },
  {
    title: 'Digital X-Ray',
    icon: 'Layers',
    roles: ['Admin', 'Employee', 'Doctor'],
    children: [
      { title: "Today's Cases", path: '/xray/today' },
      { title: 'Search Cases', path: '/xray/search' },
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
      { title: 'Employee Login', path: '/manage/employees' },
      { title: 'Doctor Access', path: '/manage/doctors' },
      { title: 'Browser Security', path: '/manage/security' },
      { title: 'Lab Profile', path: '/setup/profile' },
      { title: 'Onboarding', path: '/setup/onboarding' },
      { title: 'Templates', path: '/delivery/templates' },
      { title: 'Reviews', path: '/delivery/reviews' },
      { title: 'Tickets', path: '/support/tickets' },
      { title: 'Subscription', path: '/support/subscription' }
    ]
  }
];
